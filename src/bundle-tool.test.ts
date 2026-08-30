import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer, API_BASE, TOOL_NAMES } from "./server.js";
import { toolDescriptionFor } from "../scripts/check-description-drift.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** `get_bundle` exposes /v1/company/{n}/bundle, which shipped 2026-08-28 for
 * the website's own company page and sat live-but-undocumented for two days
 * (CH-Api#130). It was already in the public openapi.json the whole time, so
 * "internal" was never the honest description of its state.
 *
 * For an agent this is the highest-value tool in the set: one call for a whole
 * company instead of five round trips, and one credit instead of five.
 */
function mockFetchOk(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

async function makeClient() {
  const server = createServer("reg_test_key", API_BASE);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(ct);
  return client;
}

function urlOf(spy: ReturnType<typeof mockFetchOk>): string {
  return spy.mock.calls[0][0] as string;
}

beforeEach(() => vi.restoreAllMocks());

describe("get_bundle", () => {
  it("is a registered tool", () => {
    expect(TOOL_NAMES).toContain("get_bundle");
  });

  it("requests the bundle endpoint", async () => {
    const spy = mockFetchOk({ profile: { company_name: "TESCO PLC" } });
    const client = await makeClient();

    await client.callTool({ name: "get_bundle", arguments: { company_number: "00445790" } });

    expect(urlOf(spy)).toBe(`${API_BASE}/company/00445790/bundle`);
  });

  it("sends no include parameter when no sections are named", async () => {
    // The API defaults to all five. Sending an explicit list that happens to
    // match would still be a second place for that default to drift.
    const spy = mockFetchOk({});
    const client = await makeClient();

    await client.callTool({ name: "get_bundle", arguments: { company_number: "00445790" } });

    expect(urlOf(spy)).not.toContain("include");
  });

  it("passes a chosen subset as a comma-separated include list", async () => {
    const spy = mockFetchOk({});
    const client = await makeClient();

    await client.callTool({
      name: "get_bundle",
      arguments: { company_number: "00445790", include: ["profile", "compliance"] },
    });

    expect(urlOf(spy)).toContain("include=profile%2Ccompliance");
  });

  it("rejects an unknown section before spending a call", async () => {
    // The API answers an unknown section with a 400. Catching it in the schema
    // means the model is told which names are valid instead of burning a
    // request to find out.
    const spy = vi.spyOn(globalThis, "fetch");
    const client = await makeClient();

    const res = await client.callTool({
      name: "get_bundle",
      arguments: { company_number: "00445790", include: ["accounts"] },
    });

    expect(res.isError).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("the get_bundle description", () => {
  const description = toolDescriptionFor(
    readFileSync(join(__dirname, "server.ts"), "utf8"),
    "get_bundle"
  );

  it("is found, so the assertions below are not vacuous", () => {
    expect(description.length).toBeGreaterThan(200);
  });

  it("names every section so a model can choose a subset", () => {
    for (const s of ["profile", "compliance", "financials", "psc", "directors"]) {
      expect(description).toContain(s);
    }
  });

  it("says it costs one call, which is the whole reason to prefer it", () => {
    expect(description.toLowerCase()).toMatch(/one (api )?(call|credit|request)/);
  });

  it("warns that a section can come back null without the request having failed", () => {
    // Partial failure is by design: only the profile is fatal. A model that
    // does not know this will report a missing financials section as an error.
    expect(description.toLowerCase()).toMatch(/null|unavailable|partial/);
  });
});
