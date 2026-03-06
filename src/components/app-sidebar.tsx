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
import { Home, Package, ShoppingCart, Settings, Table } from "lucide-react";
import { NavUser } from "@/components/nav-user";

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
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard" className="gap-2">
                    <Home className="h-4 w-4" />
                    الرئيسية
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/orders" className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    الطلبات
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/products" className="gap-2">
                    <Package className="h-4 w-4" />
                    المنتجات
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard/products/matrix" className="gap-2">
                    <Table className="h-4 w-4" />
                    Product Matrix
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

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
