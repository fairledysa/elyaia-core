// FILE: src/app/(auth)/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function parseHashParams(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const sp = new URLSearchParams(h);
  const access_token = sp.get("access_token");
  const refresh_token = sp.get("refresh_token");
  return { access_token, refresh_token };
}

export default function CallbackPage() {
  const sb = supabaseBrowser();
  const [msg, setMsg] = useState("جاري تسجيل الدخول...");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);

        // PKCE
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.location.replace("/dashboard");
          return;
        }

        // Implicit
        const { access_token, refresh_token } = parseHashParams(
          window.location.hash,
        );

        if (access_token && refresh_token) {
          const { error } = await sb.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) throw error;

          window.location.replace("/dashboard");
          return;
        }

        setMsg("الرابط غير صالح");
        setTimeout(() => window.location.replace("/login"), 1000);
      } catch (e: any) {
        setMsg(e?.message || "فشل تسجيل الدخول");
        setTimeout(() => window.location.replace("/login"), 1000);
      }
    })();
  }, [sb]);

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 14, opacity: 0.8 }}>{msg}</div>
    </div>
  );
}