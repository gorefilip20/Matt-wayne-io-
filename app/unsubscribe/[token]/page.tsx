import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email preferences | Matt Wayne",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="unsubscribe-title">
        <div className="eyebrow"><span className="status-dot" /> EMAIL PREFERENCES</div>
        <h1 id="unsubscribe-title">Leave the list?</h1>
        <p>Confirm below to stop newsletter updates for this email address.</p>
        <form action={`/api/unsubscribe/${encodeURIComponent(token)}`} method="post">
          <button className="button button-primary login-button" type="submit">Confirm unsubscribe</button>
        </form>
        <p className="login-footnote">No account is required. You can always sign up again later.</p>
      </section>
    </main>
  );
}
