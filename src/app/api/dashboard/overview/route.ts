// FILE: src/app/api/dashboard/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
};

type StageEventRow = {
  id: string;
  stage_id: string;
  created_at: string | null;
};

type NotificationRow = {
  id: string;
  title: string;
  text: string;
  type: string | null;
  tone: string | null;
  created_at: string | null;
};

type MaterialRow = {
  id: string;
  name: string;
  on_hand: number | null;
  reorder_level: number | null;
  unit: string | null;
};

type InventoryMoveRow = {
  id: string;
  material_id: string;
  quantity: number | null;
  move_type: string;
  created_at: string | null;
  note: string | null;
};

type ProductionItemRow = {
  order_id: string;
  status: string | null;
  created_at: string | null;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  status: string | null;
  created_at: string | null;
};

function getMonthBounds(monthValue: string | null) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (monthValue && /^\d{4}-\d{2}$/.test(monthValue)) {
    year = Number(monthValue.slice(0, 4));
    month = Number(monthValue.slice(5, 7)) - 1;
  }

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return {
    year,
    month: month + 1,
    monthKey: `${year}-${String(month + 1).padStart(2, "0")}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    daysInMonth: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  };
}

function dayKeyFromIso(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCDate();
}

function mapMoveType(type: string) {
  if (type === "purchase_in") return "شراء";
  if (type === "manual_add") return "إضافة";
  if (type === "manual_remove") return "سحب";
  if (type === "adjustment") return "تسوية";
  if (type === "return_in") return "مرتجع";
  if (type === "production_deduct") return "صرف إنتاج";
  return type || "-";
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
    const stageId = searchParams.get("stageId");
    const month = searchParams.get("month");

    const { monthKey, startIso, endIso, daysInMonth } = getMonthBounds(month);

    const [
      { data: stages, error: stagesError },
      { data: notifications, error: notificationsError },
      { data: materials, error: materialsError },
      { data: inventoryMoves, error: inventoryMovesError },
      { data: productionItems, error: productionItemsError },
    ] = await Promise.all([
      admin
        .from("stages")
        .select("id, name, sort_order")
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .order("sort_order", { ascending: true }),
      admin
        .from("notifications")
        .select("id, title, text, type, tone, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(12),
      admin
        .from("materials")
        .select("id, name, on_hand, reorder_level, unit")
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true }),
      admin
        .from("inventory_moves")
        .select("id, material_id, quantity, move_type, created_at, note")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("production_items")
        .select("order_id, status, created_at")
        .eq("tenant_id", tenantId),
    ]);

    if (stagesError) {
      return NextResponse.json(
        { ok: false, error: stagesError.message },
        { status: 500 },
      );
    }

    if (notificationsError) {
      return NextResponse.json(
        { ok: false, error: notificationsError.message },
        { status: 500 },
      );
    }

    if (materialsError) {
      return NextResponse.json(
        { ok: false, error: materialsError.message },
        { status: 500 },
      );
    }

    if (inventoryMovesError) {
      return NextResponse.json(
        { ok: false, error: inventoryMovesError.message },
        { status: 500 },
      );
    }

    if (productionItemsError) {
      return NextResponse.json(
        { ok: false, error: productionItemsError.message },
        { status: 500 },
      );
    }

    let stageEventsQuery = admin
      .from("stage_events")
      .select("id, stage_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso);

    if (stageId && stageId !== "all") {
      stageEventsQuery = stageEventsQuery.eq("stage_id", stageId);
    }

    const { data: stageEvents, error: stageEventsError } =
      await stageEventsQuery;

    if (stageEventsError) {
      return NextResponse.json(
        { ok: false, error: stageEventsError.message },
        { status: 500 },
      );
    }

    const stageRows = (stages ?? []) as StageRow[];
    const stageMap = new Map(stageRows.map((item) => [item.id, item.name]));
    const materialMap = new Map(
      ((materials ?? []) as MaterialRow[]).map((item) => [item.id, item]),
    );

    const productionSeries = Array.from(
      { length: daysInMonth },
      (_, index) => ({
        day: index + 1,
        label: `${index + 1}/${monthKey.slice(5, 7)}`,
        value: 0,
      }),
    );

    for (const event of (stageEvents ?? []) as StageEventRow[]) {
      const day = dayKeyFromIso(event.created_at);
      if (!day || !productionSeries[day - 1]) continue;
      productionSeries[day - 1].value += 1;
    }

    const lowStockItems = ((materials ?? []) as MaterialRow[])
      .filter((item) => {
        const onHand = Number(item.on_hand ?? 0);
        const reorderLevel = Number(item.reorder_level ?? 0);
        return reorderLevel > 0 && onHand <= reorderLevel;
      })
      .sort(
        (a, b) =>
          Number(a.on_hand ?? 0) - Number(b.on_hand ?? 0) ||
          Number(a.reorder_level ?? 0) - Number(b.reorder_level ?? 0),
      )
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        name: item.name,
        onHand: Number(item.on_hand ?? 0),
        reorderLevel: Number(item.reorder_level ?? 0),
        unit: item.unit ?? "",
      }));

    const latestInventoryMoves = (
      (inventoryMoves ?? []) as InventoryMoveRow[]
    ).map((item) => ({
      id: item.id,
      materialName: materialMap.get(item.material_id)?.name ?? "مادة",
      quantity: Number(item.quantity ?? 0),
      moveType: item.move_type,
      moveTypeLabel: mapMoveType(item.move_type),
      note: item.note ?? null,
      createdAt: item.created_at,
    }));

    const readyOrderIds = Array.from(
      ((productionItems ?? []) as ProductionItemRow[]).reduce((map, item) => {
        if (!map.has(item.order_id)) {
          map.set(item.order_id, []);
        }
        map.get(item.order_id)!.push(item);
        return map;
      }, new Map<string, ProductionItemRow[]>()),
    )
      .filter(
        ([, items]) =>
          items.length > 0 &&
          items.every((item) => item.status === "completed"),
      )
      .map(([orderId]) => orderId)
      .slice(0, 8);

    let readyOrders: OrderRow[] = [];
    if (readyOrderIds.length > 0) {
      const { data: orders, error: ordersError } = await admin
        .from("salla_orders")
        .select(
          "id, order_number, customer_name, customer_phone, customer_city, status, created_at",
        )
        .in("id", readyOrderIds)
        .order("created_at", { ascending: false });

      if (ordersError) {
        return NextResponse.json(
          { ok: false, error: ordersError.message },
          { status: 500 },
        );
      }

      readyOrders = (orders ?? []) as OrderRow[];
    }

    const alertFeed = [
      ...((notifications ?? []) as NotificationRow[]).map((item) => ({
        id: `notification-${item.id}`,
        kind: "notification",
        title: item.title,
        text: item.text,
        createdAt: item.created_at,
      })),
      ...lowStockItems.map((item) => ({
        id: `low-stock-${item.id}`,
        kind: "low_stock",
        title: `تنبيه مخزون: ${item.name}`,
        text: `المتبقي ${item.onHand} ${item.unit} وحد التنبيه ${item.reorderLevel}`,
        createdAt: null as string | null,
      })),
      ...latestInventoryMoves.slice(0, 6).map((item) => ({
        id: `inventory-move-${item.id}`,
        kind: "inventory_move",
        title: `حركة مخزون: ${item.materialName}`,
        text: `${item.moveTypeLabel} - الكمية ${item.quantity}`,
        createdAt: item.createdAt,
      })),
    ].slice(0, 12);

    return NextResponse.json({
      ok: true,
      filters: {
        stageId: stageId || "all",
        month: monthKey,
      },
      options: {
        stages: stageRows.map((item) => ({
          id: item.id,
          name: item.name,
        })),
      },
      production: {
        total: productionSeries.reduce((sum, item) => sum + item.value, 0),
        stageName:
          stageId && stageId !== "all"
            ? (stageMap.get(stageId) ?? "مرحلة")
            : "كل المراحل",
        series: productionSeries,
      },
      alerts: alertFeed,
      lowStock: lowStockItems,
      inventoryMoves: latestInventoryMoves,
      readyOrders: readyOrders.map((item) => ({
        id: item.id,
        orderNumber: item.order_number,
        customerName: item.customer_name,
        customerPhone: item.customer_phone,
        customerCity: item.customer_city,
        status: item.status,
        createdAt: item.created_at,
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
