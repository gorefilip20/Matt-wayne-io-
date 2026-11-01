import "server-only";
import { env, requiredEnv } from "@/lib/env";

export type ResendAttachment = { filename: string; content: string };
export type ResendMessage = {
  from: string;
  to: [string];
  subject: string;
  html: string;
  headers: Record<string, string>;
  attachments?: ResendAttachment[];
};

type ApiSuccess = { id?: string };
type BatchSuccess = { data?: Array<{ id?: string }> };

function providerHeaders(idempotencyKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey.slice(0, 256),
  };
}

async function requestJson<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`https://api.resend.com${path}`, {
        method: "POST",
        headers: providerHeaders(idempotencyKey),
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      if (attempt + 1 === maxAttempts) throw new Error("Resend could not be reached after retries.");
      await new Promise((resolve) => setTimeout(resolve, Math.min(6_000, 500 * 2 ** attempt)));
      continue;
    }

    if (response.ok) return (await response.json()) as T;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt + 1 < maxAttempts) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(10_000, delay)));
      continue;
    }
    throw new Error(`Resend rejected a message (HTTP ${response.status}).`);
  }
  throw new Error("Resend could not complete the request.");
}

export function getResendFrom(): string {
  return requiredEnv("RESEND_FROM_EMAIL");
}

export function isResendConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY") && env("RESEND_FROM_EMAIL"));
}

export async function sendResendMessage(message: ResendMessage, idempotencyKey: string): Promise<string> {
  const response = await requestJson<ApiSuccess>("/emails", message, idempotencyKey);
  if (!response.id) throw new Error("Resend accepted the request without returning a message ID.");
  return response.id;
}

export async function sendResendBatch(messages: ResendMessage[], idempotencyKey: string): Promise<string[]> {
  if (messages.length === 0 || messages.length > 100) throw new Error("Resend batches must contain between 1 and 100 messages.");
  const response = await requestJson<BatchSuccess>("/emails/batch", messages, idempotencyKey);
  const ids = response.data?.map((item) => item.id ?? "") ?? [];
  if (ids.length !== messages.length || ids.some((id) => !id)) {
    throw new Error("Resend returned an incomplete batch response.");
  }
  return ids;
}
