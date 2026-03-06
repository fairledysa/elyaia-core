//// FILE: src/components/nav.tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/dashboard";

export function DashboardNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="grid gap-1" dir="rtl">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
