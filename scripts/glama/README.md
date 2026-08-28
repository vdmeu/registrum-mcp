# Glama listing drift tooling

Automates the manual re-check that came out of punkpeye/awesome-mcp-servers#13051:
Glama's scan of our server can go stale (it read v1.0.2 / 5 tools while we
actually ship v2.0.5 / 8 tools - `registrum-landscape/market-competitors.md`,
2026-08-28), and fixing it required clicking through glama.ai by hand. This
makes the check automatic and the fix a single command instead of a repeat
manual investigation.

## Three scripts, two of which need no login

| Script | Needs login? | What it does |
|---|---|---|
| `check.mjs` | No | Reads Glama's public pages and compares them to the live `server.ts` tool list and `package.json` version. Exit code 1 if stale. Safe for CI/schedules. |
| `login.mjs` | **Yes - once** | Opens a real browser window so you can sign in to Glama with GitHub. Saves the session to `state/glama-auth.json` (gitignored - treat it like a credential). Re-run whenever the session expires (`sync.mjs` will tell you). |
| `sync.mjs` | Uses the saved session | Claims the listing if unclaimed, then clicks "Sync Server" so Glama re-scans against the current code. |

## Usage

```bash
# Anytime, no login: see whether Glama's listing is stale
node scripts/glama/check.mjs
node scripts/glama/check.mjs --json   # machine-readable

# One-time (or after the session expires): sign in
node scripts/glama/login.mjs

# After shipping new tools, or whenever check.mjs reports drift:
node scripts/glama/sync.mjs
node scripts/glama/check.mjs   # re-check a few minutes later - the scan is async
```

## Why this shape, not a fully headless one-shot

Glama has no API-key path for claiming a listing or forcing a re-sync (checked
2026-08-28 - `/admin` is a plain sign-up wall, and the public API needs its
own separate key just to *read* data). GitHub OAuth login itself has to happen
in a real browser at least once. Everything downstream of that one login is
now a command instead of a repeat manual walkthrough.

If `sync.mjs` can't find the "Sync Server" button (Glama changed their UI, or
the session expired), it saves a screenshot to `state/admin-page-debug.png`
and tells you what to check rather than failing silently.
