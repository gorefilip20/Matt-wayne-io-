import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const signup = `
<section class="mw-newsletter" id="newsletter-signup" aria-labelledby="mw-newsletter-title">
  <div class="mw-newsletter__inner">
    <span class="mw-newsletter__eyebrow">NOTES FROM THE DESK</span>
    <h2 id="mw-newsletter-title">The next move starts with a better read.</h2>
    <p>Market notes, strategy breakdowns, and new releases from Matt Wayne — delivered occasionally, with no noise.</p>
    <form class="mw-newsletter__form" id="mw-newsletter-form" novalidate>
      <label class="mw-newsletter__label" for="mw-newsletter-email">Your email address</label>
      <div class="mw-newsletter__row">
        <input id="mw-newsletter-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="320" placeholder="you@example.com" required>
        <button type="submit">Join the list <span aria-hidden="true">→</span></button>
      </div>
      <label class="mw-newsletter__consent"><input name="consent" type="checkbox" required><span>Yes, email me newsletter updates from Matt Wayne. I can unsubscribe at any time.</span></label>
      <label class="mw-newsletter__trap" aria-hidden="true">Company<input name="company" tabindex="-1" autocomplete="off"></label>
      <p class="mw-newsletter__status" id="mw-newsletter-status" role="status" aria-live="polite"></p>
    </form>
    <span class="mw-newsletter__fineprint">Your address is used only for newsletter updates.</span>
  </div>
</section>
<script defer src="/newsletter-signup.js"></script>
`;

export async function GET() {
  try {
    const archived = await readFile(join(process.cwd(), "public", "index.html"), "utf8");
    let html = archived.replace(/<html\s+lang=["']nl["']/i, '<html lang="en"');
    if (!/<\/head\s*>/i.test(html) || !/<\/body\s*>/i.test(html)) {
      return new Response("Archived landing page is incomplete.", { status: 500 });
    }
    html = html.replace(/<\/head\s*>/i, '<link rel="stylesheet" href="/newsletter-signup.css"></head>');
    html = html.replace(/<\/body\s*>/i, `${signup}</body>`);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    });
  } catch {
    return new Response("Landing page could not be loaded.", { status: 500 });
  }
}
