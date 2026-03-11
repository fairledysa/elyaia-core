// FILE: src/app/api/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function hasOwn(body: Record<string, any>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export async function PATCH(req: Request, ctx: RouteContext) {
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

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const admin = createSupabaseAdminClient();

  const existingEmployee = await admin
    .from("employees")
    .select(
      `
        id,
        user_id,
        tenant_id,
        stage_id,
        job_title,
        pay_type,
        base_salary,
        has_monthly_target,
        monthly_target,
        has_over_target_bonus,
        bonus_per_extra_piece,
        active
      `,
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (existingEmployee.error) {
    return NextResponse.json(
      { ok: false, error: existingEmployee.error.message },
      { status: 500 },
    );
  }

  if (!existingEmployee.data) {
    return NextResponse.json(
      { ok: false, error: "Employee not found" },
      { status: 404 },
    );
  }

  const employee = existingEmployee.data;
  const userId = employee.user_id;

  const profileQ = await admin
    .from("profiles")
    .select("id, full_name, phone, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileQ.error) {
    return NextResponse.json(
      { ok: false, error: profileQ.error.message },
      { status: 500 },
    );
  }

  const currentProfile = profileQ.data || {
    id: userId,
    full_name: null,
    phone: null,
    email: null,
  };

  const isOnlyActiveUpdate =
    hasOwn(body, "active") &&
    !hasOwn(body, "full_name") &&
    !hasOwn(body, "email") &&
    !hasOwn(body, "phone") &&
    !hasOwn(body, "password") &&
    !hasOwn(body, "stage_id") &&
    !hasOwn(body, "pay_type") &&
    !hasOwn(body, "base_salary") &&
    !hasOwn(body, "has_monthly_target") &&
    !hasOwn(body, "monthly_target") &&
    !hasOwn(body, "has_over_target_bonus") &&
    !hasOwn(body, "bonus_per_extra_piece");

  if (isOnlyActiveUpdate) {
    const employeeUpdate = await admin
      .from("employees")
      .update({
        active: Boolean(body.active),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select("*")
      .single();

    if (employeeUpdate.error) {
      return NextResponse.json(
        { ok: false, error: employeeUpdate.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      item: employeeUpdate.data,
    });
  }

  const full_name = hasOwn(body, "full_name")
    ? String(body.full_name || "").trim()
    : String(currentProfile.full_name || "").trim();

  const email = hasOwn(body, "email")
    ? String(body.email || "")
        .trim()
        .toLowerCase()
    : String(currentProfile.email || "")
        .trim()
        .toLowerCase();

  const phone = hasOwn(body, "phone")
    ? String(body.phone || "").trim() || null
    : currentProfile.phone || null;

  const pay_type = hasOwn(body, "pay_type")
    ? String(body.pay_type || "").trim()
    : employee.pay_type || "salary";

  const active = hasOwn(body, "active")
    ? Boolean(body.active)
    : Boolean(employee.active);

  const has_monthly_target = hasOwn(body, "has_monthly_target")
    ? Boolean(body.has_monthly_target)
    : Boolean(employee.has_monthly_target);

  const monthly_target =
    has_monthly_target &&
    hasOwn(body, "monthly_target") &&
    body.monthly_target !== "" &&
    body.monthly_target != null
      ? Number(body.monthly_target)
      : has_monthly_target
        ? employee.monthly_target
        : null;

  const has_over_target_bonus = has_monthly_target
    ? hasOwn(body, "has_over_target_bonus")
      ? Boolean(body.has_over_target_bonus)
      : Boolean(employee.has_over_target_bonus)
    : false;

  const bonus_per_extra_piece =
    has_over_target_bonus &&
    hasOwn(body, "bonus_per_extra_piece") &&
    body.bonus_per_extra_piece !== "" &&
    body.bonus_per_extra_piece != null
      ? Number(body.bonus_per_extra_piece)
      : has_over_target_bonus
        ? Number(employee.bonus_per_extra_piece || 0)
        : 0;

  const base_salary = hasOwn(body, "base_salary")
    ? Number(body.base_salary ?? 0)
    : Number(employee.base_salary ?? 0);

  const password = hasOwn(body, "password")
    ? String(body.password || "").trim()
    : "";

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

  if (!["salary", "piece"].includes(pay_type)) {
    return NextResponse.json(
      { ok: false, error: "Invalid pay_type" },
      { status: 400 },
    );
  }

  let stage_id = employee.stage_id;
  let job_title = employee.job_title;

  if (hasOwn(body, "stage_id")) {
    const requestedStageId = String(body.stage_id || "").trim();

    if (!requestedStageId) {
      return NextResponse.json(
        { ok: false, error: "Missing stage_id" },
        { status: 400 },
      );
    }

    // اسمح بحفظ نفس المرحلة القديمة كما هي حتى لو كانت مؤرشفة أو غير موجودة ضمن القائمة الحالية
    // وتحقق فقط إذا المستخدم اختار مرحلة جديدة مختلفة
    if (requestedStageId !== employee.stage_id) {
      const stageCheck = await admin
        .from("stages")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("id", requestedStageId)
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

      stage_id = stageCheck.data.id;
      job_title = stageCheck.data.name || null;
    }
  }

  if (!stage_id) {
    return NextResponse.json(
      { ok: false, error: "Missing stage_id" },
      { status: 400 },
    );
  }

  const profileEmailCheck = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .neq("id", userId)
    .maybeSingle();

  if (profileEmailCheck.error) {
    return NextResponse.json(
      { ok: false, error: profileEmailCheck.error.message },
      { status: 500 },
    );
  }

  if (profileEmailCheck.data) {
    return NextResponse.json(
      { ok: false, error: "Email already used by another user" },
      { status: 400 },
    );
  }

  const updateUserRes = await admin.auth.admin.updateUserById(userId, {
    email,
    ...(password ? { password } : {}),
    user_metadata: {
      full_name,
      phone: phone || "",
      source: "employee_update",
    },
  });

  if (updateUserRes.error) {
    return NextResponse.json(
      { ok: false, error: updateUserRes.error.message },
      { status: 500 },
    );
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

  const employeeUpdate = await admin
    .from("employees")
    .update({
      stage_id,
      job_title,
      pay_type,
      base_salary:
        pay_type === "salary" && Number.isFinite(base_salary) ? base_salary : 0,
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
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("*")
    .single();

  if (employeeUpdate.error) {
    return NextResponse.json(
      { ok: false, error: employeeUpdate.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    item: employeeUpdate.data,
  });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
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

  const { id } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const employeeQ = await admin
    .from("employees")
    .select("id, user_id, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (employeeQ.error) {
    return NextResponse.json(
      { ok: false, error: employeeQ.error.message },
      { status: 500 },
    );
  }

  if (!employeeQ.data) {
    return NextResponse.json(
      { ok: false, error: "Employee not found" },
      { status: 404 },
    );
  }

  const employee = employeeQ.data;

  const stageEventsQ = await admin
    .from("stage_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("user_id", employee.user_id);

  if (stageEventsQ.error) {
    return NextResponse.json(
      { ok: false, error: stageEventsQ.error.message },
      { status: 500 },
    );
  }

  const walletMovesQ = await admin
    .from("wallet_moves")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("user_id", employee.user_id);

  if (walletMovesQ.error) {
    return NextResponse.json(
      { ok: false, error: walletMovesQ.error.message },
      { status: 500 },
    );
  }

  const hasHistory =
    (stageEventsQ.count ?? 0) > 0 || (walletMovesQ.count ?? 0) > 0;

  if (hasHistory) {
    const blockRes = await admin
      .from("employees")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id);

    if (blockRes.error) {
      return NextResponse.json(
        { ok: false, error: blockRes.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "blocked_instead_of_delete",
    });
  }

  const deleteEmployee = await admin
    .from("employees")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (deleteEmployee.error) {
    return NextResponse.json(
      { ok: false, error: deleteEmployee.error.message },
      { status: 500 },
    );
  }

  const deleteMember = await admin
    .from("tenant_members")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", employee.user_id);

  if (deleteMember.error) {
    return NextResponse.json(
      { ok: false, error: deleteMember.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "deleted",
  });
}
