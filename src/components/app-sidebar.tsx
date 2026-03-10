// FILE: src/components/app-sidebar.tsx
import * as React from "react";

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
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import { Bell } from "lucide-react";
type Props = {
  user?: { email?: string | null; name?: string | null };
};

export function AppSidebar({ user }: Props) {
  return (
    <Sidebar side="right">
      <SidebarHeader className="px-4 py-3">
        <div className="text-lg font-bold">Elyaia</div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>القائمة</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {/* الرئيسية */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard" className="gap-2">
                    <Home className="h-4 w-4" />
                    الرئيسية
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* الطلبات */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/orders" className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    الطلبات
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* دفعات الطباعة */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/dashboard/orders/print-batches"
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    دفعات الطباعة
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* المنتجات */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/products" className="gap-2">
                    <Package className="h-4 w-4" />
                    المنتجات
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Product Matrix */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/products/matrix" className="gap-2">
                    <Table className="h-4 w-4" />
                    Product Matrix
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* الموظفين */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/employees" className="gap-2">
                    <Users className="h-4 w-4" />
                    الموظفين
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* المالية */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/finance" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    المالية
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/notifications" className="gap-2">
                    <Bell className="h-4 w-4" />
                    التنبيهات
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* الأداء */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/performance" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    الأداء
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* الإعدادات */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    الإعدادات
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <NavUser email={user?.email} name={user?.name} />
      </SidebarFooter>
    </Sidebar>
  );
}
