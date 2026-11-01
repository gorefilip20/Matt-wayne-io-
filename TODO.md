# TODO

## Archived landing-page content and visual identity — Complete
- [x] Build the supplied archived landing page structure and content with high visual fidelity.
- [x] Preserve the archived marketing copy, branding, typography, colors, and overall visual identity where practical.
- [x] Reuse and optimize imagery and other relevant assets provided in the ZIP archive.
- [x] Please make sure you build exactly. Not changing any but build exactly as the zip file contains. The only addition is the requested opt-in signup section.

## Responsive, clear presentation — Complete
- [x] Implement a polished responsive layout for desktop, tablet, and mobile screens.
- [x] Refine spacing, alignment, readability, and visual hierarchy for a neat and clear presentation.

## Working links and deployment readiness — Complete
- [x] Ensure navigation links, page links, and calls to action point to valid destinations and behave correctly.
- [x] Preserve the working landing links and make “See More Proof” open the review destination already present in the archive.

## Subscriber capture and data security — Code implemented; live Supabase setup pending
- [x] “SUBSCRIBER CAPTURE: Connect the signup form on the landing page to a Supabase database to collect subscriber emails securely.” Add an opt-in form with required consent, server-side email validation/normalization, a honeypot, non-enumerating responses, and consent version/timestamp storage. Keep Supabase keys server-only and provide the SQL migration and setup instructions.
- [ ] Add real Supabase URL/key in protected environment settings, apply `supabase/migrations/202611010001_newsletter.sql`, then validate an actual consented signup and unsubscribe.

## Admin dashboard and AI generation — Code implemented; OAuth/OpenAI setup pending
- [x] “AI GENERATION ENGINE: Create a backend admin dashboard route (/admin). Include a text area where I can input a ‘Promotion/Topic Prompt’. Use the OpenAI or Anthropic API to automatically generate an HTML newsletter draft based on that prompt.” Protect admin access with Manus OAuth and a server-side admin-email allowlist; keep generated content editable and sanitize/bound HTML output.
- [ ] Add the real OpenAI key and authorized admin email(s), then validate a real OAuth login and AI-generated draft.

## Inline rich-text editor and draft review — Implemented
- [x] “INLINE RICH-TEXT EDITOR: Display the generated AI draft inside a rich-text editor (like TipTap or Quill) so I can manually edit the text, change formatting, and review the draft before it goes live.” Persist drafts and allow review before broadcast.

## Attachments — Code implemented; live storage test pending
- [x] “ATTACHMENT HANDLER: Add a file upload button inside the editor that allows me to attach files or documents (PDFs, images, etc.) to the newsletter.” Use a private Supabase Storage bucket; permit PDF, JPG, PNG, GIF, and WebP up to 8 files / 20 MiB total per draft with server-side signature/size checks.
- [ ] Apply the migration and verify a real private upload/removal after Supabase credentials are provided.

## Broadcast and delivery records — Code implemented; live send test intentionally pending
- [x] “BROADCAST ENGINE: Integrate the Resend or SendGrid API. Add a prominent ‘Send to All Subscribers’ button. Clicking this must instantly broadcast the edited HTML newsletter and attachments to every email address in the Supabase database.” Use Resend; require an exact content/audience/attachment review and a second explicit confirmation, send only to active opted-in subscribers, include signed one-click unsubscribe, atomically snapshot the campaign plus all recipients, persist resumable per-recipient progress/idempotency and retries, and display exact attachment names in final review. Use Resend batch sends when no attachments are present and individual sends when attachments are included.
- [ ] Add the real Resend key and verified sender, then validate a real campaign only after explicitly authorized by the user. No actual newsletter has been sent.

## Next.js server and deployment readiness — Build/configuration complete; publication pending
- [x] Replace the static-only build with pinned Next.js server build, production container, and unauthenticated `/api/health`; retain `/` and declare `/admin`, `/admin/login`, and `/unsubscribe/:token` in the route manifest.
- [x] Keep the separate Manus-managed database disabled and automatic publication disabled; include the Supabase migration and keep real credentials out of source control.
- [ ] Add real production environment values and publish only when requested. The `.env.example` placeholders do not configure or activate integrations.
