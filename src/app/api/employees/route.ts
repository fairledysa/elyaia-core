// FILE: src/app/api/employees/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  stage_id: string | null;
  job_title: string | null;
  pay_type: string | null;
  base_salary: number | null;
  monthly_target: number | null;
  has_monthly_target: boolean | null;
  has_over_target_bonus: boolean | null;
  bonus_per_extra_piece: number | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type MemberRow = {
  user_id: string;
  role: string | null;
};

type StageRow = {
  id: string;
  name: string;
};

function randomPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId } = await requireTenant({ userId: user.id, sb });
  const admin = createSupabaseAdminClient();

  const employeesQ = await admin
    .from("employees")
    .select(
      "id, tenant_id, user_id, stage_id, job_title, pay_type, base_salary, monthly_target, has_monthly_target, has_over_target_bonus, bonus_per_extra_piece, active, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (employeesQ.error) {
    return NextResponse.json(
      { ok: false, error: employeesQ.error.message },
      { status: 500 },
    );
  }

  const employees = (employeesQ.data || []) as EmployeeRow[];
  const userIds = [...new Set(employees.map((e) => e.user_id).filter(Boolean))];
  const stageIds = [
    ...new Set(employees.map((e) => e.stage_id).filter(Boolean)),
  ] as string[];

  let profilesByUserId = new Map<string, ProfileRow>();
  let membersByUserId = new Map<string, MemberRow>();
  let stagesById = new Map<string, StageRow>();

  if (userIds.length > 0) {
    const profilesQ = await admin
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", userIds);

    if (profilesQ.error) {
      return NextResponse.json(
        { ok: false, error: profilesQ.error.message },
        { status: 500 },
      );
    }

    const membersQ = await admin
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantId)
      .in("user_id", userIds);

    if (membersQ.error) {
      return NextResponse.json(
        { ok: false, error: membersQ.error.message },
        { status: 500 },
      );
    }

    profilesByUserId = new Map(
      ((profilesQ.data || []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    membersByUserId = new Map(
      ((membersQ.data || []) as MemberRow[]).map((m) => [m.user_id, m]),
    );
  }

  if (stageIds.length > 0) {
    const stagesQ = await admin
      .from("stages")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", stageIds);

    if (stagesQ.error) {
      return NextResponse.json(
        { ok: false, error: stagesQ.error.message },
        { status: 500 },
      );
    }

    stagesById = new Map(
      ((stagesQ.data || []) as StageRow[]).map((s) => [s.id, s]),
    );
  }

  const items = employees.map((row) => {
    const profile = profilesByUserId.get(row.user_id) || null;
    const member = membersByUserId.get(row.user_id) || null;
    const stage = row.stage_id ? stagesById.get(row.stage_id) || null : null;

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      role: member?.role ?? null,
      stage_id: row.stage_id ?? null,
      stage_name: stage?.name ?? null,
      job_title: row.job_title ?? null,
      pay_type: row.pay_type ?? "salary",
      base_salary: row.base_salary ?? 0,
      monthly_target: row.monthly_target ?? null,
      has_monthly_target: !!row.has_monthly_target,
      has_over_target_bonus: !!row.has_over_target_bonus,
      bonus_per_extra_piece: row.bonus_per_extra_piece ?? 0,
      active: !!row.active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId, role } = await requireTenant({ userId: user.id, sb });

  if (role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));

  const full_name = String(body?.full_name || "").trim();
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const phone = String(body?.phone || "").trim() || null;
  const stage_id = String(body?.stage_id || "").trim();
  const pay_type = String(body?.pay_type || "").trim() || "salary";
  const base_salary = Number(body?.base_salary ?? 0);
  const has_monthly_target = Boolean(body?.has_monthly_target ?? false);
  const monthly_target =
    has_monthly_target &&
    body?.monthly_target !== "" &&
    body?.monthly_target != null
      ? Number(body.monthly_target)
      : null;
  const has_over_target_bonus = Boolean(body?.has_over_target_bonus ?? false);
  const bonus_per_extra_piece =
    has_over_target_bonus &&
    body?.bonus_per_extra_piece !== "" &&
    body?.bonus_per_extra_piece != null
      ? Number(body.bonus_per_extra_piece)
      : 0;
  const active = body?.active === undefined ? true : Boolean(body.active);

  const inputPassword = String(body?.password || "").trim();
  const finalPassword = inputPassword || randomPassword();

  if (!full_name) {
    return NextResponse.json(
      { ok: false, error: "Missing full_name" },
      { status: 400 },
    );
  }

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Missing email" },
      { status: 400 },
    );
  }

  if (!stage_id) {
    return NextResponse.json(
      { ok: false, error: "Missing stage_id" },
      { status: 400 },
    );
  }

  if (!["salary", "piece"].includes(pay_type)) {
    return NextResponse.json(
      { ok: false, error: "Invalid pay_type" },
      { status: 400 },
    );
  }

  if (finalPassword.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  const stageCheck = await admin
    .from("stages")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("id", stage_id)
    .eq("archived", false)
    .maybeSingle();

  if (stageCheck.error) {
    return NextResponse.json(
      { ok: false, error: stageCheck.error.message },
      { status: 500 },
    );
  }

  if (!stageCheck.data) {
    return NextResponse.json(
      { ok: false, error: "Invalid stage_id" },
      { status: 400 },
    );
  }

  const job_title = stageCheck.data.name || null;

  const existingProfile = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile.error) {
    return NextResponse.json(
      { ok: false, error: existingProfile.error.message },
      { status: 500 },
    );
  }

  let userId = existingProfile.data?.id || null;
  let createdPassword: string | null = null;

  if (!userId) {
    const createUserRes = await admin.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || "",
        source: "employee_create",
      },
    });

    if (createUserRes.error || !createUserRes.data.user) {
      return NextResponse.json(
        {
          ok: false,
          error: createUserRes.error?.message || "Failed to create auth user",
        },
        { status: 500 },
      );
    }

    userId = createUserRes.data.user.id;
    createdPassword = finalPassword;
  } else {
    const updateUserRes = await admin.auth.admin.updateUserById(userId, {
      password: finalPassword,
      email,
      user_metadata: {
        full_name,
        phone: phone || "",
        source: "employee_update",
      },
    });

    if (updateUserRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: updateUserRes.error.message,
        },
        { status: 500 },
      );
    }

    createdPassword = finalPassword;
  }

  const profileUpsert = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name,
        phone,
        email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (profileUpsert.error) {
    return NextResponse.json(
      { ok: false, error: profileUpsert.error.message },
      { status: 500 },
    );
  }

  const memberUpsert = await admin
    .from("tenant_members")
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role: "staff",
      },
      { onConflict: "tenant_id,user_id" },
    )
    .select("tenant_id,user_id,role")
    .single();

  if (memberUpsert.error) {
    return NextResponse.json(
      { ok: false, error: memberUpsert.error.message },
      { status: 500 },
    );
  }

  const employeeUpsert = await admin
    .from("employees")
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        stage_id,
        job_title,
        employment_type: "worker",
        pay_type,
        base_salary:
          pay_type === "salary" && Number.isFinite(base_salary)
            ? base_salary
            : 0,
        piece_rate_enabled: pay_type === "piece",
        has_monthly_target,
        monthly_target:
          has_monthly_target &&
          monthly_target !== null &&
          Number.isFinite(monthly_target)
            ? monthly_target
            : null,
        has_over_target_bonus,
        bonus_per_extra_piece:
          has_over_target_bonus && Number.isFinite(bonus_per_extra_piece)
            ? bonus_per_extra_piece
            : 0,
        active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,user_id" },
    )
    .select(
      "id, tenant_id, user_id, stage_id, job_title, pay_type, base_salary, monthly_target, has_monthly_target, has_over_target_bonus, bonus_per_extra_piece, active, created_at, updated_at",
    )
    .single();

  if (employeeUpsert.error) {
    return NextResponse.json(
      { ok: false, error: employeeUpsert.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    item: employeeUpsert.data,
    credentials: {
      email,
      password: createdPassword,
    },
  });
}
