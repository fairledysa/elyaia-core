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
  Briefcase,
  Wallet,
  Target,
  UserCog,
  AlertTriangle,
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

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <Card className="rounded-3xl border-border/70 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-2 text-3xl font-black tracking-tight">
              {value}
            </div>
            {subtitle ? (
              <div className="mt-1 text-xs text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmployeesClient() {
  const [items, setItems] = useState<EmployeeItem[]>([]);
  const [stages, setStages] = useState<StageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

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
  const [stageNeedsReselect, setStageNeedsReselect] = useState(false);

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
    setStageNeedsReselect(false);
  }

  function startEdit(item: EmployeeItem) {
    setError("");
    setCreatedCredentials(null);
    setEditingId(item.id);

    const stageExists =
      !!item.stage_id && stages.some((s) => s.id === item.stage_id);

    setFullName(item.full_name || "");
    setEmail(item.email || "");
    setPhone(item.phone || "");
    setPassword("");
    setStageId(stageExists ? item.stage_id || "" : "");
    setStageNeedsReselect(!!item.stage_id && !stageExists);

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

    if (!!item.stage_id && !stageExists) {
      setError(
        `الموظف مربوط بمرحلة قديمة أو مؤرشفة (${item.stage_name || "غير معروفة"})، اختر مرحلة جديدة ثم احفظ.`,
      );
    }

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
        if (json.error === "Invalid stage_id") {
          throw new Error(
            "المرحلة المحددة غير صالحة أو مؤرشفة، اختر مرحلة صحيحة ثم احفظ",
          );
        }
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

  const stats = useMemo(() => {
    const total = items.length;
    const activeCount = items.filter((x) => x.active).length;
    const salaryCount = items.filter((x) => x.pay_type === "salary").length;
    const pieceCount = items.filter((x) => x.pay_type === "piece").length;

    return { total, activeCount, salaryCount, pieceCount };
  }, [items]);

  return (
    <div dir="rtl" className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              إدارة الموظفين وربطهم بالإنتاج
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                الموظفين
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                إدارة موظفي المشغل وربطهم بالمراحل والأهداف وطريقة الدفع
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="h-11 gap-2 rounded-2xl border-border/70"
            onClick={loadAll}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            تحديث
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="rounded-3xl border-red-200 bg-red-50 shadow-sm">
          <CardContent className="p-5 text-sm text-red-700">
            {error}
          </CardContent>
        </Card>
      ) : null}

      {createdCredentials ? (
        <Card className="rounded-3xl border-emerald-200 bg-emerald-50 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="text-sm font-bold text-emerald-800">
              تم إنشاء حساب العامل بنجاح
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border bg-white p-4">
                <div className="mb-1 text-xs text-muted-foreground">
                  الإيميل
                </div>
                <div className="break-all text-sm font-medium" dir="ltr">
                  {createdCredentials.email}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="إجمالي الموظفين"
          value={String(stats.total)}
          icon={Users}
        />
        <StatCard
          title="الموظفون النشطون"
          value={String(stats.activeCount)}
          icon={ShieldCheck}
        />
        <StatCard
          title="رواتب شهرية"
          value={String(stats.salaryCount)}
          icon={Wallet}
        />
        <StatCard
          title="عمل بالقطعة"
          value={String(stats.pieceCount)}
          icon={Target}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm lg:col-span-1">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="h-5 w-5" />
                {formTitle}
              </CardTitle>

              {editingId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={resetForm}
                >
                  <X className="h-4 w-4" />
                  إلغاء
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-5">
            {stageNeedsReselect ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="mb-1 flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                  يلزم اختيار مرحلة جديدة
                </div>
                <div>
                  المرحلة القديمة لهذا الموظف لم تعد متاحة ضمن المراحل النشطة،
                  لذلك اختر مرحلة صحيحة ثم احفظ.
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>اسم الموظف</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: صالح أحمد"
                className="h-11 rounded-2xl"
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
                className="h-11 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <Label>رقم الجوال</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="h-11 rounded-2xl"
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
                  className="h-11 rounded-2xl pe-10"
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

              <div className="text-xs leading-6 text-muted-foreground">
                {editingId
                  ? "إذا كتبت كلمة مرور جديدة سيتم تغييرها لهذا العامل"
                  : "إذا تركتها فارغة، النظام سينشئ كلمة مرور مؤقتة ويعرضها لك بعد الحفظ"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوظيفة / المرحلة</Label>
              <Select
                value={stageId}
                onValueChange={(value) => {
                  setStageId(value);
                  setStageNeedsReselect(false);
                  if (error.includes("مرحلة")) {
                    setError("");
                  }
                }}
              >
                <SelectTrigger className="h-11 rounded-2xl">
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
              <div className="flex flex-wrap gap-3 rounded-2xl border border-border/70 p-4">
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
                  className="h-11 rounded-2xl"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
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
                  className="h-11 rounded-2xl"
                />
              </div>
            ) : null}

            {hasMonthlyTarget ? (
              <div className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
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
                  className="h-11 rounded-2xl"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
              <div>
                <div className="text-sm font-medium">نشط</div>
                <div className="text-xs text-muted-foreground">
                  إذا كان غير نشط فلن يعتمد عليه لاحقًا في التشغيل
                </div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <Button
              className="h-11 w-full gap-2 rounded-2xl"
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

        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                قائمة الموظفين
              </CardTitle>

              <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {items.length} موظف
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                جاري التحميل...
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm font-medium">لا يوجد موظفون بعد</div>
                <div className="text-xs text-muted-foreground">
                  أضف أول موظف من النموذج الموجود على اليمين
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border/70">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-muted/30">
                    <tr className="border-b text-right text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">الاسم</th>
                      <th className="px-4 py-3 font-semibold">الإيميل</th>
                      <th className="px-4 py-3 font-semibold">الجوال</th>
                      <th className="px-4 py-3 font-semibold">المرحلة</th>
                      <th className="px-4 py-3 font-semibold">طريقة الدفع</th>
                      <th className="px-4 py-3 font-semibold">الراتب</th>
                      <th className="px-4 py-3 font-semibold">الهدف</th>
                      <th className="px-4 py-3 font-semibold">
                        مكافأة الزيادة
                      </th>
                      <th className="px-4 py-3 font-semibold">الحالة</th>
                      <th className="px-4 py-3 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/60 transition last:border-b-0 hover:bg-muted/10"
                      >
                        <td className="px-4 py-4 font-medium">
                          {item.full_name || "-"}
                        </td>
                        <td className="px-4 py-4" dir="ltr">
                          {item.email || "-"}
                        </td>
                        <td className="px-4 py-4" dir="ltr">
                          {item.phone || "-"}
                        </td>
                        <td className="px-4 py-4">{item.stage_name || "-"}</td>
                        <td className="px-4 py-4">
                          {item.pay_type === "piece" ? "بالقطعة" : "راتب"}
                        </td>
                        <td className="px-4 py-4">
                          {item.pay_type === "salary"
                            ? Number(item.base_salary || 0).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-4">
                          {item.has_monthly_target
                            ? (item.monthly_target ?? "-")
                            : "-"}
                        </td>
                        <td className="px-4 py-4">
                          {item.has_over_target_bonus
                            ? Number(
                                item.bonus_per_extra_piece || 0,
                              ).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              item.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.active ? "نشط" : "موقوف"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => startEdit(item)}
                              disabled={busyId === item.id}
                            >
                              <Pencil className="h-4 w-4" />
                              تعديل
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
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
                              className="rounded-xl"
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
