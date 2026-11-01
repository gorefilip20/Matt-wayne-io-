import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAdminRequest } from "@/lib/auth/guard";
import { isAllowedOrigin } from "@/lib/auth/origin";
import { isResendConfigured } from "@/lib/email/resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeNewsletterHtml } from "@/lib/email/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ draftId: z.string().uuid(), origin: z.string().min(1).max(500) });

type PreparedCampaign = {
  id: string;
  subject_snapshot: string;
  recipient_count: number;
  status: string;
  attachment_ids: string[];
  created_at: string;
  attachments: Array<{ id: string; filename: string; contentType: string; sizeBytes: number }>;
};

export async function POST(request: NextRequest) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(input);
  const requestOrigin = request.headers.get("origin") ?? "";
  if (!parsed.success || !isAllowedOrigin(parsed.data.origin) || parsed.data.origin !== requestOrigin) {
    return NextResponse.json({ error: "Draft or application origin is invalid." }, { status: 400 });
  }
  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Configure the Resend API key and a verified sender before preparing a broadcast." }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const { data: draft, error: draftError } = await supabase
      .from("newsletter_drafts")
      .select("id,subject,html_content,attachment_ids")
      .eq("id", parsed.data.draftId)
      .maybeSingle();
    if (draftError) throw draftError;
    if (!draft) return NextResponse.json({ error: "Save the newsletter draft before preparing a broadcast." }, { status: 404 });

    const cleanHtml = sanitizeNewsletterHtml(draft.html_content as string);
    const { data, error } = await supabase.rpc("prepare_newsletter_broadcast_snapshot", {
      p_draft_id: draft.id,
      p_subject_snapshot: draft.subject,
      p_html_snapshot: cleanHtml,
      p_attachment_ids: (draft.attachment_ids ?? []) as string[],
      p_app_origin: parsed.data.origin,
      p_created_by_open_id: auth.session.openId,
    });
    if (error) {
      if (error.message === "draft_not_found") {
        return NextResponse.json({ error: "Save the draft again before preparing a broadcast." }, { status: 404 });
      }
      if (error.message === "draft_attachments_invalid") {
        return NextResponse.json({ error: "One or more attachments are missing from this draft." }, { status: 409 });
      }
      if (error.message === "no_active_subscribers") {
        return NextResponse.json({ error: "There are no active, opted-in subscribers to receive this newsletter." }, { status: 409 });
      }
      throw error;
    }

    const campaign = (Array.isArray(data) ? data[0] : data) as PreparedCampaign | null;
    if (!campaign) throw new Error("The audience snapshot transaction returned no campaign.");
    return NextResponse.json(
      { broadcast: campaign, recipientCount: campaign.recipient_count },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Broadcast preparation failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "The audience snapshot could not be prepared. Verify the Supabase schema and try again." }, { status: 503 });
  }
}
