# 5sFindr — Go-Live Runbook 🚀

A click-by-click checklist to stand up 5sFindr on **free Supabase + Paystack + Vercel**. Follow top to bottom. Total time ≈ 30–45 min.

> Order matters: **Supabase → Paystack plan → GitHub → Vercel deploy → wire the domain back**. The webhook and site URL need the live Vercel domain, so the deploy happens before the final wiring.

---

## 0. Accounts you need (all free)
- [ ] GitHub account
- [ ] Supabase account → https://supabase.com
- [ ] Paystack account → https://paystack.com (South African business)
- [ ] Vercel account → https://vercel.com (sign in with GitHub)

---

## 1. Supabase — database + auth

### 1.1 Create the project
1. https://supabase.com/dashboard → **New project**.
2. Name: `5sfindr`. Region: **choose the closest** (e.g. *West EU (London)* — there is no SA region; London/Frankfurt are closest for Cape Town).
3. Set a strong **database password** (save it somewhere; you won't need it for this app, but keep it).
4. Click **Create new project** and wait ~2 min for it to provision.

### 1.2 Run the schema (SQL Editor, copy-paste — in this exact order)
Left sidebar → **SQL Editor** → **+ New query**. For **each file below**, open it from this repo, copy the **entire** contents, paste into the editor, and click **Run**. Do them **one at a time, in order**:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_match_feed.sql`
3. `supabase/migrations/0003_nullable_coords.sql`
4. `supabase/migrations/0004_lifecycle.sql`
5. `supabase/migrations/0005_attendance.sql`
6. `supabase/seed.sql`  ← seeds the Cape Town venues

Each should report **Success. No rows returned** (or rows for the seed). If one errors, stop and fix before continuing — they build on each other.

> ⛔️ **Do NOT run anything in `supabase/tests/`** on your real project. `00_bootstrap.sql` is a *local-only* shim that fakes the auth schema; the real Supabase already has it and running the shim could conflict.

> 💡 Alternative (if you have the Supabase CLI + Docker): `supabase link --project-ref <ref>` then `npm run db:push`. The SQL-Editor copy-paste above needs neither.

### 1.3 Turn OFF email confirmation (critical)
Our signup flow logs the user in **instantly** (no confirmation email). If you skip this, signup will appear to hang.
1. Left sidebar → **Authentication** → **Sign In / Providers** (or **Providers → Email**).
2. **Disable "Confirm email"** (toggle off). Save.

### 1.4 Grab your API keys (you'll paste these into Vercel later)
1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy these three values and keep them handy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`  ⚠️ **secret** — never put this in client code or `NEXT_PUBLIC_*`.

*(Auth **Site URL** and redirect URLs are set in step 5, once you have the Vercel domain.)*

---

## 2. Paystack — subscriptions (R20/month, ZAR)

### 2.1 Get your API keys
1. https://dashboard.paystack.com → **Settings** → **API Keys & Webhooks**.
2. Start in **Test Mode** (toggle top-right). Copy:
   - **Secret Key** (`sk_test_…`) → `PAYSTACK_SECRET_KEY`
   - **Public Key** (`pk_test_…`) → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`

   > Note: our webhook verifies signatures using the **Secret Key** itself — there is **no separate webhook secret** to configure.

### 2.2 Create the R20/month plan
1. Left sidebar → **Products → Plans** → **Create Plan** (a.k.a. Subscriptions → Plans).
2. Set:
   - **Name:** `5sFindr Premium`
   - **Amount:** `20` (ZAR)  ← Paystack stores it as 2000 cents; our code sends `2000`.
   - **Interval:** `Monthly`
   - **Currency:** `ZAR`
3. Save, then open the plan and copy its **Plan Code** (`PLN_…`) → `PAYSTACK_PLAN_CODE`.

### 2.3 Webhook → **do this in step 5.3** (needs the Vercel URL).

---

## 3. Push the code to GitHub
From the project folder:
```bash
git remote add origin https://github.com/<you>/5sfindr.git
git push -u origin master
```
*(This repo's branch is `master`. If you prefer `main`: `git branch -M main && git push -u origin main`.)*

---

## 4. Vercel — deploy the PWA

### 4.1 Import
1. https://vercel.com/new → **Import** your `5sfindr` GitHub repo.
2. Framework: **Next.js** (auto-detected). Leave build/output defaults.

### 4.2 Add Environment Variables
Before clicking Deploy, expand **Environment Variables** and add each row below (Environment: **Production**, and tick **Preview**/**Development** too if you want previews to work). See the copy-paste block in §6.

### 4.3 Deploy
Click **Deploy**. When it finishes, copy your live URL, e.g. `https://5sfindr.vercel.app`.

---

## 5. Wire the live domain back (the final 3 connections)

### 5.1 Set the site URL and redeploy
1. Vercel → your project → **Settings → Environment Variables**.
2. Set `NEXT_PUBLIC_SITE_URL` = your live URL (e.g. `https://5sfindr.vercel.app`, or your custom domain).
3. **Deployments** → **⋯** on the latest → **Redeploy** (so the new value is baked in).

### 5.2 Tell Supabase about the domain
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://5sfindr.vercel.app`
- **Redirect URLs:** add `https://5sfindr.vercel.app/**`

### 5.3 Configure the Paystack webhook
Paystack → **Settings → API Keys & Webhooks** → **Webhook URL**:
```
https://5sfindr.vercel.app/api/webhooks/paystack
```
- Set it for **Test Mode** now (and again under **Live Mode** when you go live).
- Paystack sends **all events** to this URL; our handler only acts on `charge.success`, `subscription.create`, `invoice.payment_failed`, and `subscription.disable` / `subscription.not_renew`.
- Click the **Send test webhook** button (if shown) — you should get a 200.

---

## 6. The exact `.env` block (copy-paste)

Paste these into **Vercel → Settings → Environment Variables** (and into a local `.env` if you also run `npm run dev`). Replace every `<…>`:

```bash
# ── Supabase (from step 1.4) ──
NEXT_PUBLIC_SUPABASE_URL=<your Project URL, e.g. https://abcd1234.supabase.co>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon/public key>
SUPABASE_SERVICE_ROLE_KEY=<your service_role key — SECRET>

# ── Paystack (from step 2) ──
PAYSTACK_SECRET_KEY=<sk_test_… (also used to verify webhooks)>
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=<pk_test_…>
PAYSTACK_PLAN_CODE=<PLN_… from step 2.2>

# ── App (your live Vercel URL, from step 4.3) ──
NEXT_PUBLIC_SITE_URL=https://5sfindr.vercel.app
```

| Variable | Where it's used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server Supabase clients | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server (RLS-bound) | no |
| `SUPABASE_SERVICE_ROLE_KEY` | webhook only — trusted writes | **YES** |
| `PAYSTACK_SECRET_KEY` | start subscription + verify webhook HMAC | **YES** |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | reserved for client checkout | no |
| `PAYSTACK_PLAN_CODE` | links checkout to the R20/mo plan | no |
| `NEXT_PUBLIC_SITE_URL` | invite links, Paystack callback URL | no |

---

## 7. Smoke test (5 minutes on the live site)
- [ ] Open the site → landing page renders (dark, pitch-green).
- [ ] **Sign up** → you land on `/profile/edit` immediately (no email step).
- [ ] **Wallet** → shows **1 token** and **"30d left"** Premium trial. (Proves the DB trigger fired.)
- [ ] Switch to **Organizer** → **Create a match** at a seeded venue → it appears in your dashboard.
- [ ] Open the match → **Share to WhatsApp** produces a link `…/m/<slug>`.
- [ ] Open that `/m/<slug>` link in an incognito window → the public claim card shows.
- [ ] (Optional, second account) join the match → wallet shows the token moved to **committed**.
- [ ] **Go Premium** (test card `4084 0840 8408 4081`, any future expiry, any CVV) → after payment, Wallet flips to **Premium · active** (proves the webhook works).

---

## 8. When you're ready for real money (test → live)
1. Paystack → flip to **Live Mode**, complete business verification.
2. Recreate the **R20/mo plan** in Live Mode → new `PLN_…`.
3. Update Vercel envs to the **live** `sk_live_…` / `pk_live_…` / live plan code.
4. Set the **Live Mode** webhook URL (step 5.3) too.
5. Redeploy.

---

## Footnotes / optional hardening
- **Automatic match settlement:** today, a finished match settles *lazily* the first time anyone opens it (and via the organizer's "End match & settle" button). For hands-off closure, add a scheduled job later: enable **pg_cron** in Supabase and schedule `select settle_match(id) from matches where status in ('open','full') and ends_at < now();` every 15 min. Not required for launch.
- **Custom domain (`5sfindr.com`):** Vercel → Settings → Domains → add it; then update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL, and the Paystack webhook to the custom domain.
- **PWA icons:** add `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` (referenced by `manifest.json`) before launch so "Add to Home Screen" looks right.
