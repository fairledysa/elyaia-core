// FILE: src/app/api/production/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  user_id: string;
  active: boolean;
};

type ProfileRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const admin = createSupabaseAdminClient();
    const body = await req.json();
    const identifier = String(body?.identifier || "").trim();

    if (!identifier) {
      return NextResponse.json(
        { error: "IDENTIFIER_REQUIRED" },
        { status: 400 },
      );
    }

    const looksLikeEmail = identifier.includes("@");
    const normalizedInput = normalizePhone(identifier);

    let profile: ProfileRow | null = null;

    if (looksLikeEmail) {
      const { data, error } = await admin
        .from("profiles")
        .select("id, email, phone")
        .ilike("email", identifier)
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      profile = data as ProfileRow | null;
    } else {
      const { data, error } = await admin
        .from("profiles")
        .select("id, email, phone");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      profile =
        ((data as ProfileRow[]).find((row) => {
          const phone = normalizePhone(String(row.phone || ""));
          return phone === normalizedInput;
        }) as ProfileRow | undefined) ?? null;
    }

    if (!profile?.id) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, user_id, active")
      .eq("user_id", profile.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle<EmployeeRow>();

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 500 },
      );
    }

    if (!employee?.id) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_ACTIVE" },
        { status: 403 },
      );
    }

    if (!profile.email) {
      return NextResponse.json(
        { error: "EMPLOYEE_EMAIL_NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      email: profile.email,
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
