#!/usr/bin/env node
// Connect the accounts once. ZORAN runs this in his own terminal (the consent screens and tokens are his).
// It never prints a token: it saves them straight into the repo's GitHub Actions secrets with `gh secret set`.
//
//   node content/publisher/connect.mjs meta     # Page token (never expires) + Page ID + Instagram user ID
//   node content/publisher/connect.mjs tiktok   # TikTok refresh token (365 days) with the video.upload scope
//   node content/publisher/connect.mjs check    # read-only: which secrets/variables exist
//
// Reads app IDs/secrets from content/.env.local (never committed):
//   META_APP_ID, META_APP_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, [TIKTOK_REDIRECT_URI=https://5sfindr.com/]
// Needs the GitHub CLI logged in as Zoran (`gh auth status`). Details: content/AUTOPOST-SETUP.md.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(here, "..");
const repoDir = path.resolve(contentDir, "..");
const GV = process.env.META_GRAPH_VERSION || "v25.0";
const env = { ...process.env };
const envFile = path.join(contentDir, ".env.local");
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Hidden: print the prompt, then mute every later write. (Checking "does it start with the
    // prompt?" is not enough: on a paste readline redraws prompt + line, which echoed the secret.)
    let muted = false;
    if (hidden) rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); };
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a.trim());
    });
    if (hidden) muted = true; // question() wrote the prompt synchronously above
  });
}
function need(...keys) {
  const miss = keys.filter((k) => !env[k]);
  if (miss.length) {
    console.error(`Add ${miss.join(", ")} to content/.env.local first (see content/AUTOPOST-SETUP.md).`);
    process.exit(1);
  }
}
function setSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name], { cwd: repoDir, input: value, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`gh secret set ${name} failed: ${r.stderr}`);
  console.log(`✓ GitHub secret ${name} saved`);
}
async function getJson(url, init) {
  const r = await fetch(url, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message ?? j.error_description ?? JSON.stringify(j.error ?? r.status));
  return j;
}

async function meta() {
  need("META_APP_ID", "META_APP_SECRET");
  console.log(
    [
      "1. Open https://developers.facebook.com/tools/explorer/ and pick your app (top right).",
      '2. "User or Page" → Get User Access Token, with these permissions:',
      "   pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish, business_management",
      "3. Generate Access Token → allow it for the 5sFindr Page and Instagram account → copy the token.",
      "",
    ].join("\n"),
  );
  const short = await ask("Paste the user token (hidden): ", { hidden: true });
  const g = (p, params) => getJson(`https://graph.facebook.com/${GV}/${p}?${new URLSearchParams(params)}`);
  const long = await g("oauth/access_token", { grant_type: "fb_exchange_token", client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, fb_exchange_token: short });
  const pages = (await g("me/accounts", { access_token: long.access_token, fields: "id,name,access_token,instagram_business_account{id,username}" })).data ?? [];
  if (!pages.length) throw new Error("No Pages on this login. Did you tick the 5sFindr Page on the consent screen?");
  pages.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}${p.instagram_business_account ? ` (Instagram @${p.instagram_business_account.username})` : " (no Instagram linked)"}`));
  const pick = pages.length === 1 ? pages[0] : pages[Number(await ask("Which Page? number: ")) - 1];
  if (!pick?.instagram_business_account) throw new Error("That Page has no linked Instagram professional account. Link it in Meta Business Suite → Settings → Accounts.");
  const dbg = await g("debug_token", { input_token: pick.access_token, access_token: `${env.META_APP_ID}|${env.META_APP_SECRET}` });
  const exp = dbg.data?.expires_at;
  console.log(`  Page token: ${exp === 0 ? "never expires ✓" : `expires ${new Date(exp * 1000).toISOString()} (expected "never": redo with a fresh token)`}; scopes: ${(dbg.data?.scopes ?? []).join(", ")}`);
  setSecret("META_PAGE_TOKEN", pick.access_token);
  setSecret("META_PAGE_ID", pick.id);
  setSecret("META_IG_USER_ID", pick.instagram_business_account.id);
}

async function tiktok() {
  need("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET");
  const redirect = env.TIKTOK_REDIRECT_URI || "https://5sfindr.com/";
  const state = crypto.randomBytes(12).toString("hex");
  const url = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, scope: "user.info.basic,video.upload", response_type: "code", redirect_uri: redirect, state })}`;
  console.log(`1. Open this link while logged in to the 5sFindr TikTok account, and approve:\n\n${url}\n`);
  console.log(`2. You land on ${redirect}?code=… Copy the WHOLE address from the address bar.\n`);
  const back = new URL(await ask("Paste the address (hidden): ", { hidden: true }));
  if (back.searchParams.get("state") !== state) throw new Error("state doesn't match: start again");
  const code = back.searchParams.get("code");
  if (!code) throw new Error(`no code in that address (${back.searchParams.get("error") ?? "?"})`);
  const j = await getJson("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code, grant_type: "authorization_code", redirect_uri: redirect }),
  });
  if (!String(j.scope ?? "").includes("video.upload")) throw new Error(`granted scopes are "${j.scope}": video.upload is missing (add the Content Posting API product to the app)`);
  console.log(`  scopes: ${j.scope}; refresh token valid ${Math.round(j.refresh_expires_in / 86400)} days`);
  setSecret("TIKTOK_CLIENT_KEY", env.TIKTOK_CLIENT_KEY);
  setSecret("TIKTOK_CLIENT_SECRET", env.TIKTOK_CLIENT_SECRET);
  setSecret("TIKTOK_REFRESH_TOKEN", j.refresh_token);
}

function check() {
  const s = spawnSync("gh", ["secret", "list"], { cwd: repoDir, encoding: "utf8" });
  const v = spawnSync("gh", ["variable", "list"], { cwd: repoDir, encoding: "utf8" });
  if (s.status !== 0) throw new Error(`gh secret list failed: ${s.stderr}`);
  const have = new Set(s.stdout.split("\n").map((l) => l.split(/\s/)[0]));
  for (const k of ["META_PAGE_TOKEN", "META_PAGE_ID", "META_IG_USER_ID", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN", "GH_ADMIN_TOKEN (optional)", "SUPABASE_URL (optional)", "SUPABASE_SERVICE_ROLE_KEY (optional)"]) {
    console.log(`${have.has(k.split(" ")[0]) ? "✓" : "·"} secret ${k}`);
  }
  const enabled = v.stdout.split("\n").find((l) => l.startsWith("CONTENT_PUBLISH_ENABLED"));
  console.log(`${enabled?.includes("true") ? "✓ LIVE" : "· dry-run only"}: variable CONTENT_PUBLISH_ENABLED ${enabled ? `= ${enabled.split(/\s+/)[1]}` : "not set"}`);
}

const cmd = process.argv[2];
try {
  if (cmd === "meta") await meta();
  else if (cmd === "tiktok") await tiktok();
  else if (cmd === "check") check();
  else console.log("Usage: node content/publisher/connect.mjs meta | tiktok | check");
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
