import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin } from "@/lib/auth/origin";
import { requiredEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.searchParams.get("origin") ?? "";
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "This application origin is not allowed." }, { status: 400 });
  }

  try {
    const appId = requiredEnv("MANUS_PROJECT_ID");
    const portal = requiredEnv("MANUS_OAUTH_PORTAL_URL");
    const secureOrigin = new URL(origin).protocol === "https:";
    const redirectUri = `${origin}/api/auth/callback`;
    const nonce = randomBytes(32).toString("base64url");
    const state = Buffer.from(JSON.stringify({ redirectUri, nonce }), "utf8").toString("base64url");
    const authorizationUrl = new URL(`${portal.replace(/\/+$/, "")}/app-auth`);
    authorizationUrl.searchParams.set("appId", appId);
    authorizationUrl.searchParams.set("redirectUri", redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("responseType", "code");

    const response = NextResponse.redirect(authorizationUrl, { status: 302 });
    response.cookies.set("webdev_oauth_state", state, {
      httpOnly: true,
      secure: secureOrigin,
      sameSite: secureOrigin ? "none" : "lax",
      path: "/api/auth/callback",
      maxAge: 600,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Manus OAuth is not configured." }, { status: 503 });
  }
}
