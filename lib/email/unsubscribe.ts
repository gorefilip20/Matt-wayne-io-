import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { requiredEnv } from "@/lib/env";

function consentVersion(consentedAt: string): string {
  const date = new Date(consentedAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid subscriber consent timestamp.");
  return Buffer.from(date.toISOString(), "utf8").toString("base64url");
}

function signatureFor(subscriberId: string, version: string): string {
  return createHmac("sha256", requiredEnv("NEWSLETTER_UNSUBSCRIBE_SECRET"))
    .update(`newsletter-unsubscribe:${subscriberId}:${version}`)
    .digest("base64url");
}

export function createUnsubscribeToken(subscriberId: string, consentedAt: string): string {
  const version = consentVersion(consentedAt);
  return `${subscriberId}.${version}.${signatureFor(subscriberId, version)}`;
}

export function hashUnsubscribeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyUnsubscribeToken(token: string, storedHash: string, consentedAt: string): string | null {
  const [subscriberId, version, signature, extra] = token.split(".");
  if (!subscriberId || !version || !signature || extra || !/^[0-9a-f-]{36}$/i.test(subscriberId)) return null;

  try {
    if (version !== consentVersion(consentedAt)) return null;
    const expectedSignature = signatureFor(subscriberId, version);
    const supplied = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    const suppliedHash = Buffer.from(hashUnsubscribeToken(token));
    const expectedHash = Buffer.from(storedHash);
    if (supplied.length !== expected.length || expectedHash.length !== suppliedHash.length) return null;
    if (!timingSafeEqual(supplied, expected) || !timingSafeEqual(suppliedHash, expectedHash)) return null;
    return subscriberId;
  } catch {
    return null;
  }
}
