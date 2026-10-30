# Acumen Time Tracker

A simple time-tracking website that runs entirely on free plans.

- **Admins** create projects and list the email addresses of the people who can work on them.
- **Members** sign in with their email and charge hours to their projects, recording the **task** and
  a description of the **work done**.
- **Reports** can be filtered by project, person and date range and downloaded as CSV (opens in Excel / Google Sheets).

Runs on [Vercel](https://vercel.com) (Hobby, free) with a [Neon](https://neon.tech) Postgres database
(Free plan), added straight from Vercel.

## Deploy

1. In Vercel, **Add New → Project**, import this GitHub repository and click **Deploy**.
   (The first deploy shows an error page until the database is connected; that's expected.)
2. In the Vercel project, open **Storage → Create Database → Neon**, choose the **Free** plan and
   connect it to the project. This sets `DATABASE_URL` automatically.
3. In **Settings → Environment Variables**, add `ADMIN_EMAILS` with your email (comma-separate several
   admins). Optionally add `APP_NAME` and `APP_TIMEZONE` (e.g. `Asia/Kolkata`).
   Then **Deployments → ⋯ → Redeploy**.

The app creates its database tables automatically the first time it runs.

## How to use it

1. **Sign in** with an email listed in `ADMIN_EMAILS`.
2. **Projects → Create a project**: give it a name and paste the email addresses of the people who
   will log hours (one per line or comma-separated). Tick "Add me as a member" if you also log time.
3. Share the website address. People sign in with their email; only emails on an active project
   (or in `ADMIN_EMAILS`) can get in. Anyone else is told the email has no access and to ask an admin.
4. **Log time**: project, date, hours, task and work done. People can edit or delete their own entries.
   Everyone can open **their name in the top right → Your details** to set the name shown against their
   hours in reports and CSV downloads, and to see which projects they can charge to.
5. **Reports**: pick a project, person and date range (or a preset like "Last month") and download
   the detailed or summary CSV. Members see only their own hours; admins see everyone's.

Admins can add or remove members at any time (removing someone keeps the hours they already
logged), archive a finished project to stop new time being logged, or delete it.

**Note:** sign-in is by email address only, with no password or code, so anyone who knows a
member's email address could sign in as them.

## Local development

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and ADMIN_EMAILS
npm run dev
```

`DATABASE_URL` can point to a local Postgres (`postgresql://user:pass@localhost:5432/db`).
