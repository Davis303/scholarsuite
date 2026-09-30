# DEPLOY.md — Deploying ScholarSuite (no technical experience needed)

This guide takes you from zero to a live ScholarSuite app on the internet.
You will create two free accounts (Supabase and Vercel), paste one database
file, fill in a settings page, and click Deploy. Each step tells you exactly
what to click. Budget roughly 30–45 minutes the first time.

What you end up with: your own private web app at an address like
`https://your-app-name.vercel.app`, with your own database, ready for you to
create the first user account.

---

## Step 1 — Create your database (Supabase)

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
   (or **Sign in** if you already have an account). Sign up with email or GitHub.
2. On your dashboard, click **New project**.
3. Fill in:
   - **Name**: `scholarsuite` (anything you like)
   - **Database Password**: click **Generate a password** and save it somewhere
     safe (a password manager). You rarely need it, but don't lose it.
   - **Region**: pick the one closest to you/your users.
   - **Pricing Plan**: **Free**.
4. Click **Create new project** and wait — provisioning takes about 1–2
   minutes. You'll see a progress screen, then your project dashboard.
5. Copy three values — you'll need them later:
   - In the left sidebar click **Settings** (gear icon) → **API**.
   - Copy **Project URL** (e.g. `https://xyzcompany.supabase.co`).
   - Copy the **anon public** key (long string starting with `eyJ...`).
   - Copy the **service_role** key (also starts with `eyJ...`; click
     **Reveal** to see it). **Treat this one like a password — never share
     it or paste it anywhere public.**

Keep these three in a safe note for now.

## Step 2 — Create the database tables (one paste, one click)

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. On your computer, open the file `supabase/migrations/0001_init.sql` from
   the ScholarSuite repo, select **everything** (Ctrl+A / Cmd+A), and copy it.
4. Paste it into the SQL Editor and click **Run** (bottom-right).

**What success looks like:** a green banner saying something like
"Success. No rows returned" and the query runs without errors. You can verify:
click **Table Editor** in the left sidebar — you should now see tables named
`profiles`, `documents`, `reviews`, `matched_passages`, `writing_docs`, and
others.

If you see red errors instead, see **Troubleshooting → Migration errors** below.

## Step 3 — Put the code on GitHub, then connect Vercel

You need the code in a GitHub repository so Vercel can deploy it.

1. Go to [github.com](https://github.com) and sign in (create a free account
   if needed). Click **+** (top-right) → **New repository**. Name it
   `scholarsuite`, leave it **Private**, click **Create repository**.
2. On your computer, open a terminal in the ScholarSuite folder and run these
   three commands (replace `YOUR-USERNAME` with your GitHub username):

   ```bash
   git init
   git add .
   git commit -m "Initial ScholarSuite release"
   ```

   then:

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/scholarsuite.git
   git branch -M main
   git push -u origin main
   ```

   (If your terminal asks for a password, use a GitHub **Personal Access
   Token**, not your account password — GitHub will tell you if that's the
   case.)

3. Go to [vercel.com](https://vercel.com) and sign up for a free account
   (easiest: **Continue with GitHub** — this also links your repos).
4. On the Vercel dashboard click **Add New…** → **Project**.
5. Under **Import Git Repository**, find `scholarsuite` and click **Import**.
6. **Do not click Deploy yet** — first add the environment variables (Step 4).

> **Alternative (no GitHub):** install the Vercel CLI (`npm i -g vercel`),
> run `vercel` in the project folder, and follow the prompts. You will still
> need to add the environment variables below.

## Step 4 — Add the environment variables in Vercel

On the Vercel **Configure Project** screen (before first deploy), open the
**Environment Variables** section and add each row below. Set each one for
**Production** (and Preview/Development if you like — Production is the one
that matters).

| Variable | Where to find the value | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → **Project URL** (from Step 1) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon public** (from Step 1) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (from Step 1) | Yes |
| `NEXT_PUBLIC_APP_NAME` | Type `ScholarSuite` (or your brand name — see Step 9) | Yes |
| `NEXT_PUBLIC_APP_URL` | Leave blank for now — you'll fill this in at Step 5 | Yes (after deploy) |
| `LLM_API_KEY` | Only if you want AI writing features — see Step 7 | No |
| `LLM_MODEL` | e.g. `gpt-4o-mini` — only with `LLM_API_KEY` | No |
| `LLM_BASE_URL` | Only if your AI provider isn't OpenAI | No |
| `MAX_UPLOAD_MB` | Optional — type `25` if you want to be explicit | No |
| `CRON_SECRET` | Only if you enable scheduled cleanup — see Step 8 | No |

Type each name **exactly** as shown (capital letters, underscores). Then click
**Deploy**. The build takes a few minutes — you'll see logs scrolling, then
confetti and a **live URL** like `https://scholarsuite-xyz.vercel.app`.

## Step 5 — Point the app at its own URL and redeploy

Email verification links are built from `NEXT_PUBLIC_APP_URL`, so it must
match your real address:

1. Copy your live Vercel URL (the one from the end of Step 4).
2. In Vercel, open your project → **Settings** → **Environment Variables**.
3. Edit `NEXT_PUBLIC_APP_URL` and set it to that URL
   (e.g. `https://scholarsuite-xyz.vercel.app` — no trailing slash).
4. Go to **Deployments**, click the **⋯** menu on the latest deployment →
   **Redeploy**. Wait for it to finish.

Your app is now fully live.

## Step 6 — Create your first user

1. Open your live URL and click **Sign up**.
2. Enter your email and a password, and submit.
3. Check your inbox for the verification email and click the link
   (this is the link Step 5 fixed — if it goes to the wrong address, recheck
   `NEXT_PUBLIC_APP_URL`).
4. Sign in. You should land on the Dashboard with an empty workspace.

Congratulations — the app is yours and working.

## Step 7 — (Optional) Enable the AI writing features

The Similarity Review Workspace works completely without this. The Writing
Assistant's **AI editing and Deep Proofread** features need an API key from an
OpenAI-compatible AI provider:

1. Create an account with a provider (e.g. [platform.openai.com](https://platform.openai.com)),
   add a payment method or credit, and create an **API key**.
2. In Vercel: project → **Settings** → **Environment Variables** → add
   `LLM_API_KEY` with that key (and optionally `LLM_MODEL`, e.g.
   `gpt-4o-mini`).
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variable takes effect.

Notes: the provider bills you for actual usage (typically a few cents per
document); keys are server-only and never shown to app users. Without the key,
the AI routes show a clear notice and everything else keeps working.

## Step 8 — (Optional) Automatic data deletion on a schedule

In Settings → Privacy, users can set how long their data is kept
(`retention_days`) and turn on auto-delete. For deletions to happen
automatically, enable Vercel Cron:

1. Make sure the repo has a `vercel.json` file containing a cron entry that
   calls `/api/cron/cleanup` on a schedule (e.g. daily). If it's missing, the
   cleanup endpoint simply won't run on a schedule.
2. Invent a long random secret (e.g. 32 random letters/numbers from a password
   generator) and add it in Vercel as the `CRON_SECRET` environment variable.
3. The scheduled job must present that secret to `/api/cron/cleanup` (in the
   way the route expects — check the route code) — without it, the endpoint
   refuses to run.
4. Redeploy.

Without this step, retention settings still work — deletions just won't happen
until you trigger the endpoint yourself.

## Step 9 — Renaming the brand + adding a custom domain

**Rename the brand** (3 places):

1. Change `NEXT_PUBLIC_APP_NAME` in Vercel environment variables to your name,
   then redeploy.
2. Replace `public/logo.svg` and `public/favicon.svg` in the repo with your
   own logo files (keep the same filenames), commit, and push — Vercel
   redeploys automatically.
3. Edit the landing-page text in `app/page.tsx` and the site title in
   `app/layout.tsx`.

**Custom domain** (e.g. `app.yourdomain.com` — requires a domain you own):

1. In Vercel: project → **Settings** → **Domains** → add your domain.
2. Vercel shows you DNS records to add at your domain registrar; follow them,
   wait for verification (minutes to hours).
3. Update `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com` and redeploy.

---

## Troubleshooting

**1. "Something's not working and I suspect an environment variable."**
The #1 cause of deploy problems is a typo in a variable name or a value pasted
with an extra space. Go to Vercel → Settings → Environment Variables and check
each name character-by-character against the table in Step 4. After fixing
anything, **redeploy** — environment changes never apply to an existing
deployment. Also confirm each variable is enabled for the **Production**
environment.

**2. The SQL migration shows red errors.**
Most often this is because the script was run twice, or only partially pasted.
Error mentioning "already exists"? It's likely safe — check the Table Editor
to confirm the tables are there. Any other error: create a fresh query, paste
the **entire** `0001_init.sql` file again (select all, don't miss the end),
and run once. If errors persist, copy the exact error message — it names the
line that failed.

**3. The sign-up verification email goes to the wrong address (or 404s).**
`NEXT_PUBLIC_APP_URL` doesn't match your live URL. Fix it in Vercel →
Settings → Environment Variables (exactly `https://your-url.vercel.app`, no
trailing slash), then redeploy and sign up again with a fresh email.

**4. The Vercel build fails.**
Open the failed deployment's **Build Logs** and read the first red error. The
usual culprits: a file committed with an import typo, or a missing
dependency. The build must pass with `npm run build` locally before pushing.
If the error mentions an environment variable, see issue 1.

**5. "I signed in but my documents/reviews list is empty / I see no rows."**
This is almost always correct behavior, not a bug: the app enforces strict
per-user privacy (Row-Level Security), so you only ever see **your own**
data. A brand-new account legitimately has nothing yet — upload a document to
see it appear. If you uploaded something and it still doesn't appear, make
sure you're signed in with the same account you used to upload, and that
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel match
the Supabase project where you ran the migration.

---

Still stuck? Re-read the step where things diverged, and check the Vercel
deployment logs — they usually name the exact problem. The technical reference
for every variable is `.env.example` in the repo root.
