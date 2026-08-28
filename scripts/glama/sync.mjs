// Uses the session saved by login.mjs to claim (if needed) and re-sync the
// Glama listing, so a stale scan (registrum-landscape market-competitors.md,
// 2026-08-28: Glama read v1.0.2/5 tools against a live v2.0.5/8 tools) can be
// fixed by running one command instead of clicking through glama.ai by hand
// every time the server ships new tools.
//
// Requires: node scripts/glama/login.mjs (once, or whenever the session expires)
// Run:      node scripts/glama/sync.mjs [--headless]
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { STATE_FILE } from "./login.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OVERVIEW_URL = "https://glama.ai/mcp/servers/vdmeu/registrum-mcp";
// Verified 2026-08-28, logged in: "Sync Server" lives under the Repository
// tab specifically, not the bare /admin root (which defaults to /profile
// and has no sync control at all - /admin/analytics and /admin/dockerfile
// don't either).
const ADMIN_URL = "https://glama.ai/mcp/servers/vdmeu/registrum-mcp/admin/repository";

/** Try a list of candidate locators in order; return the first that's visible, or null. */
async function firstVisible(page, candidates) {
  for (const locator of candidates) {
    try {
      if (await locator.isVisible({ timeout: 3000 })) return locator;
    } catch {
      // not present - try the next candidate
    }
  }
  return null;
}

async function main() {
  if (!existsSync(STATE_FILE)) {
    console.error(`No saved Glama session at ${STATE_FILE}.`);
    console.error("Run: node scripts/glama/login.mjs   (one-time interactive GitHub sign-in)");
    process.exit(1);
  }

  const headless = process.argv.includes("--headless");
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: STATE_FILE });
  const page = await context.newPage();

  // Step 1: claim the server if it isn't claimed yet. The overview page shows
  // "Claim" near the top when unclaimed (verified 2026-08-28, logged out) and
  // an admin panel link once it is.
  await page.goto(OVERVIEW_URL, { waitUntil: "networkidle" });

  const claimButton = await firstVisible(page, [
    page.getByRole("button", { name: /^claim$/i }),
    page.getByRole("link", { name: /^claim$/i }),
    page.getByText(/^claim$/i),
  ]);

  if (claimButton) {
    console.log("Found a 'Claim' control - claiming the server...");
    await claimButton.click();
    await page.waitForLoadState("networkidle");
  } else {
    console.log("No 'Claim' control found - assuming already claimed (or the label changed).");
  }

  // Step 2: trigger a manual re-sync from the admin panel.
  await page.goto(ADMIN_URL, { waitUntil: "networkidle" });

  const syncButton = await firstVisible(page, [
    page.getByRole("button", { name: /sync server/i }),
    page.getByRole("button", { name: /^sync$/i }),
    page.getByText(/sync server/i),
  ]);

  if (!syncButton) {
    const screenshotPath = path.join(__dirname, "state", "admin-page-debug.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(
      "Could not find a 'Sync Server' button. Saved a screenshot for debugging:\n  " + screenshotPath
    );
    console.error(
      "Either the saved session has expired (re-run login.mjs) or Glama changed the admin UI - " +
        "open the screenshot, find the real label/selector, and update the candidates in sync.mjs."
    );
    await browser.close();
    process.exit(1);
  }

  console.log("Found 'Sync Server' - clicking...");
  await syncButton.click();
  await page.waitForTimeout(3000);

  await browser.close();
  console.log("Sync triggered. Glama's scan runs asynchronously - re-check in a few minutes with:");
  console.log("  node scripts/glama/check.mjs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
