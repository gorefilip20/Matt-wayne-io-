import { NextResponse, type NextRequest } from "next/server";
import { validateEmail } from "@/lib/validation";
import { markSubscribed, rateLimit, wasRecentlySubscribed } from "@/lib/rate-limit";
import { ProviderError, subscribe } from "@/lib/email-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = 8; // requests
const RATE_WINDOW_MS = 10 * 60 * 1000; // per 10 minutes per IP
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 2_048;

export type SubscribeResponse =
  | { success: true; message: string; alreadySubscribed?: boolean }
  | { success: false; message: string; field?: "email" };

function json(body: SubscribeResponse, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Reject cross-site form posts. Same-origin fetches and server tools pass. */
function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return json({ success: false, message: "Forbidden." }, 403);
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return json({ success: false, message: "Expected a JSON body." }, 415);
  }

  const limit = rateLimit(`subscribe:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return json(
      { success: false, message: "Too many attempts. Please wait a few minutes and try again." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ success: false, message: "Request too large." }, 413);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ success: false, message: "Invalid request body." }, 400);
  }

  // Honeypot: real users never see or fill the "company" field. Pretend it
  // worked so bots don't learn to adapt.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return json({ success: true, message: "Subscribed successfully" });
  }

  const result = validateEmail(body.email);
  if (!result.ok) {
    return json({ success: false, message: result.error, field: "email" }, 422);
  }
  const { email } = result;

  if (wasRecentlySubscribed(email, DUPLICATE_WINDOW_MS)) {
    return json({
      success: true,
      alreadySubscribed: true,
      message: "You're already on the list. Check your inbox for the guide.",
    });
  }

  try {
    const outcome = await subscribe(email);
    markSubscribed(email);

    if (outcome.status === "already_subscribed") {
      return json({
        success: true,
        alreadySubscribed: true,
        message: "Welcome back! We've sent the guide to your inbox again.",
      });
    }
    return json({ success: true, message: "Subscribed successfully" });
  } catch (err) {
    // Log the provider detail server-side only; never leak it to the client.
    console.error("[subscribe] failed:", err instanceof Error ? err.message : err);
    const status = err instanceof ProviderError && err.httpStatus === 500 ? 500 : 502;
    return json(
      { success: false, message: "We couldn't sign you up right now. Please try again in a moment." },
      status,
    );
  }
}

export function GET() {
  return json({ success: false, message: "Method not allowed." }, 405, { Allow: "POST" });
}
