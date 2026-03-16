//src/components/setup-progress-bar.tsx
"use client";

import { useEffect, useState } from "react";
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

export default function SetupProgressBar() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/setup-status")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStatus(d.status);
      });
  }, []);

  if (!status) return null;

  if (status.printBatches) return null;

  const steps = [
    {
      label: "المراحل",
      done: status.stages,
      href: "/dashboard/settings/stages",
    },
    {
      label: "الموظفين",
      done: status.employees,
      href: "/dashboard/employees",
    },
    {
      label: "المخزون",
      done: status.materials,
      href: "/dashboard/inventory",
    },
    {
      label: "مزامنة المنتجات",
      done: status.products,
      href: "/dashboard/products/matrix",
    },
    {
      label: "إعدادات المنتجات",
      done: status.productSettings,
      href: "/dashboard/products/matrix",
    },
    {
      label: "مزامنة الطلبات",
      done: status.orders,
      href: "/dashboard/orders",
    },
    {
      label: "طباعة الطلبات",
      done: status.printBatches,
      href: "/dashboard/orders/print-batches",
    },
  ];

  return (
    <div className="rounded-lg border bg-yellow-50 p-4">
      <div className="mb-3 text-sm font-semibold">
        هل النظام جاهز للعمل؟{" "}
        <span className="text-red-600">لا</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className={`rounded-md border px-3 py-1 text-xs ${
              step.done
                ? "bg-green-100 border-green-300 text-green-800"
                : "bg-red-100 border-red-300 text-red-800"
            }`}
          >
            {step.done ? "✔ " : "• "}
            {step.label}
          </Link>
        ))}
      </div>
    </div>
  );
}