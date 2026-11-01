import { normalizeOrigin, parseAllowedOrigins } from "@/lib/env";

export function isAllowedOrigin(value: string): value is string {
  const normalized = normalizeOrigin(value);
  return Boolean(normalized && parseAllowedOrigins().has(normalized));
}
