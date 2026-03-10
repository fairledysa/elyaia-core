// FILE: src/app/api/production/profile/change-password/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);

    const password = cleanString(body?.password);
    const confirmPassword = cleanString(body?.confirmPassword);

    if (!password || !confirmPassword) {
      return NextResponse.json({ error: "PASSWORD_REQUIRED" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "PASSWORD_TOO_SHORT" },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "PASSWORDS_DO_NOT_MATCH" },
        { status: 400 },
      );
    }

    const { error: updatePasswordError } = await supabase.auth.updateUser({
      password,
    });

    if (updatePasswordError) {
      return NextResponse.json(
        { error: updatePasswordError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "PASSWORD_UPDATED",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
