// FILE: src/components/nav-user.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type Props = {
  email?: string | null;
  name?: string | null;
};

export function NavUser({ email, name }: Props) {
  const router = useRouter();

  async function signOut() {
    // عدّل هذا حسب مسار تسجيل الخروج عندك
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const label = name || email || "الحساب";
  const fallback = (label?.[0] || "U").toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* هذا هو “الصندوق اللي تحت” */}
            <SidebarMenuButton className="h-12 justify-between gap-3">
              <span className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
                <span className="flex flex-col text-right leading-tight">
                  <span className="text-sm font-semibold">
                    {name || "مستخدم"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {email || ""}
                  </span>
                </span>
              </span>

              <span className="text-muted-foreground">▾</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56" sideOffset={8}>
            <DropdownMenuItem onClick={() => router.push("/dashboard/guide")}>
              دليل استخدام
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>تسجيل الخروج</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
