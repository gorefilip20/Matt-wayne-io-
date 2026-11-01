import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeNewsletterHtml } from "@/lib/email/sanitize";
import { draftSchema } from "@/lib/validation/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await checkAdminRequest(request);
  if ("response" in auth) return auth.response;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("newsletter_drafts")
      .select("id,prompt,subject,html_content,attachment_ids,updated_at")
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return NextResponse.json({ drafts: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Draft list failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Draft storage is unavailable. Apply the Supabase migration and verify server configuration." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the prompt, subject, newsletter content, and attachment list." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const cleanHtml = sanitizeNewsletterHtml(parsed.data.html);
    if (!cleanHtml) return NextResponse.json({ error: "Newsletter content cannot be empty after sanitization." }, { status: 400 });

    if (parsed.data.id && parsed.data.attachmentIds.length) {
      const { data: attachments, error } = await supabase
        .from("newsletter_attachments")
        .select("id")
        .eq("draft_id", parsed.data.id)
        .in("id", parsed.data.attachmentIds);
      if (error) throw error;
      if ((attachments ?? []).length !== parsed.data.attachmentIds.length) {
        return NextResponse.json({ error: "One or more attachments do not belong to this draft." }, { status: 400 });
      }
    } else if (!parsed.data.id && parsed.data.attachmentIds.length) {
      return NextResponse.json({ error: "Save the draft before attaching files." }, { status: 400 });
    }

    const row = {
      ...(parsed.data.id ? { id: parsed.data.id } : {}),
      prompt: parsed.data.prompt,
      subject: parsed.data.subject,
      html_content: cleanHtml,
      attachment_ids: parsed.data.attachmentIds,
      created_by_open_id: auth.session.openId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("newsletter_drafts")
      .upsert(row, { onConflict: "id" })
      .select("id,prompt,subject,html_content,attachment_ids,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ draft: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Draft save failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Draft could not be saved. Verify that the Supabase migration has been applied." }, { status: 503 });
  }
}
