// FILE: src/components/orders/order-status-pill.tsx
"use client";

import { Button } from "@/components/ui/button";
import LoadingLink from "@/components/ui/loading-link";

type Props = {
  href: string;
  active?: boolean;
  label: string;
  count: number;
};

export default function OrderStatusPill({ href, active, label, count }: Props) {
  return (
    <LoadingLink href={href}>
      <Button
        variant={active ? "default" : "outline"}
        className="h-11 rounded-xl px-4"
      >
        <span className="font-medium">{label}</span>
        <span className="ms-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-background/40 px-2 text-xs">
          {count}
        </span>
      </Button>
    </LoadingLink>
  );
}
