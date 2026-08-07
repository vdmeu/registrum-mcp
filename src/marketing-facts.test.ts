import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Scaffold for marketing copy that goes stale (Eugene, 2026-08-05:
 * "what other places do we have outdated marketing information: this all needs
 * to be tightened in a testing scaffold").
 *
 * Every instance found so far shared one cause: **a fact was copied away from
 * its source**. The npm README said 5 tools when there were 7 and quoted Pro at
 * 2,000 calls when it was 4,000. smithery.yaml described 3 of 8 tools.
 * RAPIDAPI-LISTING.md still advertises a Starter GBP 19 tier dropped in March.
 *
 * The website, by contrast, is healthy - it calls GET /v1/plans at render time
 * and only falls back to a literal if the API is unreachable. That is the
 * pattern these tests enforce: link to the authority, do not restate it.
 *
 * Authorities: GET /v1/plans (pricing), openapi.json (endpoints), server.ts
 * (tools). Tests stay offline; the live diff runs in the scheduled
 * endpoint-drift workflow.
 */
const root = path.resolve(__dirname, "..");
const read = (f: string) => (existsSync(path.join(root, f)) ? readFileSync(path.join(root, f), "utf-8") : null);

const toolNames = [...(read("src/server.ts") ?? "").matchAll(/registerTool\(\s*\n?\s*["']([a-z_]+)["']/g)].map((m) => m[1]);

/** Files that describe the product to a potential customer. */
const MARKETING_SURFACES = ["README.md", "smithery.yaml", "server.json"];

describe("marketing copy cannot hardcode prices", () => {
  // Prices live in GET /v1/plans. Every stale price we have found was a copy.
  for (const file of MARKETING_SURFACES) {
    it(`${file} quotes no GBP price`, () => {
      const content = read(file);
      if (content === null) return;
      const prices = content.match(/[£$]\s?\d+(?:[.,]\d+)?/g) ?? [];
      expect(
        prices,
        `${file} hardcodes ${prices.join(", ")}. Link to GET /v1/plans instead - ` +
          `a copied price is how the README ended up advertising a 2,000-call Pro tier that was 4,000.`
      ).toEqual([]);
    });
  }

  it("does not advertise plan tiers that no longer exist", () => {
    // "Starter" was dropped 2026-03-03 and still appears in RAPIDAPI-LISTING.md.
    const dead = ["starter"];
    for (const file of MARKETING_SURFACES) {
      const content = (read(file) ?? "").toLowerCase();
      for (const tier of dead) {
        expect(content.includes(`${tier} plan`) || content.includes(`| ${tier}`), `${file} mentions the dead "${tier}" tier`).toBe(false);
      }
    }
  });
});

describe("capability claims match the tools that actually exist", () => {
  it("the tool list is non-empty (guards the parser itself)", () => {
    expect(toolNames.length).toBeGreaterThan(5);
  });

  it("README documents every registered tool", () => {
    const readme = read("README.md") ?? "";
    const undocumented = toolNames.filter((t) => !readme.includes(t));
    expect(
      undocumented,
      `tools missing from README: ${undocumented.join(", ")}`
    ).toEqual([]);
  });

  it("README states no tool count, which would need updating by hand", () => {
    // It previously said "5 tools" and stayed that way through two releases.
    const readme = read("README.md") ?? "";
    expect(readme).not.toMatch(/\b\d+\s+tools\b/i);
  });

  it("smithery.yaml describes the current capability set, not March's", () => {
    const smithery = read("smithery.yaml");
    if (smithery === null) return;
    const lower = smithery.toLowerCase();
    // Headline capabilities a listing must not omit.
    for (const claim of ["compliance", "psc", "search"]) {
      expect(lower.includes(claim), `smithery.yaml never mentions "${claim}"`).toBe(true);
    }
  });
});

/**
 * The hosted anonymous endpoint is the whole funnel argument (vdmeu/CH-Api#80).
 *
 * Every surface here spent five months telling people to install a package and
 * supply an API key, which is the exact step 74% of signups died at, and it
 * stayed that way for a full day after the keyless endpoint went live. These
 * assertions exist so a revert to key-first copy fails a test instead of
 * quietly costing a month of a pre-registered gate.
 */
describe("marketing copy leads with the keyless hosted endpoint", () => {
  const HOSTED_URL = "https://registrum.co.uk/api/mcp";

  it("README publishes the hosted URL", () => {
    expect(read("README.md")).toContain(HOSTED_URL);
  });

  it("README offers the hosted endpoint before the npx install", () => {
    const readme = read("README.md")!;
    const npxAt = readme.indexOf("npx");
    expect(npxAt, "expected the README to still document the npx path somewhere").toBeGreaterThan(-1);
    expect(
      readme.indexOf(HOSTED_URL),
      "the no-signup path must come first - a reader who hits `npx` and an API " +
        "key requirement before the free option has already been lost"
    ).toBeLessThan(npxAt);
  });

  it("README says a key is optional, not required", () => {
    const readme = read("README.md")!;
    expect(readme).toMatch(/no signup|no key|without an account/i);
  });

  it("smithery.yaml declares the hosted transport, not stdio", () => {
    const yaml = read("smithery.yaml")!;
    expect(yaml).toContain(HOSTED_URL);
    expect(
      yaml,
      "a stdio listing advertises an install step the hosted endpoint removed"
    ).not.toMatch(/type:\s*stdio/);
  });

  it("smithery.yaml requires no apiKey to get started", () => {
    const yaml = read("smithery.yaml")!;
    // `required: []` or no required block at all; what must not appear is a
    // required apiKey, which is what the listing carried until 2026-08-07.
    expect(yaml).not.toMatch(/required:\s*\n\s*-\s*apiKey/);
  });

  it("every surface points at the same hosted URL", () => {
    for (const file of ["README.md", "smithery.yaml"]) {
      const content = read(file);
      if (!content || !content.includes("/api/mcp")) continue;
      const urls = [...content.matchAll(/https:\/\/[^\s"')]+\/api\/mcp/g)].map((m) => m[0]);
      for (const u of urls) expect(u, `${file} points at ${u}`).toBe(HOSTED_URL);
    }
  });
});
