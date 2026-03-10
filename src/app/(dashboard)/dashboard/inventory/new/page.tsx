// FILE: src/app/(dashboard)/dashboard/inventory/new/page.tsx
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

import InventoryNewClient from "@/components/inventory/inventory-new-client";

export default async function InventoryNewPage() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ userId: user.id, sb });

  return <InventoryNewClient />;
}
