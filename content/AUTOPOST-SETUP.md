# Auto-posting setup (one time, about 1–2 hours, R0)

After this, your week is: **watch the videos → say "approve W48" in Claude Code → tap Post on one TikTok draft a day**.
Instagram and the Facebook Page post by themselves. Replies and DMs stay yours, and they're never automated.

**👤 = only you can do this step** (creating accounts, consent screens, tokens, the on switch). Claude must never enter
your passwords or create accounts for you. **🤖 = Claude can do it** when you ask.
Never paste a key or token into the chat. The helper scripts read them from a local file or a hidden prompt, and
save them straight into GitHub.

## How it works

```
/content-week (🤖)  → content/<week>/ posts + AI voice + renders + queue.json (unapproved)
you watch, then say "approve W48" (optionally "except 05")
npm run approve (🤖) → uploads the media to Supabase Storage (public bucket "content-media")
                     → marks queue.json approved (+ a hash of every caption, time and file)
                     → pushes it to the `content-queue` branch
GitHub Action, every ~15 min (free) → posts due items: Instagram Reels/carousels + Facebook Page Reels/photos
                     → TikTok: uploads the video to your TikTok inbox as a DRAFT, 30 min before the post time,
                       and comments the caption to paste on the "Content publisher" GitHub issue
you (≈1 min/day)     → TikTok app: open the draft, paste caption, AI label on, Post
you (15 min/day)     → replies, DMs, stories. Manual, always.
```

Fail-safes: nothing posts while the repo variable `CONTENT_PUBLISH_ENABLED` isn't `true`, while a week isn't approved,
or if `queue.json` changed after approval. Items more than 3 h late are skipped, not posted. A post that was mid-upload
when a run died is never retried blindly: you get a "check this" comment instead.

---

## 1. Supabase media bucket (10 min)

Meta's API only accepts media from a public URL, so approved videos and slides go to a public Storage bucket on the
existing 5sFindr Supabase project for a few days.

1. 👤 Supabase dashboard → 5sFindr project → **Project Settings → API Keys** → copy the **service_role** key
   (or a new **secret** key). It's full admin access to the project, so it stays on your Mac only.
2. 👤 Create `content/.env.local` (git ignores it) and put this in it:
   ```
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<paste here>
   ```
3. 🤖 Nothing else. The first `npm run approve` creates the public bucket `content-media` (50 MB per file, MP4/JPEG only).

Free tier: 1 GB storage and 5 GB egress a month. A week is about 250 MB, and each file is fetched about 3 times
(Instagram, Facebook, the TikTok upload), so about 0.75 GB a week. Each approval deletes the files of earlier weeks that
have finished. To delete them right after posting instead, also add the two values as GitHub secrets (§4.3, optional).

## 2. Meta: Instagram + Facebook Page (30–45 min)

You already have an Instagram professional account linked to the 5sFindr Facebook Page. One **Page token** (it never
expires) posts to both, through the "Instagram API with Facebook Login".

1. 👤 Check the link: Meta Business Suite → Settings → Accounts → Instagram accounts shows the 5sFindr account
   connected to the Page.
2. 👤 developers.facebook.com → **My Apps → Create app**. Name it "5sFindr Publisher". Pick the use cases for
   **managing everything on your Page** and **managing content on Instagram** (Meta renames these screens often: pick
   whatever covers Page posts + Instagram publishing via Facebook Login). Attach it to the 5sFindr business portfolio if
   asked.
3. 👤 In the app, make sure these permissions are added (Use cases → Customise / Permissions):
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`,
   `business_management`.
4. 👤 **App settings → Basic:** Privacy policy URL `https://5sfindr.com/privacy`, a data deletion URL (the same page
   is fine for now), an app icon and a category. Save.
5. 👤 **Switch the app to Live** (toggle at the top). This matters: while an app is in *Development* mode, posts it
   makes are visible only to people with a role on the app. Because you're the app's admin and you post only to your
   own Page and Instagram, Standard Access is enough and no App Review is needed.
   **If Meta insists on App Review or Business Verification before it lets you go Live, stop and tell Claude.** Until
   then, keep scheduling Meta posts in Business Suite (see "Manual fallback" at the bottom).
6. 👤 Copy the **App ID** and **App Secret** into `content/.env.local`:
   ```
   META_APP_ID=…
   META_APP_SECRET=…
   ```
7. 👤 In Terminal, in the repo folder (needs the GitHub CLI logged in as you: `gh auth status`):
   ```bash
   node content/publisher/connect.mjs meta
   ```
   It walks you through Graph API Explorer (you click Allow), swaps the short token for a never-expiring Page token,
   finds the Page and Instagram IDs, and saves `META_PAGE_TOKEN`, `META_PAGE_ID` and `META_IG_USER_ID` as GitHub
   secrets. It never shows the token. If it says the Page token "expires", run it again with a freshly generated token.

AI label: Instagram gets Meta's "AI info" label through the API (`is_ai_generated`). Facebook Reels have no API field for
it, so the caption says "AI voiceover." and the video carries an "AI VOICE" chip.

## 3. TikTok: drafts to your inbox (30 min + TikTok's review wait)

TikTok only lets apps that passed its audit post publicly. Apps that haven't can **upload to your inbox** (a draft
you finish in the app). That's what we use: you get a notification, paste the caption and tap Post.

1. 👤 developers.tiktok.com → log in → **Manage apps → Connect an app**. Name "5sFindr Publisher", category
   Utilities/Productivity, description "Uploads 5sFindr's own videos to the 5sFindr TikTok account as drafts".
   Website `https://5sfindr.com`, Privacy policy `https://5sfindr.com/privacy`. TikTok also asks for a Terms of
   Service URL; there's no terms page yet. Ask Claude to add a short `/terms` page, or use the privacy URL if TikTok
   accepts it.
2. 👤 Add products: **Login Kit** with redirect URI `https://5sfindr.com/`, and **Content Posting API**. Scopes:
   `user.info.basic` and `video.upload`. Leave **Direct Post off**: we never use it.
3. 👤 Start in **Sandbox**: add the 5sFindr TikTok account as a *target user*. Sandbox has its own client key and
   secret. Then **Submit for review** for production: say it uploads your own videos to your own inbox as drafts. It's
   free and typically takes a few days. TikTok's docs don't clearly say whether inbox upload works for an unreviewed
   production app, so test in Sandbox and switch keys after approval.
4. 👤 Put the client key and secret (sandbox ones first) in `content/.env.local`:
   ```
   TIKTOK_CLIENT_KEY=…
   TIKTOK_CLIENT_SECRET=…
   ```
5. 👤 Run, logged in to the 5sFindr TikTok account in your browser:
   ```bash
   node content/publisher/connect.mjs tiktok
   ```
   Open the link, approve, copy the address you land on (`https://5sfindr.com/?code=…`) and paste it. It saves
   `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` and `TIKTOK_REFRESH_TOKEN` as GitHub secrets. The refresh token lasts
   365 days. Redo this step when you swap sandbox keys for production ones.
6. 👤 Optional, recommended: TikTok sometimes issues a new refresh token. To let the publisher save it by itself,
   create a **fine-grained GitHub token** (github.com → Settings → Developer settings → Fine-grained tokens) for this
   repo only, with **Secrets: Read and write**, and add it as the secret `GH_ADMIN_TOKEN`
   (`gh secret set GH_ADMIN_TOKEN`). Without it, the publisher comments asking you to redo step 5.

## 4. GitHub: switch it on (10 min)

1. 👤 Merge PR #9 (`content-engine`). Scheduled workflows only run from `main`. Until the switch in step 5 is on, every
   run is a dry run that only prints.
2. 👤 Check what's set:
   ```bash
   node content/publisher/connect.mjs check
   ```
3. Optional secrets: `GH_ADMIN_TOKEN` (§3.6), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (delete media right after
   posting; otherwise the next approval cleans up).
4. 👤/🤖 GitHub → **Actions → Content publisher → Run workflow** (dry run ticked) → open the run and read what it would
   post. Claude can trigger this too: `gh workflow run content-publish.yml -f dry_run=true`.
5. 👤 **The on switch:** Settings → Secrets and variables → Actions → **Variables** → New repository variable
   `CONTENT_PUBLISH_ENABLED` = `true`. Delete it (or set it to `false`) to stop all posting immediately.
6. 👤 After the first TikTok draft, GitHub opens the issue "Content publisher: TikTok drafts and alerts". Subscribe to it
   and install the GitHub mobile app, so each draft (with its caption) and each alert reaches your phone.

First live week: approve with most posts excluded (e.g. only one carousel) and check it on Instagram and Facebook
before approving a full week.

## Weekly loop (after setup)

| When | Who | What |
|---|---|---|
| Fri/Sat | 🤖 | `/content-week`: posts, AI voice, renders, `queue.json` (unapproved), `REVIEW.md` |
| Sat/Sun (~20 min) | 👤 | Watch the videos and slides. Then say **"approve W48"** (or "approve W48 except 05 and 07 on TikTok") |
| Same time | 🤖 | `npm run approve 2026-W48 -- --exclude 05,07/tiktok` → upload + approve + push |
| Daily, 30 min before TikTok time | 🤖 | Draft lands in your TikTok inbox + GitHub comment with the caption |
| Daily (~1 min) | 👤 | TikTok: open draft → paste caption → AI-generated content on → (sound) → Post |
| Daily (15 min) | 👤 | Replies, DMs, stories |

To pull a post after approving: tell Claude "pull 05 from W48". It re-approves the week with 05 excluded. If something
is already live, delete it in the app.

## Limits and good to know

- Instagram: 100 API posts per 24 h (we use ≤ 2). Facebook Reels: 30 per 24 h. TikTok: 6 upload requests a minute.
- GitHub's cron runs can be 5–20 min late. Times in `queue.json` are SAST (`+02:00`).
- GitHub pauses scheduled workflows in public repos after 60 days with no activity. Weekly approvals push to
  `content-queue`, which counts as activity.
- Graph API version: `v25.0` by default. Set the repo variable `META_GRAPH_VERSION` to change it. If Meta ever rejects
  `is_ai_generated`, set the variable `META_AI_FLAG=off` (the caption line and chip still disclose it).
- `content-queue` holds only queue files and logs. It has a `vercel.json` that turns off Vercel builds for that
  branch. Never merge it into `main`.
- Logs: `content/<week>/published.json` on `content-queue` (status, link, error per item).

## Manual fallback (if an API route is blocked)

Meta: Business Suite → Planner, with captions and alt text from `post.md`, and "AI info" on for AI-voice posts.
TikTok: tiktok.com/tiktokstudio/upload → Schedule. Everything else in the weekly loop stays the same.
