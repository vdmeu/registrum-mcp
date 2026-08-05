import { describe, it, expect } from "vitest";
import { companyEndpointsFrom, registeredTools, findUncovered } from "../scripts/check-endpoint-coverage.mjs";

describe("endpoint coverage checker", () => {
  it("extracts company sub-endpoints from an openapi document", () => {
    const doc = { paths: {
      "/v1/company/{company_number}": {},
      "/v1/company/{company_number}/compliance": {},
      "/v1/company/{company_number}/psc/chain": {},
      "/v1/health": {},
    }};
    expect(companyEndpointsFrom(doc)).toEqual(["compliance", "psc/chain"]);
  });

  it("reads registered tool names from server source", () => {
    const src = `server.registerTool(\n "get_psc",\n{});server.registerTool("get_compliance", {});`;
    expect(registeredTools(src)).toEqual(["get_psc", "get_compliance"]);
  });

  it("flags an endpoint that has no matching tool", () => {
    expect(findUncovered(["compliance"], ["get_psc"], {})).toEqual(["compliance"]);
  });

  it("maps a nested endpoint to its underscored tool name", () => {
    expect(findUncovered(["psc/chain"], ["get_psc_chain"], {})).toEqual([]);
  });

  it("respects an explicit waiver so omissions are decisions, not oversights", () => {
    expect(findUncovered(["kyb-report"], [], { "kyb-report": "composite" })).toEqual([]);
  });

  it("passes when every endpoint is covered", () => {
    expect(findUncovered(["compliance", "psc"], ["get_compliance", "get_psc"], {})).toEqual([]);
  });
});
