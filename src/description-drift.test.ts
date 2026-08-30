import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  terminalReasonsFrom,
  toolDescriptionFor,
  findMissing,
} from "../scripts/check-description-drift.mjs";

/** A tool description is this package's entire interface.
 *
 * `get_psc_chain` returned ECCTA verification on every individual node from
 * CH-Api#104 and never said so, and its terminal-reason list predated
 * CH-Api#59 and CH-Api#62 by two reasons (registrum-mcp#20). Both were
 * invisible rather than broken: a model that has not been told a field exists
 * does not ask the question that field answers.
 *
 * The pure functions are unit-tested against fixtures here; hitting the live
 * openapi.json is the script's job, the same split check-endpoint-coverage
 * uses, so the suite stays offline and deterministic.
 */
const server = readFileSync(join(__dirname, "server.ts"), "utf8");

const API_DESCRIPTION_FIXTURE = `
Resolve the PSC ownership chain.

**Terminal reasons** explain why a branch stopped:

- \`natural_person\` - reached an individual
- \`unverified_registry\` - a number is filed but cannot be tied to the register.
  \`registry_number\` and \`registry_name\` say what was filed.
- \`unknown_kind\` - a PSC kind we have not classified

**ECCTA identity verification.**

- \`verification_status\` - verified | pending | overdue | unknown
`;

describe("terminalReasonsFrom", () => {
  it("reads the reasons the API documents", () => {
    expect(terminalReasonsFrom(API_DESCRIPTION_FIXTURE)).toEqual([
      "natural_person",
      "unverified_registry",
      "unknown_kind",
    ]);
  });

  it("does not mistake a field named in the prose for a terminal reason", () => {
    // `registry_number` sits in an indented continuation line of a bullet.
    // Treating every backticked token as a reason would demand the tool
    // description list field names as if they were branch outcomes.
    expect(terminalReasonsFrom(API_DESCRIPTION_FIXTURE)).not.toContain("registry_number");
    expect(terminalReasonsFrom(API_DESCRIPTION_FIXTURE)).not.toContain("verification_status");
  });

  it("returns nothing for an empty description rather than throwing", () => {
    expect(terminalReasonsFrom("")).toEqual([]);
    expect(terminalReasonsFrom(undefined as unknown as string)).toEqual([]);
  });
});

describe("toolDescriptionFor", () => {
  it("collapses a concatenated description into one string", () => {
    const src = `server.registerTool(\n    "get_thing",\n    {\n      title: "T",\n      description:\n        "first part " +\n        "second part",\n      inputSchema: z.object({}),`;
    expect(toolDescriptionFor(src, "get_thing")).toBe("first part second part");
  });

  it("returns empty for a tool that is not registered", () => {
    expect(toolDescriptionFor("", "get_missing")).toBe("");
  });
});

describe("the shipped get_psc_chain description", () => {
  const description = toolDescriptionFor(server, "get_psc_chain");

  it("is found, so the assertions below are not vacuous", () => {
    expect(description.length).toBeGreaterThan(200);
  });

  it("names every terminal reason the API documents", () => {
    const canonical = terminalReasonsFrom(API_DESCRIPTION_FIXTURE);
    expect(findMissing(canonical, description)).toEqual([]);
  });

  it("names the two reasons that shipped without it", () => {
    // Guarded explicitly as well as by the fixture: these are the ones a
    // model misreads. `unverified_registry` is a real AML finding, not an
    // outage, and it used to surface as `not_found`.
    expect(findMissing(["unverified_registry", "unknown_kind"], description)).toEqual([]);
  });

  it("tells the model the chain carries ECCTA verification", () => {
    expect(findMissing(["verification_status", "identity_verified"], description)).toEqual([]);
  });

  it("states that pending is not a compliance failure", () => {
    // The CH-Api#52 rule, in the one place a model summarising a chain will
    // read it. Asserting the explanation is present, not that a word is
    // absent: "pending" must appear, it just must not stand alone.
    expect(description.toLowerCase()).toMatch(/pending.{0,120}(not a (compliance )?failure|has missed nothing|deadline has not)/s);
  });

  it("distinguishes unknown from a breach", () => {
    expect(description.toLowerCase()).toMatch(/unknown.{0,120}(no record|not a breach|absence)/s);
  });

  it("says non-individual nodes carry no verification fields", () => {
    // Without this a model reports a corporate node as having unverified
    // identity, which is a false finding about a named company.
    expect(description.toLowerCase()).toMatch(/(corporate|non-individual|only individual)/);
  });
});

describe("the shipped get_psc description", () => {
  const description = toolDescriptionFor(server, "get_psc");

  it("is found, so the assertions below are not vacuous", () => {
    expect(description.length).toBeGreaterThan(200);
  });

  it("names the ECCTA fields /psc has always returned", () => {
    // Found while fixing registrum-mcp#20, which assumed get_psc already
    // described these and said to mirror it. It did not: the flat PSC view
    // was silent on verification too.
    expect(findMissing(["verification_status"], description)).toEqual([]);
  });
});
