//✅ FILE: src/app/api/auth/check-linked/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!cleanEmail) return NextResponse.json({ ok: false }, { status: 400 });

  const sb = createSupabaseAdminClient();

  // find user by email (pages)
  let userId: string | null = null;
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
      userId = u.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  if (!userId)
    return NextResponse.json(
      { ok: false, error: "NOT_LINKED" },
      { status: 403 },
    );

  const { data: membership, error: mErr } = await sb
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (mErr) throw mErr;
  if (!membership?.tenant_id) {
    return NextResponse.json(
      { ok: false, error: "NOT_LINKED" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
