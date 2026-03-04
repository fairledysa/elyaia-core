// FILE: src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type SallaWebhookBody = {
  event: string;
  merchant?: number; // merchant id
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
 * نحاول نجيب بيانات المتجر من عدة endpoints لأن سلة تختلف بالاستجابة
 * وبعضها ما يرجّع email أصلاً.
 */
async function fetchSallaJson(accessToken: string, url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse error
  }

  return { ok: res.ok, status: res.status, text, json };
}

function pickEmailAndName(json: any): {
  email: string | null;
  name: string | null;
} {
  if (!json) return { email: null, name: null };

  // شوية احتمالات شائعة
  const email =
    json?.data?.email ??
    json?.data?.store?.email ??
    json?.data?.owner?.email ??
    json?.data?.merchant?.email ??
    json?.email ??
    json?.store?.email ??
    json?.owner?.email ??
    null;

  const name =
    json?.data?.name ??
    json?.data?.store_name ??
    json?.data?.store?.name ??
    json?.data?.merchant?.name ??
    json?.name ??
    json?.store?.name ??
    json?.store_name ??
    null;

  return {
    email: email ? String(email) : null,
    name: name ? String(name) : null,
  };
}

async function getStoreInfoFromSalla(accessToken: string) {
  // جرّب أكثر من endpoint
  const candidates = [
    "https://api.salla.dev/admin/v2/store", // غالبًا
    "https://api.salla.dev/admin/v2/store/profile", // أحيانًا
    "https://api.salla.dev/admin/v2/store/info", // اللي كنت تستخدمه
  ];

  let lastErr: any = null;

  for (const url of candidates) {
    const r = await fetchSallaJson(accessToken, url);

    // سجّل لمرة وحدة لكل محاولة (يساعدك بالـ Vercel Logs)
    console.log("[salla:store] try", { url, ok: r.ok, status: r.status });

    if (!r.ok) {
      lastErr = new Error(
        `Store endpoint failed ${r.status}: ${r.text?.slice(0, 300)}`,
      );
      continue;
    }

    const picked = pickEmailAndName(r.json);
    // اطبع مفاتيح الاستجابة (بدون إغراق)
    console.log("[salla:store] keys", {
      url,
      topKeys: r.json ? Object.keys(r.json) : [],
      dataKeys: r.json?.data ? Object.keys(r.json.data) : [],
      foundEmail: !!picked.email,
      foundName: !!picked.name,
    });

    return { ...picked, raw: r.json, usedUrl: url };
  }

  // ما لقينا أي استجابة مفيدة
  throw lastErr || new Error("Salla store info endpoints all failed");
}

function toIsoFromExpires(expires: any): string | null {
  if (expires == null) return null;
  // بعضهم epoch seconds وبعضهم ms وبعضهم string
  if (typeof expires === "number") {
    // لو رقم صغير نفترض seconds
    const ms = expires < 10_000_000_000 ? expires * 1000 : expires;
    return new Date(ms).toISOString();
  }
  const n = Number(expires);
  if (!Number.isNaN(n)) {
    const ms = n < 10_000_000_000 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  // إذا string iso
  const d = new Date(String(expires));
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  try {
    // 0) تحقق من سر webhook (Token strategy)
    const sentAuth = getHeader(req, "authorization");
    const expected = mustEnv("SALLA_WEBHOOK_SECRET");
    if (sentAuth !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized webhook" },
        { status: 401 },
      );
    }

    // 1) اقرأ البودي
    const body = (await req.json()) as SallaWebhookBody;

    // ====== EVENT: authorize ======
    if (body.event === "app.store.authorize") {
      const merchantId = body.merchant;
      const accessToken = body.data?.access_token;
      const refreshToken = body.data?.refresh_token;
      const expires = body.data?.expires;
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

      // 2) هل عندنا installation مسبقًا؟
      const existingInst = await sb
        .from("salla_installations")
        .select("id, tenant_id, merchant_id")
        .eq("merchant_id", String(merchantId))
        .maybeSingle();

      if (existingInst.error) throw existingInst.error;

      let tenantId: string;
      let installationId: string;

      // 3) إذا ما فيه installation: أنشئ tenant + installation
      if (!existingInst.data) {
        const tenantName = `Store ${merchantId}`;

        const tIns = await sb
          .from("tenants")
          .insert({ name: tenantName })
          .select("id")
          .single();
        if (tIns.error) throw tIns.error;

        tenantId = tIns.data.id as string;

        const instIns = await sb
          .from("salla_installations")
          .insert({
            tenant_id: tenantId,
            merchant_id: String(merchantId),
            store_name: tenantName,
            status: "active",
          })
          .select("id, tenant_id")
          .single();

        if (instIns.error) throw instIns.error;

        installationId = instIns.data.id as string;

        console.log("[salla:webhook] created tenant+installation", {
          tenantId,
          installationId,
          merchantId: String(merchantId),
        });
      } else {
        tenantId = existingInst.data.tenant_id as string;
        installationId = existingInst.data.id as string;

        // تأكد الحالة Active
        const upd = await sb
          .from("salla_installations")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", installationId);
        if (upd.error) throw upd.error;

        console.log("[salla:webhook] installation exists", {
          tenantId,
          installationId,
        });
      }

      // 4) خزّن التوكنز
      const accessExpiresAt = toIsoFromExpires(expires);

      const scopesArr =
        scope == null
          ? null
          : Array.isArray(scope)
            ? scope.map(String)
            : String(scope).split(/[ ,]+/).filter(Boolean);

      const tokUp = await sb.from("salla_tokens").upsert(
        {
          installation_id: installationId,
          access_token: String(accessToken),
          refresh_token: refreshToken ? String(refreshToken) : null,
          access_expires_at: accessExpiresAt,
          scopes: scopesArr,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "installation_id" },
      );
      if (tokUp.error) throw tokUp.error;

      // 5) حاول تجيب email/name من سلة (بدون ما نطيح النظام إذا ما رجع)
      let storeEmail: string | null = null;
      let storeName: string | null = null;

      try {
        const store = await getStoreInfoFromSalla(String(accessToken));
        storeEmail = store.email;
        storeName = store.name;

        // حدّث اسم المتجر إذا توفر
        if (storeName) {
          const updName = await sb
            .from("salla_installations")
            .update({
              store_name: storeName,
              updated_at: new Date().toISOString(),
            })
            .eq("id", installationId);
          if (updName.error) throw updName.error;
        }

        console.log("[salla:webhook] store info ok", {
          usedUrl: store.usedUrl,
          hasEmail: !!storeEmail,
          storeName,
        });
      } catch (err: any) {
        console.warn("[salla:webhook] store info failed (will continue)", {
          message: err?.message || String(err),
        });
      }

      // 6) لو عندنا email: أنشئ/ادعُ المستخدم + اربطه كـ owner
      if (storeEmail) {
        // inviteUserByEmail قد يرجع user أو لا حسب الحالة
        let user = (await sb.auth.admin.inviteUserByEmail(storeEmail)).data
          .user;

        if (!user) {
          // المستخدم موجود مسبقًا: نبحث عنه
          const list = await sb.auth.admin.listUsers({ page: 1, perPage: 500 });
          if (list.error) throw list.error;

          const existing = list.data.users.find((u) => u.email === storeEmail);
          if (!existing)
            throw new Error(
              `Could not find or invite user for email: ${storeEmail}`,
            );
          user = existing;
        }

        const userId = user.id;

        // profiles جدولك الحالي مفتاحه id (مو user_id)
        const profUp = await sb.from("profiles").upsert(
          {
            id: userId,
            email: storeEmail,
            full_name: null,
            phone: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (profUp.error) throw profUp.error;

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

        console.log("[salla:webhook] owner linked", {
          tenantId,
          userId,
          storeEmail,
        });
      } else {
        console.log(
          "[salla:webhook] no store email => skip auth user creation",
          {
            merchantId: String(merchantId),
            installationId,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        merchantId: String(merchantId),
        tenantId,
        installationId,
        hasEmail: !!storeEmail,
      });
    }

    // ====== EVENT: uninstalled ======
    if (body.event === "app.uninstalled") {
      const merchantId = body.merchant;
      if (merchantId) {
        const upd = await sb
          .from("salla_installations")
          .update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("merchant_id", String(merchantId));
        if (upd.error) throw upd.error;

        console.log("[salla:webhook] uninstall ok", {
          merchantId: String(merchantId),
        });
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
