import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin } from "@/lib/auth/origin";
import { env, parseAdminEmails, requiredEnv } from "@/lib/env";

export const runtime = "nodejs";

function decodeState(value: string): { redirectUri: string; nonce: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Record<string, unknown>;
    if (typeof state.redirectUri !== "string" || typeof state.nonce !== "string") return null;
    return { redirectUri: state.redirectUri, nonce: state.nonce };
  } catch {
    return null;
  }
}

function redirectWithError(origin: string, error: string) {
  const url = new URL("/admin/login", origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const savedState = request.cookies.get("webdev_oauth_state")?.value ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!state || !savedState || state !== savedState) {
    return NextResponse.json({ error: "OAuth state validation failed." }, { status: 400 });
  }

  const decoded = decodeState(state);
  if (!decoded) return NextResponse.json({ error: "OAuth state is invalid." }, { status: 400 });
  const callback = new URL(decoded.redirectUri);
  const origin = callback.origin;
  if (!isAllowedOrigin(origin) || callback.pathname !== "/api/auth/callback" || callback.search || callback.hash) {
    return NextResponse.json({ error: "OAuth callback origin is not allowed." }, { status: 400 });
  }
  const secureOrigin = new URL(origin).protocol === "https:";
  const sameSite = secureOrigin ? "none" : "lax";

  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set("webdev_oauth_state", "", {
      httpOnly: true,
      secure: secureOrigin,
      sameSite,
      path: "/api/auth/callback",
      maxAge: 0,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return clearStateCookie(redirectWithError(origin, "oauth_cancelled"));
  if (!code) return clearStateCookie(redirectWithError(origin, "missing_code"));

  try {
    const appId = requiredEnv("MANUS_PROJECT_ID");
    const oauthApi = requiredEnv("MANUS_OAUTH_API_URL").replace(/\/+$/, "");
    const exchangeResponse = await fetch(`${oauthApi}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ clientId: appId, grantType: "authorization_code", code, redirectUri: decoded.redirectUri }),
    });
    if (!exchangeResponse.ok) return clearStateCookie(redirectWithError(origin, "token_exchange_failed"));

    const exchange = (await exchangeResponse.json()) as { accessToken?: string };
    if (!exchange.accessToken) return clearStateCookie(redirectWithError(origin, "token_exchange_failed"));
    const profileResponse = await fetch(`${oauthApi}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ accessToken: exchange.accessToken }),
    });
    if (!profileResponse.ok) return clearStateCookie(redirectWithError(origin, "identity_lookup_failed"));

    const profile = (await profileResponse.json()) as { openId?: string; email?: string; name?: string };
    const openId = profile.openId?.trim() ?? "";
    const email = profile.email?.trim().toLowerCase() ?? "";
    if (!openId || !email || !parseAdminEmails().has(email)) {
      return clearStateCookie(redirectWithError(origin, "not_authorized"));
    }

    const signingSecret = new TextEncoder().encode(requiredEnv("MANUS_JWT_SECRET"));
    const session = await new SignJWT({ appId, openId, email, name: profile.name?.trim() || "Admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(openId)
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(signingSecret);

    const response = NextResponse.redirect(new URL("/admin", origin), { status: 303 });
    response.cookies.set("webdev_app_session", session, {
      httpOnly: true,
      secure: secureOrigin,
      sameSite,
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return clearStateCookie(response);
  } catch {
    return clearStateCookie(redirectWithError(origin, "oauth_unavailable"));
  }
}
