import type { Metadata } from "next";
import { LoginButton } from "@/components/admin/login-button";

export const metadata: Metadata = {
  title: "Admin sign in | Matt Wayne",
  robots: { index: false, follow: false },
};

const messages: Record<string, string> = {
  not_authorized: "This Manus account is not on the administrator allowlist.",
  oauth_cancelled: "Sign-in was cancelled. You can try again when ready.",
  missing_code: "The sign-in response was incomplete. Please try again.",
  token_exchange_failed: "Manus sign-in could not be completed. Please try again.",
  identity_lookup_failed: "Manus could not verify this account. Please try again.",
  oauth_unavailable: "Sign-in is temporarily unavailable. Check the project OAuth configuration.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? messages[error] ?? "Sign-in could not be completed." : null;
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="eyebrow"><span className="status-dot" /> MATT WAYNE · NEWSLETTER STUDIO</div>
        <h1 id="login-title">Your editorial desk.</h1>
        <p>Sign in with the authorized Manus account to create, edit, and review newsletters.</p>
        {message ? <div className="notice notice-warning" role="alert">{message}</div> : null}
        <LoginButton />
        <p className="login-footnote">Only email addresses listed in the server-side admin allowlist can open the studio.</p>
      </section>
    </main>
  );
}
