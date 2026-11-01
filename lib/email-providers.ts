import "server-only";
import { createHash } from "node:crypto";
import { siteConfig } from "./site";

/**
 * ESP adapters. Each one saves the subscriber and makes sure the guide gets
 * delivered, then reports whether the person was new or already on the list.
 *
 * Pick one with EMAIL_PROVIDER = resend | convertkit | mailchimp | none.
 */

export type SubscribeOutcome = { status: "subscribed" | "already_subscribed" };

export class ProviderError extends Error {
  constructor(message: string, public readonly httpStatus = 502) {
    super(message);
    this.name = "ProviderError";
  }
}

const TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new ProviderError(`Missing environment variable ${name}`, 500);
  return value;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ProviderError(`Network error talking to email provider: ${reason}`);
  }
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `${res.status} ${body.slice(0, 300)}`;
}

/* ------------------------------------------------------------------ */
/* Resend: store contact in an Audience, then send the guide email     */
/* ------------------------------------------------------------------ */

async function subscribeWithResend(email: string): Promise<SubscribeOutcome> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const audienceId = requireEnv("RESEND_AUDIENCE_ID");
  const from = requireEnv("RESEND_FROM_EMAIL");
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const contactRes = await request(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, unsubscribed: false }),
  });

  let status: SubscribeOutcome["status"] = "subscribed";
  if (contactRes.status === 409) {
    status = "already_subscribed";
  } else if (!contactRes.ok) {
    const detail = await readError(contactRes);
    if (/already exists/i.test(detail)) status = "already_subscribed";
    else throw new ProviderError(`Resend contact error: ${detail}`);
  }

  // Send the guide either way: someone re-entering their email usually lost
  // the first message. The idempotency key stops duplicate sends within 24h.
  const { subject, html, text } = guideEmail();
  const day = new Date().toISOString().slice(0, 10);
  const sendRes = await request("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      ...headers,
      "Idempotency-Key": createHash("sha256").update(`${email}:${day}`).digest("hex"),
    },
    body: JSON.stringify({ from, to: [email], subject, html, text }),
  });

  if (!sendRes.ok && sendRes.status !== 409) {
    throw new ProviderError(`Resend send error: ${await readError(sendRes)}`);
  }

  return { status };
}

/* ------------------------------------------------------------------ */
/* ConvertKit (Kit): form subscribe triggers the incentive email       */
/* ------------------------------------------------------------------ */

async function subscribeWithConvertKit(email: string): Promise<SubscribeOutcome> {
  const apiKey = requireEnv("CONVERTKIT_API_KEY");
  const formId = requireEnv("CONVERTKIT_FORM_ID");

  const res = await request(`https://api.convertkit.com/v3/forms/${formId}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ api_key: apiKey, email }),
  });

  if (!res.ok) throw new ProviderError(`ConvertKit error: ${await readError(res)}`);

  // Kit upserts on repeat signups and doesn't flag existing subscribers in
  // the v3 response, so both cases are reported as a successful subscribe.
  return { status: "subscribed" };
}

/* ------------------------------------------------------------------ */
/* Mailchimp: idempotent upsert keyed on the md5 of the email          */
/* ------------------------------------------------------------------ */

async function subscribeWithMailchimp(email: string): Promise<SubscribeOutcome> {
  const apiKey = requireEnv("MAILCHIMP_API_KEY");
  const listId = requireEnv("MAILCHIMP_AUDIENCE_ID");
  const dc = process.env.MAILCHIMP_SERVER_PREFIX || apiKey.split("-")[1];
  if (!dc) throw new ProviderError("Missing MAILCHIMP_SERVER_PREFIX", 500);

  const hash = createHash("md5").update(email).digest("hex");
  const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");
  const base = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${hash}`;
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };

  // Check first so we can tell the user whether they were already subscribed.
  const existing = await request(base, { method: "GET", headers });
  const wasSubscribed =
    existing.ok && ((await existing.json()) as { status?: string }).status === "subscribed";

  const res = await request(base, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      email_address: email,
      status_if_new: "subscribed",
      tags: ["lead-magnet"],
    }),
  });

  if (!res.ok) throw new ProviderError(`Mailchimp error: ${await readError(res)}`);
  return { status: wasSubscribed ? "already_subscribed" : "subscribed" };
}

/* ------------------------------------------------------------------ */
/* Dev fallback                                                         */
/* ------------------------------------------------------------------ */

async function subscribeWithConsole(email: string): Promise<SubscribeOutcome> {
  console.info(`[subscribe] EMAIL_PROVIDER=none, would subscribe: ${email}`);
  return { status: "subscribed" };
}

export async function subscribe(email: string): Promise<SubscribeOutcome> {
  const provider = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase();
  switch (provider) {
    case "resend":
      return subscribeWithResend(email);
    case "convertkit":
    case "kit":
      return subscribeWithConvertKit(email);
    case "mailchimp":
      return subscribeWithMailchimp(email);
    case "none":
      if (process.env.NODE_ENV === "production") {
        throw new ProviderError("EMAIL_PROVIDER is not configured", 500);
      }
      return subscribeWithConsole(email);
    default:
      throw new ProviderError(`Unknown EMAIL_PROVIDER "${provider}"`, 500);
  }
}

/* ------------------------------------------------------------------ */
/* Guide delivery email (used by Resend; Kit/Mailchimp use automations) */
/* ------------------------------------------------------------------ */

function guideEmail() {
  const link = process.env.GUIDE_DOWNLOAD_URL ?? `${siteConfig.url}/#guide`;
  const subject = `Your free guide: ${siteConfig.brand} 5-Step Framework`;

  const text = [
    "Hey,",
    "",
    "Thanks for grabbing the guide. Here's your copy:",
    link,
    "",
    "Quick tip: read Step 4 (risk sizing) twice. It's the step most traders skip and the one that keeps you in the game.",
    "",
    `Talk soon,`,
    siteConfig.author,
    "",
    "You're getting this because you requested the guide. Reply STOP or use the unsubscribe link to opt out.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#090A0F;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1F2937;border-radius:16px;padding:32px;">
        <tr><td style="color:#10B981;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(siteConfig.brand)}</td></tr>
        <tr><td style="padding-top:12px;color:#FFFFFF;font-size:24px;font-weight:800;line-height:1.3;">Your guide is ready 🎉</td></tr>
        <tr><td style="padding-top:12px;color:#9CA3AF;font-size:15px;line-height:1.6;">Thanks for grabbing the 5-Step Price Action Framework. Tap the button below to open your copy.</td></tr>
        <tr><td style="padding:28px 0;">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#10B981;color:#04140D;font-weight:700;font-size:15px;text-decoration:none;padding:14px 24px;border-radius:10px;">Open the Guide →</a>
        </td></tr>
        <tr><td style="color:#9CA3AF;font-size:14px;line-height:1.6;border-top:1px solid #1F2937;padding-top:20px;">Quick tip: read <strong style="color:#FFFFFF;">Step 4 (risk sizing)</strong> twice. It's the step most traders skip and the one that keeps you in the game.</td></tr>
        <tr><td style="padding-top:20px;color:#FFFFFF;font-size:14px;">Talk soon,<br/>${escapeHtml(siteConfig.author)}</td></tr>
      </table>
      <p style="color:#4B5563;font-size:12px;margin-top:20px;">You're receiving this because you requested this guide.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
