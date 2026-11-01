import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { createUnsubscribeToken, hashUnsubscribeToken } from "@/lib/email/unsubscribe";
import { signupSchema } from "@/lib/validation/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CONSENT_TEXT = "Yes, email me newsletter updates from Matt Wayne. I can unsubscribe at any time.";
const CONSENT_VERSION = "newsletter-signup-v1";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Newsletter signups are temporarily unavailable." }, { status: 503 });
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and provide consent to receive updates." }, { status: 400 });
  }
  if (parsed.data.company.trim()) {
    return NextResponse.json({ ok: true, message: "Thanks. If the address is eligible, it has been added." }, { status: 202 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from("newsletter_subscribers")
      .select("id,status")
      .eq("email", parsed.data.email)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.status === "active") {
      return NextResponse.json({ ok: true, message: "Thanks. If the address is eligible, it has been added." }, { status: 202 });
    }

    const id = existing?.id ?? randomUUID();
    const consentedAt = new Date().toISOString();
    const token = createUnsubscribeToken(id, consentedAt);
    const values = {
      email: parsed.data.email,
      status: "active",
      consented_at: consentedAt,
      consent_text: CONSENT_TEXT,
      consent_version: CONSENT_VERSION,
      unsubscribe_token_hash: hashUnsubscribeToken(token),
      updated_at: new Date().toISOString(),
    };
    const result = existing
      ? await supabase.from("newsletter_subscribers").update(values).eq("id", id)
      : await supabase.from("newsletter_subscribers").insert({ id, ...values });
    if (result.error && result.error.code !== "23505") throw result.error;

    return NextResponse.json({ ok: true, message: "Thanks. If the address is eligible, it has been added." }, { status: 202 });
  } catch (error) {
    console.error("Newsletter signup failed", { code: (error as { code?: string })?.code ?? "unknown" });
    return NextResponse.json({ error: "Newsletter signups are temporarily unavailable." }, { status: 503 });
  }
}
