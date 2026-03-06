// FILE: src/components/user-account-nav.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserAccountNav({
  user,
}: {
  user: { email: string | null; name?: string | null; image?: string | null };
}) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => ({}));
    router.push("/login");
    router.refresh();
  }

  return (
    <div dir="rtl">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="max-w-[240px] truncate">
            {user.email ?? "حساب"}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 text-right">
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            الإعدادات
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>تسجيل خروج</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
