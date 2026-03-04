// FILE: src/app/(auth)/verify/page.tsx
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
      <h1>verify</h1>
    </main>
  );
}
