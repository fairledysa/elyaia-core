// FILE: src/app/api/dev/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function supabaseAdmin() {
  return createClient(
    mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  const { email } = await req.json().catch(() => ({ email: null }));
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "email is required" },
      { status: 400 },
    );
  }

  const users = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (users.error) {
    return NextResponse.json(
      { ok: false, error: users.error.message },
      { status: 500 },
    );
  }

  const user = users.data.users.find(
    (u) => (u.email || "").toLowerCase() === String(email).toLowerCase(),
  );

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "User not found" },
      { status: 404 },
    );
  }

  // ✅ يصنع لك رابط دخول مباشر بدون إرسال إيميل
  const link = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: String(email),
    options: {
      redirectTo: `${new URL(req.url).origin}/callback`,
    },
  });

  if (link.error) {
    return NextResponse.json(
      { ok: false, error: link.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    action_link: link.data.properties.action_link,
  });
}
