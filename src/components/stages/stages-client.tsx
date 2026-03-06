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
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">إدارة المراحل</h2>
          <p className="text-sm text-muted-foreground">
            إضافة/تعديل/ترتيب/أرشفة
          </p>
        </div>

        <Button onClick={openCreate} className="cursor-pointer">
          <Plus className="me-2 h-4 w-4" />
          إضافة مرحلة
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">المراحل النشطة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : activeItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد مراحل.</div>
          ) : (
            activeItems.map((s, idx) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{s.name}</div>
                    {rowHint(s).map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ترتيب: {s.sort_order}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 cursor-pointer"
                    disabled={idx === 0}
                    onClick={() => move(s.id, "up")}
                    title="أعلى"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 cursor-pointer"
                    disabled={idx === activeItems.length - 1}
                    onClick={() => move(s.id, "down")}
                    title="أسفل"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 cursor-pointer"
                    onClick={() => openEdit(s)}
                    title="تعديل"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 cursor-pointer"
                    onClick={() => setArchived(s, true)}
                    title="أرشفة"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 w-9 p-0 cursor-pointer"
                    onClick={() => del(s)}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {archivedItems.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">مؤرشفة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archivedItems.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ترتيب: {s.sort_order}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setArchived(s, false)}
                  className="cursor-pointer"
                >
                  إلغاء الأرشفة
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden">
          <div className="border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle>
                {mode === "create" ? "إضافة مرحلة" : "تعديل مرحلة"}
              </DialogTitle>
              <DialogDescription>إعدادات بسيطة ومباشرة</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label>اسم المرحلة</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: قصاص"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">منع القفز</div>
                <div className="text-xs text-muted-foreground">
                  لا يسمح بتنفيذ المرحلة إلا بعد إكمال ما قبلها.
                </div>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={requirePrev}
                  onCheckedChange={setRequirePrev}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">خصم مخزون</div>
                <div className="text-xs text-muted-foreground">
                  عند تنفيذ المرحلة يتم خصم المواد الخام.
                </div>
              </div>
              <div className="shrink-0">
                <Switch
                  checked={deduct}
                  onCheckedChange={setDeduct}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="border-t px-6 py-4">
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="cursor-pointer"
              >
                إلغاء
              </Button>
              <Button
                onClick={submit}
                disabled={saving}
                className="cursor-pointer"
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
