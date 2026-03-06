//✅ FILE: src/app/api/auth/signout/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
