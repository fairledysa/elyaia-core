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

function toIsoDate(value: any) {
  if (!value) return null;

  if (typeof value === "number") {
    const ms = value > 9999999999 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeScopes(scope: any): string[] | null {
  if (!scope) return null;
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  const s = String(scope);
  return s
    .split(/[ ,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 1) accounts user/info
 * 2) fallback: store/info
 */
async function getBestEmailFromSalla(accessToken: string) {
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

function isSubscriptionEvent(event: string) {
  return [
    "app.subscription.started",
    "app.subscription.renewed",
    "app.subscription.expired",
    "app.subscription.canceled",
    "app.trial.started",
    "app.trial.expired",
  ].includes(event);
}

async function upsertSubscriptionFromEvent(params: {
  sb: any;
  tenantId: string;
  installationId: string;
  merchantId: string;
  body: SallaWebhookBody;
}) {
  const { sb, tenantId, installationId, merchantId, body } = params;

  const event = body.event;
  const data = body.data ?? {};
  const createdAt = toIsoDate(body.created_at) ?? new Date().toISOString();

  const subscriptionId =
    data?.subscription_id != null ? String(data.subscription_id) : null;

  const planName =
    data?.plan_name ??
    data?.plan?.name ??
    data?.package_name ??
    data?.subscription?.plan_name ??
    null;

  const startedAt =
    toIsoDate(data?.started_at) ??
    toIsoDate(data?.start_date) ??
    (event === "app.subscription.started" ? createdAt : null);

  const renewedAt =
    toIsoDate(data?.renewed_at) ??
    toIsoDate(data?.renewal_date) ??
    (event === "app.subscription.renewed" ? createdAt : null);

  const expiresAt =
    toIsoDate(data?.expires_at) ??
    toIsoDate(data?.expiry_date) ??
    toIsoDate(data?.ends_at) ??
    toIsoDate(data?.end_date);

  const trialStartedAt =
    toIsoDate(data?.trial_started_at) ??
    toIsoDate(data?.trial_start_date) ??
    (event === "app.trial.started" ? createdAt : null);

  const trialEndsAt =
    toIsoDate(data?.trial_ends_at) ??
    toIsoDate(data?.trial_end_date) ??
    toIsoDate(data?.trial_expires_at);

  const canceledAt =
    toIsoDate(data?.canceled_at) ??
    toIsoDate(data?.cancelled_at) ??
    (event === "app.subscription.canceled" ? createdAt : null);

  let status: string = "inactive";

  if (
    event === "app.subscription.started" ||
    event === "app.subscription.renewed"
  ) {
    status = "active";
  } else if (event === "app.subscription.expired") {
    status = "expired";
  } else if (event === "app.subscription.canceled") {
    status = "canceled";
  } else if (event === "app.trial.started") {
    status = "trialing";
  } else if (event === "app.trial.expired") {
    status = "expired";
  }

  const payload: Record<string, any> = {
    tenant_id: tenantId,
    installation_id: installationId,
    merchant_id: merchantId,
    subscription_id: subscriptionId,
    status,
    plan_name: planName,
    last_event: event,
    raw: body as any,
    updated_at: new Date().toISOString(),
  };

  if (startedAt) payload.started_at = startedAt;
  if (renewedAt) payload.renewed_at = renewedAt;
  if (expiresAt) payload.expires_at = expiresAt;
  if (trialStartedAt) payload.trial_started_at = trialStartedAt;
  if (trialEndsAt) payload.trial_ends_at = trialEndsAt;
  if (canceledAt) payload.canceled_at = canceledAt;

  const subUp = await sb
    .from("app_subscriptions")
    .upsert(payload, { onConflict: "tenant_id" });

  if (subUp.error) throw subUp.error;
}

export async function POST(req: NextRequest) {
  const sb = createSupabaseAdminClient();

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
    const body = (await req.json()) as SallaWebhookBody;
    const event = String(body.event || "");
    const merchantId = body.merchant ? String(body.merchant) : null;

    const allowedEvents = [
      "app.store.authorize",
      "app.uninstalled",
      "app.subscription.started",
      "app.subscription.renewed",
      "app.subscription.expired",
      "app.subscription.canceled",
      "app.trial.started",
      "app.trial.expired",
    ];

    if (!allowedEvents.includes(event)) {
      return NextResponse.json({ ok: true });
    }

    if (merchantId) {
      const inst = await sb
        .from("salla_installations")
        .select("id")
        .eq("merchant_id", merchantId)
        .maybeSingle();

      if (inst.error) throw inst.error;
      installationIdForEvent = inst.data?.id ?? null;
    }

    if (installationIdForEvent) {
      const evIns = await sb
        .from("webhook_events")
        .insert({
          installation_id: installationIdForEvent,
          event_type: event,
          event_id: body.id ? String(body.id) : null,
          payload: body as any,
          status: "pending",
        })
        .select("id")
        .single();

      if (evIns.error) throw evIns.error;
      webhookEventId = evIns.data.id as string;
    }

    if (event === "app.uninstalled") {
      if (merchantId) {
        const instGet = await sb
          .from("salla_installations")
          .select("id, tenant_id")
          .eq("merchant_id", merchantId)
          .maybeSingle();

        if (instGet.error) throw instGet.error;

        if (instGet.data?.id) {
          const upd = await sb
            .from("salla_installations")
            .update({
              status: "revoked",
              updated_at: new Date().toISOString(),
            })
            .eq("id", instGet.data.id);

          if (upd.error) throw upd.error;

          const subUp = await sb.from("app_subscriptions").upsert(
            {
              tenant_id: instGet.data.tenant_id,
              installation_id: instGet.data.id,
              merchant_id: merchantId,
              status: "uninstalled",
              uninstalled_at:
                toIsoDate(body.created_at) ?? new Date().toISOString(),
              last_event: event,
              raw: body as any,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id" },
          );

          if (subUp.error) throw subUp.error;
        }
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

    if (event === "app.store.authorize") {
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

      if (!webhookEventId) {
        const evIns = await sb
          .from("webhook_events")
          .insert({
            installation_id: installationId,
            event_type: event,
            event_id: body.id ? String(body.id) : null,
            payload: body as any,
            status: "pending",
          })
          .select("id")
          .single();

        if (evIns.error) throw evIns.error;
        webhookEventId = evIns.data.id as string;
      }

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

        const subEnsure = await sb.from("app_subscriptions").upsert(
          {
            tenant_id: tenantId,
            installation_id: installationId,
            merchant_id: merchantId,
            status: "active",
            last_event: event,
            raw: body as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id" },
        );

        if (subEnsure.error) throw subEnsure.error;

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

      const storeUser = await getBestEmailFromSalla(String(accessToken));
      const email = storeUser.email.trim().toLowerCase();
      const name = storeUser.name ?? null;

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

      const { user, isNewUser } = await getOrCreateUserByEmail(sb, email, name);
      const userId = user.id;

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

      const subEnsure = await sb.from("app_subscriptions").upsert(
        {
          tenant_id: tenantId,
          installation_id: installationId,
          merchant_id: merchantId,
          status: "active",
          last_event: event,
          raw: body as any,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );

      if (subEnsure.error) throw subEnsure.error;

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
    }

    if (isSubscriptionEvent(event)) {
      if (!merchantId) {
        return NextResponse.json(
          { ok: false, error: "Missing merchant" },
          { status: 400 },
        );
      }

      const instExisting = await sb
        .from("salla_installations")
        .select("id, tenant_id, merchant_id")
        .eq("merchant_id", merchantId)
        .maybeSingle();

      if (instExisting.error) throw instExisting.error;

      if (!instExisting.data?.id || !instExisting.data?.tenant_id) {
        return NextResponse.json(
          { ok: false, error: "Installation not found for merchant" },
          { status: 404 },
        );
      }

      await upsertSubscriptionFromEvent({
        sb,
        tenantId: instExisting.data.tenant_id,
        installationId: instExisting.data.id,
        merchantId,
        body,
      });

      if (!webhookEventId) {
        const evIns = await sb
          .from("webhook_events")
          .insert({
            installation_id: instExisting.data.id,
            event_type: event,
            event_id: body.id ? String(body.id) : null,
            payload: body as any,
            status: "pending",
          })
          .select("id")
          .single();

        if (evIns.error) throw evIns.error;
        webhookEventId = evIns.data.id as string;
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

      return NextResponse.json({
        ok: true,
        merchantId,
        event,
        note: "subscription_event_processed",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[salla:webhook] error", e);

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