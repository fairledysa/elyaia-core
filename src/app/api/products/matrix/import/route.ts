// FILE: src/app/api/products/matrix/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Buffer } from "buffer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";

function toNum(v: any) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  const sb = await createSupabaseServerClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { tenantId, role } = await requireTenant({ userId: u.user.id, sb });
  if (role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) {
    return NextResponse.json(
      { ok: false, error: "Missing file" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();

  const s = await admin
    .from("stages")
    .select("id,name,sort_order")
    .eq("tenant_id", tenantId)
    .eq("archived", false)
    .order("sort_order", { ascending: true });

  if (s.error) {
    return NextResponse.json(
      { ok: false, error: s.error.message },
      { status: 500 },
    );
  }

  const m = await admin
    .from("materials")
    .select("id,name")
    .eq("tenant_id", tenantId);

  if (m.error) {
    return NextResponse.json(
      { ok: false, error: m.error.message },
      { status: 500 },
    );
  }

  const stages = s.data || [];
  const materials = m.data || [];

  const materialIdByName = new Map<string, string>();
  materials.forEach((x: any) =>
    materialIdByName.set(normalizeText(x.name), String(x.id)),
  );

  const stageByHeader = new Map<
    string,
    { stage_id: string; sort_order: number; mode: "enabled" | "payout" }
  >();

  stages.forEach((st: any) => {
    stageByHeader.set(`${normalizeText(st.name)} | مفعلة`, {
      stage_id: String(st.id),
      sort_order: Number(st.sort_order ?? 0),
      mode: "enabled",
    });
    stageByHeader.set(`${normalizeText(st.name)} | سعر المرحلة`, {
      stage_id: String(st.id),
      sort_order: Number(st.sort_order ?? 0),
      mode: "payout",
    });
  });

  const wb = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer()) as any;
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet("matrix") || wb.worksheets[0];
  if (!ws) {
    return NextResponse.json(
      { ok: false, error: "Missing matrix sheet" },
      { status: 400 },
    );
  }

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeText(cell.value);
  });

  let updatedMaterials = 0;
  let updatedStages = 0;

  for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
    const row = ws.getRow(rowNumber);
    const productId = normalizeText(row.getCell(1).value);
    if (!productId) continue;

    const materialName = normalizeText(row.getCell(4).value);
    const qtyPerPiece = toNum(row.getCell(5).value) ?? 0;

    if (materialName) {
      const materialId = materialIdByName.get(materialName);
      if (!materialId) {
        return NextResponse.json(
          {
            ok: false,
            error: `اسم القماش غير موجود في النظام: ${materialName} (row ${rowNumber})`,
          },
          { status: 400 },
        );
      }

      const upm = await admin.from("product_materials").upsert(
        {
          tenant_id: tenantId,
          salla_product_id: productId,
          material_id: materialId,
          qty_per_piece: qtyPerPiece,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,salla_product_id,material_id" },
      );

      if (upm.error) {
        return NextResponse.json(
          { ok: false, error: upm.error.message },
          { status: 500 },
        );
      }

      updatedMaterials++;
    }

    for (let colNumber = 6; colNumber <= headers.length; colNumber++) {
      const header = headers[colNumber];
      if (!header) continue;

      const meta = stageByHeader.get(header);
      if (!meta) continue;

      const raw = row.getCell(colNumber).value;

      if (meta.mode === "enabled") {
        const txt = normalizeText(raw);
        const enabled = txt === "لا" ? false : true;

        const ups = await admin.from("product_stages").upsert(
          {
            tenant_id: tenantId,
            salla_product_id: productId,
            stage_id: meta.stage_id,
            enabled,
            sort_order: meta.sort_order,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,salla_product_id,stage_id" },
        );

        if (ups.error) {
          return NextResponse.json(
            { ok: false, error: ups.error.message },
            { status: 500 },
          );
        }

        updatedStages++;
      }

      if (meta.mode === "payout") {
        const payout = toNum(raw);

        const ups = await admin.from("product_stages").upsert(
          {
            tenant_id: tenantId,
            salla_product_id: productId,
            stage_id: meta.stage_id,
            payout_amount: payout,
            sort_order: meta.sort_order,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,salla_product_id,stage_id" },
        );

        if (ups.error) {
          return NextResponse.json(
            { ok: false, error: ups.error.message },
            { status: 500 },
          );
        }

        updatedStages++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    updatedMaterials,
    updatedStages,
  });
}
