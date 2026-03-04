// FILE: src/app/api/admin/update-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const userId = url.searchParams.get("user_id");
  const email = url.searchParams.get("email");

  if (!userId || !email) {
    return NextResponse.json({ error: "missing params" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    email: email,
  });

  if (error) {
    return NextResponse.json({ error: error.message });
  }

  return NextResponse.json({ ok: true, user: data.user });
}
