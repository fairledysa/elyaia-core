// src/app/api/salla/webhooks/route.ts
// src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

type SallaWebhookBody = {
  event: string;
  merchant?: number;
  created_at?: string;
  data?: any;
};

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

function toIsoFromUnixSeconds(v?: any): string | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    // =========================
    // 0) DEBUG (Vercel logs)
    // =========================
    console.log("[salla:webhook] env check", {
      hasWebhookSecret: !!process.env.SALLA_WEBHOOK_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    // =========================
    // 1) Verify webhook secret (Token strategy)
    // =========================
    const sentAuth = getHeader(req, "authorization");
    const expected = process.env.SALLA_WEBHOOK_SECRET || "";

    if (!expected) {
      return NextResponse.json(
        { ok: false, error: "Missing SALLA_WEBHOOK_SECRET" },
        { status: 500 },
      );
    }

    if (sentAuth !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized webhook" },
        { status: 401 },
      );
    }

    // =========================
    // 2) Read body
    // =========================
    const body = (await req.json()) as SallaWebhookBody;

    const merchantId = body.merchant ? String(body.merchant) : null;

    // =========================
    // 3) Save webhook event (best-effort)
    // =========================
    // NOTE: سلة غالبًا ما ترسل event_id، إذا ما وصل ما راح نسوي dedupe
    // نخزنها فقط للتتبع/debug
    if (merchantId) {
      try {
        const { data: inst } = await supabaseAdmin
          .from("salla_installations")
          .select("id")
          .eq("merchant_id", merchantId)
          .maybeSingle();

        if (inst?.id) {
          await supabaseAdmin.from("webhook_events").insert({
            installation_id: inst.id,
            event_type: body.event,
            event_id: body.data?.event_id || null,
            payload: body as any,
            status: "pending",
          });
        }
      } catch (e) {
        // لا نكسر الـ webhook بسبب inbox
        console.log("[salla:webhook] webhook_events insert skipped", String(e));
      }
    }

    // =========================
    // 4) Event: app.store.authorize
    // =========================
    if (body.event === "app.store.authorize") {
      if (!merchantId) {
        return NextResponse.json(
          { ok: false, error: "Missing merchant" },
          { status: 400 },
        );
      }

      const accessToken = body.data?.access_token;
      const refreshToken = body.data?.refresh_token || null;
      const expiresAt = toIsoFromUnixSeconds(body.data?.expires);

      if (!accessToken) {
        return NextResponse.json(
          { ok: false, error: "Missing access_token" },
          { status: 400 },
        );
      }

      // 4.1) هل installation موجود؟
      const { data: existingInstallation, error: findErr } = await supabaseAdmin
        .from("salla_installations")
        .select("id, tenant_id")
        .eq("merchant_id", merchantId)
        .maybeSingle();

      if (findErr) {
        console.error("[salla:webhook] find installation error", findErr);
        return NextResponse.json(
          { ok: false, error: findErr.message },
          { status: 500 },
        );
      }

      let installationId: string;
      let tenantId: string;

      // 4.2) لو موجود → استخدمه
      if (existingInstallation?.id) {
        installationId = existingInstallation.id;
        tenantId = existingInstallation.tenant_id;

        // تأكد الحالة active
        await supabaseAdmin
          .from("salla_installations")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", installationId);
      } else {
        // 4.3) لو جديد → أنشئ tenant
        const { data: tenant, error: tenantErr } = await supabaseAdmin
          .from("tenants")
          .insert({ name: `Store ${merchantId}` })
          .select("id")
          .single();

        if (tenantErr || !tenant?.id) {
          console.error("[salla:webhook] create tenant error", tenantErr);
          return NextResponse.json(
            { ok: false, error: tenantErr?.message || "tenant create failed" },
            { status: 500 },
          );
        }

        tenantId = tenant.id;

        // أنشئ installation
        const { data: installation, error: instErr } = await supabaseAdmin
          .from("salla_installations")
          .insert({
            tenant_id: tenantId,
            merchant_id: merchantId,
            status: "active",
          })
          .select("id")
          .single();

        if (instErr || !installation?.id) {
          console.error("[salla:webhook] create installation error", instErr);
          return NextResponse.json(
            {
              ok: false,
              error: instErr?.message || "installation create failed",
            },
            { status: 500 },
          );
        }

        installationId = installation.id;
      }

      // 4.4) upsert tokens
      const { error: tokenErr } = await supabaseAdmin
        .from("salla_tokens")
        .upsert(
          {
            installation_id: installationId,
            access_token: accessToken,
            refresh_token: refreshToken,
            access_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "installation_id" },
        );

      if (tokenErr) {
        console.error("[salla:webhook] upsert token error", tokenErr);
        return NextResponse.json(
          { ok: false, error: tokenErr.message },
          { status: 500 },
        );
      }

      console.log("[salla:webhook] authorize ok", {
        merchantId,
        tenantId,
        installationId,
      });

      return NextResponse.json({ ok: true });
    }

    // =========================
    // 5) Event: app.uninstalled
    // =========================
    if (body.event === "app.uninstalled") {
      if (merchantId) {
        const { error: unErr } = await supabaseAdmin
          .from("salla_installations")
          .update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("merchant_id", merchantId);

        if (unErr) {
          console.error("[salla:webhook] uninstall update error", unErr);
          return NextResponse.json(
            { ok: false, error: unErr.message },
            { status: 500 },
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    // =========================
    // 6) Other events
    // =========================
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[salla:webhook] FATAL", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Webhook error" },
      { status: 500 },
    );
  }
}
