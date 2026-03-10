//src/app/api/inventory/moves/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type MaterialRow = {
  id: string;
  name: string | null;
  unit: string | null;
};

type MoveRow = {
  id: string;
  material_id: string;
  stage_event_id: string | null;
  quantity: number;
  move_type: string;
  unit_cost: number | null;
  total_cost: number | null;
  note: string | null;
  user_id: string | null;
  created_by: string | null;
  running_balance: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

export async function GET(req: Request) {
  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();

  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId } = await requireTenant({ userId: u.user.id, sb });
  const url = new URL(req.url);

  const materialId = (url.searchParams.get("material_id") || "").trim();
  const moveType = (url.searchParams.get("move_type") || "").trim();
  const createdBy = (url.searchParams.get("created_by") || "").trim();
  const from = (url.searchParams.get("from") || "").trim();
  const to = (url.searchParams.get("to") || "").trim();

  const limitRaw = Number(url.searchParams.get("limit") || 300);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 1000)
    : 300;

  const admin = createSupabaseAdminClient();

  const materialsRes = await admin
    .from("materials")
    .select("id,name,unit")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (materialsRes.error) {
    return NextResponse.json(
      { ok: false, error: materialsRes.error.message },
      { status: 500 },
    );
  }

  let q = admin
    .from("inventory_moves")
    .select(
      "id,material_id,stage_event_id,quantity,move_type,unit_cost,total_cost,note,user_id,created_by,running_balance,meta,created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (materialId) q = q.eq("material_id", materialId);
  if (moveType) q = q.eq("move_type", moveType);
  if (createdBy) q = q.eq("created_by", createdBy);
  if (from) q = q.gte("created_at", `${from}T00:00:00`);
  if (to) q = q.lte("created_at", `${to}T23:59:59.999`);

  const r = await q;

  if (r.error) {
    return NextResponse.json(
      { ok: false, error: r.error.message },
      { status: 500 },
    );
  }

  const rows: MoveRow[] = Array.isArray(r.data) ? (r.data as MoveRow[]) : [];
  const allMaterials = Array.isArray(materialsRes.data)
    ? (materialsRes.data as MaterialRow[])
    : [];

  const materialsMap = new Map(
    allMaterials.map((m) => [
      m.id,
      {
        name: m.name || null,
        unit: m.unit || null,
      },
    ]),
  );

  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.user_id, row.created_by])
        .filter((v): v is string => !!v),
    ),
  );

  let profilesMap = new Map<string, ProfileRow>();

  if (profileIds.length) {
    const profilesRes = await admin
      .from("profiles")
      .select("id,full_name,email")
      .in("id", profileIds);

    if (!profilesRes.error && Array.isArray(profilesRes.data)) {
      profilesMap = new Map(
        (profilesRes.data as ProfileRow[]).map((p) => [p.id, p]),
      );
    }
  }

  const items = rows.map((row) => {
    const meta = asObject(row.meta) || {};
    const material = materialsMap.get(row.material_id) || null;

    const createdByProfile = row.created_by
      ? profilesMap.get(row.created_by) || null
      : null;

    const userProfile = row.user_id
      ? profilesMap.get(row.user_id) || null
      : null;

    const quantity = Number(row.quantity || 0);
    const direction = quantity > 0 ? "in" : quantity < 0 ? "out" : "neutral";

    return {
      id: row.id,
      material_id: row.material_id,
      material_name: material?.name || null,
      material_unit: material?.unit || null,
      stage_event_id: row.stage_event_id,
      quantity,
      move_type: row.move_type,
      direction,
      unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
      total_cost: row.total_cost == null ? null : Number(row.total_cost),
      note: row.note || null,
      running_balance:
        row.running_balance == null ? null : Number(row.running_balance),
      created_at: row.created_at,

      created_by: row.created_by
        ? {
            id: row.created_by,
            name:
              createdByProfile?.full_name ||
              createdByProfile?.email ||
              row.created_by,
          }
        : null,

      user: row.user_id
        ? {
            id: row.user_id,
            name: userProfile?.full_name || userProfile?.email || row.user_id,
          }
        : null,

      meta: {
        source: typeof meta.source === "string" ? meta.source : null,
        created_from:
          typeof meta.created_from === "string" ? meta.created_from : null,
        reason: typeof meta.reason === "string" ? meta.reason : null,
        order_id: typeof meta.order_id === "string" ? meta.order_id : null,
        order_number:
          typeof meta.order_number === "string" ||
          typeof meta.order_number === "number"
            ? String(meta.order_number)
            : null,
        production_item_id:
          typeof meta.production_item_id === "string"
            ? meta.production_item_id
            : null,
        quantity_index:
          typeof meta.quantity_index === "number" ||
          typeof meta.quantity_index === "string"
            ? Number(meta.quantity_index)
            : null,
        salla_item_id:
          typeof meta.salla_item_id === "string" ? meta.salla_item_id : null,
        sku: typeof meta.sku === "string" ? meta.sku : null,
        product_name:
          typeof meta.product_name === "string" ? meta.product_name : null,
        stage_id: typeof meta.stage_id === "string" ? meta.stage_id : null,
        stage_name:
          typeof meta.stage_name === "string" ? meta.stage_name : null,
        employee_id:
          typeof meta.employee_id === "string" ? meta.employee_id : null,
        employee_user_id:
          typeof meta.employee_user_id === "string"
            ? meta.employee_user_id
            : null,
        employee_name:
          typeof meta.employee_name === "string" ? meta.employee_name : null,
      },
    };
  });

  const materials = allMaterials.map((m) => ({
    id: m.id,
    name: m.name || "—",
    unit: m.unit || null,
  }));

  const executorsMap = new Map<string, { id: string; name: string }>();
  for (const item of items) {
    if (item.created_by?.id && item.created_by?.name) {
      executorsMap.set(item.created_by.id, item.created_by);
    }
  }

  const executors = Array.from(executorsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ar"),
  );

  return NextResponse.json({
    ok: true,
    items,
    materials,
    executors,
    filters: {
      material_id: materialId || null,
      move_type: moveType || null,
      created_by: createdBy || null,
      from: from || null,
      to: to || null,
      limit,
    },
  });
}
