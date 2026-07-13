# Payroll Portal (Extra Hours) — Setup Guide

This is a plain HTML/CSS/JavaScript app (no build step needed) that uses
**Supabase** for the database + login, and deploys to **Vercel** for free.

## What's in this folder

```
payroll-portal/
├── index.html          ← Landing page / Login / Sign Up
├── teacher.html         ← Teacher Dashboard
├── manager.html         ← Regional Manager Dashboard
├── css/style.css        ← All styling
├── js/
│   ├── supabaseClient.js  ← ⚠️ You'll paste your Supabase keys here
│   ├── auth.js
│   ├── teacher.js
│   └── manager.js
├── sql/schema.sql       ← Run this once in Supabase
└── README.md            ← You are here
```

A quick design note: the PRD asks people to sign up with just a **Full Name**
and **Password** (no email). Supabase's login system needs an email under
the hood, so the app quietly builds one from the person's name (like
`janedoe@ymu.internal`) — nobody ever sees or types it. That's why Step 3
below (turning off email confirmation) matters.

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in.
2. Click **New Project**. Pick any name (e.g. "ymu-payroll"), generate a
   database password (save it somewhere), and choose the region closest to
   Miami. Click **Create new project** and wait ~2 minutes for it to spin up.

## Step 2 — Create the database tables

1. In your new project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `sql/schema.sql` from this folder, copy the **entire file**, and
   paste it into the editor.
4. Click **Run**. You should see "Success. No rows returned." That's it —
   your `profiles` and `requests` tables now exist with all the correct
   security rules.

## Step 3 — Turn off email confirmation (important!)

Because accounts use a made-up internal email address, Supabase can never
actually deliver a confirmation email to it. If confirmation is required,
nobody would ever be able to log in.

1. Go to **Authentication → Sign In / Providers** (in some Supabase versions:
   **Authentication → Settings**).
2. Find **"Confirm email"** and turn it **OFF**.
3. Save.

## Step 4 — Connect the app to your Supabase project

1. In Supabase, go to **Project Settings → Data API**. Copy the **Project URL**.
2. Go to **Project Settings → API Keys**. Copy the **`anon` `public`** key.
3. Open `js/supabaseClient.js` in this folder and replace the two placeholder
   lines near the top:

   ```js
   const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```

   with your real values, e.g.:

   ```js
   const SUPABASE_URL = "https://abcdefghij.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   ```

4. Save the file.

## Step 5 — Put the code on GitHub

1. Go to [github.com](https://github.com) and create a **New repository**
   (e.g. `payroll-portal`). Keep it Public or Private, either is fine.
2. On your computer, open a terminal inside this `payroll-portal` folder and run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/payroll-portal.git
   git push -u origin main
   ```

   (No `git`? Install it from [git-scm.com](https://git-scm.com), or simply
   drag-and-drop the folder's files into GitHub's "upload files" web page
   instead of using the terminal.)

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up / log in (you can use
   your GitHub account to sign in — it's the easiest option).
2. Click **Add New → Project**.
3. Select the `payroll-portal` repository you just pushed.
4. Vercel will detect it as a static site. You don't need to change any
   build settings — leave **Framework Preset** as "Other" and click **Deploy**.
5. Wait about 30–60 seconds. Vercel will give you a live URL like
   `https://payroll-portal-yourname.vercel.app`.

Your app is now live! Every time you push new changes to GitHub, Vercel
automatically redeploys.

## Step 7 — Try it out

1. Open your Vercel URL. Click **Sign Up**.
2. Create a **Teacher** account (any name + password).
3. Create a **Regional Manager** account using access code: `coolwebapp12`
4. Log in as the teacher, submit an Extra Hours request.
5. Log out, log in as the manager — you'll see it in the **Pending Requests**
   table. Hover over the row to reveal the **Review** button, then Approve
   or Decline it.
6. Log back in as the teacher — you'll see a notification banner about the
   update, and the request will now show under the right tab.
7. As the manager, try the **Export CSV** button at the top.

---

### Notes & troubleshooting

- **"We couldn't find an account with that name"** on login — double check
  the exact spelling/spacing used at sign-up; names are matched exactly
  (but not case-sensitive).
- **Signup fails with a duplicate error** — that name is already taken, since
  every account needs a unique name for login to work. Add a middle name/initial.
- Every teacher only ever sees their own requests; only Regional Managers see
  everyone's — this is enforced by the database itself (Row Level Security),
  not just hidden in the interface.
- The Manager Access Code (`coolwebapp12`) is checked in the sign-up form; you
  can change it by editing `MANAGER_ACCESS_CODE` at the top of `js/auth.js`.
