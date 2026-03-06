// FILE: src/app/(dashboard)/dashboard/inventory/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

import InventoryClient from "@/components/inventory/inventory-client";

export default async function Page() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ userId: user.id, sb });

  return <InventoryClient />;
}
