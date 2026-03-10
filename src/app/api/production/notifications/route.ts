// FILE: src/app/api/production/notifications/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type NotificationRow = {
  id: string;
  title: string;
  text: string;
  tone: string | null;
  type: string | null;
  created_at: string | null;
};

function formatRelativeArabic(dateValue: string | null | undefined) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `قبل ${diffMin} دقيقة`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.tenant_id) {
      return NextResponse.json({ error: "TENANT_NOT_FOUND" }, { status: 403 });
    }

    const tenantId = membership.tenant_id;

    const { data: rows, error } = await admin
      .from("notifications")
      .select("id,title,text,tone,type,created_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items =
      rows?.map((row: NotificationRow) => ({
        id: row.id,
        title: row.title,
        text: row.text,
        tone: row.tone ?? "slate",
        type: row.type ?? "system",
        time: formatRelativeArabic(row.created_at),
      })) ?? [];

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
