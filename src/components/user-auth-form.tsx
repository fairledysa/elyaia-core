// FILE: components/user-auth-form.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabaseBrowser } from "@/lib/supabase/client";

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

export function UserAuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array.from({ length: OTP_LENGTH }, () => ""),
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const otp = useMemo(() => otpDigits.join(""), [otpDigits]);
  const canResend = timeLeft <= 0 && !sending && !verifying;

  useEffect(() => {
    if (!dialogOpen) return;

    const focusTimer = window.setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 60);

    return () => window.clearTimeout(focusTimer);
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (timeLeft <= 0) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [dialogOpen, timeLeft]);

  function resetOtp() {
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
  }

  function startOtpCountdown() {
    setTimeLeft(OTP_EXPIRY_SECONDS);
  }

  function handleOtpChange(index: number, rawValue: string) {
    const clean = onlyDigits(rawValue);

    if (!clean) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    if (clean.length > 1) {
      const sliced = clean.slice(0, OTP_LENGTH);
      const nextDigits = Array.from(
        { length: OTP_LENGTH },
        (_, i) => sliced[i] ?? "",
      );
      setOtpDigits(nextDigits);

      const nextFocusIndex = Math.min(sliced.length, OTP_LENGTH - 1);
      inputRefs.current[nextFocusIndex]?.focus();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
        return;
      }

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === "ArrowRight") {
      if (index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();

    const pasted = onlyDigits(e.clipboardData.getData("text")).slice(
      0,
      OTP_LENGTH,
    );
    if (!pasted) return;

    const nextDigits = Array.from(
      { length: OTP_LENGTH },
      (_, i) => pasted[i] ?? "",
    );
    setOtpDigits(nextDigits);

    const nextFocusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      setError("أدخل البريد الإلكتروني");
      setSuccess("");
      return;
    }

    try {
      setSending(true);
      setError("");
      setSuccess("");

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      resetOtp();
      startOtpCountdown();
      setDialogOpen(true);
      setSuccess("تم إرسال رمز التحقق إلى بريدك الإلكتروني");
    } catch (err: any) {
      setError(err?.message || "تعذر إرسال رمز التحقق");
      setSuccess("");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();

    const cleanEmail = normalizeEmail(email);
    const cleanOtp = onlyDigits(otp);

    if (!cleanEmail) {
      setError("البريد الإلكتروني غير صحيح");
      return;
    }

    if (cleanOtp.length < OTP_LENGTH) {
      setError("أدخل رمز التحقق الصحيح");
      return;
    }

    try {
      setVerifying(true);
      setError("");
      setSuccess("");

      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: "email",
      });

      if (error) throw error;

      setDialogOpen(false);
      resetOtp();
      router.refresh();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "رمز التحقق غير صحيح");
    } finally {
      setVerifying(false);
    }
  }

  async function resendOtp() {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      setError("أدخل البريد الإلكتروني أولًا");
      return;
    }

    if (!canResend) return;

    try {
      setSending(true);
      setError("");
      setSuccess("");

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      resetOtp();
      startOtpCountdown();
      setSuccess("تمت إعادة إرسال رمز التحقق");
      setDialogOpen(true);

      window.setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 60);
    } catch (err: any) {
      setError(err?.message || "تعذرت إعادة الإرسال");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={sendOtp} className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">البريد الإلكتروني</label>

          <div className="relative">
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              dir="ltr"
              type="email"
              autoComplete="email"
              placeholder="البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pr-10"
              disabled={sending || verifying}
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <Button type="submit" disabled={sending || verifying}>
          {sending ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري إرسال الرمز...
            </>
          ) : (
            "إرسال رمز التحقق"
          )}
        </Button>
      </form>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetOtp();
            setTimeLeft(OTP_EXPIRY_SECONDS);
          }
        }}
      >
        <DialogContent
          dir="rtl"
          className="w-[calc(100%-24px)] max-w-[560px] rounded-3xl border-0 p-0 shadow-2xl [&>button]:hidden"
        >
          <div className="p-6 sm:p-8">
            <DialogHeader className="space-y-4 text-right">
              <div className="flex flex-row-reverse items-start justify-between">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex flex-row-reverse items-center gap-2">
                  <DialogTitle className="text-xl font-bold sm:text-2xl">
                    تحقق من البريد الإلكتروني
                  </DialogTitle>
                  <ShieldCheck className="h-5 w-5 text-foreground" />
                </div>
              </div>

              <DialogDescription className="space-y-2 text-right">
                <div className="text-sm leading-7 sm:text-base">
                  أدخل رمز التحقق المرسل إلى:
                  <span className="mr-1 font-semibold text-foreground">
                    {email}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground sm:text-sm">
                  {timeLeft > 0 ? (
                    <>
                      ينتهي الرمز خلال{" "}
                      <span className="font-semibold text-foreground">
                        {formatCountdown(timeLeft)}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-red-600">
                      انتهت صلاحية الرمز، أعد الإرسال
                    </span>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={verifyOtp} className="mt-6 grid gap-5">
              <div className="grid gap-3">
                <label className="text-right text-sm font-medium">
                  رمز التحقق
                </label>

                <div
                  dir="ltr"
                  className="flex flex-row-reverse items-center justify-center gap-2 sm:gap-3"
                >
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      disabled={verifying || timeLeft <= 0}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      aria-label={`رقم ${index + 1} من رمز التحقق`}
                      className="h-14 w-11 rounded-2xl border border-slate-200 bg-white text-center text-xl font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 sm:h-16 sm:w-12"
                    />
                  ))}
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-row-reverse gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resendOtp}
                  disabled={!canResend}
                  className="h-12 rounded-2xl"
                >
                  {sending ? "جاري الإرسال..." : "إعادة الإرسال"}
                </Button>

                <Button
                  type="submit"
                  className="h-12 rounded-2xl"
                  disabled={verifying || timeLeft <= 0}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    "تأكيد الدخول"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
