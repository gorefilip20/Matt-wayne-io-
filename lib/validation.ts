/**
 * Email validation shared by the client form and the API route, so both sides
 * agree on what "valid" means. The server always re-validates.
 */

export const MAX_EMAIL_LENGTH = 254;

// Pragmatic RFC 5322 subset: local@domain.tld, no spaces, a dotted domain,
// and a TLD of at least two letters.
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/** Trim, strip invisible/control characters and lowercase. */
export function sanitizeEmail(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F​-‍﻿]/g, "")
    .trim()
    .toLowerCase();
}

export type EmailValidationResult = { ok: true; email: string } | { ok: false; error: string };

export function validateEmail(raw: unknown): EmailValidationResult {
  const email = sanitizeEmail(raw);

  if (!email) return { ok: false, error: "Please enter your email address." };
  if (email.length > MAX_EMAIL_LENGTH) return { ok: false, error: "That email address is too long." };

  const [local] = email.split("@");
  if (!EMAIL_REGEX.test(email) || !local || local.length > 64 || email.includes("..")) {
    return { ok: false, error: "That doesn't look like a valid email. Double-check for typos." };
  }

  return { ok: true, email };
}
