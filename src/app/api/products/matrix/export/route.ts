// FILE: src/app/api/products/matrix/export/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function colLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function GET() {
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

  const admin = createSupabaseAdminClient();

  const p = await admin
    .from("salla_products")
    .select("salla_product_id,name,sku,salla_installations!inner(tenant_id)")
    .eq("salla_installations.tenant_id", tenantId)
    .order("name", { ascending: true });

  if (p.error) {
    return NextResponse.json(
      { ok: false, error: p.error.message },
      { status: 500 },
    );
  }

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
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  if (m.error) {
    return NextResponse.json(
      { ok: false, error: m.error.message },
      { status: 500 },
    );
  }

  const pm = await admin
    .from("product_materials")
    .select("salla_product_id,material_id,qty_per_piece,updated_at")
    .eq("tenant_id", tenantId);

  if (pm.error) {
    return NextResponse.json(
      { ok: false, error: pm.error.message },
      { status: 500 },
    );
  }

  const ps = await admin
    .from("product_stages")
    .select("salla_product_id,stage_id,enabled,payout_amount")
    .eq("tenant_id", tenantId);

  if (ps.error) {
    return NextResponse.json(
      { ok: false, error: ps.error.message },
      { status: 500 },
    );
  }

  const products =
    (p.data || []).map((r: any) => ({
      salla_product_id: String(r.salla_product_id),
      name: r.name ?? "",
      sku: r.sku ?? "",
    })) || [];

  const stages = s.data || [];
  const materials = m.data || [];

  const materialNameById = new Map<string, string>();
  materials.forEach((x: any) =>
    materialNameById.set(String(x.id), String(x.name)),
  );

  const matByProduct = new Map<
    string,
    { material_name: string; qty_per_piece: number }
  >();
  (pm.data || [])
    .sort((a: any, b: any) =>
      String(a.updated_at).localeCompare(String(b.updated_at)),
    )
    .forEach((r: any) => {
      matByProduct.set(String(r.salla_product_id), {
        material_name: materialNameById.get(String(r.material_id)) || "",
        qty_per_piece: Number(r.qty_per_piece ?? 0),
      });
    });

  const stageByKey = new Map<
    string,
    { enabled: boolean; payout_amount: number | null }
  >();
  (ps.data || []).forEach((r: any) => {
    stageByKey.set(`${r.salla_product_id}__${r.stage_id}`, {
      enabled: !!r.enabled,
      payout_amount: r.payout_amount == null ? null : Number(r.payout_amount),
    });
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Elyaia";
  wb.created = new Date();

  const ref = wb.addWorksheet("ref", { views: [{ rightToLeft: true }] });
  ref.columns = [
    { header: "القماش", key: "material_name", width: 28 },
    { header: "معرّف القماش", key: "material_id", width: 40 },
    { header: "المرحلة", key: "stage_name", width: 28 },
    { header: "معرّف المرحلة", key: "stage_id", width: 40 },
  ];

  const maxRows = Math.max(materials.length, stages.length);
  for (let i = 0; i < maxRows; i++) {
    ref.addRow({
      material_name: materials[i]?.name ?? "",
      material_id: materials[i]?.id ?? "",
      stage_name: stages[i]?.name ?? "",
      stage_id: stages[i]?.id ?? "",
    });
  }

  ref.getRow(1).font = { bold: true };
  ref.views = [{ rightToLeft: true }];
  ref.columns.forEach((c) => {
    if (!c.width) c.width = 24;
  });

  const matrix = wb.addWorksheet("matrix", { views: [{ rightToLeft: true }] });

  const baseHeaders = [
    "معرّف منتج سلة",
    "اسم المنتج",
    "SKU",
    "القماش",
    "كمية القماش لكل قطعة",
  ];

  const stageHeaders: string[] = [];
  stages.forEach((st: any) => {
    stageHeaders.push(`${st.name} | مفعلة`);
    stageHeaders.push(`${st.name} | سعر المرحلة`);
  });

  const headers = [...baseHeaders, ...stageHeaders];
  matrix.addRow(headers);

  const stageColumnMap: Array<{
    stageId: string;
    enabledCol: number;
    payoutCol: number;
    stageName: string;
  }> = [];

  let currentCol = baseHeaders.length + 1;
  stages.forEach((st: any) => {
    stageColumnMap.push({
      stageId: String(st.id),
      enabledCol: currentCol,
      payoutCol: currentCol + 1,
      stageName: String(st.name),
    });
    currentCol += 2;
  });

  for (const pr of products) {
    const rowValues: any[] = [
      pr.salla_product_id,
      pr.name,
      pr.sku,
      matByProduct.get(pr.salla_product_id)?.material_name ?? "",
      matByProduct.get(pr.salla_product_id)?.qty_per_piece ?? "",
    ];

    for (const st of stageColumnMap) {
      const v = stageByKey.get(`${pr.salla_product_id}__${st.stageId}`);
      rowValues.push(v ? (v.enabled ? "نعم" : "لا") : "نعم");
      rowValues.push(v?.payout_amount ?? "");
    }

    matrix.addRow(rowValues);
  }

  matrix.getRow(1).font = { bold: true };
  matrix.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  headers.forEach((h, i) => {
    const col = matrix.getColumn(i + 1);
    col.width =
      i === 1
        ? 28
        : i === 2
          ? 18
          : i === 4
            ? 16
            : i === 5
              ? 18
              : h.includes("سعر")
                ? 16
                : 18;
  });

  const materialListLastRow = Math.max(materials.length + 1, 2);
  const yesNoFormula = '"نعم,لا"';
  const materialFormula = `ref!$A$2:$A$${materialListLastRow}`;

  for (let row = 2; row <= products.length + 1; row++) {
    matrix.getCell(`D${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [materialFormula],
      showErrorMessage: true,
      errorTitle: "قيمة غير صحيحة",
      error: "اختر القماش من القائمة.",
    };

    for (const st of stageColumnMap) {
      matrix.getCell(`${colLetter(st.enabledCol)}${row}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [yesNoFormula],
        showErrorMessage: true,
        errorTitle: "قيمة غير صحيحة",
        error: 'القيمة المسموحة: "نعم" أو "لا".',
      };
    }
  }

  matrix.autoFilter = {
    from: "A1",
    to: `${colLetter(headers.length)}1`,
  };

  const help = wb.addWorksheet("شرح", { views: [{ rightToLeft: true }] });
  help.addRow(["تعليمات"]);
  help.addRow(["1) عدّل فقط ورقة matrix"]);
  help.addRow(['2) عمود "القماش" اختياره من القائمة المنسدلة']);
  help.addRow(['3) عمود "كمية القماش لكل قطعة" رقم فقط']);
  help.addRow(['4) أعمدة "مفعلة" تقبل: نعم / لا']);
  help.addRow(['5) أعمدة "سعر المرحلة" أرقام فقط']);
  help.addRow(["6) لا تعدّل معرّفات المراحل أو المراجع في ref"]);
  help.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="product-matrix.xlsx"',
    },
  });
}
