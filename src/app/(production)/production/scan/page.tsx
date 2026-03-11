// FILE: src/app/(production)/production/scan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Expand,
  Flashlight,
  ImageIcon,
  Keyboard,
  Loader2,
  MapPin,
  Ruler,
  ScanLine,
  Shirt,
  UserRound,
  X,
} from "lucide-react";

type ScanApiResponse = {
  ok?: boolean;
  action?: "preview" | "confirm";
  message?: string;
  error?: string;
  alreadyDoneAt?: string | null;
  alreadyScanned?: boolean;
  canConfirm?: boolean;
  requiredStage?: string | null;
  validation?: {
    previousCompleted?: boolean;
    requiredStageName?: string | null;
  };
  item?: {
    id?: string;
    qrCode?: string;
    quantityIndex?: number;
    orderId?: string;
    sallaItemId?: string | null;
    status?: string;
  };
  order?: {
    id?: string;
    orderNumber?: string | null;
    sallaOrderId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    city?: string | null;
  };
  product?: {
    name?: string | null;
    sku?: string | null;
    imageUrl?: string | null;
    size?: string | null;
    optionsText?: string | null;
    customerNote?: string | null;
  };
  material?: {
    name?: string | null;
    qtyPerPiece?: number | null;
    onHand?: number | null;
    unit?: string | null;
  };
  progress?: {
    totalPieces?: number;
    completedForCurrentStage?: number;
    remainingPieces?: number;
  };
  employee?: {
    id?: string;
    payType?: string | null;
    pieceRateEnabled?: boolean;
    showPayout?: boolean;
  };
  stage?: {
    id?: string;
    name?: string | null;
    payoutAmount?: number | null;
    scannedAt?: string;
    allowSkip?: boolean;
    requirePreviousComplete?: boolean;
    buttonLabel?: string;
  } | null;
  nextStage?: {
    id?: string;
    name?: string | null;
  } | null;
};

type RecentScanStatus = "تم التنفيذ" | "فشل" | "معاينة";

type RecentScanItem = {
  id: string;
  code: string;
  item: string;
  status: RecentScanStatus;
  time: string;
};

type ResultState = {
  kind: "idle" | "success" | "error" | "preview";
  message: string;
  orderNumber: string;
  pieceLabel: string;
  productName: string;
  stageName: string;
  nextStageName: string;
  qrCode: string;
};

function timeAgoLabel(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "الآن";
  if (seconds < 3600) return `قبل ${Math.floor(seconds / 60)} دقيقة`;
  return `قبل ${Math.floor(seconds / 3600)} ساعة`;
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 2,
  }).format(value);
}

function mapApiErrorToArabic(data: ScanApiResponse, qrValue: string) {
  switch (data.error) {
    case "UNAUTHORIZED":
      return "يجب تسجيل الدخول أولًا";
    case "QR_CODE_REQUIRED":
      return "أدخل رمز QR أولًا";
    case "TENANT_NOT_FOUND":
      return "لم يتم العثور على المتجر المرتبط بهذا الحساب";
    case "EMPLOYEE_NOT_ACTIVE":
      return "هذا الموظف غير نشط";
    case "EMPLOYEE_STAGE_NOT_ASSIGNED":
      return "لم يتم تعيين مرحلة لهذا الموظف";
    case "ITEM_NOT_FOUND":
      return `لم يتم العثور على قطعة بهذا الرمز: ${qrValue}`;
    case "ORDER_NOT_FOUND":
      return "تم العثور على القطعة لكن الطلب غير موجود";
    case "THIS_STAGE_NOT_ENABLED_FOR_PRODUCT":
      return "هذه المرحلة غير مفعلة لهذا المنتج";
    case "STAGE_ALREADY_SCANNED":
      return "تم تنفيذ هذه المرحلة مسبقًا";
    case "PREVIOUS_STAGE_REQUIRED":
      return data.requiredStage
        ? `يجب إنهاء المرحلة السابقة أولًا: ${data.requiredStage}`
        : "يجب إنهاء المرحلة السابقة أولًا";
    default:
      return data.message || data.error || "تعذر تنفيذ المرحلة لهذه القطعة";
  }
}

function mapConfirmSuccessMessage(data: ScanApiResponse) {
  if (data.message === "ITEM_COMPLETED") {
    return "تم تنفيذ المرحلة الأخيرة واكتمال القطعة";
  }

  if (data.message === "STAGE_SCANNED") {
    if (data.nextStage?.name) {
      return `تم تنفيذ المرحلة بنجاح. المرحلة التالية: ${data.nextStage.name}`;
    }
    return "تم تنفيذ المرحلة بنجاح";
  }

  if (data.nextStage?.name) {
    return `تم التنفيذ بنجاح. المرحلة التالية: ${data.nextStage.name}`;
  }

  return "تم التنفيذ بنجاح";
}

export default function ProductionScanPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionId = "production-qr-reader";

  const lastDetectedCodeRef = useRef("");
  const lastDetectedAtRef = useRef(0);
  const isMountedRef = useRef(true);

  const [qrValue, setQrValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [previewData, setPreviewData] = useState<ScanApiResponse | null>(null);
  const [imageOpen, setImageOpen] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStarting, setCameraStarting] = useState(false);

  const [result, setResult] = useState<ResultState>({
    kind: "idle",
    message: "",
    orderNumber: "-",
    pieceLabel: "-",
    productName: "-",
    stageName: "-",
    nextStageName: "-",
    qrCode: "-",
  });

  const scanStatusText = useMemo(() => {
    if (confirming) return "جاري تأكيد المرحلة...";
    if (loading) return "جاري جلب بيانات القطعة...";
    if (result.kind === "success") return result.message || "تم التنفيذ بنجاح";
    if (result.kind === "error") return result.message || "تعذر تنفيذ العملية";
    if (result.kind === "preview") {
      return result.message || "تم تحميل بيانات القطعة، راجعها ثم أكد المرحلة";
    }
    if (!manualMode && cameraReady) {
      return "الكاميرا تعمل الآن. وجّه QR داخل الإطار ليتم جلب بيانات القطعة تلقائيًا";
    }
    if (!manualMode && cameraError) {
      return cameraError;
    }
    return "امسح QR أو أدخل الكود يدويًا لمعاينة القطعة";
  }, [loading, confirming, result, manualMode, cameraReady, cameraError]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function stopCamera() {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {}

    try {
      await scannerRef.current?.clear();
    } catch {}

    scannerRef.current = null;
    if (isMountedRef.current) {
      setCameraReady(false);
    }
  }

  async function startCamera() {
    if (manualMode || scannerRef.current) return;

    try {
      setCameraStarting(true);
      setCameraError("");

      const scanner = new Html5Qrcode(scannerRegionId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.7778,
        },
        async (decodedText) => {
          const value = String(decodedText || "").trim();
          if (!value || loading || confirming) return;

          const now = Date.now();
          const isSameCode = lastDetectedCodeRef.current === value;
          const isTooSoon = now - lastDetectedAtRef.current < 2500;

          if (isSameCode && isTooSoon) return;

          lastDetectedCodeRef.current = value;
          lastDetectedAtRef.current = now;

          setQrValue(value);
          await handlePreview(value);
        },
        () => {},
      );

      if (isMountedRef.current) {
        setCameraReady(true);
        setCameraError("");
      }
    } catch {
      if (isMountedRef.current) {
        setCameraReady(false);
        setCameraError(
          "تعذر تشغيل الكاميرا. اسمح بالوصول إلى الكاميرا أو استخدم الإدخال اليدوي",
        );
      }
      await stopCamera();
    } finally {
      if (isMountedRef.current) {
        setCameraStarting(false);
      }
    }
  }

  useEffect(() => {
    if (!manualMode) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode]);

  async function requestScan(
    action: "preview" | "confirm",
    customValue?: string,
  ) {
    const value = (customValue ?? qrValue).trim();
    if (!value || loading || confirming) return null;

    if (action === "preview") {
      setLoading(true);
    } else {
      setConfirming(true);
    }

    try {
      const res = await fetch("/api/production/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          qrCode: value,
        }),
      });

      const data = (await res
        .json()
        .catch(() => null)) as ScanApiResponse | null;

      if (!res.ok || !data?.ok) {
        const errorMessage = mapApiErrorToArabic(data ?? {}, value);

        setResult({
          kind: "error",
          message: errorMessage,
          orderNumber: data?.order?.orderNumber || "-",
          pieceLabel:
            (typeof data?.item?.quantityIndex === "number"
              ? `#${data.item.quantityIndex}`
              : data?.item?.qrCode) || value,
          productName: data?.product?.name || "-",
          stageName: data?.stage?.name || "-",
          nextStageName:
            data?.requiredStage || data?.validation?.requiredStageName || "-",
          qrCode: data?.item?.qrCode || value,
        });

        if (action === "preview") {
          setPreviewData(null);
        }

        const failedItem: RecentScanItem = {
          id: crypto.randomUUID(),
          code: data?.item?.qrCode || value,
          item: data?.product?.name || "فشل تنفيذ المسح",
          status: "فشل",
          time: "الآن",
        };

        setRecentScans((prev) => [failedItem, ...prev].slice(0, 8));
        setLastScanAt(new Date());
        return null;
      }

      return data;
    } catch {
      setResult({
        kind: "error",
        message: "حدث خطأ في الاتصال بالخادم",
        orderNumber: "-",
        pieceLabel: "-",
        productName: "-",
        stageName: "-",
        nextStageName: "-",
        qrCode: value,
      });

      if (action === "preview") {
        setPreviewData(null);
      }

      const connectionFailedItem: RecentScanItem = {
        id: crypto.randomUUID(),
        code: value,
        item: "تعذر الاتصال",
        status: "فشل",
        time: "الآن",
      };

      setRecentScans((prev) => [connectionFailedItem, ...prev].slice(0, 8));
      setLastScanAt(new Date());
      return null;
    } finally {
      if (action === "preview") {
        setLoading(false);
      } else {
        setConfirming(false);
      }
    }
  }

  async function handlePreview(customValue?: string) {
    const value = (customValue ?? qrValue).trim();
    if (!value) return;

    const data = await requestScan("preview", value);
    if (!data) return;

    const pieceLabel =
      typeof data.item?.quantityIndex === "number"
        ? `#${data.item.quantityIndex}`
        : data.item?.qrCode || value;

    setPreviewData(data);
    setResult({
      kind: "preview",
      message: "تم تحميل بيانات القطعة، راجعها ثم أكد المرحلة",
      orderNumber: data.order?.orderNumber || "-",
      pieceLabel,
      productName: data.product?.name || "قطعة بدون اسم",
      stageName: data.stage?.name || "-",
      nextStageName: data.nextStage?.name || "لا توجد مرحلة تالية",
      qrCode: data.item?.qrCode || value,
    });

    const previewItem: RecentScanItem = {
      id: crypto.randomUUID(),
      code: pieceLabel,
      item: data.product?.name || "قطعة بدون اسم",
      status: "معاينة",
      time: "الآن",
    };

    setRecentScans((prev) => [previewItem, ...prev].slice(0, 8));
    setLastScanAt(new Date());
  }

  async function handleConfirm() {
    const value = (previewData?.item?.qrCode || qrValue).trim();
    if (!value || !previewData) return;

    const data = await requestScan("confirm", value);
    if (!data) return;

    const pieceLabel =
      typeof data.item?.quantityIndex === "number"
        ? `#${data.item.quantityIndex}`
        : data.item?.qrCode || value;

    setPreviewData(data);
    setResult({
      kind: "success",
      message: mapConfirmSuccessMessage(data),
      orderNumber: data.order?.orderNumber || "-",
      pieceLabel,
      productName: data.product?.name || "قطعة بدون اسم",
      stageName: data.stage?.name || "-",
      nextStageName: data.nextStage?.name || "لا توجد مرحلة تالية",
      qrCode: data.item?.qrCode || value,
    });

    const successItem: RecentScanItem = {
      id: crypto.randomUUID(),
      code: pieceLabel,
      item: data.product?.name || "قطعة بدون اسم",
      status: "تم التنفيذ",
      time: "الآن",
    };

    setRecentScans((prev) => [successItem, ...prev].slice(0, 8));
    setLastScanAt(new Date());
    setQrValue("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }

  const productImage = previewData?.product?.imageUrl || null;
  const showPayout = previewData?.employee?.showPayout === true;
  const confirmButtonLabel = previewData?.stage?.buttonLabel || "تأكيد المرحلة";

  return (
    <>
      <div className="space-y-4">
        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-black text-slate-900">
                ماسح الباركود
              </div>
              <div className="text-xs text-slate-500">
                افتح الكاميرا تلقائيًا، وعند مسح QR سيتم جلب بيانات القطعة
                مباشرة
              </div>
            </div>

            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Camera className="h-5 w-5" />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#0f172a,#1e293b)] p-4 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between text-sm text-white/70">
              <span>الكاميرا الخلفية</span>
              <span>تنفيذ المرحلة الحالية</span>
            </div>

            <div className="relative h-[220px] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.06),_transparent_55%)]">
              {!manualMode && (
                <div
                  id={scannerRegionId}
                  className="absolute inset-0 h-full w-full overflow-hidden"
                />
              )}

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(15,23,42,0.3))]" />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-40 w-40 rounded-[28px] border-2 border-dashed border-indigo-300/70">
                  <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 bg-[linear-gradient(90deg,transparent,#38bdf8,#8b5cf6,transparent)] shadow-[0_0_20px_rgba(56,189,248,0.8)]" />
                  <div className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-[22px] border-l-4 border-t-4 border-cyan-300" />
                  <div className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-[22px] border-r-4 border-t-4 border-cyan-300" />
                  <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[22px] border-b-4 border-l-4 border-cyan-300" />
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[22px] border-b-4 border-r-4 border-cyan-300" />
                </div>
              </div>

              <div className="absolute inset-x-4 bottom-16">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-white/80 backdrop-blur">
                  {manualMode
                    ? "الوضع الحالي: إدخال يدوي للباركود"
                    : cameraStarting
                      ? "جاري تشغيل الكاميرا..."
                      : cameraReady
                        ? "وجّه QR داخل الإطار وسيتم جلب بيانات القطعة تلقائيًا"
                        : cameraError || "جاري تهيئة الكاميرا"}
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <button
                  type="button"
                  disabled
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 opacity-60 backdrop-blur"
                >
                  <Flashlight className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualMode((prev) => !prev);
                    setCameraError("");
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 50);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur"
                >
                  <Keyboard className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-cyan-300" />
                <div className="text-sm font-bold">إدخال الكود</div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  ref={inputRef}
                  value={qrValue}
                  onChange={(e) => setQrValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handlePreview();
                    }
                  }}
                  placeholder="الصق أو اكتب رمز QR هنا"
                  dir="ltr"
                  className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:border-cyan-300/50 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => handlePreview()}
                  disabled={loading || confirming || !qrValue.trim()}
                  className="flex h-12 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#22c55e,#16a34a)] px-4 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      جاري العرض
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-4 w-4" />
                      عرض البيانات
                    </>
                  )}
                </button>
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  result.kind === "success"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : result.kind === "error"
                      ? "border-red-400/20 bg-red-500/10 text-red-100"
                      : result.kind === "preview"
                        ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/70"
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.kind === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : result.kind === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <ScanLine className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>{scanStatusText}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-cyan-300" />
                <div className="text-sm font-bold">آخر نتيجة</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">رقم الطلب</div>
                  <div className="mt-1 font-bold">{result.orderNumber}</div>
                </div>

                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">رقم القطعة</div>
                  <div className="mt-1 font-bold">{result.pieceLabel}</div>
                </div>

                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">المنتج</div>
                  <div className="mt-1 font-bold">{result.productName}</div>
                </div>

                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">المرحلة الحالية</div>
                  <div className="mt-1 font-bold">{result.stageName}</div>
                </div>

                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">المرحلة التالية</div>
                  <div className="mt-1 font-bold">{result.nextStageName}</div>
                </div>

                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">رمز QR</div>
                  <div className="mt-1 break-all font-bold">
                    {result.qrCode}
                  </div>
                </div>
              </div>

              {lastScanAt && (
                <div className="mt-3 text-xs text-white/50">
                  آخر تحديث: {timeAgoLabel(lastScanAt)}
                </div>
              )}
            </div>
          </div>
        </section>

        {previewData && (
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-base font-black text-slate-900">
                تفاصيل القطعة بعد المسح
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {previewData.stage?.name || "-"}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-black text-slate-900">
                  بيانات القطعة
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => productImage && setImageOpen(true)}
                    className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white"
                  >
                    {productImage ? (
                      <img
                        src={productImage}
                        alt={previewData.product?.name || "صورة المنتج"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="text-xs text-slate-500">اسم المنتج</div>
                      <div className="font-bold text-slate-900">
                        {previewData.product?.name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">
                        رقم الموديل SKU
                      </div>
                      <div className="font-bold text-slate-900" dir="ltr">
                        {previewData.product?.sku || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">رقم الطلب</div>
                      <div className="font-bold text-slate-900">
                        {previewData.order?.orderNumber || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">رقم القطعة</div>
                      <div className="font-bold text-slate-900" dir="ltr">
                        {typeof previewData.item?.quantityIndex === "number"
                          ? `#${previewData.item.quantityIndex}`
                          : previewData.item?.qrCode || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-black text-slate-900">
                  بيانات العميل
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <UserRound className="h-4 w-4" />
                      <span>اسم العميل</span>
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.order?.customerName || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="h-4 w-4" />
                      <span>مدينة العميل</span>
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.order?.city || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3 sm:col-span-2">
                    <div className="mb-1 text-xs text-slate-500">
                      ملاحظات العميل
                    </div>
                    <div className="font-bold leading-6 text-slate-900">
                      {previewData.product?.customerNote || "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-black text-slate-900">
                  تفاصيل المنتج
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <Ruler className="h-4 w-4" />
                      <span>المقاس</span>
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.product?.size || "-"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-3 sm:col-span-2">
                    <div className="mb-1 text-xs text-slate-500">
                      خيارات المنتج
                    </div>
                    <div className="font-bold leading-6 text-slate-900">
                      {previewData.product?.optionsText || "-"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <Shirt className="h-4 w-4" />
                      <span>اسم القماش</span>
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.material?.name || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      استهلاك القطعة
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.material?.qtyPerPiece != null
                        ? `${formatNumber(previewData.material.qtyPerPiece)} ${
                            previewData.material?.unit || ""
                          }`
                        : "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      المخزون الحالي من القماش
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.material?.onHand != null
                        ? `${formatNumber(previewData.material.onHand)} ${
                            previewData.material?.unit || ""
                          }`
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-black text-slate-900">
                  المرحلة والتنفيذ
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      المرحلة الحالية
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.stage?.name || "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">التخطي</div>
                    <div className="font-bold text-slate-900">
                      {previewData.stage?.allowSkip ? "مسموح" : "غير مسموح"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      نوع العامل
                    </div>
                    <div className="font-bold text-slate-900">
                      {showPayout ? "بالقطعة" : "راتب شهري"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      سعر المرحلة الحالية
                    </div>
                    <div className="font-bold text-slate-900">
                      {showPayout && previewData.stage?.payoutAmount != null
                        ? `${formatNumber(previewData.stage.payoutAmount)} ريال`
                        : "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      إجمالي القطع
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.progress?.totalPieces ?? "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3">
                    <div className="mb-1 text-xs text-slate-500">
                      تم إنجازه في هذه المرحلة
                    </div>
                    <div className="font-bold text-slate-900">
                      {previewData.progress?.completedForCurrentStage ?? "-"}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3 sm:col-span-2">
                    <div className="mb-1 text-xs text-slate-500">المتبقي</div>
                    <div className="font-bold text-slate-900">
                      {previewData.progress?.remainingPieces ?? "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={
                  confirming ||
                  loading ||
                  !previewData?.canConfirm ||
                  !!previewData?.alreadyScanned
                }
                className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#22c55e,#16a34a)] px-6 text-lg font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 sm:h-[72px] sm:flex-1 sm:text-xl"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    جاري التأكيد
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-6 w-6" />
                    {confirmButtonLabel}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewData(null);
                  setResult({
                    kind: "idle",
                    message: "",
                    orderNumber: "-",
                    pieceLabel: "-",
                    productName: "-",
                    stageName: "-",
                    nextStageName: "-",
                    qrCode: "-",
                  });
                  setQrValue("");
                  lastDetectedCodeRef.current = "";
                  lastDetectedAtRef.current = 0;
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="h-16 w-full rounded-2xl border border-slate-200 px-6 text-base font-black text-slate-700 sm:h-[72px] sm:min-w-[220px] sm:text-lg"
              >
                مسح قطعة جديدة
              </button>
            </div>
          </section>
        )}

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 text-base font-black text-slate-900">
            آخر المسحات
          </div>

          {recentScans.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              لا توجد عمليات مسح حتى الآن
            </div>
          ) : (
            <div className="space-y-3">
              {recentScans.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <div className="font-bold text-slate-900">{item.code}</div>
                    <div className="text-sm text-slate-600">{item.item}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.time}
                    </div>
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      item.status === "تم التنفيذ"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "معاينة"
                          ? "bg-cyan-100 text-cyan-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {imageOpen && productImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-xl rounded-[28px] bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setImageOpen(false)}
              className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
              <Expand className="h-4 w-4" />
              <span>صورة المنتج</span>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
              <img
                src={productImage}
                alt={previewData?.product?.name || "صورة المنتج"}
                className="h-auto max-h-[75vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
