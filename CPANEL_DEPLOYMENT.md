# cPanel Deployment

This project can run on cPanel if your hosting account includes **Setup Node.js App**.

Recommended cPanel architecture:

- cPanel Node.js App: Next.js dashboard
- Supabase or another external Postgres: `DATABASE_URL`
- Optional Upstash Redis: `REDIS_URL`
- cPanel Cron Jobs: scheduled automation and reply sync
- cPanel SMTP: email sending

Shared cPanel usually cannot run a permanent background worker, so use `AUTOMATION_INLINE=true` and the protected cron endpoint.

## 1. Create the Node.js App

In cPanel:

1. Open **Setup Node.js App**.
2. Create an application.
3. Node version: 20.x if available.
4. Application mode: Production.
5. Application root: your uploaded project folder.
6. Application startup file: `cpanel-server.js`.
7. Application URL: your desired domain or subdomain.

## 2. Upload the Project

Upload the project files from GitHub or with Git Version Control if your cPanel supports it.

Do not upload `node_modules`.

## 3. Install and Build

In cPanel Terminal, from the app folder:

```bash
npm ci
npm run cpanel:build
npm run prisma:generate
npx prisma migrate deploy
```

If your cPanel UI has an **NPM Install** button, you can use it for `npm ci`, then run the build command in Terminal.

## 4. Environment Variables

Add these in cPanel's Node.js app environment variables.

Required:

```env
NODE_ENV=production
DATABASE_URL=your_external_postgres_url
NEXTAUTH_SECRET=your_random_secret
APP_PUBLIC_URL=https://your-domain.com
AUTH_REGISTRATION_ENABLED=false
AUTOMATION_INLINE=true
CRON_SECRET=your_long_random_cron_secret
CRON_AUTOMATION_MAX_RESULTS=3
SMTP_HOST=your_cpanel_smtp_host
SMTP_PORT=465
SMTP_USER=your_email_user
SMTP_PASS=your_email_password
SMTP_FROM=Your Name <you@yourdomain.com>
SMTP_TIMEOUT_MS=30000
OUTREACH_EMAIL_SEND_ENABLED=true
```

Optional but recommended:

```env
REDIS_URL=your_upstash_or_redis_url
GOOGLE_PLACES_API_KEY=...
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...
HUNTER_API_KEY=...
BUILTWITH_API_KEY=...
OPENAI_API_KEY=...
IMAP_HOST=...
IMAP_PORT=993
IMAP_USER=...
IMAP_PASS=...
ADMIN_WHATSAPP_NUMBER=...
```

## 5. Start the App

In cPanel, click **Restart** for the Node.js app.

Open:

```text
https://your-domain.com/login
```

## 6. Add Cron Job

In cPanel **Cron Jobs**, run every 15 minutes:

```bash
*/15 * * * * curl -fsS "https://your-domain.com/api/cron/tick?secret=YOUR_CRON_SECRET" >/dev/null 2>&1
```

This cron endpoint:

- syncs inbox replies using IMAP
- checks each region's local scheduled time
- runs one due region automation per cron hit

Keep `CRON_AUTOMATION_MAX_RESULTS` small on shared hosting, such as `3` or `5`.

## 7. SMTP Notes

Because the app runs inside the same cPanel hosting environment, SMTP to your cPanel mail server is more likely to work than from Railway/Render.

Use:

- Port `465` with SSL, or
- Port `587` with STARTTLS

If email still times out, confirm the SMTP hostname in cPanel's **Email Accounts > Connect Devices** page.
