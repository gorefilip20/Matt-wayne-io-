import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getBroadcastProgress } from "@/lib/email/broadcasts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRequest(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  try {
    const supabase = getSupabaseAdmin();
    const { data: broadcast, error } = await supabase
      .from("newsletter_broadcasts")
      .select("id,subject_snapshot,recipient_count,status,attachment_ids,created_at,started_at,completed_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!broadcast) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
    const progress = await getBroadcastProgress(supabase, id);
    return NextResponse.json({ broadcast, progress }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Broadcast status failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Broadcast status is unavailable." }, { status: 503 });
  }
}
