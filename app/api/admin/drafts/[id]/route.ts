import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getDraftAttachments } from "@/lib/email/attachments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRequest(request);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("newsletter_drafts")
      .select("id,prompt,subject,html_content,attachment_ids,updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const attachments = await getDraftAttachments(id);
    return NextResponse.json({ draft: data, attachments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Draft load failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Draft storage is unavailable." }, { status: 503 });
  }
}
