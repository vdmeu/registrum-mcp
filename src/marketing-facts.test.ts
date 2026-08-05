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
