// FILE: src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";

export const runtime = "nodejs";

type SallaWebhookBody = {
  event: string;
  merchant?: number;
  created_at?: string;
  data?: any;
  id?: string | number;
};

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function toExpiresAt(expires: any) {
  if (expires == null) return null;
  const n = typeof expires === "number" ? expires : Number(expires);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString();
}

/**
 * 1) store/info
 * 2) fallback: accounts.salla.sa/oauth2/user/info
 */
async function getBestEmailFromSalla(accessToken: string) {
  // A) accounts user/info أولاً لأنه يعطي إيميل صاحب الحساب الحقيقي
  const userInfoUrl = "https://accounts.salla.sa/oauth2/user/info";
  const r1 = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const t1 = await r1.text();
  if (r1.ok) {
    const j1 = JSON.parse(t1);

    const email = j1?.data?.email ?? j1?.email ?? null;

    const name = j1?.data?.name ?? j1?.name ?? null;

    if (email) {
      return { email: String(email), name: name ? String(name) : null };
    }
  }

  // B) fallback: store/info
  const storeInfoUrl = "https://api.salla.dev/admin/v2/store/info";
  const r2 = await fetch(storeInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const t2 = await r2.text();
  if (!r2.ok) {
    throw new Error(
      `Salla user info failed: accounts=${r1.status} ${t1} | store=${r2.status} ${t2}`,
    );
  }

  const j2 = JSON.parse(t2);

  const email =
    j2?.data?.email ??
    j2?.data?.store?.email ??
    j2?.email ??
    j2?.store?.email ??
    null;

  const name =
    j2?.data?.name ??
    j2?.data?.store_name ??
    j2?.data?.store?.name ??
    j2?.name ??
    j2?.store?.name ??
    null;

  if (!email) {
    throw new Error("Could not read email from Salla response");
  }

  return { email: String(email), name: name ? String(name) : null };
}

function normalizeScopes(scope: any): string[] | null {
  if (!scope) return null;
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  const s = String(scope);
  // sometimes comma-separated / space-separated
  return s
    .split(/[ ,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function getOrCreateUserByEmail(
  sb: any,
  email: string,
  fullName: string | null,
): Promise<{ user: any; isNewUser: boolean }> {
  const emailLower = email.trim().toLowerCase();

  const listed = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listed.error) throw listed.error;

  const existingUser = (listed.data?.users || []).find(
    (u: any) => String(u.email || "").toLowerCase() === emailLower,
  );
  if (existingUser) {
    return { user: existingUser, isNewUser: false };
  }

  const created = await sb.auth.admin.createUser({
    email: emailLower,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });
  if (created.error) throw created.error;

  return { user: created.data.user, isNewUser: true };
}

export async function POST(req: NextRequest) {
  const sb = createSupabaseAdminClient();

  // 1) verify webhook token
  const sentAuth = getHeader(req, "authorization");
  const expected = mustEnv("SALLA_WEBHOOK_SECRET");
  if (sentAuth !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized webhook" },
      { status: 401 },
    );
  }

  let installationIdForEvent: string | null = null;
  let webhookEventId: string | null = null;

  try {
    // 2) body
    const body = (await req.json()) as SallaWebhookBody;

    // 3) only handle needed events
    if (
      body.event !== "app.store.authorize" &&
      body.event !== "app.uninstalled"
    ) {
      return NextResponse.json({ ok: true });
    }

    const merchantId = body.merchant ? String(body.merchant) : null;

    // Try find installation early (for webhook_events logging)
    if (merchantId) {
      const inst = await sb
        .from("salla_installations")
        .select("id")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (inst.error) throw inst.error;
      installationIdForEvent = inst.data?.id ?? null;
    }

    // Create webhook_events row if we have installation_id
    if (installationIdForEvent) {
      const evIns = await sb
        .from("webhook_events")
        .insert({
          installation_id: installationIdForEvent,
          event_type: body.event,
          event_id: body.id ? String(body.id) : null,
          payload: body as any,
          status: "pending",
        })
        .select("id")
        .single();
      if (evIns.error) throw evIns.error;
      webhookEventId = evIns.data.id as string;
    }

    // 4) uninstall
    if (body.event === "app.uninstalled") {
      if (merchantId) {
        const upd = await sb
          .from("salla_installations")
          .update({
            status: "revoked",
            updated_at: new Date().toISOString(),
          })
          .eq("merchant_id", merchantId);
        if (upd.error) throw upd.error;
      }

      if (webhookEventId) {
        const evUpd = await sb
          .from("webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventId);
        if (evUpd.error) throw evUpd.error;
      }

      return NextResponse.json({ ok: true });
    }

    // 5) authorize
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

    // A) get/create installation + tenant
    const instExisting = await sb
      .from("salla_installations")
      .select("id, tenant_id, merchant_id, store_name, status")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    if (instExisting.error) throw instExisting.error;

    let tenantId: string;
    let installationId: string;

    if (instExisting.data) {
      tenantId = instExisting.data.tenant_id;
      installationId = instExisting.data.id;
    } else {
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
          merchant_id: merchantId,
          store_name: tenantName,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (instIns.error) throw instIns.error;
      installationId = instIns.data.id as string;
    }

    // If we didn't log webhook_events earlier, log now (after creating installation)
    if (!webhookEventId) {
      const evIns = await sb
        .from("webhook_events")
        .insert({
          installation_id: installationId,
          event_type: body.event,
          event_id: body.id ? String(body.id) : null,
          payload: body as any,
          status: "pending",
        })
        .select("id")
        .single();
      if (evIns.error) throw evIns.error;
      webhookEventId = evIns.data.id as string;
    }

    // B) upsert tokens
    const tokUp = await sb.from("salla_tokens").upsert(
      {
        installation_id: installationId,
        access_token: String(accessToken),
        refresh_token: refreshToken ? String(refreshToken) : null,
        access_expires_at: toExpiresAt(expires),
        scopes: normalizeScopes(scope),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "installation_id" },
    );
    if (tokUp.error) throw tokUp.error;

    // C) if owner already linked, stop here (no email/user creation)
    const owner = await sb
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (owner.error) throw owner.error;

    if (owner.data?.user_id) {
      const instUpd = await sb
        .from("salla_installations")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", installationId);
      if (instUpd.error) throw instUpd.error;

      if (webhookEventId) {
        const evUpd = await sb
          .from("webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventId);
        if (evUpd.error) throw evUpd.error;
      }

      return NextResponse.json({
        ok: true,
        merchantId,
        tenantId,
        installationId,
        linkedOwnerUserId: owner.data.user_id,
        note: "owner_already_linked",
      });
    }

    // D) first-time: fetch email + store name
    const storeUser = await getBestEmailFromSalla(String(accessToken));
    const email = storeUser.email.trim().toLowerCase();
    const name = storeUser.name ?? null;

    // Update installation with owner_email/store_name
    const updInst = await sb
      .from("salla_installations")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
        store_name: name ?? null,
        owner_email: email,
      } as any)
      .eq("id", installationId);
    if (updInst.error) throw updInst.error;

    // E) create/find user (NO invite)
    const { user, isNewUser } = await getOrCreateUserByEmail(sb, email, name);
    const userId = user.id;

    // F) upsert profile (non-blocking)
    const profUp = await sb.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: name,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profUp.error) {
      console.log(
        "[salla:webhook] profiles upsert error",
        profUp.error.message,
      );
    }

    // G) link tenant membership (owner) - idempotent
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

    // H) mark webhook_events processed
    if (webhookEventId) {
      const evUpd = await sb
        .from("webhook_events")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookEventId);
      if (evUpd.error) throw evUpd.error;
    }

    // I) send welcome email فقط إذا المستخدم جديد
    if (isNewUser) {
      try {
        await sendWelcomeEmail(email);
      } catch (emailError) {
        console.error("[salla:webhook] welcome email failed", emailError);
      }
    }

    return NextResponse.json({
      ok: true,
      merchantId,
      tenantId,
      installationId,
      email,
      note: isNewUser
        ? "linked_owner_with_welcome_email"
        : "linked_owner_existing_user",
    });
  } catch (e: any) {
    console.error("[salla:webhook] error", e);

    // best-effort: mark webhook_events failed
    if (webhookEventId) {
      try {
        await sb
          .from("webhook_events")
          .update({
            status: "failed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEventId);
      } catch {}
    }

    return NextResponse.json(
      { ok: false, error: e?.message || "Webhook error" },
      { status: 500 },
    );
  }
}