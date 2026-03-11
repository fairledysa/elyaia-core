// FILE: src/components/stages/stages-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  ArrowUp,
  ArrowDown,
  Archive,
  Pencil,
  Trash2,
  Workflow,
  ArchiveRestore,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

type StageRow = {
  id: string;
  name: string;
  sort_order: number;
  require_previous_complete: boolean;
  inventory_deduct_enabled: boolean;
  archived: boolean;
  created_at: string | null;
};

type StageListResponse = { ok: boolean; items: StageRow[]; error?: string };
type StageCreateResponse = { ok: boolean; item?: StageRow; error?: string };
type StageUpdateResponse = { ok: boolean; item?: StageRow; error?: string };
type StageDeleteResponse = { ok: boolean; deleted?: boolean; error?: string };

function rowHint(s: StageRow) {
  const tags: string[] = [];
  if (s.require_previous_complete) tags.push("منع القفز");
  if (s.inventory_deduct_enabled) tags.push("خصم مخزون");
  if (s.archived) tags.push("مؤرشف");
  return tags;
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  count,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
      <div className="flex items-center gap-3 text-right">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/50 text-foreground">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <div className="text-base font-bold md:text-lg">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>

      {typeof count === "number" ? (
        <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {count}
        </div>
      ) : null}
    </div>
  );
}

export default function StagesClient() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StageRow[]>([]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<StageRow | null>(null);

  const [name, setName] = useState("");
  const [requirePrev, setRequirePrev] = useState(true);
  const [deduct, setDeduct] = useState(false);

  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/stages", { cache: "no-store" });
      const j = (await r.json()) as StageListResponse;
      if (!r.ok || !j.ok) throw new Error(j.error || "Load failed");
      setItems(j.items || []);
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "فشل التحميل",
        variant: "destructive" as any,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeItems = useMemo(
    () =>
      items
        .filter((x) => !x.archived)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  const archivedItems = useMemo(
    () =>
      items
        .filter((x) => x.archived)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  function openCreate() {
    setMode("create");
    setEditing(null);
    setName("");
    setRequirePrev(true);
    setDeduct(false);
    setOpen(true);
  }

  function openEdit(s: StageRow) {
    setMode("edit");
    setEditing(s);
    setName(s.name);
    setRequirePrev(!!s.require_previous_complete);
    setDeduct(!!s.inventory_deduct_enabled);
    setOpen(true);
  }

  async function submit() {
    if (!name.trim()) {
      toast({ title: "تنبيه", description: "اسم المرحلة مطلوب" });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const r = await fetch("/api/stages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            require_previous_complete: requirePrev,
            inventory_deduct_enabled: deduct,
          }),
        });
        const j = (await r.json()) as StageCreateResponse;
        if (!r.ok || !j.ok) throw new Error(j.error || "Create failed");
      } else {
        const r = await fetch(`/api/stages/${editing!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            require_previous_complete: requirePrev,
            inventory_deduct_enabled: deduct,
          }),
        });
        const j = (await r.json()) as StageUpdateResponse;
        if (!r.ok || !j.ok) throw new Error(j.error || "Update failed");
      }

      setOpen(false);
      await load();
      toast({ title: "تم", description: "تم حفظ المرحلة" });
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "فشل الحفظ",
        variant: "destructive" as any,
      });
    } finally {
      setSaving(false);
    }
  }

  async function move(id: string, dir: "up" | "down") {
    try {
      const r = await fetch(`/api/stages/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Move failed");
      await load();
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "فشل الترتيب",
        variant: "destructive" as any,
      });
    }
  }

  async function setArchived(s: StageRow, archived: boolean) {
    try {
      const r = await fetch(`/api/stages/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const j = (await r.json()) as StageUpdateResponse;
      if (!r.ok || !j.ok) throw new Error(j.error || "Archive failed");
      await load();
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "فشل الأرشفة",
        variant: "destructive" as any,
      });
    }
  }

  async function del(s: StageRow) {
    if (!confirm("حذف المرحلة؟ لن يسمح بالحذف إذا لها تنفيذ.")) return;

    try {
      const r = await fetch(`/api/stages/${s.id}`, { method: "DELETE" });
      const j = (await r.json()) as StageDeleteResponse;
      if (!r.ok || !j.ok) throw new Error(j.error || "Delete failed");
      await load();
      toast({ title: "تم", description: "تم حذف المرحلة" });
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e?.message || "فشل الحذف",
        variant: "destructive" as any,
      });
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 md:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3 text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Workflow className="h-3.5 w-3.5" />
              إدارة مراحل التشغيل والإنتاج
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                إدارة المراحل
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                إضافة وتعديل وترتيب وأرشفة مراحل العمل بطريقة واضحة ومنظمة
              </p>
            </div>
          </div>

          <Button onClick={openCreate} className="h-12 rounded-2xl px-5">
            <Plus className="me-2 h-4 w-4" />
            إضافة مرحلة
          </Button>
        </div>
      </div>

      {/* Active stages */}
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <SectionHeader
          icon={Workflow}
          title="المراحل النشطة"
          subtitle="المراحل المستخدمة حاليًا في التشغيل"
          count={activeItems.length}
        />

        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : activeItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              لا توجد مراحل.
            </div>
          ) : (
            <div className="space-y-3">
              {activeItems.map((s, idx) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border/70 p-4 transition hover:bg-muted/20"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 text-right">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-bold">{s.name}</div>

                        {rowHint(s).map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="rounded-full px-3 py-1 text-xs"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        ترتيب المرحلة: {s.sort_order}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 rounded-xl p-0"
                        disabled={idx === 0}
                        onClick={() => move(s.id, "up")}
                        title="أعلى"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 rounded-xl p-0"
                        disabled={idx === activeItems.length - 1}
                        onClick={() => move(s.id, "down")}
                        title="أسفل"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 rounded-xl p-0"
                        onClick={() => openEdit(s)}
                        title="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 rounded-xl p-0"
                        onClick={() => setArchived(s, true)}
                        title="أرشفة"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-10 w-10 rounded-xl p-0"
                        onClick={() => del(s)}
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived */}
      {archivedItems.length ? (
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
          <SectionHeader
            icon={ArchiveRestore}
            title="المراحل المؤرشفة"
            subtitle="مراحل محفوظة خارج التشغيل الحالي"
            count={archivedItems.length}
          />

          <CardContent className="p-4">
            <div className="space-y-3">
              {archivedItems.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border/70 p-4 transition hover:bg-muted/20"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="text-right">
                      <div className="font-bold">{s.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        ترتيب المرحلة: {s.sort_order}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setArchived(s, false)}
                      className="h-10 rounded-xl"
                    >
                      إلغاء الأرشفة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="overflow-hidden p-0 sm:max-w-xl">
          <div className="border-b border-border/60 px-6 py-5">
            <DialogHeader className="text-right">
              <DialogTitle className="text-xl font-bold">
                {mode === "create" ? "إضافة مرحلة" : "تعديل مرحلة"}
              </DialogTitle>
              <DialogDescription className="pt-1">
                إعدادات المرحلة الأساسية الخاصة بالتشغيل
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label>اسم المرحلة</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: قصاص"
                className="h-11 rounded-2xl"
              />
            </div>

            <Separator />

            <div className="rounded-2xl border border-border/70 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 text-right">
                  <div className="text-sm font-semibold">منع القفز</div>
                  <div className="text-xs leading-6 text-muted-foreground">
                    لا يسمح بتنفيذ المرحلة إلا بعد إكمال المرحلة السابقة
                  </div>
                </div>

                <div className="shrink-0">
                  <Switch
                    checked={requirePrev}
                    onCheckedChange={setRequirePrev}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1 text-right">
                  <div className="text-sm font-semibold">خصم مخزون</div>
                  <div className="text-xs leading-6 text-muted-foreground">
                    عند تنفيذ هذه المرحلة يتم خصم المواد الخام المرتبطة
                  </div>
                </div>

                <div className="shrink-0">
                  <Switch checked={deduct} onCheckedChange={setDeduct} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 px-6 py-4">
            <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-11 rounded-2xl"
              >
                إلغاء
              </Button>

              <Button
                onClick={submit}
                disabled={saving}
                className="h-11 rounded-2xl px-5"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </span>
                ) : (
                  "حفظ"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
