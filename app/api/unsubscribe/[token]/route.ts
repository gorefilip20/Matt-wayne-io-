import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlResponse(title: string, message: string, status = 200) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><body style="margin:0;background:#0e182c;color:#f1f9ff;font:16px/1.6 system-ui,sans-serif"><main style="max-width:620px;margin:12vh auto;padding:36px"><p style="color:#63b3ed;letter-spacing:.16em;font-size:12px">MATT WAYNE · NEWSLETTER</p><h1>${escape(title)}</h1><p>${escape(message)}</p><a style="color:#63b3ed" href="/">Return to the site</a></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const subscriberId = token.split(".")[0] ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(subscriberId)) {
    return htmlResponse("Link not recognized", "This unsubscribe link is invalid or has expired.", 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id,unsubscribe_token_hash,status,consented_at")
      .eq("id", subscriberId)
      .maybeSingle();
    if (error) throw error;
    const verifiedId = data ? verifyUnsubscribeToken(token, data.unsubscribe_token_hash, data.consented_at) : null;
    if (!data || !verifiedId) {
      return htmlResponse("Link not recognized", "This unsubscribe link is invalid or has expired.", 400);
    }
    if (data.status !== "unsubscribed") {
      const result = await supabase
        .from("newsletter_subscribers")
        .update({ status: "unsubscribed", updated_at: new Date().toISOString() })
        .eq("id", verifiedId);
      if (result.error) throw result.error;
    }
    return htmlResponse("You’re unsubscribed", "This email address will no longer receive newsletter updates.");
  } catch (error) {
    console.error("Newsletter unsubscribe failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return htmlResponse("Unable to update preferences", "Please try again later or contact the newsletter owner.", 503);
  }
}
