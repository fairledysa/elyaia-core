// FILE: src/app/api/finance/warnings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  user_id: string;
  active: boolean | null;
  stage_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type StageRow = {
  id: string;
  name: string;
};

type WarningRow = {
  id: string;
  employee_id: string;
  stage_id: string | null;
  warning_type: string;
  severity: string;
  note: string | null;
  reason: string | null;
  created_at: string | null;
};

function toIsoStart(value: string | null) {
  if (!value) return null;
  return `${value}T00:00:00.000Z`;
}

function toIsoEnd(value: string | null) {
  if (!value) return null;
  return `${value}T23:59:59.999Z`;
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await sb.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({ userId: user.id, sb });

    const searchParams = req.nextUrl.searchParams;
    const employeeId = searchParams.get("employeeId");
    const stageId = searchParams.get("stageId");
    const warningType = searchParams.get("warningType");
    const severity = searchParams.get("severity");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromIso = toIsoStart(from);
    const toIso = toIsoEnd(to);

    const [
      { data: employees, error: employeesError },
      { data: stages, error: stagesError },
    ] = await Promise.all([
      admin
        .from("employees")
        .select("id, user_id, active, stage_id")
        .eq("tenant_id", tenantId),
      admin
        .from("stages")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .order("sort_order", { ascending: true }),
    ]);

    if (employeesError) {
      return NextResponse.json(
        { ok: false, error: employeesError.message },
        { status: 500 },
      );
    }

    if (stagesError) {
      return NextResponse.json(
        { ok: false, error: stagesError.message },
        { status: 500 },
      );
    }

    const employeeRows = (employees ?? []) as EmployeeRow[];
    const userIds = employeeRows.map((item) => item.user_id);

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      return NextResponse.json(
        { ok: false, error: profilesError.message },
        { status: 500 },
      );
    }

    let query = admin
      .from("employee_warnings")
      .select(
        "id, employee_id, stage_id, warning_type, severity, note, reason, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (employeeId && employeeId !== "all")
      query = query.eq("employee_id", employeeId);
    if (stageId && stageId !== "all") query = query.eq("stage_id", stageId);
    if (warningType && warningType !== "all")
      query = query.eq("warning_type", warningType);
    if (severity && severity !== "all") query = query.eq("severity", severity);
    if (fromIso) query = query.gte("created_at", fromIso);
    if (toIso) query = query.lte("created_at", toIso);

    const { data: warnings, error: warningsError } = await query;

    if (warningsError) {
      return NextResponse.json(
        { ok: false, error: warningsError.message },
        { status: 500 },
      );
    }

    const profileMap = new Map(
      ((profiles ?? []) as ProfileRow[]).map((item) => [
        item.id,
        item.full_name,
      ]),
    );

    const employeeMap = new Map(employeeRows.map((item) => [item.id, item]));
    const stageMap = new Map(
      ((stages ?? []) as StageRow[]).map((item) => [item.id, item.name]),
    );

    return NextResponse.json({
      ok: true,
      employees: employeeRows.map((item) => ({
        id: item.id,
        full_name: profileMap.get(item.user_id) ?? null,
        stage_name: item.stage_id
          ? (stageMap.get(item.stage_id) ?? null)
          : null,
        active: !!item.active,
      })),
      stages: ((stages ?? []) as StageRow[]).map((item) => ({
        id: item.id,
        name: item.name,
      })),
      items: ((warnings ?? []) as WarningRow[]).map((item) => ({
        id: item.id,
        employee_id: item.employee_id,
        employee_name:
          profileMap.get(employeeMap.get(item.employee_id)?.user_id || "") ??
          null,
        stage_id: item.stage_id,
        stage_name: item.stage_id
          ? (stageMap.get(item.stage_id) ?? null)
          : null,
        warning_type: item.warning_type,
        severity: item.severity,
        note: item.note,
        reason: item.reason,
        created_at: item.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await sb.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const { tenantId, role } = await requireTenant({ userId: user.id, sb });

    if (!["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const employee_id = String(body?.employee_id || "").trim();
    const stage_id = body?.stage_id ? String(body.stage_id).trim() : null;
    const warning_type = String(body?.warning_type || "other").trim();
    const severity = String(body?.severity || "medium").trim();
    const note = String(body?.note || "").trim() || null;
    const reason = String(body?.reason || "").trim() || null;

    if (!employee_id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_EMPLOYEE_ID" },
        { status: 400 },
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from("employee_warnings")
      .insert({
        tenant_id: tenantId,
        employee_id,
        stage_id,
        warning_type,
        severity,
        note,
        reason,
        issued_by: user.id,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, item: inserted });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
