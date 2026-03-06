// FILE: src/app/(dashboard)/dashboard/products/matrix/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";
import ProductMatrixClient from "@/components/products/product-matrix-client";

export default async function ProductMatrixPage() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ sb, userId: user.id });

  return <ProductMatrixClient />;
}
