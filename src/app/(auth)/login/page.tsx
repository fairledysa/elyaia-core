"use client";

import { Suspense } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { UserAuthForm } from "@/components/user-auth-form";

export default function LoginPage() {
  return (
    <div
      className="  flex h-screen w-screen flex-col items-center justify-center"
      dir="rtl"
    >
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "absolute right-4 top-4 md:right-8 md:top-8",
        )}
      >
        <span className="flex items-center gap-2">
          <Icons.chevronLeft className="h-4 w-4" />
          رجوع
        </span>
      </Link>

      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
        <div className="flex flex-col space-y-2 text-center">
          <Icons.logo className="mx-auto h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">
            تسجيل الدخول
          </h1>
          <p className="text-sm text-muted-foreground">
            أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق
          </p>
        </div>

        <Suspense
          fallback={
            <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
              جاري تحميل نموذج الدخول...
            </div>
          }
        >
          <UserAuthForm />
        </Suspense>

        <p className="px-8 text-center text-sm text-muted-foreground">
          بتسجيل الدخول أنت توافق على الشروط وسياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
