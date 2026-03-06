"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";

import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function UserAuthForm({ className, ...props }: Props) {
  const sb = supabaseBrowser();

  const sp = useSearchParams();
  const next = sp.get("from") || "/dashboard";

  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const v = email.trim().toLowerCase();
    if (!v) {
      setMsg("اكتب الإيميل.");
      return;
    }

    setIsLoading(true);

    // 1) تحقق أنه مربوط
    const r = await fetch("/api/auth/check-linked", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: v }),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setIsLoading(false);
      setMsg(j?.error || "هذا الإيميل غير مربوط بمتجر. ثبّت التطبيق أولاً.");
      return;
    }

    // 2) أرسل Magic Link
    const { error } = await sb.auth.signInWithOtp({
      email: v,
      options: {
        emailRedirectTo: `${window.location.origin}/callback?from=${encodeURIComponent(
          next,
        )}`,
      },
    });

    setIsLoading(false);
    setMsg(error ? error.message : "تم إرسال رابط الدخول على الإيميل ✅");
  }

  async function devLogin() {
    setMsg(null);
    const v = email.trim().toLowerCase();
    if (!v) {
      setMsg("اكتب الإيميل أولاً.");
      return;
    }

    setIsLoading(true);
    const r = await fetch("/api/dev/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: v, next }),
    });

    const j = await r.json().catch(() => ({}));
    setIsLoading(false);

    if (!r.ok || !j?.ok) {
      setMsg(j?.error || "Dev Login فشل");
      return;
    }

    // ✅ يدخل مباشرة بدون إيميل
    window.location.href = j.action_link;
  }

  return (
    <div className={cn("grid gap-6", className)} {...props} dir="rtl">
      <form onSubmit={onSubmit}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              الإيميل
            </Label>

            <Input
              id="email"
              placeholder="name@domain.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {msg ? (
              <p className="px-1 text-xs text-muted-foreground">{msg}</p>
            ) : null}
          </div>

          <button
            className={cn(buttonVariants())}
            disabled={isLoading || !email.trim()}
          >
            {isLoading && (
              <Icons.spinner className="ms-2 h-4 w-4 animate-spin" />
            )}
            إرسال رابط الدخول
          </button>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            أو دخول سريع
          </span>
        </div>
      </div>

      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline" }))}
        onClick={devLogin}
        disabled={isLoading || !email.trim()}
      >
        {isLoading ? (
          <Icons.spinner className="ms-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.gitHub className="ms-2 h-4 w-4" />
        )}
        Dev Login (بدون إيميل)
      </button>
    </div>
  );
}
