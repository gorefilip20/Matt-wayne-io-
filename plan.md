# Full-Stack Newsletter Dashboard Plan

## Scope and assumptions

Rebuild the current static project as a full-stack Next.js App Router site while retaining the supplied landing page’s copy, media, links, and visual treatment. The ZIP currently has **no email form** (`0` forms and `0` email inputs), so add a distinct, consent-based newsletter signup section at the end of the landing page without replacing its existing calls to action.

Use **Supabase** for subscribers, drafts, attachments metadata, broadcast jobs, and recipient outcomes; **OpenAI** for draft generation; **Resend** for delivery; and **Manus OAuth** for the protected `/admin` route, restricted by a server-side admin-email allowlist. The Supabase secret key, OpenAI API key, Resend API key, sender address, site origin, and admin allowlist will be supplied through protected project environment input, never source files. Include a Supabase SQL migration and setup instructions. No Supabase/Resend connector was found in the current session, so a user will need to apply the migration in Supabase unless a connector is enabled later.

The project currently has `server: false`, `database: false`, and a static-copy build. This plan requires enabling the Webdev **server capability**, which is one-way and cannot later be disabled. The separate Manus-managed database will remain off; subscriber data uses the explicitly requested Supabase service. Preserve the current `main` history and the existing non-default GitHub feature branch; continue to leave the GitHub default branch untouched. Do not publish or send any actual newsletters during development.

## Implementation architecture

Use the Node 22 environment and pin pnpm 11.25.0 with a committed lockfile and explicit `pnpm-workspace.yaml` lifecycle-script permissions before installation. Build a production Next.js container that honors `PORT` (default 3000), serves an unauthenticated `/api/health`, and keeps every provider credential server-only. Use the existing Webdev runtime port for Preview and a Dockerfile/container deployment for production.

Serve the existing rendered landing markup at `/` with a small added opt-in form and client-side submit handler. Validate and normalize email on the server, require an explicit marketing-consent checkbox, use a honeypot, and keep subscriber records inaccessible to anonymous Supabase clients. Include a one-click unsubscribe endpoint and unsubscribe link in each broadcast. Apply Supabase RLS to every application table with no public policies; use the Supabase secret key only in server routes. Keep attachments in a private Supabase Storage bucket, with authenticated upload routes and bounded file/total sizes.

Protect `/admin` with the platform Manus OAuth session named `webdev_app_session`; validate the HS256 project JWT, expiry, project ID, and authenticated identity, then enforce the configured admin-email allowlist. Keep OAuth state nonce-bound and short-lived. Set the session cookie `SameSite=None; Secure` for public HTTPS Preview. Provide the normal logged-out login state.

The dashboard contains a Promotion/Topic Prompt field, an OpenAI generation action, subject field, TipTap rich-text editor, private file upload/list/removal controls, saved draft support, and a prominent **Send to All Subscribers** action. Sanitize AI HTML before rendering or storing it. Show the exact subject, attachment list, and active-recipient count before the final send confirmation. Send only to subscribers who opted in and have not unsubscribed. Record broadcast and per-recipient outcomes, expose progress, and make incomplete batches resumable without silently resending successes.

Resend's batch API accepts up to 100 emails but does not support attachments; the single-email API supports attachments up to 40 MB after Base64 encoding. Therefore use the batch endpoint only when a campaign has no attachments, and use individually addressed messages with idempotency keys when attachments are present. Process manageable chunks through durable Supabase broadcast records; the dashboard starts processing immediately after confirmation and can resume remaining recipients. Keep attachment totals conservatively below Resend’s documented limit.

## Project structure

- `app/route.ts` serves the archived landing HTML at `/`; `public/` retains its original fonts, images, and source page.
- `app/admin/` contains the OAuth-protected dashboard and login state; `app/unsubscribe/[token]/` contains the public unsubscribe confirmation page.
- `app/api/auth/`, `app/api/subscribers/`, and `app/api/admin/` contain OAuth, capture, draft-generation, draft-storage, attachment, recipient-count, broadcast, and progress handlers. `app/api/health/route.ts` is the deployment health endpoint.
- `components/admin/` contains the TipTap editor, prompt panel, attachment controls, broadcast confirmation, and progress UI. The landing signup section is injected by `app/route.ts`; its submit behavior and styles remain in `public/newsletter-signup.js` and `public/newsletter-signup.css`.
- `lib/auth/`, `lib/supabase/`, `lib/email/`, `lib/ai/`, and `lib/validation/` isolate security, database/storage, provider integrations, HTML sanitization, and input rules.
- `supabase/migrations/` contains RLS-enabled schema and the private attachment bucket. `public/manus-routes.json` declares `/`, `/admin`, `/admin/login`, and `/unsubscribe/:token` only; API endpoints are excluded.
- Root `Dockerfile`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `.env.example` define reproducible installation and deployment without credential values.

## Design system

**Design movement:** a restrained fintech editorial system extended into a dark creator-console, reusing the supplied trading-page aesthetic rather than introducing a generic SaaS theme.

**Core principles:** preserve the existing landing page; make subscriber consent and delivery status explicit; keep AI-generated material visibly in draft until reviewed; keep every sensitive action scoped and auditable.

**Color philosophy:** deep navy and blue retain the landing page’s confident trading identity. Cobalt marks primary actions, restrained green marks successful delivery, and amber/red communicate pending or failed states without competing with the content.

**Layout paradigm:** the public page remains the archived long-form landing flow with a clear signup section at the end. The admin desktop uses a three-part workbench—prompt and draft controls, central editor, and attachments/send review—collapsing into a single vertical flow on narrow screens.

**Signature elements:** the source page’s subtle trading-grid texture; compact blue gradient action surfaces; crisp dark bordered panels with clear status chips.

**Interaction philosophy:** generate, edit, save, preview, then send. The final send step exposes its recipient count and content summary; resuming a campaign never hides prior successes.

**Animation:** keep motion functional and brief: small progress transitions and editor feedback only. No looping decoration; respect reduced-motion preferences.

**Typography system:** preserve the archived page’s existing font declarations. Reuse the same family in the dashboard, with larger editorial headings, compact UI labels, and monospaced provider/status metadata.

**Brand essence:** a confident, practical trading education brand extended into a creator newsletter tool; **direct, composed, credible**.

**Brand voice:** concrete and restrained, with no guaranteed-profit claims. Examples: “Turn this week’s market idea into a draft.” “Review every detail before it goes to subscribers.”

**Wordmark & logo:** reuse the supplied portrait/icon and existing page wordmark treatment; do not introduce an unrelated symbol.

**Signature brand color:** the archived page’s cobalt blue, reused for primary actions and focus states.

## Provider references informing delivery behavior

- Resend batch API: https://resend.com/docs/api-reference/emails/send-batch-emails — up to 100 messages per request; attachments are not supported in batches.
- Resend single-email API: https://resend.com/docs/api-reference/emails/send-email — supports attachments and unsubscribe headers; attachment campaigns use individual sends.
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys — secret keys bypass RLS and must remain server-only.
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control — private storage with no client policy; only the trusted server can access its objects.


## Security implementation detail

Keep an explicit HTTPS `APP_ORIGINS` allowlist for OAuth redirects, with plain HTTP limited to localhost. Set short-lived state cookies and session cookies from the validated public origin so HTTPS Preview uses `SameSite=None; Secure` while local HTTP remains testable. Generate subscriber unsubscribe URLs as HMAC-signed subscriber identifiers plus the current consent timestamp using a dedicated `NEWSLETTER_UNSUBSCRIBE_SECRET`; persist only their SHA-256 hashes in Supabase. This makes links reproducible for resumed sends without storing bearer tokens in plaintext, and invalidates old messages after re-consent.
