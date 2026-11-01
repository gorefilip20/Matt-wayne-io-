import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await checkAdminRequest(request);
  if ("response" in auth) return auth.response;
  try {
    const { count, error } = await getSupabaseAdmin()
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if (error) throw error;
    return NextResponse.json({ activeSubscribers: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Subscriber count failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Subscriber data is unavailable." }, { status: 503 });
  }
}
