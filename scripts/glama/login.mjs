// One-time interactive login: opens a real (headed) browser window so Eugene
// can sign in to Glama with GitHub once, then saves the session so
// scripts/glama/sync.mjs can act on it later without asking him to click
// through the UI again.
//
// This is the only step that has to be a human: GitHub OAuth requires
// completing 2FA/consent in a real browser, and Glama has no API-key path for
// claiming or re-syncing a server (checked 2026-08-28 - the admin page is a
// plain sign-up wall, and the public API needs its own separate key).
//
// Run: node scripts/glama/login.mjs
// Then: node scripts/glama/sync.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = path.join(__dirname, "state");
export const STATE_FILE = path.join(STATE_DIR, "glama-auth.json");

async function main() {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });

  console.log("Opening a browser window. Sign in to Glama with GitHub, then come back here.");
  console.log("This window will close itself once you reach a signed-in Glama page.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://glama.ai/mcp/servers/vdmeu/registrum-mcp/admin");

  // Poll for a sign of being logged in: the admin page stops being a sign-up
  // wall and starts showing the server's own admin controls (e.g. a "Claim"
  // or "Sync Server" button, or the account menu). We don't know the exact
  // DOM until a real session gets there, so this waits generously and lets a
  // human confirm rather than guessing a brittle selector.
  console.log("Waiting for you to finish signing in (up to 5 minutes)...");
  try {
    await page.waitForURL((url) => !url.pathname.includes("/sign-in") && !url.pathname.includes("/sign-up"), {
      timeout: 5 * 60 * 1000,
    });
  } catch {
    console.log("Timed out waiting - saving whatever session state exists anyway. Re-run if sync.mjs fails.");
  }

  // Give the post-login redirect a moment to settle before snapshotting cookies.
  await page.waitForTimeout(2000);

  await context.storageState({ path: STATE_FILE });
  await browser.close();

  console.log(`\nSaved session to ${STATE_FILE} (gitignored - this is a live login, treat it like a credential).`);
  console.log("Run: node scripts/glama/sync.mjs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
