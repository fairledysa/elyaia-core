// FILE: src/app/(dashboard)/layout.tsx
import { notFound, redirect } from "next/navigation";
import Image from "next/image";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import OnboardingPath from "@/components/onboarding/onboarding-path";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  const tenant = await requireTenant({ sb, userId: user.id });
  if (!tenant?.tenantId) return notFound();

  const allowedRoles = ["owner", "admin", "manager"];

  if (!allowedRoles.includes(String(tenant.role || ""))) {
    redirect("/production");
  }

  return (
    <div dir="rtl" className="min-h-screen w-full overflow-x-hidden">
      <SidebarProvider>
        <AppSidebar user={{ email: user.email }} />

        <SidebarInset className="min-w-0 flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background">
            <div className="flex w-full min-w-0 items-center gap-3 px-4">
              <SidebarTrigger className="ms-0 me-1 shrink-0" />

              <Separator orientation="vertical" className="mx-2 h-4 shrink-0" />

              <div className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="Elyaia Production"
                  width={28}
                  height={28}
                  className="rounded"
                />

                <div className="flex flex-col leading-none">
                  <span className="text-sm font-semibold">
                    Elyaia Production
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    إدارة الإنتاج
                  </span>
                </div>
              </div>

              <Separator orientation="vertical" className="mx-2 h-4 shrink-0" />

              <DashboardBreadcrumb />

              <div className="ms-auto min-w-0 truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex flex-1 flex-col gap-6 p-4">
            {/* شريط مسار الانطلاقة */}
            <OnboardingPath />

            {children}
          </main>

          <footer className="border-t p-4 text-xs text-muted-foreground">
            © Elyaia Production {new Date().getFullYear()}
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}