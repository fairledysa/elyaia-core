// FILE: src/app/(dashboard)/dashboard/notifications/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  RefreshCcw,
  ShieldAlert,
  Filter,
  UserRound,
  Layers3,
  TriangleAlert,
} from "lucide-react";

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

function severityClass(value: string) {
  if (value === "low") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (value === "medium") {
    return "bg-orange-50 text-orange-700 border border-orange-200";
  }
  if (value === "high") {
    return "bg-red-50 text-red-700 border border-red-200";
  }
  return "bg-muted text-muted-foreground border border-border";
}

function typeClass(value: string) {
  if (value === "quality") {
    return "bg-blue-50 text-blue-700 border border-blue-200";
  }
  if (value === "lateness") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (value === "behavior") {
    return "bg-purple-50 text-purple-700 border border-purple-200";
  }
  if (value === "absence") {
    return "bg-rose-50 text-rose-700 border border-rose-200";
  }
  return "bg-slate-50 text-slate-700 border border-slate-200";
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-right">
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
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

  const stats = useMemo(() => {
    const total = items.length;
    const high = items.filter((x) => x.severity === "high").length;
    const medium = items.filter((x) => x.severity === "medium").length;
    const low = items.filter((x) => x.severity === "low").length;
    return { total, high, medium, low };
  }, [items]);

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" />
              إدارة تنبيهات وملاحظات الموظفين
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                التنبيهات
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                إدارة تنبيهات الموظفين بشكل مستقل مع تصنيف النوع والدرجة
                والمرحلة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white px-4 text-sm font-medium transition hover:bg-muted/40"
          >
            <RefreshCcw className="h-4 w-4" />
            تحديث
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي التنبيهات"
          value={String(stats.total)}
          icon={Bell}
        />
        <StatCard
          title="تنبيهات عالية"
          value={String(stats.high)}
          icon={ShieldAlert}
        />
        <StatCard
          title="تنبيهات متوسطة"
          value={String(stats.medium)}
          icon={TriangleAlert}
        />
        <StatCard
          title="تنبيهات منخفضة"
          value={String(stats.low)}
          icon={Filter}
        />
      </div>

      {/* Form */}
      <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50">
            <ShieldAlert className="h-5 w-5" />
          </div>

          <div>
            <div className="text-lg font-bold">
              {editingId ? "تعديل تنبيه" : "إضافة تنبيه"}
            </div>
            <div className="text-sm text-muted-foreground">
              سجّل تنبيه جديد أو عدّل تنبيه سابق
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={formEmployeeId}
            onChange={(e) => setFormEmployeeId(e.target.value)}
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
          >
            <option value="low">منخفض</option>
            <option value="medium">متوسط</option>
            <option value="high">عالي</option>
          </select>

          <input
            value={formReason}
            onChange={(e) => setFormReason(e.target.value)}
            placeholder="السبب"
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
          />

          <input
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            placeholder="الملاحظة"
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitForm}
            disabled={saving}
            className="rounded-2xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-2xl border border-border/70 px-5 py-2.5 text-sm font-medium transition hover:bg-muted/40"
          >
            إلغاء
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50">
            <Filter className="h-5 w-5" />
          </div>

          <div>
            <div className="text-lg font-bold">الفلاتر</div>
            <div className="text-sm text-muted-foreground">
              تصفية سجل التنبيهات حسب الموظف والمرحلة والنوع والدرجة والتاريخ
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
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
            className="h-12 rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
          />

          <div className="flex gap-2">
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              type="date"
              className="h-12 w-full rounded-2xl border border-border/70 bg-background px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={loadData}
              className="rounded-2xl bg-black px-4 text-sm font-medium text-white"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-white shadow-sm">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="text-lg font-bold">سجل التنبيهات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            جميع التنبيهات المسجلة على الموظفين
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border/60">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right font-semibold">المرحلة</th>
                <th className="px-4 py-3 text-right font-semibold">النوع</th>
                <th className="px-4 py-3 text-right font-semibold">الدرجة</th>
                <th className="px-4 py-3 text-right font-semibold">السبب</th>
                <th className="px-4 py-3 text-right font-semibold">الملاحظة</th>
                <th className="px-4 py-3 text-right font-semibold">
                  الإجراءات
                </th>
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
                  <tr
                    key={item.id}
                    className="border-t border-border/60 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">{formatDate(item.created_at)}</td>
                    <td className="px-4 py-3 font-medium">
                      {item.employee_name || "-"}
                    </td>
                    <td className="px-4 py-3">{item.stage_name || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${typeClass(
                          item.warning_type,
                        )}`}
                      >
                        {mapWarningType(item.warning_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${severityClass(
                          item.severity,
                        )}`}
                      >
                        {mapSeverity(item.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.reason || "-"}</td>
                    <td className="px-4 py-3">{item.note || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-xl border border-border/70 px-3 py-1.5 text-xs font-medium transition hover:bg-muted/40"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
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
