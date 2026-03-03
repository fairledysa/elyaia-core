import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-salla-signature");

  const secret = process.env.SALLA_WEBHOOK_SECRET || "";

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // تحقق من التوقيع
  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  console.log("📩 Salla Webhook Event:", body.event);

  // عند تثبيت التطبيق
  if (body.event === "app.store.authorize") {
    const merchantId = body.merchant?.id;
    const accessToken = body.access_token;

    console.log("🟢 New Store Authorized:");
    console.log("Merchant ID:", merchantId);
    console.log("Access Token:", accessToken);

    // هنا لاحقاً نحفظهم في قاعدة البيانات
  }

  // عند إنشاء طلب
  if (body.event === "order.created") {
    console.log("🛒 New Order Received:");
    console.log(body.data);
  }

  return NextResponse.json({ success: true });
}
