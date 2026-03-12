// FILE: src/app/api/orders/tracking/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
  archived: boolean | null;
};

type ProductionItemRow = {
  id: string;
  order_id: string;
  salla_item_id: string | null;
  quantity_index: number;
  qr_code: string;
  status: string | null;
  printed_at: string | null;
  print_sequence: number | null;
  print_batch_id: string | null;
};

type StageEventRow = {
  id: string;
  production_item_id: string;
  stage_id: string;
  user_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type OrderItemRow = {
  order_id: string;
  salla_item_id: string | null;
  name: string | null;
  sku: string | null;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  salla_order_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  raw?: unknown;
};

type PrintBatchLinkRow = {
  order_id: string;
  created_at: string;
  print_batches:
    | {
        id: string;
        batch_date: string;
        batch_no: number;
        status: string | null;
      }
    | {
        id: string;
        batch_date: string;
        batch_no: number;
        status: string | null;
      }[]
    | null;
};

type FilterMode = "active" | "completed" | "activity";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function getCityFromRaw(raw: unknown): string | null {
  const record = asRecord(raw);
  if (!record) return null;

  const paths = [
    ["shipping", "address", "city"],
    ["shipping_address", "city"],
    ["address", "city"],
    ["customer", "city"],
    ["city"],
  ];

  for (const path of paths) {
    let current: unknown = record;
    let ok = true;

    for (const key of path) {
      const rec = asRecord(current);
      if (!rec || !(key in rec)) {
        ok = false;
        break;
      }
      current = rec[key];
    }

    if (ok) {
      const str = asString(current);
      if (str) return str;
    }
  }

  return null;
}

function parseMode(value: string | null): FilterMode {
  if (value === "completed") return "completed";
  if (value === "activity") return "activity";
  return "active";
}

function parsePositiveInt(value: string | null, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function clampPageSize(value: number) {
  if (value <= 20) return 20;
  if (value <= 50) return 50;
  return 100;
}

function buildUuidInFilter(column: string, ids: string[]) {
  if (!ids.length) return null;
  return `${column}.in.(${ids.join(",")})`;
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { tenantId } = await requireTenant({ userId: user.id, sb });
    const admin = createSupabaseAdminClient();

    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    const qLower = q.toLowerCase();
    const mode = parseMode(req.nextUrl.searchParams.get("mode"));
    const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
    const pageSize = clampPageSize(
      parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 20),
    );

    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    const { data: stagesData, error: stagesError } = await admin
      .from("stages")
      .select("id, name, sort_order, archived")
      .eq("tenant_id", tenantId)
      .eq("archived", false)
      .order("sort_order", { ascending: true });

    if (stagesError) {
      return NextResponse.json(
        { ok: false, error: stagesError.message },
        { status: 500 },
      );
    }

    const stages = (stagesData || []) as StageRow[];

    // -----------------------------
    // 1) تحديد القيود الأساسية من قاعدة البيانات فقط
    // -----------------------------
    let baseQuery = admin
      .from("production_items")
      .select(
        "id, order_id, salla_item_id, quantity_index, qr_code, status, printed_at, print_sequence, print_batch_id",
        { count: "exact" },
      )
      .eq("tenant_id", tenantId)
      .not("print_batch_id", "is", null);

    if (mode === "active") {
      baseQuery = baseQuery.neq("status", "done");
    } else if (mode === "completed") {
      baseQuery = baseQuery.eq("status", "done");
    }

    // -----------------------------
    // 2) لو فيه بحث: نضيّق النتائج قبل الـ pagination
    // -----------------------------
    if (qLower) {
      const [orderMatchesRes, orderItemMatchesRes, qrMatchesRes] =
        await Promise.all([
          admin
            .from("salla_orders")
            .select("id")
            .or(
              [
                `order_number.ilike.%${qLower}%`,
                `salla_order_id.ilike.%${qLower}%`,
                `customer_name.ilike.%${qLower}%`,
                `customer_phone.ilike.%${qLower}%`,
              ].join(","),
            )
            .limit(300),

          admin
            .from("salla_order_items")
            .select("order_id")
            .or([`name.ilike.%${qLower}%`, `sku.ilike.%${qLower}%`].join(","))
            .limit(300),

          admin
            .from("production_items")
            .select("id")
            .eq("tenant_id", tenantId)
            .not("print_batch_id", "is", null)
            .ilike("qr_code", `%${qLower}%`)
            .limit(300),
        ]);

      if (orderMatchesRes.error) {
        return NextResponse.json(
          { ok: false, error: orderMatchesRes.error.message },
          { status: 500 },
        );
      }

      if (orderItemMatchesRes.error) {
        return NextResponse.json(
          { ok: false, error: orderItemMatchesRes.error.message },
          { status: 500 },
        );
      }

      if (qrMatchesRes.error) {
        return NextResponse.json(
          { ok: false, error: qrMatchesRes.error.message },
          { status: 500 },
        );
      }

      const matchedOrderIds = Array.from(
        new Set([
          ...(orderMatchesRes.data || []).map((x: { id: string }) => x.id),
          ...(orderItemMatchesRes.data || []).map(
            (x: { order_id: string }) => x.order_id,
          ),
        ]),
      );

      const matchedProductionIds = Array.from(
        new Set((qrMatchesRes.data || []).map((x: { id: string }) => x.id)),
      );

      const orParts = [
        buildUuidInFilter("order_id", matchedOrderIds),
        buildUuidInFilter("id", matchedProductionIds),
      ].filter(Boolean) as string[];

      if (orParts.length === 0) {
        return NextResponse.json({
          ok: true,
          stats: {
            totalPrinted: 0,
            notStarted: 0,
            inProgress: 0,
            completed: 0,
            totalStages: stages.length,
          },
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
          stages: stages.map((s) => ({
            id: s.id,
            name: s.name,
            sortOrder: s.sort_order,
          })),
          rows: [],
        });
      }

      baseQuery = baseQuery.or(orParts.join(","));
    }

    // -----------------------------
    // 3) نجيب فقط عناصر الصفحة الحالية
    // -----------------------------
    const {
      data: pageItemsData,
      error: pageItemsError,
      count,
    } = await baseQuery
      .order("print_sequence", { ascending: true, nullsFirst: false })
      .order("printed_at", { ascending: false, nullsFirst: false })
      .range(rangeFrom, rangeTo);

    if (pageItemsError) {
      return NextResponse.json(
        { ok: false, error: pageItemsError.message },
        { status: 500 },
      );
    }

    const pageItems = (pageItemsData || []) as ProductionItemRow[];
    const total = count || 0;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    if (pageItems.length === 0) {
      // إحصائيات خفيفة
      const [totalPrintedRes, totalCompletedRes, totalActiveRes] =
        await Promise.all([
          admin
            .from("production_items")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .not("print_batch_id", "is", null),

          admin
            .from("production_items")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .not("print_batch_id", "is", null)
            .eq("status", "done"),

          admin
            .from("production_items")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .not("print_batch_id", "is", null)
            .neq("status", "done"),
        ]);

      return NextResponse.json({
        ok: true,
        stats: {
          totalPrinted: totalPrintedRes.count || 0,
          notStarted: 0,
          inProgress: totalActiveRes.count || 0,
          completed: totalCompletedRes.count || 0,
          totalStages: stages.length,
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
        stages: stages.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sort_order,
        })),
        rows: [],
      });
    }

    // -----------------------------
    // 4) الآن فقط نجيب البيانات المرتبطة بهذه الصفحة
    // -----------------------------
    const pageProductionItemIds = pageItems.map((x) => x.id);
    const pageOrderIds = Array.from(new Set(pageItems.map((x) => x.order_id)));

    const [stageEventsRes, ordersRes, orderItemsRes, batchLinksRes] =
      await Promise.all([
        admin
          .from("stage_events")
          .select("id, production_item_id, stage_id, user_id, created_at")
          .eq("tenant_id", tenantId)
          .in("production_item_id", pageProductionItemIds)
          .order("created_at", { ascending: true }),

        admin
          .from("salla_orders")
          .select(
            "id, order_number, salla_order_id, customer_name, customer_phone, raw",
          )
          .in("id", pageOrderIds),

        admin
          .from("salla_order_items")
          .select("order_id, salla_item_id, name, sku")
          .in("order_id", pageOrderIds),

        admin
          .from("print_batch_orders")
          .select(
            `
            order_id,
            created_at,
            print_batches (
              id,
              batch_date,
              batch_no,
              status
            )
          `,
          )
          .eq("tenant_id", tenantId)
          .in("order_id", pageOrderIds),
      ]);

    if (stageEventsRes.error) {
      return NextResponse.json(
        { ok: false, error: stageEventsRes.error.message },
        { status: 500 },
      );
    }

    if (ordersRes.error) {
      return NextResponse.json(
        { ok: false, error: ordersRes.error.message },
        { status: 500 },
      );
    }

    if (orderItemsRes.error) {
      return NextResponse.json(
        { ok: false, error: orderItemsRes.error.message },
        { status: 500 },
      );
    }

    if (batchLinksRes.error) {
      return NextResponse.json(
        { ok: false, error: batchLinksRes.error.message },
        { status: 500 },
      );
    }

    const stageEvents = (stageEventsRes.data || []) as StageEventRow[];
    const orders = (ordersRes.data || []) as OrderRow[];
    const orderItems = (orderItemsRes.data || []) as OrderItemRow[];
    const batchLinks = (batchLinksRes.data || []) as PrintBatchLinkRow[];

    const userIds = Array.from(new Set(stageEvents.map((x) => x.user_id)));

    const profilesRes =
      userIds.length > 0
        ? await admin.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [], error: null as unknown as null };

    if (profilesRes.error) {
      return NextResponse.json(
        { ok: false, error: profilesRes.error.message },
        { status: 500 },
      );
    }

    const profiles = (profilesRes.data || []) as ProfileRow[];

    // -----------------------------
    // 5) بناء خرائط سريعة للصفحة الحالية فقط
    // -----------------------------
    const profileNameMap = new Map(
      profiles.map((p) => [p.id, p.full_name || "عامل"]),
    );

    const ordersMap = new Map(
      orders.map((o) => [
        o.id,
        {
          orderNumber: o.order_number,
          sallaOrderId: o.salla_order_id,
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          customerCity: getCityFromRaw(o.raw),
        },
      ]),
    );

    const batchMap = new Map<
      string,
      {
        batchId: string | null;
        batchNo: number | null;
        batchDate: string | null;
        batchStatus: string | null;
        printedAt: string | null;
      }
    >();

    for (const row of batchLinks) {
      const batch = one(row.print_batches);
      batchMap.set(row.order_id, {
        batchId: batch?.id || null,
        batchNo: batch?.batch_no || null,
        batchDate: batch?.batch_date || null,
        batchStatus: batch?.status || null,
        printedAt: row.created_at || null,
      });
    }

    const orderItemsByCompositeKey = new Map<string, OrderItemRow>();
    for (const item of orderItems) {
      const key = `${item.order_id}__${item.salla_item_id || ""}`;
      if (!orderItemsByCompositeKey.has(key)) {
        orderItemsByCompositeKey.set(key, item);
      }
    }

    const eventsByProductionItem = new Map<string, StageEventRow[]>();
    for (const event of stageEvents) {
      if (!eventsByProductionItem.has(event.production_item_id)) {
        eventsByProductionItem.set(event.production_item_id, []);
      }
      eventsByProductionItem.get(event.production_item_id)!.push(event);
    }

    // -----------------------------
    // 6) نركب صفوف الصفحة فقط
    // -----------------------------
    const rows = pageItems.map((item) => {
      const orderMeta = ordersMap.get(item.order_id) || {
        orderNumber: null,
        sallaOrderId: null,
        customerName: null,
        customerPhone: null,
        customerCity: null,
      };

      const batchMeta = batchMap.get(item.order_id) || {
        batchId: null,
        batchNo: null,
        batchDate: null,
        batchStatus: null,
        printedAt: null,
      };

      const orderItem =
        orderItemsByCompositeKey.get(
          `${item.order_id}__${item.salla_item_id || ""}`,
        ) || null;

      const itemEvents = eventsByProductionItem.get(item.id) || [];
      const lastEvent = itemEvents.length
        ? itemEvents[itemEvents.length - 1]
        : null;

      let trackingStatus: "not_started" | "in_progress" | "completed" =
        "not_started";

      if (item.status === "done") {
        trackingStatus = "completed";
      } else if (itemEvents.length > 0) {
        trackingStatus = "in_progress";
      }

      let currentStageName = stages[0]?.name || "بانتظار الاستلام";
      let currentStageAt: string | null = null;

      if (trackingStatus === "completed") {
        currentStageName = "مكتمل";
        currentStageAt = lastEvent?.created_at || null;
      } else if (trackingStatus === "in_progress") {
        const currentStage = stages.find((s) => s.id === lastEvent?.stage_id);
        currentStageName = currentStage?.name || "تحت التنفيذ";
        currentStageAt = lastEvent?.created_at || null;
      }

      const stageCells = stages.map((stage) => {
        const stageEvent = itemEvents.find((ev) => ev.stage_id === stage.id);

        return {
          stageId: stage.id,
          stageName: stage.name,
          state: stageEvent ? ("done" as const) : ("pending" as const),
          doneCount: stageEvent ? 1 : 0,
          totalItems: 1,
          firstAt: stageEvent?.created_at || null,
          lastAt: stageEvent?.created_at || null,
          workerName: stageEvent
            ? profileNameMap.get(stageEvent.user_id) || "عامل"
            : null,
        };
      });

      return {
        productionItemId: item.id,
        qrCode: item.qr_code,
        pieceNo: item.quantity_index,
        orderId: item.order_id,
        orderNumber: orderMeta.orderNumber,
        sallaOrderId: orderMeta.sallaOrderId,
        customerName: orderMeta.customerName,
        customerPhone: orderMeta.customerPhone,
        customerCity: orderMeta.customerCity,
        batchId: batchMeta.batchId,
        batchNo: batchMeta.batchNo,
        batchDate: batchMeta.batchDate,
        batchStatus: batchMeta.batchStatus,
        trackingStatus,
        currentStageName,
        currentStageAt,
        printedAt: item.printed_at || batchMeta.printedAt,
        productName: orderItem?.name || null,
        sku: orderItem?.sku || null,
        stageCells,
      };
    });

    // -----------------------------
    // 7) إحصائيات خفيفة وسريعة نسبيًا
    // -----------------------------
    const [totalPrintedRes, totalCompletedRes, totalActiveRes] =
      await Promise.all([
        admin
          .from("production_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("print_batch_id", "is", null),

        admin
          .from("production_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("print_batch_id", "is", null)
          .eq("status", "done"),

        admin
          .from("production_items")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("print_batch_id", "is", null)
          .neq("status", "done"),
      ]);

    return NextResponse.json({
      ok: true,
      stats: {
        totalPrinted: totalPrintedRes.count || 0,
        notStarted: 0,
        inProgress: totalActiveRes.count || 0,
        completed: totalCompletedRes.count || 0,
        totalStages: stages.length,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        sortOrder: s.sort_order,
      })),
      rows,
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
