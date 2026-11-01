# Matt Wayne Newsletter Studio

This project preserves the supplied Matt Wayne landing page and adds an opt-in newsletter signup plus a private Next.js dashboard at `/admin`. The archived page remains the original saved markup and design; the signup form is appended server-side so the source page and its supplied media stay intact. The archive’s missing hydration bundles are not loaded because they produced an error screen.

## Features

- Public signup validates addresses and explicit consent server-side, stores normalized addresses in Supabase, and gives a non-enumerating response for duplicates. Consent copy and version are recorded.
- `/admin` uses Manus OAuth and a server-side `ADMIN_EMAILS` allowlist. Privileged Supabase, OpenAI, and Resend values are used only by server routes.
- The studio creates an HTML email from a Promotion / Topic Prompt, then lets an administrator edit and preview the draft with TipTap before delivery.
- Attachments are PDF, JPG, PNG, GIF, or WebP; up to 8 files and 20 MiB total per draft. Files live in a private Supabase Storage bucket and are never exposed with public URLs.
- Sending first snapshots the exact active, opted-in audience and requires a second explicit confirmation. Delivery is stored per subscriber and can pause/resume; failed recipients can be retried. Unsubscribed addresses are excluded. Emails contain a signed unsubscribe link and one-click list-unsubscribe headers.

## Supabase setup

Create a Supabase project, then apply [`supabase/migrations/202611010001_newsletter.sql`](supabase/migrations/202611010001_newsletter.sql) in its SQL editor. It creates the subscriber, draft, attachment, campaign, and recipient tables, enables row-level security without public policies, creates a private `newsletter-attachments` bucket, and adds a service-role-only transactional campaign snapshot function. The migration is safe to re-run. Do not add anonymous/client policies or expose a Supabase secret/service-role key in browser code.

Provide `SUPABASE_URL` and either `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY` as protected server values. This project intentionally leaves Manus-managed database capability disabled; Supabase is the external data store. Signup writes only after the migration is applied.

## Runtime configuration

Copy `.env.example` only for local development and replace every example value. In Manus-managed development or production, use protected environment settings rather than committing a `.env` file or pasting credentials into chat. **The current values in `.env.example` are deliberately invalid placeholders; they are not runtime settings and do not activate or bypass any provider integration.**

Required server values:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged Supabase key. Never prefix it with `NEXT_PUBLIC_`. |
| `OPENAI_API_KEY` | Server-side newsletter generation. |
| `RESEND_API_KEY` | Resend delivery API. |
| `RESEND_FROM_EMAIL` | Sender using a verified Resend domain, such as `Matt Wayne <newsletter@example.com>`. |
| `ADMIN_EMAILS` | Comma-separated email addresses permitted to enter `/admin`. Use the exact email returned by Manus sign-in. |
| `APP_ORIGINS` | Comma-separated exact public origins allowed for OAuth callbacks and unsubscribe URLs; no paths or trailing slash. |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | Random signing value with at least 32 characters, used to sign consent-versioned unsubscribe links. |

`MANUS_PROJECT_ID`, `MANUS_OAUTH_PORTAL_URL`, `MANUS_OAUTH_API_URL`, and `MANUS_JWT_SECRET` are supplied by the Manus project; do not replace them with custom values. For this Preview, include `https://8328-iy3qwdx92srj8ep15pcge-571a96ea.us3.manus.computer` in `APP_ORIGINS`. Add the final production origin when one is selected. Local development uses `http://localhost:3000`.

`OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`. For Resend, verify the sending domain and sender before preparing a real campaign. The app never sends an email during build or merely by opening `/admin`.

## Run locally

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm check` for TypeScript or `pnpm build` for the production Next.js build. Configure local environment variables first if testing authenticated or database-backed paths. The health endpoint is `GET /api/health` and intentionally does not probe or mutate external services.

## Delivery behavior and provider limits

A prepared campaign stores a subject/content/attachment snapshot and the exact active audience in a single database transaction. No message is sent until the administrator confirms that snapshot. The dashboard advances delivery in resumable chunks, skips subscribers who are no longer active or whose consent token changed, and records provider IDs/errors without displaying recipient email addresses in history.

Resend’s [batch-send API](https://resend.com/docs/api-reference/emails/send-batch-emails) supports batches of up to 100 messages but not attachments. Campaigns without attachments use that endpoint; campaigns with attachments use Resend’s [single-email API](https://resend.com/docs/api-reference/emails/send-email) with per-recipient idempotency keys. Retries are limited and only transient network, rate-limit, and server errors are retried automatically.

Supabase’s [API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys) treats secret/service-role keys as server-only. Supabase [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) is configured here as a private bucket with no client policy; access goes through protected server routes.

## Deployment

The project uses a pinned Node/pnpm lockfile and `Dockerfile` for the Next.js standalone container. Publish only after supplying the external provider values, applying the Supabase migration, and setting the correct administrator email and allowed origins. Do not publish a real newsletter as part of build or smoke-check validation.
