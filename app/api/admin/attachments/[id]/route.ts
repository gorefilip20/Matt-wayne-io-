import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: attachment, error: lookupError } = await supabase
    .from("newsletter_attachments")
    .select("id,storage_path")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Attachment storage is unavailable." }, { status: 503 });
  if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  const { data: campaigns, error: campaignError } = await supabase
    .from("newsletter_broadcasts")
    .select("id")
    .contains("attachment_ids", [id])
    .limit(1);
  if (campaignError) return NextResponse.json({ error: "Campaign attachment references are unavailable." }, { status: 503 });
  if (campaigns?.length) return NextResponse.json({ error: "This attachment is part of a prepared campaign and cannot be removed." }, { status: 409 });

  const { error: storageError } = await supabase.storage
    .from("newsletter-attachments")
    .remove([attachment.storage_path as string]);
  if (storageError) return NextResponse.json({ error: "The private file could not be removed." }, { status: 503 });

  const { error: deleteError } = await supabase.from("newsletter_attachments").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: "Attachment metadata could not be removed." }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
