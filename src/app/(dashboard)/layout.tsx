// FILE: src/app/(dashboard)/layout.tsx
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sb, user } = await requireUser();

  await requireTenant({
    sb,
    userId: user.id,
  });

  return <div>{children}</div>;
}
