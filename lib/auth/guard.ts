import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, type AdminSession } from "@/lib/auth/session";
import { isAllowedOrigin } from "@/lib/auth/origin";

export async function checkAdminRequest(
  request: NextRequest,
  requireSameOrigin = false,
): Promise<{ session: AdminSession } | { response: NextResponse }> {
  const session = await getAdminSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (requireSameOrigin) {
    const origin = request.headers.get("origin") ?? "";
    if (!isAllowedOrigin(origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return { response: NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 }) };
    }
  }
  return { session };
}
