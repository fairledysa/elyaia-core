// FILE: src/components/orders/sync-orders-button.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SyncOrdersButton(props: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      disabled={props.disabled || loading}
      onClick={async () => {
        try {
          setLoading(true);
          const r = await fetch("/api/salla/sync/orders", { method: "POST" });
          const j = await r.json().catch(() => null);
          if (!r.ok) throw new Error(j?.error || `Sync failed (${r.status})`);
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          جاري المزامنة...
        </span>
      ) : (
        "مزامنة الطلبات"
      )}
    </Button>
  );
}
