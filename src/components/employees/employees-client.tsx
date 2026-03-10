// FILE: src/components/employees/employees-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EmployeeItem = {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  stage_id: string | null;
  stage_name: string | null;
  job_title: string | null;
  pay_type: string | null;
  base_salary: number;
  monthly_target: number | null;
  has_monthly_target: boolean;
  has_over_target_bonus: boolean;
  bonus_per_extra_piece: number;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type StageItem = {
  id: string;
  name: string;
  sort_order: number;
};

type EmployeesResponse = {
  ok: boolean;
  items?: EmployeeItem[];
  error?: string;
};

type StagesResponse = {
  ok: boolean;
  items?: StageItem[];
  error?: string;
};

type CreateEmployeeResponse = {
  ok: boolean;
  item?: EmployeeItem;
  credentials?: {
    email?: string | null;
    password?: string | null;
  };
  mode?: string;
  error?: string;
};

const EMPTY_FORM = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  stageId: "",
  payType: "piece" as "salary" | "piece",
  baseSalary: "",
  hasMonthlyTarget: false,
  monthlyTarget: "",
  hasOverTargetBonus: false,
  bonusPerExtraPiece: "",
  active: true,
};

export function EmployeesClient() {
  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [fullName, setFullName] = useState(EMPTY_FORM.fullName);
  const [email, setEmail] = useState(EMPTY_FORM.email);
  const [phone, setPhone] = useState(EMPTY_FORM.phone);
  const [password, setPassword] = useState(EMPTY_FORM.password);
  const [stageId, setStageId] = useState(EMPTY_FORM.stageId);
  const [payType, setPayType] = useState<"salary" | "piece">(
    EMPTY_FORM.payType,
  );
  const [baseSalary, setBaseSalary] = useState(EMPTY_FORM.baseSalary);
  const [hasMonthlyTarget, setHasMonthlyTarget] = useState(
    EMPTY_FORM.hasMonthlyTarget,
  );
  const [monthlyTarget, setMonthlyTarget] = useState(EMPTY_FORM.monthlyTarget);
  const [hasOverTargetBonus, setHasOverTargetBonus] = useState(
    EMPTY_FORM.hasOverTargetBonus,
  );
  const [bonusPerExtraPiece, setBonusPerExtraPiece] = useState(
    EMPTY_FORM.bonusPerExtraPiece,
  );
  const [active, setActive] = useState(EMPTY_FORM.active);

  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [employeesRes, stagesRes] = await Promise.all([
        fetch("/api/employees", { cache: "no-store" }),
        fetch("/api/stages", { cache: "no-store" }),
      ]);

      const employeesJson = (await employeesRes.json()) as EmployeesResponse;
      const stagesJson = (await stagesRes.json()) as StagesResponse;

      if (!employeesRes.ok || !employeesJson.ok) {
        throw new Error(employeesJson.error || "Failed to load employees");
      }

      if (!stagesRes.ok || !stagesJson.ok) {
        throw new Error(stagesJson.error || "Failed to load stages");
      }

      setItems(employeesJson.items || []);
      setStages((stagesJson.items || []).filter((x) => x.name && x.id));
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetForm() {
    setFullName(EMPTY_FORM.fullName);
    setEmail(EMPTY_FORM.email);
    setPhone(EMPTY_FORM.phone);
    setPassword(EMPTY_FORM.password);
    setStageId(EMPTY_FORM.stageId);
    setPayType(EMPTY_FORM.payType);
    setBaseSalary(EMPTY_FORM.baseSalary);
    setHasMonthlyTarget(EMPTY_FORM.hasMonthlyTarget);
    setMonthlyTarget(EMPTY_FORM.monthlyTarget);
    setHasOverTargetBonus(EMPTY_FORM.hasOverTargetBonus);
    setBonusPerExtraPiece(EMPTY_FORM.bonusPerExtraPiece);
    setActive(EMPTY_FORM.active);
    setShowPassword(false);
    setEditingId(null);
  }

  function startEdit(item: EmployeeItem) {
    setError("");
    setCreatedCredentials(null);
    setEditingId(item.id);

    setFullName(item.full_name || "");
    setEmail(item.email || "");
    setPhone(item.phone || "");
    setPassword("");
    setStageId(item.stage_id || "");
    setPayType(item.pay_type === "salary" ? "salary" : "piece");
    setBaseSalary(
      item.pay_type === "salary" ? String(item.base_salary || 0) : "",
    );
    setHasMonthlyTarget(!!item.has_monthly_target);
    setMonthlyTarget(
      item.has_monthly_target && item.monthly_target != null
        ? String(item.monthly_target)
        : "",
    );
    setHasOverTargetBonus(!!item.has_over_target_bonus);
    setBonusPerExtraPiece(
      item.has_over_target_bonus ? String(item.bonus_per_extra_piece || 0) : "",
    );
    setActive(!!item.active);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload() {
    return {
      full_name: fullName,
      email,
      phone,
      password: password || undefined,
      stage_id: stageId,
      pay_type: payType,
      base_salary: payType === "salary" ? Number(baseSalary || 0) : 0,
      has_monthly_target: hasMonthlyTarget,
      monthly_target:
        hasMonthlyTarget && monthlyTarget !== "" ? Number(monthlyTarget) : null,
      has_over_target_bonus: hasMonthlyTarget && hasOverTargetBonus,
      bonus_per_extra_piece:
        hasMonthlyTarget && hasOverTargetBonus && bonusPerExtraPiece !== ""
          ? Number(bonusPerExtraPiece)
          : 0,
      active,
    };
  }

  async function onSave() {
    setSaving(true);
    setError("");
    setCreatedCredentials(null);

    try {
      const isEditing = !!editingId;
      const url = isEditing ? `/api/employees/${editingId}` : "/api/employees";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const json = (await res.json()) as CreateEmployeeResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to save employee");
      }

      if (!isEditing && json.credentials?.email && json.credentials?.password) {
        setCreatedCredentials({
          email: json.credentials.email,
          password: json.credentials.password,
        });
      }

      resetForm();
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: EmployeeItem) {
    setBusyId(item.id);
    setError("");

    try {
      const res = await fetch(`/api/employees/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: item.full_name,
          email: item.email,
          phone: item.phone,
          stage_id: item.stage_id,
          pay_type: item.pay_type === "salary" ? "salary" : "piece",
          base_salary: item.pay_type === "salary" ? item.base_salary || 0 : 0,
          has_monthly_target: item.has_monthly_target,
          monthly_target: item.has_monthly_target ? item.monthly_target : null,
          has_over_target_bonus: item.has_over_target_bonus,
          bonus_per_extra_piece: item.has_over_target_bonus
            ? item.bonus_per_extra_piece || 0
            : 0,
          active: !item.active,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to update employee");
      }

      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(item: EmployeeItem) {
    const confirmed = window.confirm(
      `هل تريد حذف الموظف "${item.full_name || item.email || item.id}"؟`,
    );
    if (!confirmed) return;

    setBusyId(item.id);
    setError("");

    try {
      const res = await fetch(`/api/employees/${item.id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to delete employee");
      }

      if (json.mode === "blocked_instead_of_delete") {
        setError("هذا الموظف لديه سجل سابق، تم حظره بدلًا من حذفه");
      }

      if (editingId === item.id) {
        resetForm();
      }

      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setBusyId(null);
    }
  }

  const formTitle = useMemo(
    () => (editingId ? "تعديل موظف" : "إضافة موظف"),
    [editingId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الموظفين</h1>
          <p className="text-sm text-muted-foreground">
            إدارة موظفي المشغل وربطهم بالتنفيذ والإنتاج لاحقًا
          </p>
        </div>

        <Button variant="outline" onClick={loadAll} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          تحديث
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {createdCredentials ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-3 pt-6">
            <div className="text-sm font-bold text-emerald-800">
              تم إنشاء حساب العامل بنجاح
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-white p-3">
                <div className="mb-1 text-xs text-muted-foreground">
                  الإيميل
                </div>
                <div className="break-all text-sm font-medium" dir="ltr">
                  {createdCredentials.email}
                </div>
              </div>

              <div className="rounded-lg border bg-white p-3">
                <div className="mb-1 text-xs text-muted-foreground">
                  كلمة المرور
                </div>
                <div className="break-all text-sm font-medium" dir="ltr">
                  {createdCredentials.password}
                </div>
              </div>
            </div>

            <div className="text-xs text-emerald-700">
              احفظ هذه البيانات وأرسلها للعامل حتى يتمكن من الدخول إلى
              /production-login
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{formTitle}</CardTitle>

            {editingId ? (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
                إلغاء
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الموظف</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: صالح أحمد"
              />
            </div>

            <div className="space-y-2">
              <Label>الإيميل</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>رقم الجوال</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>كلمة المرور {editingId ? "(اختياري)" : ""}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    editingId
                      ? "اتركها فارغة إذا لا تريد تغييرها"
                      : "اتركها فارغة لتوليد كلمة مرور تلقائيًا"
                  }
                  dir="ltr"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                {editingId
                  ? "إذا كتبت كلمة مرور جديدة سيتم تغييرها لهذا العامل"
                  : "إذا تركتها فارغة، النظام سينشئ كلمة مرور مؤقتة ويعرضها لك بعد الحفظ"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوظيفة / المرحلة</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  {stages.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      لا توجد مراحل
                    </div>
                  ) : (
                    stages.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>طريقة الدفع</Label>
              <div className="flex flex-wrap gap-3 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pay_type"
                    value="salary"
                    checked={payType === "salary"}
                    onChange={() => setPayType("salary")}
                  />
                  راتب
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pay_type"
                    value="piece"
                    checked={payType === "piece"}
                    onChange={() => setPayType("piece")}
                  />
                  بالقطعة
                </label>
              </div>
            </div>

            {payType === "salary" ? (
              <div className="space-y-2">
                <Label>الراتب الشهري</Label>
                <Input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  placeholder="0"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">هل له هدف شهري؟</div>
              </div>
              <Switch
                checked={hasMonthlyTarget}
                onCheckedChange={(v) => {
                  setHasMonthlyTarget(v);
                  if (!v) {
                    setMonthlyTarget("");
                    setHasOverTargetBonus(false);
                    setBonusPerExtraPiece("");
                  }
                }}
              />
            </div>

            {hasMonthlyTarget ? (
              <div className="space-y-2">
                <Label>الهدف الشهري</Label>
                <Input
                  type="number"
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(e.target.value)}
                  placeholder="مثال: 100"
                />
              </div>
            ) : null}

            {hasMonthlyTarget ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">
                    هل له مكافأة إذا تجاوز الهدف الشهري؟
                  </div>
                </div>
                <Switch
                  checked={hasOverTargetBonus}
                  onCheckedChange={(v) => {
                    setHasOverTargetBonus(v);
                    if (!v) setBonusPerExtraPiece("");
                  }}
                />
              </div>
            ) : null}

            {hasMonthlyTarget && hasOverTargetBonus ? (
              <div className="space-y-2">
                <Label>قيمة كل قطعة زيادة على الهدف</Label>
                <Input
                  type="number"
                  value={bonusPerExtraPiece}
                  onChange={(e) => setBonusPerExtraPiece(e.target.value)}
                  placeholder="0"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">نشط</div>
                <div className="text-xs text-muted-foreground">
                  إذا كان غير نشط فلن يعتمد عليه لاحقًا في التشغيل
                </div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <Button
              className="w-full"
              onClick={onSave}
              disabled={saving || !fullName || !email || !stageId}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "حفظ التعديلات" : "حفظ الموظف"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>قائمة الموظفين</CardTitle>
            <div className="rounded-full bg-muted px-3 py-1 text-xs">
              {items.length} موظف
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                جاري التحميل...
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm font-medium">لا يوجد موظفون بعد</div>
                <div className="text-xs text-muted-foreground">
                  أضف أول موظف من النموذج الموجود على اليمين
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-right text-muted-foreground">
                      <th className="px-3 py-3 font-medium">الاسم</th>
                      <th className="px-3 py-3 font-medium">الإيميل</th>
                      <th className="px-3 py-3 font-medium">الجوال</th>
                      <th className="px-3 py-3 font-medium">المرحلة</th>
                      <th className="px-3 py-3 font-medium">طريقة الدفع</th>
                      <th className="px-3 py-3 font-medium">الراتب</th>
                      <th className="px-3 py-3 font-medium">الهدف</th>
                      <th className="px-3 py-3 font-medium">مكافأة الزيادة</th>
                      <th className="px-3 py-3 font-medium">الحالة</th>
                      <th className="px-3 py-3 font-medium">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="px-3 py-3">{item.full_name || "-"}</td>
                        <td className="px-3 py-3">{item.email || "-"}</td>
                        <td className="px-3 py-3">{item.phone || "-"}</td>
                        <td className="px-3 py-3">{item.stage_name || "-"}</td>
                        <td className="px-3 py-3">
                          {item.pay_type === "piece" ? "بالقطعة" : "راتب"}
                        </td>
                        <td className="px-3 py-3">
                          {item.pay_type === "salary"
                            ? Number(item.base_salary || 0).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {item.has_monthly_target
                            ? (item.monthly_target ?? "-")
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {item.has_over_target_bonus
                            ? Number(
                                item.bonus_per_extra_piece || 0,
                              ).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              item.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.active ? "نشط" : "موقوف"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(item)}
                              disabled={busyId === item.id}
                            >
                              <Pencil className="h-4 w-4" />
                              تعديل
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActive(item)}
                              disabled={busyId === item.id}
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : item.active ? (
                                <Ban className="h-4 w-4" />
                              ) : (
                                <ShieldCheck className="h-4 w-4" />
                              )}
                              {item.active ? "حظر" : "فك الحظر"}
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDelete(item)}
                              disabled={busyId === item.id}
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              حذف
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
