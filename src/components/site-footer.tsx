//✅ FILE: src/components/site-footer.tsx
import { cn } from "@/lib/utils";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("py-6 text-sm text-muted-foreground", className)}>
      <div className="container flex items-center justify-between">
        <div>© {new Date().getFullYear()} Elyaia</div>
        <div>لوحة الإدارة</div>
      </div>
    </footer>
  );
}
