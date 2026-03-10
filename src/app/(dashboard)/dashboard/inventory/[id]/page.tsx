// FILE: src/app/(dashboard)/dashboard/inventory/[id]/page.tsx
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

import InventoryDetailsClient from "@/components/inventory/inventory-details-client";

export default async function InventoryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ userId: user.id, sb });

  return <InventoryDetailsClient materialId={id} />;
}
