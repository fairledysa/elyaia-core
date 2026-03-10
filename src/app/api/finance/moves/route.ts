//api/finance/moves/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/requireTenant";

export async function GET(req: NextRequest) {
  const sb = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false });
  }

  const { tenantId } = await requireTenant({
    userId: user.id,
    sb,
  });

  const searchParams = req.nextUrl.searchParams;

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  let query = admin
    .from("wallet_moves")
    .select(
      `
      id,
      created_at,
      type,
      amount,
      profiles(full_name)
    `,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data } = await query;

  let items =
    data?.map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      employeeName: row.profiles?.full_name ?? null,
      type: row.type,
      amount: row.amount,
    })) ?? [];

  if (search) {
    items = items.filter((i) =>
      i.employeeName?.toLowerCase().includes(search.toLowerCase()),
    );
  }

  return NextResponse.json({
    ok: true,
    items,
  });
}
