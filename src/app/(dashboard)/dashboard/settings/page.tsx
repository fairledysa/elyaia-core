// FILE: src/app/(dashboard)/dashboard/settings/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  const { tenantId, role } = await requireTenant({ userId: user.id, sb });

  if (role !== "owner") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          غير مصرح لك بالدخول لهذه الصفحة.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إعدادات المتجر والمشغل</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">المراحل</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              إضافة/تعديل/أرشفة المراحل وترتيبها.
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/stages">إدارة</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">المخزون</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              مواد خام + حدود تنبيه + السماح بالسالب.
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory">فتح</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tenant</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          tenant_id: {tenantId}
        </CardContent>
      </Card>
    </div>
  );
}
