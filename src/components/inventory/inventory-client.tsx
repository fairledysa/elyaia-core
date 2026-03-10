// FILE: src/components/inventory/inventory-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Archive,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Loader2,
  MoreVertical,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FabricRow = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  unit_cost: number;
  reorder_level: number;
  allow_negative: boolean;
};

type StatusFilter = "all" | "good" | "low" | "empty";

type MaterialPayload = {
  name: string;
  unit: string;
  unit_cost: number;
  reorder_level: number;
  allow_negative: boolean;
};

type ReceivePayload = {
  material_id: string;
  delta: number;
  unit_cost: number;
  note: string;
};

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  return JSON.parse(txt) as T;
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatQty(value: number | null | undefined) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function unitLabel(unit: string | null | undefined) {
  switch (unit) {
    case "m":
      return "متر";
    case "pcs":
      return "قطعة";
    case "roll":
      return "لفة";
    default:
      return unit || "—";
  }
}

function getStatus(row: FabricRow) {
  const onHand = Number(row.on_hand || 0);
  const reorderLevel = Number(row.reorder_level || 0);

  if (onHand <= 0) {
    return {
      key: "empty" as const,
      label: "نافد",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (onHand <= reorderLevel) {
    return {
      key: "low" as const,
      label: "منخفض",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    key: "good" as const,
    label: "جيد",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const emptyMaterialForm: MaterialPayload = {
  name: "",
  unit: "m",
  unit_cost: 0,
  reorder_level: 0,
  allow_negative: false,
};

const emptyReceiveForm: ReceivePayload = {
  material_id: "",
  delta: 0,
  unit_cost: 0,
  note: "",
};

export default function InventoryClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FabricRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const [addOpen, setAddOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [addSaving, setAddSaving] = useState(false);
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteSavingId, setDeleteSavingId] = useState<string | null>(null);

  const [newMaterial, setNewMaterial] =
    useState<MaterialPayload>(emptyMaterialForm);
  const [receiveForm, setReceiveForm] =
    useState<ReceivePayload>(emptyReceiveForm);
  const [editing, setEditing] = useState<FabricRow | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await j<{ ok: boolean; items: FabricRow[] }>(
        "/api/materials",
      );
      setRows(res.items || []);
    } catch (e: any) {
      setError(e?.message || "تعذر تحميل الأقمشة");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return rows.filter((row) => {
      const status = getStatus(row);

      const matchesSearch = !needle
        ? true
        : (row.name || "").toLowerCase().includes(needle);

      const matchesStatus =
        statusFilter === "all" ? true : status.key === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const totalCount = filteredRows.length;
    const totalValue = filteredRows.reduce(
      (sum, row) => sum + Number(row.on_hand || 0) * Number(row.unit_cost || 0),
      0,
    );
    const totalRemaining = filteredRows.reduce(
      (sum, row) => sum + Number(row.on_hand || 0),
      0,
    );
    const lowCount = filteredRows.filter(
      (row) =>
        Number(row.on_hand || 0) > 0 &&
        Number(row.on_hand || 0) <= Number(row.reorder_level || 0),
    ).length;
    const emptyCount = filteredRows.filter(
      (row) => Number(row.on_hand || 0) <= 0,
    ).length;

    return {
      totalCount,
      totalValue,
      totalRemaining,
      lowCount,
      emptyCount,
    };
  }, [filteredRows]);

  function openEdit(row: FabricRow) {
    setEditing({ ...row });
    setEditOpen(true);
  }

  async function createMaterial() {
    const name = newMaterial.name.trim();
    if (!name) {
      alert("اكتب اسم القماش");
      return;
    }

    setAddSaving(true);
    try {
      const created = await j<{ ok: boolean; item: FabricRow }>(
        "/api/materials",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            unit: newMaterial.unit,
            unit_cost: Number(newMaterial.unit_cost || 0),
          }),
        },
      );

      const createdId = created.item?.id;
      if (createdId) {
        await j(`/api/materials/${encodeURIComponent(createdId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reorder_level: Number(newMaterial.reorder_level || 0),
            allow_negative: !!newMaterial.allow_negative,
          }),
        });
      }

      setAddOpen(false);
      setNewMaterial(emptyMaterialForm);
      await load();
    } catch (e: any) {
      alert(e?.message || "تعذر إضافة القماش");
    } finally {
      setAddSaving(false);
    }
  }

  async function submitReceive() {
    if (!receiveForm.material_id) {
      alert("اختر القماش");
      return;
    }

    if (Number(receiveForm.delta) <= 0) {
      alert("الكمية يجب أن تكون أكبر من صفر");
      return;
    }

    setReceiveSaving(true);
    try {
      await j("/api/materials/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material_id: receiveForm.material_id,
          delta: Number(receiveForm.delta || 0),
          move_type: "purchase_in",
          unit_cost: Number(receiveForm.unit_cost || 0),
          note: receiveForm.note.trim() || null,
        }),
      });

      setReceiveOpen(false);
      setReceiveForm(emptyReceiveForm);
      await load();
    } catch (e: any) {
      alert(e?.message || "تعذر إدخال القماش");
    } finally {
      setReceiveSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;

    const name = String(editing.name || "").trim();
    if (!name) {
      alert("اسم القماش مطلوب");
      return;
    }

    setEditSaving(true);
    try {
      await j(`/api/materials/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          unit: editing.unit,
          unit_cost: Number(editing.unit_cost || 0),
          reorder_level: Number(editing.reorder_level || 0),
          allow_negative: !!editing.allow_negative,
        }),
      });

      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "تعذر حفظ التعديل");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteRow(id: string) {
    setDeleteSavingId(id);
    try {
      await j(`/api/materials/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "تعذر حذف القماش");
    } finally {
      setDeleteSavingId(null);
    }
  }

  function archiveRow() {
    alert("الأرشفة تحتاج ربط Backend أولاً.");
  }

  const columns = useMemo<ColumnDef<FabricRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "اسم القماش",
        cell: ({ row }) => (
          <div className="font-medium text-foreground">{row.original.name}</div>
        ),
      },
      {
        accessorKey: "unit",
        header: "الوحدة",
        cell: ({ row }) => (
          <div className="text-center">{unitLabel(row.original.unit)}</div>
        ),
      },
      {
        id: "stock_value",
        header: "قيمة المخزون",
        accessorFn: (row) =>
          Number(row.on_hand || 0) * Number(row.unit_cost || 0),
        cell: ({ row }) => {
          const stockValue =
            Number(row.original.on_hand || 0) *
            Number(row.original.unit_cost || 0);

          return <div className="text-center">{formatMoney(stockValue)}</div>;
        },
      },
      {
        accessorKey: "on_hand",
        header: "المتبقي",
        cell: ({ row }) => (
          <div className="text-center">
            {formatQty(row.original.on_hand)} {unitLabel(row.original.unit)}
          </div>
        ),
      },
      {
        id: "status",
        header: "الحالة",
        accessorFn: (row) => getStatus(row).label,
        cell: ({ row }) => {
          const status = getStatus(row.original);
          return (
            <div className="text-center">
              <span
                className={`inline-flex min-w-16 justify-center rounded-md border px-3 py-1 text-xs ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "الإجراءات",
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;

          return (
            <div className="text-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    حد التنبيه: {formatQty(item.reorder_level)}
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => openEdit(item)}>
                    <Pencil className="ml-2 h-4 w-4" />
                    تعديل
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/inventory/${item.id}`}>
                      <FileText className="ml-2 h-4 w-4" />
                      تقرير
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={archiveRow}>
                    <Archive className="ml-2 h-4 w-4" />
                    أرشفة
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف القماش</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم حذف القماش نهائيًا. هذا الإجراء لا يمكن التراجع
                          عنه.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteRow(item.id)}
                          disabled={deleteSavingId === item.id}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteSavingId === item.id ? (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          ) : null}
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [deleteSavingId],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">الأقمشة</h1>
            <p className="text-sm text-muted-foreground">
              إدارة الأقمشة والمتبقي وقيمة المخزون
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              إضافة قماش
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setReceiveOpen(true)}
            >
              <PackagePlus className="h-4 w-4" />
              إدخال قماش
            </Button>

            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard/inventory/moves">
                <FileText className="h-4 w-4" />
                تقارير الحركة
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">عدد الأقمشة</div>
              <div className="mt-2 text-3xl font-semibold">
                {formatQty(stats.totalCount)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">المتبقي</div>
              <div className="mt-2 text-3xl font-semibold">
                {formatQty(stats.totalRemaining)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">قيمة المخزون</div>
              <div className="mt-2 text-3xl font-semibold">
                {formatMoney(stats.totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">حالة المخزون</div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="font-semibold">
                    {formatQty(stats.lowCount)}
                  </span>
                  <span className="text-muted-foreground">منخفض</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">
                    {formatQty(stats.emptyCount)}
                  </span>
                  <span className="text-muted-foreground">نافد</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="relative xl:col-span-2">
                <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pr-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث باسم القماش"
                />
              </div>

              <div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as StatusFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="فلترة الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="good">جيد</SelectItem>
                    <SelectItem value="low">منخفض</SelectItem>
                    <SelectItem value="empty">نافد</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead
                              key={header.id}
                              className="text-right font-medium"
                            >
                              {header.isPlaceholder ? null : (
                                <div
                                  className={
                                    header.column.getCanSort()
                                      ? "flex cursor-pointer items-center gap-1 select-none"
                                      : ""
                                  }
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                  {header.column.getCanSort() ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : null}
                                </div>
                              )}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>

                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-28 text-center text-sm text-muted-foreground"
                        >
                          لا توجد أقمشة.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  إجمالي النتائج: {formatQty(filteredRows.length)}
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={String(table.getState().pagination.pageSize)}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 صفوف</SelectItem>
                      <SelectItem value="20">20 صفًا</SelectItem>
                      <SelectItem value="50">50 صفًا</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>

                  <div className="min-w-[100px] text-center text-sm">
                    صفحة {table.getState().pagination.pageIndex + 1} من{" "}
                    {table.getPageCount() || 1}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة قماش جديد</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm">اسم القماش</div>
              <Input
                value={newMaterial.name}
                onChange={(e) =>
                  setNewMaterial((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="مثال: قماش ياباني أسود"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">الوحدة</div>
              <Select
                value={newMaterial.unit}
                onValueChange={(value) =>
                  setNewMaterial((prev) => ({ ...prev, unit: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="m">متر</SelectItem>
                  <SelectItem value="pcs">قطعة</SelectItem>
                  <SelectItem value="roll">لفة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm">تكلفة الوحدة</div>
              <Input
                inputMode="decimal"
                value={String(newMaterial.unit_cost)}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    unit_cost: toNumber(e.target.value),
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">حد التنبيه</div>
              <Input
                inputMode="decimal"
                value={String(newMaterial.reorder_level)}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    reorder_level: toNumber(e.target.value),
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="text-sm font-medium">السماح بالسالب</div>
              <div className="text-xs text-muted-foreground">
                تفعيل السحب حتى لو الرصيد صفر
              </div>
            </div>

            <Switch
              checked={!!newMaterial.allow_negative}
              onCheckedChange={(v) =>
                setNewMaterial((prev) => ({ ...prev, allow_negative: v }))
              }
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={createMaterial} disabled={addSaving}>
              {addSaving ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : null}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>إدخال قماش</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm">القماش</div>
              <Select
                value={receiveForm.material_id}
                onValueChange={(value) =>
                  setReceiveForm((prev) => ({ ...prev, material_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القماش" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm">الكمية</div>
              <Input
                inputMode="decimal"
                value={String(receiveForm.delta || "")}
                onChange={(e) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    delta: toNumber(e.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm">تكلفة الوحدة</div>
              <Input
                inputMode="decimal"
                value={String(receiveForm.unit_cost || "")}
                onChange={(e) =>
                  setReceiveForm((prev) => ({
                    ...prev,
                    unit_cost: toNumber(e.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-sm">ملاحظة</div>
              <Input
                value={receiveForm.note}
                onChange={(e) =>
                  setReceiveForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="مثال: توريد جديد / شراء مباشر"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={submitReceive} disabled={receiveSaving}>
              {receiveSaving ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : null}
              حفظ الحركة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل بيانات القماش</DialogTitle>
          </DialogHeader>

          {editing ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm">اسم القماش</div>
                  <Input
                    value={editing.name}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm">الوحدة</div>
                  <Select
                    value={editing.unit}
                    onValueChange={(value) =>
                      setEditing((prev) =>
                        prev ? { ...prev, unit: value } : prev,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">متر</SelectItem>
                      <SelectItem value="pcs">قطعة</SelectItem>
                      <SelectItem value="roll">لفة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-sm">تكلفة الوحدة</div>
                  <Input
                    inputMode="decimal"
                    value={String(editing.unit_cost ?? 0)}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev
                          ? { ...prev, unit_cost: toNumber(e.target.value) }
                          : prev,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm">حد التنبيه</div>
                  <Input
                    inputMode="decimal"
                    value={String(editing.reorder_level ?? 0)}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev
                          ? { ...prev, reorder_level: toNumber(e.target.value) }
                          : prev,
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <div className="text-sm font-medium">السماح بالسالب</div>
                  <div className="text-xs text-muted-foreground">
                    تفعيل السحب حتى لو الرصيد صفر
                  </div>
                </div>

                <Switch
                  checked={!!editing.allow_negative}
                  onCheckedChange={(v) =>
                    setEditing((prev) =>
                      prev ? { ...prev, allow_negative: v } : prev,
                    )
                  }
                />
              </div>

              <DialogFooter className="gap-2 sm:justify-start">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={saveEdit} disabled={editSaving}>
                  {editSaving ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : null}
                  حفظ
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
