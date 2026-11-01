import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";
import { getAdminSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter Studio", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <AdminDashboard
      name={session.name}
      email={session.email}
      readiness={{
        supabase: isSupabaseConfigured(),
        openai: Boolean(env("OPENAI_API_KEY")),
        resend: Boolean(env("RESEND_API_KEY") && env("RESEND_FROM_EMAIL")),
        oauth: Boolean(env("MANUS_PROJECT_ID") && env("MANUS_OAUTH_PORTAL_URL") && env("MANUS_OAUTH_API_URL")),
      }}
    />
  );
}
