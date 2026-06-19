# Render Deployment

This project includes a `render.yaml` Blueprint for deploying:

- `direct-optimize-web`: Next.js web app
- `direct-optimize-worker`: background automation worker
- `direct-optimize-db`: Render Postgres
- `direct-optimize-redis`: Render Key Value, Redis-compatible

## 1. Add Render Billing

The full setup uses paid Render services because background workers do not have a free instance type.

In Render:

1. Open Account or Workspace Billing.
2. Add a payment method.
3. Return to the dashboard.

## 2. Create the Blueprint

1. Open Render Dashboard.
2. Click **New +**.
3. Choose **Blueprint**.
4. Connect the GitHub repo:
   `Atlasdeve/direct-optimize-lead-automation-dashboard`
5. Render will detect `render.yaml`.
6. Continue through the Blueprint setup.

## 3. Enter Secret Environment Variables

Render will prompt for variables marked `sync: false`.

Use the values from your local `.env` file for:

- `NEXTAUTH_SECRET`
- `GOOGLE_PLACES_API_KEY`
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_CX`
- `HUNTER_API_KEY`
- `BUILTWITH_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `IMAP_HOST`
- `IMAP_PORT`
- `IMAP_USER`
- `IMAP_PASS`
- `OPENAI_API_KEY`
- `ADMIN_WHATSAPP_NUMBER`

Do not paste secrets into GitHub.

## 4. Deploy and Test

After Render finishes deploying:

1. Open `https://direct-optimize-web.onrender.com/login`.
2. Log in or create the first admin user if the database is new.
3. Go to **Compose Email**.
4. Send a test email to your own inbox.
5. Check the **Compose tracking** table for opens/clicks.

## SMTP Timeout Notes

If SMTP still times out on Render:

- Confirm `SMTP_PORT` is `465` for SSL or `587` for STARTTLS.
- Confirm the cPanel SMTP hostname is the mail server hostname, not only the web domain.
- Ask the hosting provider whether they block cloud provider IPs.
- Consider using a transactional SMTP provider such as Amazon SES, Mailgun, Brevo, or Postmark.

`SMTP_TIMEOUT_MS` defaults to `30000` on Render.
