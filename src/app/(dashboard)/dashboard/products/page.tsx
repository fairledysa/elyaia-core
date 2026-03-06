// FILE: src/app/(dashboard)/dashboard/products/page.tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";
import ProductsClient from "@/components/products/products-client";

export default async function ProductsPage() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ sb, userId: user.id });

  return <ProductsClient />;
}
