# Direct Optimize Lead Automation Dashboard

Full-stack Next.js scaffold for compliant lead generation, outreach, reply tracking, and analytics.

## What is included

- React + Next.js app router dashboard with Tailwind CSS, Material UI icons, glassmorphism black/blue UI, region tabs, lead table, notifications, and Recharts analytics.
- API routes for regions, leads, lead details, automation start, templates, replies, analytics, and settings.
- Prisma PostgreSQL schema for `users`, `regions`, `leads`, `lead_contacts`, `outreach_logs`, `email_templates`, `whatsapp_templates`, `inbox_replies`, `ai_reply_drafts`, `automation_runs`, `notifications`, and `settings`.
- BullMQ/Redis queue wiring with an in-process fallback when Redis is not configured.
- Cron scheduler for Canada, USA, UK, UAE, and Qatar morning runs with region timezones.
- Provider-safe service layer for Google Places, Google Custom Search, SMTP email, enrichment providers, and OpenAI reply drafting.
- Compliance guardrails: no LinkedIn scraping, WhatsApp number identification only, rate caps, unsubscribe handling, consent fields, and outreach logs.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

```bash
docker compose up -d postgres redis
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Set `DATABASE_URL` to a PostgreSQL database before running migrations.

## Automation worker and scheduler

```bash
npm run scheduler
```

When `REDIS_URL` is set, automation jobs are queued through BullMQ. Without Redis, the Start Automation button runs the compliant demo flow in-process.

## Railway deployment

The repository includes `railway.json` for the web service.

Recommended Railway services:

- Web service from this GitHub repo
- PostgreSQL database
- Redis database
- Worker service from the same GitHub repo

Web service commands:

```bash
npm run railway:build
npm run railway:start
```

Worker service start command:

```bash
npm run railway:worker
```

Set `APP_PUBLIC_URL` to the public Railway/domain URL so email open and click tracking works outside your computer.

For first production login, registration is allowed only when the users table is empty. After that, registration is disabled unless `AUTH_REGISTRATION_ENABLED="true"`.

## Provider configuration

Live sending and discovery require official provider credentials in `.env`:

- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_CX`
- `HUNTER_API_KEY` and `BUILTWITH_API_KEY` for optional enrichment
- SMTP or Gmail credentials
- `OPENAI_API_KEY`

The demo does not bypass platform rules or scrape restricted sources.

Verify cPanel SMTP without sending an email:

```bash
npm run smtp:verify
```

Verify cPanel IMAP and sync replies:

```bash
npm run imap:verify
npm run replies:sync
```
