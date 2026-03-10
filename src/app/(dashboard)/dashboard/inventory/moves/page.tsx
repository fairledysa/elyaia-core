// FILE: src/app/(dashboard)/dashboard/inventory/moves/page.tsx
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

import InventoryMovesClient from "@/components/inventory/inventory-moves-client";

export default async function InventoryMovesPage() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ userId: user.id, sb });

  return <InventoryMovesClient />;
}
