// FILE: src/components/app-sidebar.tsx
import * as React from "react";
import Link from "next/link";
import {
  Home,
  Package,
  ShoppingCart,
  Settings,
  Table,
  Users,
  Printer,
  Wallet,
  BarChart3,
  Layers,
  Boxes,
  Bell,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { NavUser } from "@/components/nav-user";

type Props = {
  user?: { email?: string | null; name?: string | null };
};

const mainItems = [
  { title: "الرئيسية", href: "/dashboard", icon: Home },
  { title: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart },
  {
    title: "دفعات الطباعة",
    href: "/dashboard/orders/print-batches",
    icon: Printer,
  },
  { title: "المنتجات", href: "/dashboard/products", icon: Package },
  {
    title: "اعدادات المنتجات",
    href: "/dashboard/products/matrix",
    icon: Table,
  },
];

const managementItems = [
  { title: "المراحل", href: "/dashboard/settings/stages", icon: Layers },
  { title: "المخزون", href: "/dashboard/inventory", icon: Boxes },
  { title: "الموظفين", href: "/dashboard/employees", icon: Users },
  { title: "المالية", href: "/dashboard/finance", icon: Wallet },
  { title: "التنبيهات", href: "/dashboard/notifications", icon: Bell },
  { title: "الأداء", href: "/dashboard/performance", icon: BarChart3 },
];

function SidebarSection({
  label,
  items,
}: {
  label: string;
  items: {
    title: string;
    href: string;
    icon: React.ElementType;
  }[];
}) {
  return (
    <SidebarGroup className="px-2 py-2">
      <SidebarGroupLabel
        dir="rtl"
        className="mb-2 px-3 text-right text-xs font-semibold text-muted-foreground"
      >
        {label}
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className="
                    h-12 rounded-2xl px-3
                    hover:bg-muted/60
                    data-[active=true]:bg-primary
                    data-[active=true]:text-primary-foreground
                  "
                >
                  <Link
                    href={item.href}
                    dir="rtl"
                    className="flex w-full items-center justify-start gap-3 text-right"
                  >
                    <div
                      className="
                        flex h-9 w-9 shrink-0 items-center justify-center
                        rounded-xl border border-border bg-background
                      "
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <span className="min-w-0 flex-1 text-right text-sm font-medium">
                      {item.title}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ user }: Props) {
  return (
    <Sidebar
      side="right"
      dir="rtl"
      className="border-l bg-background text-right"
    >
      <SidebarHeader className="px-4 pb-3 pt-4">
        <div className="rounded-2xl border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-4.5 w-4.5" />
            </div>

            <div className="text-right">
              <div className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                PRODUCTION SYSTEM
              </div>
              <div className="text-lg font-bold">Elyaia Production</div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>لوحة تشغيل وإدارة متكاملة</span>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pb-2">
        <SidebarSection label="العمليات الأساسية" items={mainItems} />
        <SidebarSection label="الإدارة والتحكم" items={managementItems} />
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="rounded-2xl border bg-muted/30 p-2">
          <NavUser email={user?.email} name={user?.name} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
