// FILE: src/components/onboarding/onboarding-path.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Status = {
  stages: boolean;
  employees: boolean;
  materials: boolean;
  products: boolean;
  productSettings: boolean;
  orders: boolean;
  printBatches: boolean;
};

type Step = {
  key: keyof Status;
  title: string;
  desc: string;
  href: string;
  group: "required" | "perfect" | "run";
};

const steps: Step[] = [
  {
    key: "stages",
    title: "إضافة مراحل الإنتاج",
    desc: "أضف مراحل العمل الأساسية مثل القص والخياطة والتشطيب حتى يبدأ النظام بالعمل بشكل صحيح.",
    href: "/dashboard/settings/stages",
    group: "required",
  },
  {
    key: "employees",
    title: "إضافة الموظفين",
    desc: "أضف الموظفين واربط كل موظف بالمرحلة المناسبة له داخل خط الإنتاج.",
    href: "/dashboard/employees",
    group: "required",
  },
  {
    key: "materials",
    title: "إعداد المخزون",
    desc: "أضف الأقمشة والخامات الأساسية حتى تصبح الدورة الإنتاجية جاهزة للتشغيل.",
    href: "/dashboard/inventory",
    group: "required",
  },
  {
    key: "products",
    title: "مزامنة المنتجات",
    desc: "قم بمزامنة منتجات سلة حتى تظهر داخل النظام ويمكن ربطها بالإنتاج.",
    href: "/dashboard/products/matrix",
    group: "perfect",
  },
  {
    key: "productSettings",
    title: "إعدادات المنتجات",
    desc: "حدد لكل منتج استهلاك الخامة وأسعار المراحل حتى يصبح النظام متكاملاً.",
    href: "/dashboard/products/matrix",
    group: "perfect",
  },
  {
    key: "orders",
    title: "مزامنة أول الطلبات",
    desc: "قم بجلب أول الطلبات من سلة إلى النظام لبدء التجربة الفعلية.",
    href: "/dashboard/orders",
    group: "run",
  },
  {
    key: "printBatches",
    title: "طباعة أول الطلبات",
    desc: "أنشئ دفعة طباعة لأول الطلبات وابدأ التشغيل الفعلي داخل المشغل.",
    href: "/dashboard/orders/print-batches",
    group: "run",
  },
];

export default function OnboardingPath() {
  const [status, setStatus] = useState<Status | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch("/api/setup-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setStatus(d.status);
      })
      .catch(() => {});
  }, []);

  const firstIncompleteIndex = useMemo(() => {
    if (!status) return 0;
    const i = steps.findIndex((s) => !status[s.key]);
    return i === -1 ? 0 : i;
  }, [status]);

  useEffect(() => {
    if (!status) return;

    setActive((prev) => {
      if (prev >= 0 && prev < steps.length && !status[steps[prev].key]) {
        return prev;
      }
      return firstIncompleteIndex;
    });
  }, [status, firstIncompleteIndex]);

  if (!status) return null;
  if (status.printBatches) return null;

  const requiredDone = status.stages && status.employees && status.materials;
  const perfectDone = status.products && status.productSettings;

  const answerText = !requiredDone
    ? "لا"
    : !perfectDone
      ? "متبقي خطوتين فقط"
      : "نعم";

  const answerClass = !requiredDone
    ? "text-red-600"
    : !perfectDone
      ? "text-amber-600"
      : "text-emerald-600";

  const currentStep = steps[active];

  const getStepClasses = (step: Step, isActive: boolean, done: boolean) => {
    if (done) {
      return isActive
        ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        : "border-emerald-500 bg-emerald-500 text-white";
    }

    if (step.group === "required") {
      return isActive
        ? "border-red-500 bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
        : "border-red-300 bg-red-50 text-red-600";
    }

    if (step.group === "perfect") {
      return isActive
        ? "border-amber-500 bg-amber-500 text-white shadow-[0_0_0_4px_rgba(245,158,11,0.15)]"
        : "border-amber-300 bg-amber-50 text-amber-600";
    }

    return isActive
      ? "border-sky-600 bg-sky-600 text-white shadow-[0_0_0_4px_rgba(2,132,199,0.15)]"
      : "border-sky-300 bg-sky-50 text-sky-600";
  };

  const lineClass = (index: number) => {
    const done = status[steps[index].key];
    return done ? "bg-emerald-400" : "bg-slate-300";
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[#e9f7f4]">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="text-xl font-black text-slate-900">مسار إعداد النظام</div>
        <div className="text-sm text-slate-500">
          اتبع الخطوات بالترتيب حتى يبدأ النظام بالعمل
        </div>
      </div>

      <div className="px-6 pb-4">
        <div className="rounded-2xl bg-white/60 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
            <span>هل النظام جاهز للتشغيل؟</span>
            <span className={answerClass}>{answerText}</span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="rounded-2xl bg-[#d9f1ec] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-600">تنقّل بين الخطوات</div>
            <div className="text-sm text-slate-500">اضغط على أي دائرة لعرض الشرح</div>
          </div>

          <div className="mb-8 overflow-x-auto">
            <div className="flex min-w-[860px] items-center px-1">
              {steps.map((step, index) => {
                const done = status[step.key];
                const isActive = index === active;

                return (
                  <div key={step.key} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setActive(index)}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black transition ${getStepClasses(step, isActive, done)}`}
                      title={step.title}
                    >
                      {done ? "✓" : index + 1}
                    </button>

                    {index !== steps.length - 1 && (
                      <div className={`h-[3px] w-28 shrink-0 ${lineClass(index)}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-[#0d5360] p-5 text-white shadow-sm">
            <div className="mb-2 text-xs font-bold text-cyan-100">الخطوة الحالية</div>

            <div className="mb-2 text-3xl font-black">{currentStep.title}</div>

            <p className="mb-5 max-w-3xl text-sm leading-7 text-cyan-50/90">
              {currentStep.desc}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={currentStep.href}
                className="inline-flex items-center rounded-xl bg-[#9ce7d9] px-5 py-2.5 text-sm font-bold text-slate-900 transition hover:opacity-90"
              >
                فتح الصفحة
              </Link>

              <button
                type="button"
                onClick={() => setActive((prev) => (prev + 1) % steps.length)}
                className="inline-flex items-center rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold text-white/90 transition hover:bg-white/10"
              >
                الخطوة التالية
              </button>

              <div className="text-sm font-semibold text-cyan-100/90">
                {status[currentStep.key] ? "مكتملة" : "غير مكتملة"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}