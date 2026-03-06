// FILE: src/config/dashboard.ts

import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ShoppingCart, Package, Settings } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
};

export const dashboardConfig: {
  mainNav: NavItem[];
  sidebarNav: NavItem[];
} = {
  mainNav: [
    { title: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
  ],
  sidebarNav: [
    { title: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
    { title: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart },
    { title: "المنتجات", href: "/dashboard/products", icon: Package },
    { title: "الإعدادات", href: "/dashboard/settings", icon: Settings },
  ],
};
