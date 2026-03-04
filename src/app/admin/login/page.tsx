// FILE: src/app/admin/login/page.tsx
import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

export default async function ProductionPage() {
  const { sb, user } = await requireUser();

  const { tenantId, role } = await requireTenant({
    sb,
    userId: user.id,
  });

  return (
    <main style={{ padding: 24 }}>
      <h1>login</h1>
    </main>
  );
}
