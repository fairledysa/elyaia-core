// FILE: src/app/(dashboard)/dashboard/inventory/receive/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";
import ReceiveFabricClient from "@/components/inventory/receive-client";

export default async function Page() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ userId: user.id, sb });

  return <ReceiveFabricClient />;
}
