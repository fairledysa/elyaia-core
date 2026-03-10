// FILE: src/app/api/production/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
  require_previous_complete: boolean | null;
  inventory_deduct_enabled: boolean | null;
  archived: boolean | null;
};

type ProductStageRow = {
  id: string;
  stage_id: string;
  enabled: boolean;
  payout_amount: number | null;
  sort_order: number;
};

type ProductionItemRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  salla_item_id: string | null;
  quantity_index: number;
  qr_code: string;
  status: string | null;
};

type StageEventRow = {
  id: string;
  stage_id: string;
  created_at: string;
};

type EmployeeRow = {
  id: string;
  stage_id: string | null;
  active: boolean | null;
  pay_type: string | null;
  piece_rate_enabled: boolean | null;
};

type ScanAction = "preview" | "confirm";

type MaterialInfo = {
  materialId: string | null;
  name: string | null;
  qtyPerPiece: number | null;
  onHand: number | null;
  unit: string | null;
  unitCost: number | null;
};

type ParsedOrderItemRaw = {
  sallaProductId: string | null;
  size: string | null;
  optionsText: string | null;
  customerNote: string | null;
  imageUrl: string | null;
};

type ParsedOrderRaw = {
  city: string | null;
  note: string | null;
};

type BaseContextSuccess = {
  ok: true;
  data: {
    user: { id: string };
    admin: ReturnType<typeof createSupabaseAdminClient>;
    tenantId: string;
    action: ScanAction;
    qrCode: string;
    productionItem: ProductionItemRow;
    order: {
      id: string;
      installation_id: string;
      order_number: string | null;
      salla_order_id: string | null;
      customer_name: string | null;
      customer_phone: string | null;
      raw: unknown;
    };
    orderItem: {
      id: string;
      order_id: string;
      salla_item_id: string | null;
      sku: string | null;
      name: string | null;
      raw: unknown;
    } | null;
    employee: EmployeeRow;
    workerStageId: string;
    existingEvent: StageEventRow | null;
    previousCompleted: boolean;
    requiredStageName: string | null;
    currentStageRow: StageRow | null;
    nextStage: ProductStageRow | null;
    payoutAmount: number | null;
    isPieceRate: boolean;
    totalPieces: number;
    completedForCurrentStage: number;
    remainingPieces: number;
    materialInfo: MaterialInfo | null;
    imageUrl: string | null;
    orderItemMeta: ParsedOrderItemRaw;
    orderMeta: ParsedOrderRaw;
    allowSkip: boolean;
    stageMap: Map<string, StageRow>;
  };
};

type BaseContextError = {
  ok: false;
  response: NextResponse;
};

type BaseContextResult = BaseContextSuccess | BaseContextError;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getNestedValue(obj: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    let current: unknown = obj;
    let valid = true;

    for (const key of path) {
      const rec = asRecord(current);
      if (!rec || !(key in rec)) {
        valid = false;
        break;
      }
      current = rec[key];
    }

    if (valid) return current;
  }

  return null;
}

function getNestedString(obj: unknown, paths: string[][]): string | null {
  return asString(getNestedValue(obj, paths));
}

function getOptionName(entry: unknown): string | null {
  const rec = asRecord(entry);
  if (!rec) return null;

  return (
    asString(rec.name) ||
    asString(rec.label) ||
    asString(rec.key) ||
    asString(rec.title)
  );
}

function getOptionValue(entry: unknown): string | null {
  const rec = asRecord(entry);
  if (!rec) return null;

  const direct =
    asString(rec.value) ||
    asString(rec.display_value) ||
    asString(rec.option) ||
    asString(rec.text) ||
    asString(rec.option_value);

  if (direct) return direct;

  const valueRecord = asRecord(rec.value);
  if (valueRecord) {
    return (
      asString(valueRecord.name) ||
      asString(valueRecord.label) ||
      asString(valueRecord.value) ||
      asString(valueRecord.text)
    );
  }

  return null;
}

function isSizeOptionName(name: string | null): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return (
    normalized.includes("size") ||
    normalized.includes("المقاس") ||
    normalized.includes("مقاس")
  );
}

function extractSizeFromOptions(options: unknown[]): string | null {
  for (const entry of options) {
    const name = getOptionName(entry);
    const value = getOptionValue(entry);

    if (!name || !value) continue;
    if (isSizeOptionName(name)) return value;
  }

  return null;
}

function parseOrderItemRaw(raw: unknown): ParsedOrderItemRaw {
  const options = asArray(
    getNestedValue(raw, [
      ["options"],
      ["fields"],
      ["custom_fields"],
      ["attributes"],
      ["product_options"],
    ]),
  );

  const optionsText = options
    .map((entry) => {
      const name = getOptionName(entry);
      const value = getOptionValue(entry);

      if (!name && !value) return null;
      if (isSizeOptionName(name)) return null;
      if (name && value) return `${name}: ${value}`;
      return name || value || null;
    })
    .filter(Boolean)
    .join(" - ");

  return {
    sallaProductId: getNestedString(raw, [
      ["product", "id"],
      ["product_id"],
      ["product", "product_id"],
    ]),
    size:
      getNestedString(raw, [
        ["size", "name"],
        ["size"],
        ["product_size"],
        ["variant", "size"],
      ]) || extractSizeFromOptions(options),
    optionsText: optionsText || null,
    customerNote: getNestedString(raw, [
      ["notes"],
      ["note"],
      ["customer_note"],
      ["comment"],
      ["special_instructions"],
    ]),
    imageUrl: getNestedString(raw, [
      ["image", "url"],
      ["image", "original"],
      ["product", "image", "url"],
      ["product", "image"],
      ["thumbnail", "url"],
    ]),
  };
}

function parseOrderRaw(raw: unknown): ParsedOrderRaw {
  return {
    city:
      getNestedString(raw, [
        ["shipping", "address", "city"],
        ["shipping_address", "city"],
        ["address", "city"],
        ["customer", "city"],
        ["city"],
      ]) || null,
    note:
      getNestedString(raw, [
        ["notes"],
        ["note"],
        ["customer_note"],
        ["comment"],
      ]) || null,
  };
}

function buildWalletMoveNote(params: {
  stageName: string | null;
  pieceNumber: number;
  sku: string | null;
}): string {
  const stageName = params.stageName?.trim() || "تنفيذ مرحلة";
  const sku = params.sku?.trim() || "-";

  return `${stageName} - SKU: ${sku} - قطعة #${params.pieceNumber}`;
}

async function insertWalletMoveWithFallback(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  tenantId: string;
  userId: string;
  amount: number;
  referenceId: string;
  note: string;
}) {
  const { admin, tenantId, userId, amount, referenceId, note } = params;

  const insertWithNote = await admin
    .from("wallet_moves")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      type: "piece_earning",
      amount,
      reference_id: referenceId,
      note,
    })
    .select("id")
    .single();

  if (!insertWithNote.error) {
    return {
      ok: true as const,
      walletMoveId: insertWithNote.data?.id ?? null,
      noteSaved: true,
    };
  }

  const message = insertWithNote.error.message || "";

  const missingNoteColumn =
    message.includes("note") &&
    (message.includes("schema cache") || message.includes("column"));

  if (!missingNoteColumn) {
    return {
      ok: false as const,
      error: insertWithNote.error,
    };
  }

  const insertWithoutNote = await admin
    .from("wallet_moves")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      type: "piece_earning",
      amount,
      reference_id: referenceId,
    })
    .select("id")
    .single();

  if (insertWithoutNote.error) {
    return {
      ok: false as const,
      error: insertWithoutNote.error,
    };
  }

  return {
    ok: true as const,
    walletMoveId: insertWithoutNote.data?.id ?? null,
    noteSaved: false,
  };
}

async function getBaseContext(req: NextRequest): Promise<BaseContextResult> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  const body = await req.json().catch(() => null);
  const actionValue = String(body?.action || "preview").trim();
  const action: ScanAction = actionValue === "confirm" ? "confirm" : "preview";
  const qrCode = String(body?.qrCode || "").trim();

  if (!qrCode) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "QR_CODE_REQUIRED" },
        { status: 400 },
      ),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      ),
    };
  }

  if (!membership?.tenant_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "TENANT_NOT_FOUND" },
        { status: 403 },
      ),
    };
  }

  const tenantId = membership.tenant_id;

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, stage_id, active, pay_type, piece_rate_enabled")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle<EmployeeRow>();

  if (employeeError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: employeeError.message },
        { status: 500 },
      ),
    };
  }

  if (!employee?.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "EMPLOYEE_NOT_ACTIVE" },
        { status: 403 },
      ),
    };
  }

  if (!employee?.stage_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "EMPLOYEE_STAGE_NOT_ASSIGNED" },
        { status: 403 },
      ),
    };
  }

  const workerStageId = employee.stage_id;

  const { data: productionItem, error: itemError } = await admin
    .from("production_items")
    .select(
      "id, tenant_id, order_id, salla_item_id, quantity_index, qr_code, status",
    )
    .eq("tenant_id", tenantId)
    .eq("qr_code", qrCode)
    .single<ProductionItemRow>();

  if (itemError || !productionItem) {
    return {
      ok: false,
      response: NextResponse.json({ error: "ITEM_NOT_FOUND" }, { status: 404 }),
    };
  }

  const { data: order, error: orderError } = await admin
    .from("salla_orders")
    .select(
      "id, installation_id, order_number, salla_order_id, customer_name, customer_phone, raw",
    )
    .eq("id", productionItem.order_id)
    .single();

  if (orderError || !order) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "ORDER_NOT_FOUND" },
        { status: 404 },
      ),
    };
  }

  const { data: orderItem, error: orderItemError } = await admin
    .from("salla_order_items")
    .select("id, order_id, salla_item_id, sku, name, raw")
    .eq("order_id", productionItem.order_id)
    .eq("salla_item_id", productionItem.salla_item_id)
    .maybeSingle();

  if (orderItemError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: orderItemError.message },
        { status: 500 },
      ),
    };
  }

  const orderItemMeta = parseOrderItemRaw(orderItem?.raw);
  const orderMeta = parseOrderRaw(order.raw);
  const sallaProductId = orderItemMeta.sallaProductId;

  const { data: stages, error: stagesError } = await admin
    .from("stages")
    .select(
      "id, name, sort_order, require_previous_complete, inventory_deduct_enabled, archived",
    )
    .eq("tenant_id", tenantId)
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (stagesError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: stagesError.message },
        { status: 500 },
      ),
    };
  }

  const allStages = (stages ?? []) as StageRow[];
  const stageMap = new Map<string, StageRow>(allStages.map((s) => [s.id, s]));

  let activeProductStages: ProductStageRow[] = [];

  if (sallaProductId) {
    const { data: productStages, error: productStagesError } = await admin
      .from("product_stages")
      .select("id, stage_id, enabled, payout_amount, sort_order")
      .eq("tenant_id", tenantId)
      .eq("salla_product_id", sallaProductId)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (productStagesError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: productStagesError.message },
          { status: 500 },
        ),
      };
    }

    activeProductStages = (productStages ?? []) as ProductStageRow[];
  }

  if (activeProductStages.length === 0) {
    activeProductStages = allStages.map((stage) => ({
      id: stage.id,
      stage_id: stage.id,
      enabled: true,
      payout_amount: null,
      sort_order: stage.sort_order,
    }));
  }

  const allowedStages = activeProductStages
    .filter((x) => x.enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  const currentProductStage = allowedStages.find(
    (x) => x.stage_id === workerStageId,
  );

  if (!currentProductStage) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "THIS_STAGE_NOT_ENABLED_FOR_PRODUCT" },
        { status: 403 },
      ),
    };
  }

  const stageIndex = allowedStages.findIndex(
    (x) => x.stage_id === workerStageId,
  );

  const previousStage = stageIndex > 0 ? allowedStages[stageIndex - 1] : null;

  const { data: existingEvent, error: existingEventError } = await admin
    .from("stage_events")
    .select("id, stage_id, created_at")
    .eq("tenant_id", tenantId)
    .eq("production_item_id", productionItem.id)
    .eq("stage_id", workerStageId)
    .maybeSingle<StageEventRow>();

  if (existingEventError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: existingEventError.message },
        { status: 500 },
      ),
    };
  }

  let previousCompleted = true;
  let requiredStageName: string | null = null;

  if (previousStage) {
    const { data: previousEvent, error: previousEventError } = await admin
      .from("stage_events")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("production_item_id", productionItem.id)
      .eq("stage_id", previousStage.stage_id)
      .maybeSingle();

    if (previousEventError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: previousEventError.message },
          { status: 500 },
        ),
      };
    }

    const previousStageRow = stageMap.get(previousStage.stage_id) ?? null;
    const requirePrevious =
      previousStageRow?.require_previous_complete !== false;

    previousCompleted = !requirePrevious || !!previousEvent;
    requiredStageName = previousCompleted
      ? null
      : (previousStageRow?.name ?? null);
  }

  let materialInfo: MaterialInfo | null = null;

  if (sallaProductId) {
    const { data: productMaterial, error: productMaterialError } = await admin
      .from("product_materials")
      .select("material_id, qty_per_piece")
      .eq("tenant_id", tenantId)
      .eq("salla_product_id", sallaProductId)
      .limit(1)
      .maybeSingle();

    if (productMaterialError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: productMaterialError.message },
          { status: 500 },
        ),
      };
    }

    if (productMaterial?.material_id) {
      const { data: material, error: materialError } = await admin
        .from("materials")
        .select("name, on_hand, unit, unit_cost")
        .eq("tenant_id", tenantId)
        .eq("id", productMaterial.material_id)
        .maybeSingle();

      if (materialError) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: materialError.message },
            { status: 500 },
          ),
        };
      }

      materialInfo = {
        materialId: productMaterial.material_id,
        name: material?.name ?? null,
        qtyPerPiece: asNumber(productMaterial.qty_per_piece),
        onHand: asNumber(material?.on_hand),
        unit: material?.unit ?? null,
        unitCost: asNumber(material?.unit_cost),
      };
    }
  }

  let imageUrl: string | null = orderItemMeta.imageUrl;

  if (!imageUrl && sallaProductId) {
    const { data: productById } = await admin
      .from("salla_products")
      .select("image_url")
      .eq("installation_id", order.installation_id)
      .eq("salla_product_id", sallaProductId)
      .maybeSingle();

    imageUrl = productById?.image_url ?? null;
  }

  if (!imageUrl && orderItem?.sku) {
    const { data: productBySku } = await admin
      .from("salla_products")
      .select("image_url")
      .eq("installation_id", order.installation_id)
      .eq("sku", orderItem.sku)
      .limit(1)
      .maybeSingle();

    imageUrl = productBySku?.image_url ?? null;
  }

  const { count: totalPiecesCount, error: totalPiecesError } = await admin
    .from("production_items")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("order_id", productionItem.order_id)
    .eq("salla_item_id", productionItem.salla_item_id);

  if (totalPiecesError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: totalPiecesError.message },
        { status: 500 },
      ),
    };
  }

  const { data: completedStageRows, error: completedStageRowsError } =
    await admin
      .from("stage_events")
      .select(
        "production_item_id, production_items!inner(order_id, salla_item_id)",
      )
      .eq("tenant_id", tenantId)
      .eq("stage_id", workerStageId)
      .eq("production_items.order_id", productionItem.order_id)
      .eq("production_items.salla_item_id", productionItem.salla_item_id);

  if (completedStageRowsError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: completedStageRowsError.message },
        { status: 500 },
      ),
    };
  }

  const completedForCurrentStage = new Set(
    (completedStageRows ?? []).map(
      (row: { production_item_id: string }) => row.production_item_id,
    ),
  ).size;

  const totalPieces = totalPiecesCount ?? 0;
  const remainingPieces = Math.max(totalPieces - completedForCurrentStage, 0);
  const nextStage =
    stageIndex >= 0 && stageIndex < allowedStages.length - 1
      ? allowedStages[stageIndex + 1]
      : null;

  const currentStageRow = stageMap.get(workerStageId) ?? null;
  const allowSkip = currentStageRow?.require_previous_complete === false;
  const isPieceRate =
    employee.pay_type !== "salary" || employee.piece_rate_enabled === true;
  const payoutAmount = currentProductStage.payout_amount ?? null;

  return {
    ok: true,
    data: {
      user: { id: user.id },
      admin,
      tenantId,
      action,
      qrCode,
      productionItem,
      order,
      orderItem: orderItem
        ? {
            id: orderItem.id,
            order_id: orderItem.order_id,
            salla_item_id: orderItem.salla_item_id,
            sku: orderItem.sku,
            name: orderItem.name,
            raw: orderItem.raw,
          }
        : null,
      employee,
      workerStageId,
      existingEvent: existingEvent ?? null,
      previousCompleted,
      requiredStageName,
      currentStageRow,
      nextStage,
      payoutAmount,
      isPieceRate,
      totalPieces,
      completedForCurrentStage,
      remainingPieces,
      materialInfo,
      imageUrl,
      orderItemMeta,
      orderMeta,
      allowSkip,
      stageMap,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const base = await getBaseContext(req);

    if (!base.ok) {
      return base.response;
    }

    const {
      user,
      admin,
      tenantId,
      action,
      productionItem,
      order,
      orderItem,
      employee,
      workerStageId,
      existingEvent,
      previousCompleted,
      requiredStageName,
      currentStageRow,
      nextStage,
      payoutAmount,
      isPieceRate,
      totalPieces,
      completedForCurrentStage,
      remainingPieces,
      materialInfo,
      imageUrl,
      orderItemMeta,
      orderMeta,
      allowSkip,
      stageMap,
    } = base.data;

    const walletNote = buildWalletMoveNote({
      stageName: currentStageRow?.name ?? null,
      pieceNumber: productionItem.quantity_index,
      sku: orderItem?.sku ?? null,
    });

    const shouldCreateWalletMove =
      isPieceRate &&
      typeof payoutAmount === "number" &&
      Number.isFinite(payoutAmount) &&
      payoutAmount > 0;

    const shouldDeductInventory =
      currentStageRow?.inventory_deduct_enabled === true &&
      !!materialInfo?.materialId &&
      typeof materialInfo?.qtyPerPiece === "number" &&
      Number.isFinite(materialInfo.qtyPerPiece) &&
      materialInfo.qtyPerPiece > 0;

    const previewPayload = {
      ok: true,
      action,
      canConfirm: !existingEvent && previousCompleted,
      alreadyScanned: !!existingEvent,
      alreadyDoneAt: existingEvent?.created_at ?? null,
      item: {
        id: productionItem.id,
        qrCode: productionItem.qr_code,
        quantityIndex: productionItem.quantity_index,
        orderId: productionItem.order_id,
        sallaItemId: productionItem.salla_item_id,
        status: productionItem.status ?? "in_progress",
      },
      order: {
        id: order.id,
        orderNumber: order.order_number,
        sallaOrderId: order.salla_order_id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        city: orderMeta.city,
      },
      product: {
        name: orderItem?.name ?? null,
        sku: orderItem?.sku ?? null,
        imageUrl,
        size: orderItemMeta.size,
        optionsText: orderItemMeta.optionsText,
        customerNote: orderItemMeta.customerNote || orderMeta.note,
      },
      material: {
        name: materialInfo?.name ?? null,
        qtyPerPiece: materialInfo?.qtyPerPiece ?? null,
        onHand: materialInfo?.onHand ?? null,
        unit: materialInfo?.unit ?? null,
        willDeductOnConfirm: shouldDeductInventory,
      },
      progress: {
        totalPieces,
        completedForCurrentStage,
        remainingPieces,
      },
      employee: {
        id: employee.id,
        payType: employee.pay_type ?? null,
        pieceRateEnabled: employee.piece_rate_enabled ?? false,
        showPayout: isPieceRate,
      },
      stage: {
        id: workerStageId,
        name: currentStageRow?.name ?? null,
        payoutAmount: isPieceRate ? payoutAmount : null,
        allowSkip,
        requirePreviousComplete:
          currentStageRow?.require_previous_complete !== false,
        inventoryDeductEnabled:
          currentStageRow?.inventory_deduct_enabled === true,
        buttonLabel: currentStageRow?.name
          ? `تأكيد ${currentStageRow.name}`
          : "تأكيد المرحلة",
      },
      finance: {
        shouldCreateWalletMove,
        walletType: shouldCreateWalletMove ? "piece_earning" : null,
        walletAmount: shouldCreateWalletMove ? payoutAmount : null,
        walletNote: shouldCreateWalletMove ? walletNote : null,
      },
      nextStage: nextStage
        ? {
            id: nextStage.stage_id,
            name: stageMap.get(nextStage.stage_id)?.name ?? null,
          }
        : null,
      validation: {
        previousCompleted,
        requiredStageName,
      },
    };

    if (action === "preview") {
      return NextResponse.json(previewPayload);
    }

    if (existingEvent) {
      return NextResponse.json(
        {
          ...previewPayload,
          ok: false,
          error: "STAGE_ALREADY_SCANNED",
        },
        { status: 409 },
      );
    }

    if (!previousCompleted) {
      return NextResponse.json(
        {
          ...previewPayload,
          ok: false,
          error: "PREVIOUS_STAGE_REQUIRED",
          requiredStage: requiredStageName,
        },
        { status: 409 },
      );
    }

    const { data: insertedEvent, error: insertEventError } = await admin
      .from("stage_events")
      .insert({
        tenant_id: tenantId,
        production_item_id: productionItem.id,
        stage_id: workerStageId,
        user_id: user.id,
        payout_amount: payoutAmount,
      })
      .select("id, created_at")
      .single();

    if (insertEventError || !insertedEvent) {
      return NextResponse.json(
        {
          error: insertEventError?.message || "FAILED_TO_CREATE_STAGE_EVENT",
        },
        { status: 500 },
      );
    }

    let walletMoveCreated = false;
    let walletMoveId: string | null = null;
    let walletNoteSaved = false;

    if (shouldCreateWalletMove) {
      const walletInsertResult = await insertWalletMoveWithFallback({
        admin,
        tenantId,
        userId: user.id,
        amount: payoutAmount!,
        referenceId: insertedEvent.id,
        note: walletNote,
      });

      if (!walletInsertResult.ok) {
        await admin.from("stage_events").delete().eq("id", insertedEvent.id);

        return NextResponse.json(
          {
            error:
              walletInsertResult.error.message ||
              "FAILED_TO_CREATE_WALLET_MOVE",
          },
          { status: 500 },
        );
      }

      walletMoveCreated = true;
      walletMoveId = walletInsertResult.walletMoveId;
      walletNoteSaved = walletInsertResult.noteSaved;
    }

    let itemStatus = "in_progress";
    let updatedDone = false;

    if (!nextStage) {
      const { error: updateItemError } = await admin
        .from("production_items")
        .update({ status: "done" })
        .eq("id", productionItem.id);

      if (updateItemError) {
        if (walletMoveCreated && walletMoveId) {
          await admin.from("wallet_moves").delete().eq("id", walletMoveId);
        }

        await admin.from("stage_events").delete().eq("id", insertedEvent.id);

        return NextResponse.json(
          { error: updateItemError.message },
          { status: 500 },
        );
      }

      updatedDone = true;
      itemStatus = "done";
    }

    let inventoryDeducted = false;

    if (
      shouldDeductInventory &&
      materialInfo?.materialId &&
      materialInfo.qtyPerPiece
    ) {
      const deductQty = -Math.abs(Number(materialInfo.qtyPerPiece));

      const inventoryMeta = {
        source: "production_scan",
        created_from: "production_scan_confirm",
        reason: "stage_confirm",
        order_id: order.id,
        order_number: order.order_number,
        production_item_id: productionItem.id,
        quantity_index: productionItem.quantity_index,
        salla_item_id: productionItem.salla_item_id,
        sku: orderItem?.sku ?? null,
        product_name: orderItem?.name ?? null,
        stage_id: workerStageId,
        stage_name: currentStageRow?.name ?? null,
        employee_id: employee.id,
        employee_user_id: user.id,
        employee_name: null,
      };

      const deductRes = await admin.rpc("inventory_apply_move", {
        p_tenant_id: tenantId,
        p_material_id: materialInfo.materialId,
        p_delta: deductQty,
        p_move_type: "production_deduct",
        p_unit_cost: materialInfo.unitCost ?? 0,
        p_note: `خصم إنتاج - ${currentStageRow?.name || "مرحلة"} - قطعة #${productionItem.quantity_index}`,
        p_created_by: user.id,
        p_user_id: user.id,
        p_stage_event_id: insertedEvent.id,
        p_meta: inventoryMeta,
      });

      if (deductRes.error) {
        if (updatedDone) {
          await admin
            .from("production_items")
            .update({ status: "in_progress" })
            .eq("id", productionItem.id);
        }

        if (walletMoveCreated && walletMoveId) {
          await admin.from("wallet_moves").delete().eq("id", walletMoveId);
        }

        await admin.from("stage_events").delete().eq("id", insertedEvent.id);

        return NextResponse.json(
          {
            error: deductRes.error.message || "FAILED_TO_DEDUCT_INVENTORY",
          },
          { status: 500 },
        );
      }

      inventoryDeducted = true;
    }

    return NextResponse.json({
      ok: true,
      action: "confirm",
      message: nextStage ? "STAGE_SCANNED" : "ITEM_COMPLETED",
      item: {
        id: productionItem.id,
        qrCode: productionItem.qr_code,
        quantityIndex: productionItem.quantity_index,
        orderId: productionItem.order_id,
        sallaItemId: productionItem.salla_item_id,
        status: itemStatus,
      },
      order: {
        id: order.id,
        orderNumber: order.order_number,
        sallaOrderId: order.salla_order_id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        city: orderMeta.city,
      },
      product: {
        name: orderItem?.name ?? null,
        sku: orderItem?.sku ?? null,
        imageUrl,
        size: orderItemMeta.size,
        optionsText: orderItemMeta.optionsText,
        customerNote: orderItemMeta.customerNote || orderMeta.note,
      },
      material: {
        name: materialInfo?.name ?? null,
        qtyPerPiece: materialInfo?.qtyPerPiece ?? null,
        onHand: materialInfo?.onHand ?? null,
        unit: materialInfo?.unit ?? null,
        deducted: inventoryDeducted,
      },
      progress: {
        totalPieces,
        completedForCurrentStage: completedForCurrentStage + 1,
        remainingPieces: Math.max(remainingPieces - 1, 0),
      },
      employee: {
        id: employee.id,
        payType: employee.pay_type ?? null,
        pieceRateEnabled: employee.piece_rate_enabled ?? false,
        showPayout: isPieceRate,
      },
      stage: {
        id: workerStageId,
        name: currentStageRow?.name ?? null,
        payoutAmount: isPieceRate ? payoutAmount : null,
        allowSkip,
        requirePreviousComplete:
          currentStageRow?.require_previous_complete !== false,
        inventoryDeductEnabled:
          currentStageRow?.inventory_deduct_enabled === true,
        buttonLabel: currentStageRow?.name
          ? `تأكيد ${currentStageRow.name}`
          : "تأكيد المرحلة",
        scannedAt: insertedEvent.created_at,
      },
      finance: {
        walletMoveCreated,
        walletMoveId,
        walletType: walletMoveCreated ? "piece_earning" : null,
        walletAmount: walletMoveCreated ? payoutAmount : null,
        walletNote: walletMoveCreated ? walletNote : null,
        walletNoteSaved,
      },
      nextStage: nextStage
        ? {
            id: nextStage.stage_id,
            name: stageMap.get(nextStage.stage_id)?.name ?? null,
          }
        : null,
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
