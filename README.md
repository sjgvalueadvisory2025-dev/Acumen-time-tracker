# Acumen Time Tracker

A simple, secure time-tracking website that runs entirely on free plans
(no trials, no credit card).

- **Admins** create projects and list the email addresses of the people who can work on them.
- **Members** sign in with only their email (a 6-digit code is emailed to them; no passwords) and
  charge hours to the projects they belong to.
- **Reports** can be filtered by project, person and date range and downloaded as CSV (opens in Excel / Google Sheets).

## What it runs on (all free)

| Piece | Service | Free plan |
|---|---|---|
| Website hosting | [Vercel](https://vercel.com) Hobby | Free, no expiry |
| Database | [Neon](https://neon.tech) Postgres Free | Free, no expiry (0.5 GB is roughly millions of time entries) |
| Sign-in emails | Any SMTP account, e.g. Gmail with an App Password | Free (Gmail allows about 500 emails per day) |

There are no paid or trial security services involved: sign-in, sessions and access control are all
built into the app itself.

## Deploy in about 15 minutes

### 1. Create the database (Neon)
1. Sign up at <https://neon.tech> (free plan, no card needed) and create a project.
2. On the project dashboard, click **Connect**, tick **Connection pooling**, and copy the connection
   string. It looks like `postgresql://...-pooler...neon.tech/neondb?sslmode=require`.
   This is your `DATABASE_URL`.

   (Alternatively, in Vercel go to **Storage → Create → Neon** and pick the Free plan; it fills in
   `DATABASE_URL` for you.)

The app creates its tables automatically the first time it runs.

### 2. Set up the email account used to send sign-in codes (Gmail)
1. Use a Gmail account (a new one dedicated to the app is a good idea).
2. Turn on **2-Step Verification**: <https://myaccount.google.com/security>.
3. Create an **App password**: <https://myaccount.google.com/apppasswords>. Copy the 16-character password.
   This is your `SMTP_PASS`.

Any other SMTP provider works too (Outlook, Zoho, Brevo's free plan, your company mail server):
just set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` accordingly.

### 3. Generate a secret
Create a long random string for `AUTH_SECRET` (at least 32 characters). For example run
`openssl rand -hex 32` in a terminal, or use a password manager to generate a 64-character password.
Keep it private; changing it later signs everyone out.

### 4. Deploy on Vercel
1. In Vercel, **Add New → Project** and import this GitHub repository. Leave the build settings as they are.
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string from step 1 |
   | `AUTH_SECRET` | Random string from step 3 |
   | `ADMIN_EMAILS` | Your email (comma-separate several admins), e.g. `you@company.com` |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | The Gmail address from step 2 |
   | `SMTP_PASS` | The App password from step 2 |
   | `EMAIL_FROM` | Optional, e.g. `Acumen Time Tracker <yourapp@gmail.com>` |
   | `APP_NAME` | Optional, e.g. `Acumen Time Tracker` |
   | `APP_TIMEZONE` | Optional, e.g. `Asia/Kolkata` or `America/New_York` (default `UTC`) |

3. Click **Deploy**. When it finishes, open the site and sign in with an email from `ADMIN_EMAILS`.

If you change environment variables later, redeploy (Deployments → ⋯ → Redeploy) for them to take effect.

## How to use it

1. **Sign in** as an admin with your email; enter the code you receive.
2. **Projects → Create a project**: give it a name and paste the email addresses of the people who
   will log hours (one per line or comma-separated). Tick "Add me as a member" if you also log time.
3. Tell those people the website address. They sign in with their email and get a code. Anyone whose
   email is not on an active project (or in `ADMIN_EMAILS`) never receives a code.
4. Members use **Log time** to record date, hours and an optional description. They can edit or delete
   their own entries.
5. **Reports**: pick a project, person and date range (or a quick preset like "Last month") and
   download the detailed or summary CSV. Members see only their own hours; admins see everyone's.

Managing projects (admins): add or remove members at any time (removing someone keeps the hours they
already logged), archive a finished project to stop new time being logged, or delete it permanently.

## Security

- **Email-only sign-in** with one-time 6-digit codes: valid for 10 minutes, single use, at most
  5 guesses per code, and at most 3 codes per 15 minutes (15 per day) per email.
- Codes are only sent to admins and members of active projects. The sign-in page responds the same
  way for every address, so it doesn't reveal who has access.
- Codes and session tokens are stored only as HMAC-SHA256 hashes (keyed with `AUTH_SECRET`), so a
  database leak does not expose usable logins.
- Sessions are random 256-bit tokens in `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` cookies, valid for
  30 days. Signing out deletes the session from the database.
- Access is re-checked on every request: removing someone from their last project, or archiving it,
  locks them out immediately.
- Every action is checked on the server: members can only log time to projects they belong to and
  only edit their own entries; only admins can manage projects or see other people's hours.
- All database queries are parameterised (no SQL injection). React escapes all output (no XSS).
  Next.js server actions reject cross-site form posts (CSRF protection).
- Security headers: Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy.
- CSV exports neutralise spreadsheet formula injection.
- The site asks search engines not to index it.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS
npm run dev
```

`DATABASE_URL` can point to a local Postgres (`postgresql://user:pass@localhost:5432/db`).
If SMTP is not configured in development, sign-in codes are printed in the terminal instead of emailed.

## Tech

Next.js (App Router, server actions) · TypeScript · Postgres (Neon serverless driver) · Nodemailer. No
CSS framework or other runtime dependencies.
