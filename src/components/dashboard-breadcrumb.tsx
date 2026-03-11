// FILE: src/components/dashboard-breadcrumb.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABELS: Record<string, string> = {
  dashboard: "لوحة التحكم",
  employees: "الموظفين",
  inventory: "المخزون",
  finance: "المالية",
  moves: "الحركات",
  payouts: "المدفوعات",
  reports: "التقارير",
  performance: "الأداء",
  products: "المنتجات",
  matrix: "Dashboard",
  settings: "الإعدادات",
  stages: "المراحل",
  notifications: "التنبيهات",
  orders: "الطلبات",
  print: "طباعة الطلب",
  "print-batches": "دفعات الطباعة",
  new: "إضافة جديد",
  receive: "استلام",
  "production-settings": "إعدادات الإنتاج",
};

function getLabel(segment: string) {
  if (!segment) return "";

  if (/^[0-9a-fA-F-]{8,}$/.test(segment)) {
    return "التفاصيل";
  }

  return LABELS[segment] || decodeURIComponent(segment);
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();

  const parts = pathname.split("/").filter(Boolean);
  const dashboardIndex = parts.indexOf("dashboard");

  const segments =
    dashboardIndex >= 0 ? parts.slice(dashboardIndex) : ["dashboard"];

  const items = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    return {
      href,
      label: getLabel(segment),
      isLast: index === segments.length - 1,
    };
  });

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="min-w-0">
        {items.map((item, index) => (
          <div key={item.href} className="flex min-w-0 items-center">
            <BreadcrumbItem
              className={index === 0 ? "hidden md:block" : "min-w-0"}
            >
              {item.isLast ? (
                <BreadcrumbPage className="truncate">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="text-muted-foreground">
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>

            {!item.isLast ? (
              <BreadcrumbSeparator
                className={index === 0 ? "hidden md:block" : ""}
              />
            ) : null}
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
