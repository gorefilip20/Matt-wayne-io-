import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await checkAdminRequest(request);
  if ("response" in auth) return auth.response;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("newsletter_broadcasts")
      .select("id,subject_snapshot,recipient_count,status,created_at,started_at,completed_at,attachment_ids")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json({ broadcasts: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Broadcast list failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Broadcast history is unavailable." }, { status: 503 });
  }
}
