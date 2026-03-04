// FILE: src/app/(dashboard)/dashboard/page.tsx
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

export default async function DashboardPage() {
  const { sb, user } = await requireUser();

  const { tenantId, role } = await requireTenant({
    sb,
    userId: user.id,
  });

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <p>User: {user.email}</p>
      <p>Tenant: {tenantId}</p>
      <p>Role: {role}</p>
    </main>
  );
}
