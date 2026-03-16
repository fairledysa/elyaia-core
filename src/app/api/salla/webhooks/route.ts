// FILE: src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const storeInfoUrl = "https://api.salla.dev/admin/v2/store/info";
  const r1 = await fetch(storeInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
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

    if (email) {
      return { email: String(email), name: name ? String(name) : null };
    }
  }

  const userInfoUrl = "https://accounts.salla.sa/oauth2/user/info";
  const r2 = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const t2 = await r2.text();
  if (!r2.ok) throw new Error(`Salla user info failed: ${r2.status} ${t2}`);

  const j2 = JSON.parse(t2);
  const email = j2?.data?.email ?? null;
  const name = j2?.data?.name ?? null;

  if (!email) {
    throw new Error("Could not read email from Salla user/info response");
  }

  return { email: String(email), name: name ? String(name) : null };
}

function normalizeScopes(scope: any): string[] | null {
  if (!scope) return null;
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);

  return String(scope)
    .split(/[ ,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function getOrCreateUserByEmail(
  sb: any,
  email: string,
  fullName: string | null,
) {
  const emailLower = email.trim().toLowerCase();

  const listed = await sb.auth.admin.listUsers();
  if (listed.error) throw listed.error;

  const existingUser = (listed.data?.users || []).find(
    (u: any) => String(u.email || "").toLowerCase() === emailLower,
  );
  if (existingUser) return existingUser;

  const created = await sb.auth.admin.createUser({
    email: emailLower,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (created.error) throw created.error;
  return created.data.user;
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

    console.log("[salla:webhook] event:", body.event, "merchant:", body.merchant);

    if (
      body.event !== "app.store.authorize" &&
      body.event !== "app.uninstalled"
    ) {
      return NextResponse.json({ ok: true });
    }

    const merchantId = body.merchant ? String(body.merchant) : null;

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
      console.log("[salla:webhook] existing installation:", installationId);
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

      console.log("[salla:webhook] created tenant:", tenantId);
      console.log("[salla:webhook] created installation:", installationId);
    }

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

    console.log("[salla:webhook] token saved for installation:", installationId);

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

    const storeUser = await getBestEmailFromSalla(String(accessToken));
    const email = storeUser.email.trim().toLowerCase();
    const name = storeUser.name ?? null;

    console.log("[salla:webhook] merchant email:", email);

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

    const user = await getOrCreateUserByEmail(sb, email, name);
    const userId = user.id;

    console.log("[salla:webhook] owner user:", userId);

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
      email,
      note: "linked_owner_without_invite_email",
    });
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