# Guide Landing Page + Email Capture

A dark-mode lead-generation page for a long-form, step-by-step guide. Readers get the full guide on the page and can opt in to have the PDF and bonus toolkit emailed to them. Built with Next.js (App Router), Tailwind CSS, Lucide icons and Plus Jakarta Sans.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your provider keys
npm run dev
```

With `EMAIL_PROVIDER=none` (the default in development) signups only get logged to the server console, so you can try the whole flow without any accounts. In production that setting returns an error, so a misconfigured deploy can't quietly drop leads.

## Project layout

```
app/
  layout.tsx              fonts, metadata, viewport
  page.tsx                page composition
  api/subscribe/route.ts  POST endpoint: validation, rate limit, honeypot, ESP sync
components/
  SiteHeader.tsx, Hero.tsx, SiteFooter.tsx
  guide/                  Badge, Step, Callout, Checklist, CodeBlock, TableOfContents, GuideContent
  email/                  EmailCaptureForm, SuccessCard, EmailCaptureCard, StickyCta, use-subscribed
lib/
  site.ts                 brand name, author, headline, copy (edit this to rebrand)
  validation.ts           email sanitizing + regex, shared by client and server
  rate-limit.ts           in-memory sliding window + recent-duplicate memory
  email-providers.ts      Resend / ConvertKit / Mailchimp adapters + guide email template
```

## Rebranding and content

Brand, author, badge, headline and description all live in `lib/site.ts`. The guide body is in `components/guide/GuideContent.tsx` and is put together from the `Step`, `Callout`, `Checklist` and `CodeBlock` primitives, so swapping in a different topic means editing JSX and nothing else.

## Email providers

Set `EMAIL_PROVIDER` to one of these:

| Provider | Saves subscriber | Delivers the guide |
| --- | --- | --- |
| `resend` | Adds contact to `RESEND_AUDIENCE_ID` | Sends the built-in HTML email with `GUIDE_DOWNLOAD_URL` (idempotency key, so at most one send per address per day) |
| `convertkit` | Subscribes to `CONVERTKIT_FORM_ID` | Use the form's incentive email or a Kit automation |
| `mailchimp` | Upserts the member (safe on duplicates), tagged `lead-magnet` | Use a Customer Journey triggered on "joins audience" or the tag |

## API contract

`POST /api/subscribe` with JSON `{ "email": "you@example.com" }`

| Status | Body |
| --- | --- |
| 200 | `{ "success": true, "message": "Subscribed successfully" }` |
| 200 | `{ "success": true, "alreadySubscribed": true, "message": "..." }` |
| 422 | `{ "success": false, "field": "email", "message": "..." }` |
| 429 | Rate limited (8 requests per 10 minutes per IP), includes a `Retry-After` header |
| 403 / 413 / 415 / 400 | Cross-origin post, oversized body, wrong content type, malformed JSON |
| 500 / 502 | Config or provider failure (details go to server logs only) |

Protections: server-side sanitize + regex, same-origin check, 2 KB body cap, hidden honeypot field, per-IP rate limit, and a short duplicate window so double clicks don't hit the ESP twice.

The rate limiter and duplicate memory live in process memory. That's fine for a single server or a warm serverless instance; for high traffic across many instances, swap `lib/rate-limit.ts` over to Upstash Redis or Vercel KV. The interface stays the same.

## Deploying

The app is ready for Vercel as is: import the repo, add the env vars from `.env.example`, and set `NEXT_PUBLIC_SITE_URL` to your domain so metadata and email links resolve correctly.
