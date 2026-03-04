// FILE: src/app/api/auth/request-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_REQUIRED" },
        { status: 400 },
      );
    }

    const sb = createSupabaseAdminClient();

    // 1) هل عندنا مستخدم بهذا الإيميل؟
    // نبحث في auth.users بالصفحات
    let foundUser: { id: string; email: string | null } | null = null;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await sb.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;

      const u = data.users.find(
        (x) => (x.email || "").toLowerCase() === cleanEmail,
      );
      if (u) {
        foundUser = { id: u.id, email: u.email || null };
        break;
      }
      if (data.users.length < 200) break;
    }

    if (!foundUser) {
      // لا نكشف هل الإيميل موجود أو لا (اختياري) — بس أنت طلبت "يعتذر"
      return NextResponse.json(
        { ok: false, error: "NOT_LINKED" },
        { status: 403 },
      );
    }

    // 2) هل هذا المستخدم مربوط بتِننت (يعني ثبت التطبيق/تم ربطه)؟
    const { data: membership, error: mErr } = await sb
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", foundUser.id)
      .limit(1)
      .maybeSingle();

    if (mErr) throw mErr;

    if (!membership?.tenant_id) {
      return NextResponse.json(
        { ok: false, error: "NOT_LINKED" },
        { status: 403 },
      );
    }

    // 3) إرسال Magic Link
    const redirectTo = new URL(req.url);
    redirectTo.pathname = "/auth/callback";
    redirectTo.search = "";

    const { error: inviteErr } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: cleanEmail,
      options: {
        redirectTo: redirectTo.toString(),
      },
    });

    if (inviteErr) throw inviteErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
