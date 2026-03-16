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

function normalizeScopes(scope: any): string[] | null {
  if (!scope) return null;
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  const s = String(scope);
  return s
    .split(/[ ,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
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
      note: "installation_linked_tokens_saved",
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