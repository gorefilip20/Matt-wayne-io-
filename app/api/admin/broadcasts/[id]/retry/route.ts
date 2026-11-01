import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  const supabase = getSupabaseAdmin();
  const { data: broadcast, error: lookupError } = await supabase
    .from("newsletter_broadcasts")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Broadcast status is unavailable." }, { status: 503 });
  if (!broadcast) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  if (!["partial", "failed"].includes(broadcast.status as string)) {
    return NextResponse.json({ error: "Only a completed partial or failed broadcast can retry failed recipients." }, { status: 409 });
  }

  const { data: failedRows, error: failedError } = await supabase
    .from("newsletter_broadcast_recipients")
    .select("id")
    .eq("broadcast_id", id)
    .eq("status", "failed");
  if (failedError) return NextResponse.json({ error: "Failed recipient queue is unavailable." }, { status: 503 });
  if (!failedRows?.length) return NextResponse.json({ error: "There are no failed recipients to retry." }, { status: 409 });

  const { error: resetError } = await supabase
    .from("newsletter_broadcast_recipients")
    .update({ status: "pending", last_error: null, updated_at: new Date().toISOString() })
    .in("id", failedRows.map((row) => row.id));
  if (resetError) return NextResponse.json({ error: "Failed recipients could not be queued again." }, { status: 503 });
  const { error: updateError } = await supabase
    .from("newsletter_broadcasts")
    .update({ status: "queued", completed_at: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: "Broadcast could not be resumed." }, { status: 503 });
  return NextResponse.json({ ok: true, retryCount: failedRows.length }, { headers: { "Cache-Control": "no-store" } });
}
