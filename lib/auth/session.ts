import "server-only";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { env, parseAdminEmails, requiredEnv } from "@/lib/env";

export type AdminSession = {
  openId: string;
  email: string;
  name: string;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get("webdev_app_session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(requiredEnv("MANUS_JWT_SECRET")),
      { algorithms: ["HS256"] },
    );
    const projectId = env("MANUS_PROJECT_ID");
    const openId = typeof payload.openId === "string" ? payload.openId : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const name = typeof payload.name === "string" ? payload.name : "Matt Wayne Admin";
    if (!projectId || payload.appId !== projectId || !openId || !email) return null;
    if (!parseAdminEmails().has(email)) return null;
    return { openId, email, name };
  } catch {
    return null;
  }
}
