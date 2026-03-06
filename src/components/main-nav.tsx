import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/config/dashboard";

export function MainNav({
  items,
  className,
}: {
  items?: NavItem[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)} dir="rtl">
      <Link href="/dashboard" className="font-semibold text-lg">
        Elyaia
      </Link>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        {items?.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="hover:text-foreground transition-colors"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
