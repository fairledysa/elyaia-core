import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text(); // مهم: نقرأ نص خام
    console.log("Salla webhook headers:", Object.fromEntries(req.headers));
    console.log("Salla webhook body:", bodyText);

    // ارجع 200 دايمًا كبداية
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { ok: false, error: "bad_request" },
      { status: 400 },
    );
  }
}

// اختياري: لو تبي GET ما يعطي 405
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET" });
}
