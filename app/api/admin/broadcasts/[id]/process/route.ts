import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { runBroadcastChunk } from "@/lib/email/broadcast-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Broadcast not found." }, { status: 404 });
  try {
    const progress = await runBroadcastChunk(id);
    return NextResponse.json(progress, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Broadcast processing step failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "The next delivery chunk could not be completed. The saved campaign can be resumed or retried." }, { status: 503 });
  }
}
