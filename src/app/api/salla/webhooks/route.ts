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
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 1) نحاول نجيب إيميل من store/info
 * 2) إذا فاضي -> نجيب من accounts.salla.sa/oauth2/user/info (رسمي من سلة)
 */
async function getBestEmailFromSalla(accessToken: string) {
  // A) store/info
  const storeInfoUrl = "https://api.salla.dev/admin/v2/store/info";
  const r1 = await fetch(storeInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const t1 = await r1.text();
  if (!r1.ok) {
    console.log("[salla:store] store/info failed", {
      status: r1.status,
      body: t1.slice(0, 300),
    });
  } else {
    const j1 = JSON.parse(t1);
    const email =
      j1?.data?.email ??
      j1?.data?.store?.email ??
      j1?.email ??
      j1?.store?.email;

    const name =
      j1?.data?.name ??
      j1?.data?.store_name ??
      j1?.data?.store?.name ??
      j1?.name ??
      j1?.store?.name ??
      null;

    if (email)
      return { email: String(email), name: name ? String(name) : null };
    console.log(
      "[salla:store] store/info returned empty email, fallback to user/info",
    );
  }

  // B) accounts user/info (هذا اللي يرجّع email بشكل موثوق)
  // حسب توثيق سلة: GET https://accounts.salla.sa/oauth2/user/info  :contentReference[oaicite:2]{index=2}
  const userInfoUrl = "https://accounts.salla.sa/oauth2/user/info";
  const r2 = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const t2 = await r2.text();
  if (!r2.ok) {
    throw new Error(`Salla user info failed: ${r2.status} ${t2}`);
  }

  const j2 = JSON.parse(t2);
  const email = j2?.data?.email;
  const name = j2?.data?.name ?? null;

  if (!email)
    throw new Error("Could not read email from Salla user/info response");

  return { email: String(email), name: name ? String(name) : null };
}

async function findUserByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  // supabase admin ما يعطي search مباشر بالإيميل في كل الإصدارات
  // فنمشي بالصفحات
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const list = await sb.auth.admin.listUsers({ page, perPage });
    if (list.error) throw list.error;

    const u = list.data.users.find(
      (x) => (x.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (u) return u;

    if (list.data.users.length < perPage) break;
    page++;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 0) ENV check
    console.log("[salla:webhook] env check", {
      hasWebhookSecret: !!process.env.SALLA_WEBHOOK_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    // 1) verify webhook token (Token strategy)
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

    // 3) supabase admin
    const sb = supabaseAdmin();

    // 4) authorize
    if (body.event === "app.store.authorize") {
      const merchantId = body.merchant;
      const accessToken = body.data?.access_token;
      const refreshToken = body.data?.refresh_token;
      const expires = body.data?.expires; // epoch seconds غالباً
      const scope = body.data?.scope;

      if (!merchantId || !accessToken) {
        return NextResponse.json(
          { ok: false, error: "Missing merchant/token" },
          { status: 400 },
        );
      }

      console.log("[salla:webhook] authorize received", {
        merchantId: String(merchantId),
      });

      // A) هل فيه installation موجودة؟ (علشان ما نسوي tenant جديد كل مرة)
      const instExisting = await sb
        .from("salla_installations")
        .select("id, tenant_id, merchant_id")
        .eq("merchant_id", String(merchantId))
        .maybeSingle();

      if (instExisting.error) throw instExisting.error;

      let tenantId: string;
      let installationId: string;

      if (instExisting.data) {
        tenantId = instExisting.data.tenant_id;
        installationId = instExisting.data.id;
        console.log("[salla:webhook] installation exists", {
          tenantId,
          installationId,
        });
      } else {
        // B) أنشئ tenant جديد
        const tenantName = `Store ${merchantId}`;
        const tIns = await sb
          .from("tenants")
          .insert({ name: tenantName })
          .select("id")
          .single();
        if (tIns.error) throw tIns.error;
        tenantId = tIns.data.id as string;

        // C) أنشئ installation
        const instUp = await sb
          .from("salla_installations")
          .insert({
            tenant_id: tenantId,
            merchant_id: String(merchantId),
            store_name: tenantName,
            status: "active",
          })
          .select("id, tenant_id")
          .single();

        if (instUp.error) throw instUp.error;
        installationId = instUp.data.id as string;
      }

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

      // E) جيب (email,name) بأفضل طريقة
      const storeUser = await getBestEmailFromSalla(String(accessToken)); // <-- هذا اللي يحل foundEmail:false

      // F) invite/create user في Supabase Auth
      // invite يرسل Magic Link من إعدادات Supabase (SMTP) — تقدر تربطه بـ Resend لاحقاً
      const invited = await sb.auth.admin.inviteUserByEmail(storeUser.email);
      if (invited.error) {
        console.log("[salla:webhook] invite error (maybe exists)", {
          message: invited.error.message,
        });
      }

      let user = invited.data.user;
      if (!user) {
        const existing = await findUserByEmail(sb, storeUser.email);
        if (!existing)
          throw new Error(
            `Could not find or invite user for email: ${storeUser.email}`,
          );
        user = existing;
      }

      const userId = user.id;

      // G) اكتب/حدّث جدول profiles (عندك PK اسمه id مو user_id)
      const profUp = await sb.from("profiles").upsert(
        {
          id: userId,
          email: storeUser.email,
          full_name: storeUser.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (profUp.error) throw profUp.error;

      // H) اربط المستخدم كـ owner في tenant_members
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

      // I) حدّث installation store_name لو تحب
      const instNameUp = await sb
        .from("salla_installations")
        .update({
          store_name: storeUser.name ?? `Store ${merchantId}`,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", installationId);

      if (instNameUp.error) throw instNameUp.error;

      console.log("[salla:webhook] authorize ok", {
        merchantId: String(merchantId),
        tenantId,
        installationId,
        email: storeUser.email,
      });

      return NextResponse.json({ ok: true });
    }

    // 5) uninstall
    if (body.event === "app.uninstalled") {
      const merchantId = body.merchant;
      if (merchantId) {
        const upd = await sb
          .from("salla_installations")
          .update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("merchant_id", String(merchantId));
        if (upd.error) throw upd.error;
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[salla:webhook] error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Webhook error" },
      { status: 500 },
    );
  }
}
