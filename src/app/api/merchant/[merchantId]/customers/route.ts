import { NextRequest, NextResponse } from "next/server";

import { sallaGet } from "@/app/lib/salla-client";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> },
) {
  try {
    const { merchantId } = await params;
    const data = await sallaGet(merchantId, "/customers");
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
