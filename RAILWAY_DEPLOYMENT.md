# Railway Deployment

Repository:

https://github.com/Atlasdeve/direct-optimize-lead-automation-dashboard

## 1. Create Railway project

1. Open Railway.
2. Create a new project.
3. Choose Deploy from GitHub repo.
4. Select `Atlasdeve/direct-optimize-lead-automation-dashboard`.
5. Deploy the repo as the web service.

The repo includes `railway.json`, so the web service uses:

```bash
npm ci && npm run railway:build
npm run railway:start
```

## 2. Add databases

Add these Railway services inside the same project:

- PostgreSQL
- Redis

## 3. Web service variables

Set these variables on the web/app service.

Use Railway references for databases:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

Set app/auth:

```env
NEXTAUTH_SECRET=<generate-a-long-random-secret>
AUTH_REGISTRATION_ENABLED=false
APP_PUBLIC_URL=https://your-railway-domain-or-custom-domain
```

Set providers:

```env
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_MAX_RESULTS=6
GOOGLE_PLACES_QUERY_COUNT=2
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=
HUNTER_API_KEY=
BUILTWITH_API_KEY=
LEAD_ENRICHMENT_TIMEOUT_MS=12000
OPENAI_API_KEY=
```

Set email:

```env
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
OUTREACH_EMAIL_SEND_ENABLED=false
OUTREACH_EMAIL_BUSINESS_HOURS_ONLY=true
EMAIL_DISCOVERY_MAX_PAGES=4
EMAIL_DISCOVERY_TIMEOUT_MS=8000
IMAP_HOST=
IMAP_PORT=993
IMAP_USER=
IMAP_PASS=
```

## 4. Worker service

Create another Railway service from the same GitHub repo.

Set its start command to:

```bash
npm run railway:worker
```

Give it the same variables as the web service, especially:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
IMAP_HOST=
IMAP_PORT=993
IMAP_USER=
IMAP_PASS=
```

The worker runs scheduled lead discovery, approved outreach every 10 minutes, day-3/day-7 follow-ups, reply sync, and employee reminders.

## 5. First login

If the production database is empty, open:

```text
https://your-domain/login
```

Register the first admin account. After one user exists, registration is disabled unless:

```env
AUTH_REGISTRATION_ENABLED=true
```

Keep it `false` after creating your admin account.

## 6. Domain

After Railway gives you a public URL, update:

```env
APP_PUBLIC_URL=https://your-live-domain
```

This is required for email open and click tracking.

If using cPanel DNS, create a CNAME such as:

```text
app.yourdomain.com -> Railway target
```

Then set:

```env
APP_PUBLIC_URL=https://app.yourdomain.com
```
