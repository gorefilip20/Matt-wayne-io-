import { NextRequest, NextResponse } from "next/server";
import { checkAdminRequest } from "@/lib/auth/guard";
import { generateNewsletter } from "@/lib/ai/generate";
import { generateSchema } from "@/lib/validation/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await checkAdminRequest(request, true);
  if ("response" in auth) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a topic prompt of 8 to 4,000 characters." }, { status: 400 });

  try {
    const draft = await generateNewsletter(parsed.data.prompt);
    return NextResponse.json(draft, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Newsletter generation failed", { name: (error as { name?: string })?.name ?? "unknown" });
    return NextResponse.json({ error: "Draft generation is unavailable. Check the server-side OpenAI configuration and try again." }, { status: 502 });
  }
}
