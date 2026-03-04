// FILE: src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type SallaWebhookBody = {
  event: string;
  merchant?: number;
  created_at?: string;
  data?: any;
};

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function supabaseAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL"); // مثال: https://xxxx.supabase.co
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY"); // service role
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getStoreEmailFromSalla(accessToken: string) {
  const res = await fetch("https://api.salla.dev/admin/v2/store/info", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok)
    throw new Error(`Salla store info failed: ${res.status} ${text}`);

  const json = JSON.parse(text);

  const email =
    json?.data?.email ||
    json?.data?.store?.email ||
    json?.email ||
    json?.store?.email;

  const name =
    json?.data?.name ||
    json?.data?.store_name ||
    json?.data?.store?.name ||
    json?.name ||
    json?.store?.name;

  if (!email) throw new Error("Could not read store email from Salla response");

  return { email: String(email), name: name ? String(name) : null, raw: json };
}

async function ensureUserByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  // 1) جرّب invite (يرسل Magic Link من Supabase)
  const inv = await sb.auth.admin.inviteUserByEmail(email);
  if (inv.error) {
    // بعض الحالات يرجع error "User already registered" أو غيره
    console.warn("[salla:webhook] invite error", inv.error);
  }
  if (inv.data?.user) return inv.data.user;

  // 2) fallback: ابحث في قائمة المستخدمين (خففناها قدر الإمكان)
  // ملاحظة: لو عندك عدد مستخدمين كبير لاحقًا بنسوي جدول mapping ونوقف listUsers
  const list = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw list.error;

  const existing = list.data.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (!existing)
    throw new Error(`Could not find or invite user for email: ${email}`);
  return existing;
}

export async function POST(req: NextRequest) {
  try {
    // ENV check (للـ logs)
    console.log("[salla:webhook] env check", {
      hasWebhookSecret: !!process.env.SALLA_WEBHOOK_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    // 1) تحقق webhook secret (Token strategy)
    const sentAuth = getHeader(req, "authorization");
    const expected = mustEnv("SALLA_WEBHOOK_SECRET");
    if (sentAuth !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized webhook" },
        { status: 401 },
      );
    }

    // 2) body
    const body = (await req.json()) as SallaWebhookBody;

    // 3) Supabase admin
    const sb = supabaseAdmin();

    // =====================================================
    // AUTHORIZE
    // =====================================================
    if (body.event === "app.store.authorize") {
      const merchantId = body.merchant;
      const accessToken = body.data?.access_token;
      const refreshToken = body.data?.refresh_token;
      const expires = body.data?.expires; // epoch seconds غالبًا
      const scope = body.data?.scope;

      if (!merchantId || !accessToken) {
        return NextResponse.json(
          { ok: false, error: "Missing merchant/token" },
          { status: 400 },
        );
      }

      // A) بيانات المتجر (ايميل + اسم)
      const store = await getStoreEmailFromSalla(String(accessToken));
      const merchantIdStr = String(merchantId);

      // B) هل عندنا installation سابق؟ إذا ايه خذ tenant_id نفسه
      const existingInst = await sb
        .from("salla_installations")
        .select("id, tenant_id")
        .eq("merchant_id", merchantIdStr)
        .maybeSingle();

      if (existingInst.error) throw existingInst.error;

      let tenantId: string;

      if (existingInst.data?.tenant_id) {
        tenantId = existingInst.data.tenant_id as string;
      } else {
        // أول مرة: أنشئ Tenant
        const tenantName = store.name || `Store ${merchantIdStr}`;
        const tIns = await sb
          .from("tenants")
          .insert({ name: tenantName })
          .select("id")
          .single();
        if (tIns.error) throw tIns.error;
        tenantId = tIns.data.id as string;
      }

      // C) upsert installation (merchant_id unique)
      const instUp = await sb
        .from("salla_installations")
        .upsert(
          {
            tenant_id: tenantId,
            merchant_id: merchantIdStr,
            store_name: store.name || `Store ${merchantIdStr}`,
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "merchant_id" },
        )
        .select("id, tenant_id")
        .single();

      if (instUp.error) throw instUp.error;
      const installationId = instUp.data.id as string;

      // D) upsert tokens
      const accessExpiresAt =
        typeof expires === "number"
          ? new Date(expires * 1000).toISOString()
          : expires
            ? new Date(Number(expires) * 1000).toISOString()
            : null;

      const tokUp = await sb.from("salla_tokens").upsert(
        {
          installation_id: installationId,
          access_token: String(accessToken),
          refresh_token: refreshToken ? String(refreshToken) : null,
          access_expires_at: accessExpiresAt,
          scopes: scope
            ? Array.isArray(scope)
              ? scope.map(String)
              : String(scope).split(" ")
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "installation_id" },
      );
      if (tokUp.error) throw tokUp.error;

      // E) المستخدم (مالك المتجر) — invite / get
      const user = await ensureUserByEmail(sb, store.email);
      const userId = user.id;

      // F) اربط owner في tenant_members
      const tmUp = await sb.from("tenant_members").upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          role: "owner",
          created_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,user_id" },
      );
      if (tmUp.error) throw tmUp.error;

      // G) حدث profiles (عندك PK = id)
      // (لو عندك trigger من auth.users ممكن يكون انشأ صف، نحن نسوي upsert للتأكد)
      const profUp = await sb.from("profiles").upsert(
        {
          id: userId,
          email: store.email,
          full_name: store.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (profUp.error) {
        console.warn("[salla:webhook] profiles upsert warning", profUp.error);
      }

      console.log("[salla:webhook] authorize ok", {
        merchantId: merchantIdStr,
        tenantId,
        installationId,
        userId,
        email: store.email,
      });

      return NextResponse.json({ ok: true });
    }

    // =====================================================
    // UNINSTALL
    // =====================================================
    if (body.event === "app.uninstalled") {
      const merchantId = body.merchant ? String(body.merchant) : null;

      if (merchantId) {
        const upd = await sb
          .from("salla_installations")
          .update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("merchant_id", merchantId);

        if (upd.error) throw upd.error;

        console.log("[salla:webhook] uninstall ok", { merchantId });
      }

      return NextResponse.json({ ok: true });
    }

    // باقي الأحداث
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[salla:webhook] error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Webhook error" },
      { status: 500 },
    );
  }
}
