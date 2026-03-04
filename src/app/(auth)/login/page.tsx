// FILE: src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setMsg(null);

    // 1) تحقق أنه مربوط
    const r = await fetch("/api/auth/check-linked", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setLoading(false);
      setMsg("هذا الإيميل غير مربوط بمتجر. ثبّت التطبيق أولاً.");
      return;
    }

    // 2) أرسل Magic Link (هذا اللي يرسل فعليًا)
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });

    setLoading(false);
    setMsg(error ? error.message : "تم إرسال رابط الدخول على الإيميل ✅");
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 16 }} dir="rtl">
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        تسجيل الدخول
      </h1>

      <label style={{ display: "block", marginBottom: 6 }}>الإيميل</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@domain.com"
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 10,
          marginBottom: 12,
          border: "1px solid #ddd",
        }}
      />

      <button
        disabled={loading || !email}
        onClick={send}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: 0,
          background: "#0b5",
          color: "#001",
          fontWeight: 700,
        }}
      >
        {loading ? "..." : "أرسل رابط الدخول"}
      </button>
      <button
        onClick={async () => {
          const r = await fetch("/api/dev/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const j = await r.json();
          if (!j.ok) {
            alert(j.error || "failed");
            return;
          }
          window.location.href = j.action_link; // ✅ يدخل مباشرة بدون إيميل
        }}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #333",
          background: "#111",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        Dev Login (بدون إيميل)
      </button>
      {msg && <div style={{ marginTop: 12, fontSize: 13 }}>{msg}</div>}
    </main>
  );
}
