// FILE: src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/requireTenant";

export const runtime = "nodejs";

export async function GET() {
  const sb = await createSupabaseServerClient();

  const { data: userRes, error: userErr } = await sb.auth.getUser();
  if (userErr || !userRes?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const user = userRes.user;
  const { tenantId, role } = await requireTenant({ userId: user.id, sb });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    tenant: { id: tenantId, role },
  });
}
