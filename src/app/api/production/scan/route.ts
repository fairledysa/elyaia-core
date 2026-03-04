// FILE: src/app/api/production/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      },
    );

    const { data: auth } = await sb.auth.getUser();

    if (!auth.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();

    const qr_code = body.qr_code;
    const stage_id = body.stage_id;

    if (!qr_code || !stage_id) {
      return NextResponse.json(
        { ok: false, error: "Missing qr_code or stage_id" },
        { status: 400 },
      );
    }

    const { data: item, error } = await sb
      .from("production_items")
      .select("id")
      .eq("qr_code", qr_code)
      .maybeSingle();

    if (error) throw error;

    if (!item) {
      return NextResponse.json(
        { ok: false, error: "Item not found" },
        { status: 404 },
      );
    }

    const { error: insertError } = await sb.from("stage_events").insert({
      production_item_id: item.id,
      stage_id,
      user_id: auth.user.id,
    });

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
