// FILE: src/app/(dashboard)/settings/page.tsx
import StagesClient from "@/components/stages/stages-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">
          المراحل + إعدادات التشغيل
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">المراحل</CardTitle>
        </CardHeader>
        <CardContent>
          <StagesClient />
        </CardContent>
      </Card>
    </div>
  );
}
