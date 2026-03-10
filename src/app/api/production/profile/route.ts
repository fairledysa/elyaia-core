// FILE: src/app/api/production/profile/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  active: boolean | null;
  pay_type: string | null;
  stage_id: string | null;
  user_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type StageRow = {
  id: string;
  name: string;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    if (!membership?.tenant_id) {
      return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 403 });
    }

    const tenantId = membership.tenant_id;

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, active, pay_type, stage_id, user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle<EmployeeRow>();

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 500 },
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, phone, email")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    let stage: StageRow | null = null;

    if (employee.stage_id) {
      const { data: stageRow, error: stageError } = await admin
        .from("stages")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("id", employee.stage_id)
        .maybeSingle<StageRow>();

      if (stageError) {
        return NextResponse.json(
          { error: stageError.message },
          { status: 500 },
        );
      }

      stage = stageRow ?? null;
    }

    return NextResponse.json({
      ok: true,
      profile: {
        name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        email: profile?.email ?? user.email ?? null,
        stage: stage?.name ?? null,
        active: employee.active ?? null,
        payType: employee.pay_type ?? null,
      },
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
