// FILE: src/app/api/production/timeline/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  stage_id: string | null;
  active: boolean | null;
};

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
};

type ProductionItemRow = {
  id: string;
  order_id: string;
  salla_item_id: string | null;
  status: string | null;
  created_at: string | null;
};

type StageEventRow = {
  id: string;
  production_item_id: string;
  stage_id: string;
  user_id: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  salla_order_id: string | null;
  customer_name: string | null;
  created_at: string | null;
};

function formatRelativeArabic(dateValue: string | null | undefined) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} دقيقة`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d} ${h}:${min}`;
}

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
      .select("id, stage_id, active")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle<EmployeeRow>();

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 500 },
      );
    }

    if (!employee?.active) {
      return NextResponse.json(
        { error: "EMPLOYEE_NOT_ACTIVE" },
        { status: 403 },
      );
    }

    if (!employee?.stage_id) {
      return NextResponse.json(
        { error: "EMPLOYEE_STAGE_NOT_ASSIGNED" },
        { status: 403 },
      );
    }

    const workerStageId = employee.stage_id;

    const { data: stages, error: stagesError } = await admin
      .from("stages")
      .select("id, name, sort_order")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .order("sort_order", { ascending: true });

    if (stagesError) {
      return NextResponse.json({ error: stagesError.message }, { status: 500 });
    }

    const stageRows = (stages ?? []) as StageRow[];
    const currentStage =
      stageRows.find((stage) => stage.id === workerStageId) ?? null;

    const { data: productionItems, error: productionItemsError } = await admin
      .from("production_items")
      .select("id, order_id, salla_item_id, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (productionItemsError) {
      return NextResponse.json(
        { error: productionItemsError.message },
        { status: 500 },
      );
    }

    const productionItemRows = (productionItems ?? []) as ProductionItemRow[];
    const productionItemIds = productionItemRows.map((item) => item.id);
    const orderIds = [
      ...new Set(productionItemRows.map((item) => item.order_id)),
    ];

    const { data: orders, error: ordersError } = orderIds.length
      ? await admin
          .from("salla_orders")
          .select("id, order_number, salla_order_id, customer_name, created_at")
          .in("id", orderIds)
      : { data: [], error: null };

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const orderRows = (orders ?? []) as OrderRow[];
    const orderMap = new Map(orderRows.map((order) => [order.id, order]));

    const { data: currentStageEvents, error: currentStageEventsError } =
      productionItemIds.length
        ? await admin
            .from("stage_events")
            .select("id, production_item_id, stage_id, user_id, created_at")
            .eq("tenant_id", tenantId)
            .eq("stage_id", workerStageId)
            .in("production_item_id", productionItemIds)
        : { data: [], error: null };

    if (currentStageEventsError) {
      return NextResponse.json(
        { error: currentStageEventsError.message },
        { status: 500 },
      );
    }

    const stageEventRows = (currentStageEvents ?? []) as StageEventRow[];
    const stageEventByItemId = new Map<string, StageEventRow>();

    for (const event of stageEventRows) {
      if (!stageEventByItemId.has(event.production_item_id)) {
        stageEventByItemId.set(event.production_item_id, event);
      }
    }

    const userRecentEvents = stageEventRows
      .filter((event) => event.user_id === user.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    const latestWorkedItemId = userRecentEvents[0]?.production_item_id ?? null;
    const latestWorkedOrderId =
      productionItemRows.find((item) => item.id === latestWorkedItemId)
        ?.order_id ?? null;

    const pendingItems = productionItemRows.filter((item) => {
      if (item.status === "done") return false;
      return !stageEventByItemId.has(item.id);
    });

    const pendingCountByOrder = new Map<string, number>();
    for (const item of pendingItems) {
      pendingCountByOrder.set(
        item.order_id,
        (pendingCountByOrder.get(item.order_id) ?? 0) + 1,
      );
    }

    const completedCountByOrder = new Map<string, number>();
    for (const item of productionItemRows) {
      if (stageEventByItemId.has(item.id)) {
        completedCountByOrder.set(
          item.order_id,
          (completedCountByOrder.get(item.order_id) ?? 0) + 1,
        );
      }
    }

    const totalCountByOrder = new Map<string, number>();
    for (const item of productionItemRows) {
      totalCountByOrder.set(
        item.order_id,
        (totalCountByOrder.get(item.order_id) ?? 0) + 1,
      );
    }

    const fallbackCurrentOrderId =
      [...pendingCountByOrder.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([orderId]) => orderId)[0] ?? null;

    const currentOrderId =
      latestWorkedOrderId ?? fallbackCurrentOrderId ?? null;
    const currentOrder = currentOrderId ? orderMap.get(currentOrderId) : null;

    const currentSummary = currentOrderId
      ? {
          orderId: currentOrderId,
          orderNumber:
            currentOrder?.order_number || currentOrder?.salla_order_id || "-",
          stageName: currentStage?.name || "-",
          totalPieces: totalCountByOrder.get(currentOrderId) ?? 0,
          completedPieces: completedCountByOrder.get(currentOrderId) ?? 0,
          remainingPieces: pendingCountByOrder.get(currentOrderId) ?? 0,
          status:
            (pendingCountByOrder.get(currentOrderId) ?? 0) > 0
              ? "جاري"
              : "مكتمل",
        }
      : null;

    const newOrders = [...pendingCountByOrder.entries()]
      .filter(([orderId]) => orderId !== currentOrderId)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([orderId, count]) => {
        const order = orderMap.get(orderId);
        return {
          orderId,
          orderNumber: order?.order_number || order?.salla_order_id || "-",
          newPieces: count,
          customerName: order?.customer_name || null,
          message:
            count === 1
              ? "دخلت قطعة جديدة في مرحلتك"
              : `دخلت ${count} قطع جديدة في مرحلتك`,
        };
      });

    const recentTimeline = [
      ...userRecentEvents.slice(0, 8).map((event) => {
        const item = productionItemRows.find(
          (row) => row.id === event.production_item_id,
        );
        const order = item ? orderMap.get(item.order_id) : null;

        return {
          type: "stage_completed",
          title: item
            ? `تم تنفيذ قطعة من الطلب ${order?.order_number || order?.salla_order_id || "#-"}`
            : "تم تنفيذ قطعة",
          subtitle: currentStage?.name
            ? `مرحلة ${currentStage.name}`
            : "تم تنفيذ مرحلة",
          time: formatRelativeArabic(event.created_at),
          createdAt: event.created_at,
        };
      }),
      ...newOrders.slice(0, 3).map((entry) => ({
        type: "new_order",
        title: `دخل طلب جديد في مرحلتك ${entry.orderNumber}`,
        subtitle: entry.message,
        time: "الآن",
        createdAt: new Date().toISOString(),
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10)
      .map(({ createdAt, ...rest }) => rest);

    return NextResponse.json({
      ok: true,
      stage: currentStage
        ? {
            id: currentStage.id,
            name: currentStage.name,
            sortOrder: currentStage.sort_order,
          }
        : null,
      currentOrder: currentSummary,
      newOrders,
      timeline: recentTimeline,
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
