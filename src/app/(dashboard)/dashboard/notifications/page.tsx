// FILE: src/app/(dashboard)/dashboard/notifications/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type EmployeeItem = {
  id: string;
  full_name: string | null;
  stage_name: string | null;
  active: boolean;
};

type StageItem = {
  id: string;
  name: string;
};

type WarningItem = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  stage_id: string | null;
  stage_name: string | null;
  warning_type: string;
  severity: string;
  note: string | null;
  reason: string | null;
  created_at: string | null;
};

type ListResponse = {
  ok?: boolean;
  error?: string;
  employees?: EmployeeItem[];
  stages?: StageItem[];
  items?: WarningItem[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
    2,
    "0",
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function mapWarningType(value: string) {
  if (value === "quality") return "جودة";
  if (value === "lateness") return "تأخير";
  if (value === "behavior") return "سلوك";
  if (value === "absence") return "غياب";
  if (value === "other") return "أخرى";
  return value || "-";
}

function mapSeverity(value: string) {
  if (value === "low") return "منخفض";
  if (value === "medium") return "متوسط";
  if (value === "high") return "عالي";
  return value || "-";
}

export default function NotificationsPage() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  const [items, setItems] = useState<WarningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("all");
  const [stageId, setStageId] = useState("all");
  const [warningType, setWarningType] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formStageId, setFormStageId] = useState("none");
  const [formWarningType, setFormWarningType] = useState("quality");
  const [formSeverity, setFormSeverity] = useState("medium");
  const [formNote, setFormNote] = useState("");
  const [formReason, setFormReason] = useState("");

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (employeeId !== "all") query.set("employeeId", employeeId);
    if (stageId !== "all") query.set("stageId", stageId);
    if (warningType !== "all") query.set("warningType", warningType);
    if (severity !== "all") query.set("severity", severity);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return query.toString();
  }, [employeeId, stageId, warningType, severity, from, to]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/finance/warnings?${queryString}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as ListResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_LOAD_WARNINGS");
      }

      setEmployees(json.employees ?? []);
      setStages(json.stages ?? []);
      setItems(json.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_LOAD_WARNINGS");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setEditingId(null);
    setFormEmployeeId("");
    setFormStageId("none");
    setFormWarningType("quality");
    setFormSeverity("medium");
    setFormNote("");
    setFormReason("");
  }

  async function submitForm() {
    if (!formEmployeeId) {
      setError("اختر الموظف");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        employee_id: formEmployeeId,
        stage_id: formStageId === "none" ? null : formStageId,
        warning_type: formWarningType,
        severity: formSeverity,
        note: formNote,
        reason: formReason,
      };

      const isEdit = Boolean(editingId);
      const url = isEdit
        ? `/api/finance/warnings/${editingId}`
        : "/api/finance/warnings";

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_SAVE_WARNING");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_SAVE_WARNING");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: WarningItem) {
    setEditingId(item.id);
    setFormEmployeeId(item.employee_id);
    setFormStageId(item.stage_id ?? "none");
    setFormWarningType(item.warning_type);
    setFormSeverity(item.severity);
    setFormNote(item.note ?? "");
    setFormReason(item.reason ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeItem(id: string) {
    const ok = window.confirm("هل تريد حذف هذا التنبيه؟");
    if (!ok) return;

    try {
      setError(null);

      const res = await fetch(`/api/finance/warnings/${id}`, {
        method: "DELETE",
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "FAILED_TO_DELETE_WARNING");
      }

      if (editingId === id) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED_TO_DELETE_WARNING");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">التنبيهات</h1>
          <p className="text-sm text-muted-foreground">
            إدارة تنبيهات الموظفين بشكل مستقل عن المالية
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="rounded-md border px-4 py-2 text-sm"
        >
          تحديث
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 text-lg font-bold">
          {editingId ? "تعديل تنبيه" : "إضافة تنبيه"}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={formEmployeeId}
            onChange={(e) => setFormEmployeeId(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="">اختر الموظف</option>
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name || "بدون اسم"}
              </option>
            ))}
          </select>

          <select
            value={formStageId}
            onChange={(e) => setFormStageId(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="none">بدون مرحلة</option>
            {stages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={formWarningType}
            onChange={(e) => setFormWarningType(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="quality">جودة</option>
            <option value="lateness">تأخير</option>
            <option value="behavior">سلوك</option>
            <option value="absence">غياب</option>
            <option value="other">أخرى</option>
          </select>

          <select
            value={formSeverity}
            onChange={(e) => setFormSeverity(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="low">منخفض</option>
            <option value="medium">متوسط</option>
            <option value="high">عالي</option>
          </select>

          <input
            value={formReason}
            onChange={(e) => setFormReason(e.target.value)}
            placeholder="السبب"
            className="rounded-md border px-3 py-2"
          />

          <input
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            placeholder="الملاحظة"
            className="rounded-md border px-3 py-2"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitForm}
            disabled={saving}
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-md border px-4 py-2 text-sm"
          >
            إلغاء
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 text-lg font-bold">الفلاتر</div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="all">كل الموظفين</option>
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name || "بدون اسم"}
              </option>
            ))}
          </select>

          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="all">كل المراحل</option>
            {stages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={warningType}
            onChange={(e) => setWarningType(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="all">كل الأنواع</option>
            <option value="quality">جودة</option>
            <option value="lateness">تأخير</option>
            <option value="behavior">سلوك</option>
            <option value="absence">غياب</option>
            <option value="other">أخرى</option>
          </select>

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="all">كل الدرجات</option>
            <option value="low">منخفض</option>
            <option value="medium">متوسط</option>
            <option value="high">عالي</option>
          </select>

          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            type="date"
            className="rounded-md border px-3 py-2"
          />

          <div className="flex gap-2">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="w-full rounded-md border px-3 py-2"
            />
            <button
              type="button"
              onClick={loadData}
              className="rounded-md bg-black px-4 py-2 text-white"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-bold">سجل التنبيهات</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">الموظف</th>
                <th className="px-4 py-3 text-right">المرحلة</th>
                <th className="px-4 py-3 text-right">النوع</th>
                <th className="px-4 py-3 text-right">الدرجة</th>
                <th className="px-4 py-3 text-right">السبب</th>
                <th className="px-4 py-3 text-right">الملاحظة</th>
                <th className="px-4 py-3 text-right">الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr className="border-t">
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    جاري التحميل...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      {item.employee_name || "-"}
                    </td>
                    <td className="px-4 py-3">{item.stage_name || "-"}</td>
                    <td className="px-4 py-3">
                      {mapWarningType(item.warning_type)}
                    </td>
                    <td className="px-4 py-3">{mapSeverity(item.severity)}</td>
                    <td className="px-4 py-3">{item.reason || "-"}</td>
                    <td className="px-4 py-3">{item.note || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-md border px-3 py-1 text-xs"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-600"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t">
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    لا توجد تنبيهات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
