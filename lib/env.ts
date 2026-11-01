export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function parseAdminEmails(): Set<string> {
  return new Set(
    (env("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function parseAllowedOrigins(): Set<string> {
  const origins = (env("APP_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(origins.map(normalizeOrigin).filter((value): value is string => Boolean(value)));
}

export function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    const localHosts = ["localhost", "127.0.0.1", "::1"];
    if (!( ["https:", "http:"].includes(url.protocol) && url.origin === value.replace(/\/$/, ""))) return undefined;
    if (url.protocol === "http:" && !localHosts.includes(url.hostname)) return undefined;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
