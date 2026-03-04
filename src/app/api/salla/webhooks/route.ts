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

// ✅ best-effort log (لا يكسر webhook لو فشل)
async function logWebhookEvent(
  sb: ReturnType<typeof supabaseAdmin>,
  installationId: string | null,
  body: SallaWebhookBody,
  status: "pending" | "processed" | "ignored" | "error",
  processedAt?: string | null,
  errorMessage?: string | null,
) {
  if (!installationId) return;

  try {
    await sb.from("webhook_events").insert({
      installation_id: installationId,
      event_type: body.event,
      event_id: body.data?.id ? String(body.data.id) : null,
      payload: body as any,
      received_at: new Date().toISOString(),
      processed_at: processedAt ?? null,
      status,
      // error_message: errorMessage ?? null,
    });
  } catch {
    // تجاهل
  }
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  try {
    // 1) verify webhook token
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

    // 3) only handle needed events
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
    const expires = body.data?.expires;
    const scope = body.data?.scope;

    if (!merchantId || !accessToken) {
      return NextResponse.json(
        { ok: false, error: "Missing merchant/token" },
        { status: 400 },
      );
    }

    const merchantIdStr = String(merchantId);

    // A) get/create installation + tenant
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

    await logWebhookEvent(sb, installationId, body, "pending", null);

    // B) upsert tokens (هذا أهم شيء لازم يتم دائمًا)
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

    // C) إذا فيه owner مرتبط مسبقاً خلاص لا نرسل دعوات ولا نجيب ايميل
    const owner = await sb
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .maybeSingle();

    if (owner.error) throw owner.error;

    if (owner.data?.user_id) {
      const updActive = await sb
        .from("salla_installations")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", installationId);
      if (updActive.error) throw updActive.error;

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
        linkedOwnerUserId: owner.data.user_id,
        note: "owner_already_linked_skip_email_invite",
      });
    }

    // D) أول مرة فقط: نحاول نجيب email/name من سلة
    let storeUser: { email: string; name: string | null } | null = null;
    try {
      storeUser = await getBestEmailFromSalla(String(accessToken));
    } catch (e: any) {
      // لا نكسر authorize بسبب الإيميل
      const updActive = await sb
        .from("salla_installations")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", installationId);
      if (updActive.error) throw updActive.error;

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
        warning: "tokens_saved_but_no_email",
        detail: e?.message ?? null,
      });
    }

    // تحديث store_name لو قدرنا
    if (storeUser?.name) {
      await sb
        .from("salla_installations")
        .update({
          store_name: storeUser.name,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", installationId);
    } else {
      await sb
        .from("salla_installations")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", installationId);
    }

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
        merchantId: merchantIdStr,
        tenantId,
        installationId,
        warning: "tokens_saved_but_no_email",
      });
    }

    const email = storeUser.email;

    // E) find or invite (لكن بدون ما نطيح لو invite فشل)
    let user = await findUserByEmail(sb, email);

    if (!user) {
      const invited = await sb.auth.admin.inviteUserByEmail(email);

      if (invited.error) {
        // ✅ مهم: لا نرمي خطأ هنا (rate limit / already invited / etc)
        console.log("[salla:webhook] invite skipped", invited.error.message);
      }

      user = invited.data?.user ?? (await findUserByEmail(sb, email));
    }

    // إذا لسا ما لقيناه: لا نرجع 500 (عشان سلة ما تعيد)
    if (!user) {
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
        warning: "user_not_linked_yet",
        email,
      });
    }

    const userId = user.id;

    // upsert profile
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

    // link tenant membership (owner)
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
      linkedOwnerUserId: userId,
    });
  } catch (e: any) {
    console.error("[salla:webhook] error", e);
    // ✅ هذا فقط للأخطاء الحقيقية (ENV/DB/Unauthorized)
    return NextResponse.json(
      { ok: false, error: e?.message || "Webhook error" },
      { status: 500 },
    );
  }
}
