// FILE: src/app/(dashboard)/layout.tsx
import { notFound } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { requireUser } from "@/lib/auth/requireUser";
import { requireTenant } from "@/lib/tenant/requireTenant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sb, user } = await requireUser();
  if (!user) return notFound();

  await requireTenant({ sb, userId: user.id });

  return (
    <div dir="rtl" className="min-h-screen w-full overflow-x-hidden">
      <SidebarProvider>
        <AppSidebar user={{ email: user.email }} />

        {/* ✅ أهم سطرين: امنع القص + خلي المحتوى يتمدد */}
        <SidebarInset className="min-w-0 flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background">
            <div className="flex w-full min-w-0 items-center gap-2 px-4">
              <SidebarTrigger className="ms-0 me-1 shrink-0" />
              <Separator orientation="vertical" className="mx-2 h-4 shrink-0" />

              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="min-w-0">
                  <BreadcrumbItem className="hidden md:block">
                    <span className="text-muted-foreground">لوحة التحكم</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">
                      Dashboard
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="ms-auto min-w-0 truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex flex-1 flex-col gap-4 p-4">
            {children}
          </main>

          <footer className="border-t p-4 text-xs text-muted-foreground">
            © Elyaia {new Date().getFullYear()}
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
