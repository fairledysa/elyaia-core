// FILE: src/components/orders/orders-status-strip.tsx
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OrdersStatusStrip(props: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = React.useState(false);

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto pb-1",
          loading && "opacity-70",
        )}
      >
        {React.Children.map(props.children, (child) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child as any, {
            onLoadingChange: (v: boolean) => setLoading(v),
          });
        })}
      </div>

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
