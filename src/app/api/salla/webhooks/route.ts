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
 * 1) store/info
 * 2) fallback: accounts.salla.sa/oauth2/user/info
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
  if (r1.ok) {
    const j1 = JSON.parse(t1);
    const email =
      j1?.data?.email ??
      j1?.data?.store?.email ??
      j1?.email ??
      j1?.store?.email ??
      null;

    const name =
      j1?.data?.name ??
      j1?.data?.store_name ??
      j1?.data?.store?.name ??
      j1?.name ??
      j1?.store?.name ??
      null;

    if (email)
      return { email: String(email), name: name ? String(name) : null };
  } else {
    console.log("[salla:store] store/info failed", {
      status: r1.status,
      body: t1.slice(0, 300),
    });
  }

  // B) accounts user/info
  const userInfoUrl = "https://accounts.salla.sa/oauth2/user/info";
  const r2 = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const t2 = await r2.text();
  if (!r2.ok) throw new Error(`Salla user info failed: ${r2.status} ${t2}`);

  const j2 = JSON.parse(t2);
  const email = j2?.data?.email ?? null;
  const name = j2?.data?.name ?? null;

  if (!email)
    throw new Error("Could not read email from Salla user/info response");
  return { email: String(email), name: name ? String(name) : null };
}

async function findUserByEmail(
  sb: ReturnType<typeof supabaseAdmin>,
  email: string,
) {
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
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

function toExpiresAt(expires: any) {
  if (expires == null) return null;
  const n = typeof expires === "number" ? expires : Number(expires);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString();
}

async function logWebhookEvent(
  sb: ReturnType<typeof supabaseAdmin>,
  installationId: string | null,
  body: SallaWebhookBody,
  status: "pending" | "processed" | "ignored" | "error",
  processedAt?: string | null,
  errorMessage?: string | null,
) {
  // جدول webhook_events عندك يحتاج installation_id NOT NULL
  // فلو ما عندنا installationId (مثلاً قبل ما ننشئه) نتجاهل التسجيل
  if (!installationId) return;

  await sb.from("webhook_events").insert({
    installation_id: installationId,
    event_type: body.event,
    event_id: body.data?.id ? String(body.data.id) : null,
    payload: body as any,
    received_at: new Date().toISOString(),
    processed_at: processedAt ?? null,
    status,
    // إذا ما عندك عمود error_message تجاهله
    // error_message: errorMessage ?? null,
  });
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  try {
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

    // 3) only handle what we need
    if (
      body.event !== "app.store.authorize" &&
      body.event !== "app.uninstalled"
    ) {
      return NextResponse.json({ ok: true });
    }

    // 4) uninstall
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

    // 5) authorize
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

    const merchantIdStr = String(merchantId);

    // A) installation upsert (لا نكرر tenant)
    // 1) إذا موجودة: خذها
    const instExisting = await sb
      .from("salla_installations")
      .select("id, tenant_id, merchant_id, store_name, status")
      .eq("merchant_id", merchantIdStr)
      .maybeSingle();

    if (instExisting.error) throw instExisting.error;

    let tenantId: string;
    let installationId: string;

    if (instExisting.data) {
      tenantId = instExisting.data.tenant_id;
      installationId = instExisting.data.id;
    } else {
      // 2) create tenant + installation
      const tenantName = `Store ${merchantIdStr}`;

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
          merchant_id: merchantIdStr,
          store_name: tenantName,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (instIns.error) throw instIns.error;
      installationId = instIns.data.id as string;
    }

    // (اختياري) سجل webhook event كـ pending قبل المعالجة
    await logWebhookEvent(sb, installationId, body, "pending", null);

    // B) upsert tokens
    const tokUp = await sb.from("salla_tokens").upsert(
      {
        installation_id: installationId,
        access_token: String(accessToken),
        refresh_token: refreshToken ? String(refreshToken) : null,
        access_expires_at: toExpiresAt(expires),
        scopes: scope
          ? Array.isArray(scope)
            ? scope.map(String)
            : String(scope).split(" ").filter(Boolean)
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" },
    );
    if (tokUp.error) throw tokUp.error;

    // C) حاول تجيب email/name
    let storeUser: { email: string; name: string | null } | null = null;
    try {
      storeUser = await getBestEmailFromSalla(String(accessToken));
    } catch (e: any) {
      console.log("[salla:webhook] could not fetch store user info now", {
        message: e?.message,
      });
      // ما نكسر authorize بسبب الإيميل — التوكن انحفظ خلاص
      // نخلي owner linking لاحقاً من شاشة داخلية لو احتجنا.
    }

    // D) تحديث اسم المتجر إذا قدرنا
    if (storeUser?.name) {
      const updName = await sb
        .from("salla_installations")
        .update({
          store_name: storeUser.name,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", installationId);
      if (updName.error) throw updName.error;
    } else {
      const updActive = await sb
        .from("salla_installations")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", installationId);
      if (updActive.error) throw updActive.error;
    }

    // E) إذا ما عندنا email — نوقف هنا (بدون invites/ربط)
    if (!storeUser?.email) {
      await logWebhookEvent(
        sb,
        installationId,
        body,
        "processed",
        new Date().toISOString(),
      );
      return NextResponse.json({
        ok: true,
        warning: "tokens_saved_but_no_email",
      });
    }

    // F) user linking (بدون spam)
    const email = storeUser.email;

    // 1) هل موجود؟
    let user = await findUserByEmail(sb, email);

    // 2) إذا غير موجود -> invite مرة واحدة فقط
    if (!user) {
      const invited = await sb.auth.admin.inviteUserByEmail(email);
      if (invited.error) {
        // إذا فشل invite لأي سبب — نعيد محاولة find
        console.log("[salla:webhook] invite error", {
          message: invited.error.message,
        });
      }
      user = invited.data.user ?? (await findUserByEmail(sb, email));
    }

    if (!user) {
      // ما نكسر الربط بالكامل — لكن نبلغ بالخطأ
      await logWebhookEvent(
        sb,
        installationId,
        body,
        "error",
        new Date().toISOString(),
        "user_create_or_find_failed",
      );
      return NextResponse.json(
        { ok: false, error: `Could not find/create user for ${email}` },
        { status: 500 },
      );
    }

    const userId = user.id;

    // G) upsert profile
    const profUp = await sb.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: storeUser.name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profUp.error) throw profUp.error;

    // H) link tenant membership (owner)
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

    // I) done
    await logWebhookEvent(
      sb,
      installationId,
      body,
      "processed",
      new Date().toISOString(),
    );

    return NextResponse.json({
      ok: true,
      merchantId: merchantIdStr,
      tenantId,
      installationId,
      email,
    });
  } catch (e: any) {
    console.error("[salla:webhook] error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Webhook error" },
      { status: 500 },
    );
  }
}
