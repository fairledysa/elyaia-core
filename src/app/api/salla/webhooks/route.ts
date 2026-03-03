// src/app/api/salla/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs"; // مهم مع kv

type SallaWebhookBody = {
  event: string;
  merchant?: number;
  created_at?: string;
  data?: any;
};

function getHeader(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

export async function POST(req: NextRequest) {
  try {
    // 1) تحقق من سرّ الـ webhook (Token strategy)
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

    // 2) اقرأ البودي
    const body = (await req.json()) as SallaWebhookBody;

    // 3) أهم حدث عندنا بالنمط السهل: app.store.authorize
    if (body.event === "app.store.authorize") {
      const merchantId = body.merchant;
      const accessToken = body.data?.access_token;
      const refreshToken = body.data?.refresh_token;
      const expires = body.data?.expires; // رقم (timestamp)
      const scope = body.data?.scope;

      if (!merchantId || !accessToken) {
        return NextResponse.json(
          { ok: false, error: "Missing merchant/token" },
          { status: 400 },
        );
      }

      // خزّن توكن المتجر
      await kv.hset(`salla:merchant:${merchantId}`, {
        merchantId: String(merchantId),
        accessToken,
        refreshToken: refreshToken || "",
        expires: String(expires || ""),
        scope: scope || "",
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true });
    }

    // 4) إذا انحذف التطبيق من المتجر: امسح بياناته
    if (body.event === "app.uninstalled") {
      const merchantId = body.merchant;
      if (merchantId) {
        await kv.del(`salla:merchant:${merchantId}`);
      }
      return NextResponse.json({ ok: true });
    }

    // باقي الأحداث نعدّيها الآن
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Webhook error" },
      { status: 500 },
    );
  }
}
