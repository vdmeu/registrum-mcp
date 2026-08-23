import { describe, it, expect } from "vitest";
import {
  matchOpenApiPath,
  declaredQueryParams,
  synthesizeArgs,
  findParamDrift,
  captureToolRequests,
} from "../scripts/check-param-drift.mjs";
import { createServer, API_BASE } from "./server.js";

const TEMPLATES = [
  "/v1/search",
  "/v1/company/{company_number}",
  "/v1/company/{company_number}/psc/chain",
];

describe("matchOpenApiPath", () => {
  it("matches a concrete path back to its templated declaration", () => {
    expect(matchOpenApiPath("/v1/company/00445790/psc/chain", TEMPLATES)).toBe(
      "/v1/company/{company_number}/psc/chain"
    );
  });

  it("matches a path with no parameters", () => {
    expect(matchOpenApiPath("/v1/search", TEMPLATES)).toBe("/v1/search");
  });

  it("returns null when the API declares no such path", () => {
    expect(matchOpenApiPath("/v1/company/00445790/charges", TEMPLATES)).toBeNull();
  });

  it("does not match across a segment boundary", () => {
    expect(matchOpenApiPath("/v1/company/00445790", ["/v1/company/{n}/psc"])).toBeNull();
  });
});

describe("declaredQueryParams", () => {
  const openapi = {
    paths: {
      "/v1/search": {
        get: {
          parameters: [
            { in: "query", name: "q", required: true },
            { in: "query", name: "items_per_page" },
            { in: "path", name: "ignored_because_not_query", required: true },
          ],
        },
      },
    },
  };

  it("returns every declared query parameter and which are required", () => {
    expect(declaredQueryParams(openapi, "/v1/search")).toEqual({
      all: ["items_per_page", "q"],
      required: ["q"],
    });
  });

  it("returns nothing for a path that declares no parameters", () => {
    expect(declaredQueryParams({ paths: { "/v1/x": { get: {} } } }, "/v1/x")).toEqual({
      all: [],
      required: [],
    });
  });
});

describe("synthesizeArgs", () => {
  it("supplies a value for every input, optional ones included", () => {
    const schema = {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["query"],
    };
    expect(synthesizeArgs(schema)).toEqual({ query: "00445790", limit: 1 });
  });

  it("respects a minimum so the tool does not reject the synthesized call", () => {
    expect(synthesizeArgs({ properties: { depth: { type: "number", minimum: 2 } } })).toEqual({
      depth: 2,
    });
  });

  it("handles a tool with no inputs", () => {
    expect(synthesizeArgs({ type: "object" })).toEqual({});
  });
});

describe("findParamDrift", () => {
  const openapi = {
    paths: {
      "/v1/search": {
        get: {
          parameters: [
            { in: "query", name: "q", required: true },
            { in: "query", name: "items_per_page" },
          ],
        },
      },
    },
  };

  it("flags a query parameter the API does not declare (registrum-mcp#5)", () => {
    const drift = findParamDrift(
      [{ tool: "search_company", url: "https://api.registrum.co.uk/v1/search?q=x&limit=1" }],
      openapi
    );
    expect(drift).toEqual([
      {
        tool: "search_company",
        path: "/v1/search",
        problem: "sends undeclared query parameter 'limit'",
      },
    ]);
  });

  it("passes when the tool sends the name the API actually declares", () => {
    expect(
      findParamDrift(
        [
          {
            tool: "search_company",
            url: "https://api.registrum.co.uk/v1/search?q=x&items_per_page=1",
          },
        ],
        openapi
      )
    ).toEqual([]);
  });

  it("flags a required parameter the tool never sends", () => {
    const drift = findParamDrift(
      [{ tool: "search_company", url: "https://api.registrum.co.uk/v1/search?items_per_page=1" }],
      openapi
    );
    expect(drift).toEqual([
      {
        tool: "search_company",
        path: "/v1/search",
        problem: "omits required query parameter 'q'",
      },
    ]);
  });

  it("flags a tool calling a path the API does not declare at all", () => {
    const drift = findParamDrift(
      [{ tool: "get_charges", url: "https://api.registrum.co.uk/v1/company/00445790/charges" }],
      openapi
    );
    expect(drift).toEqual([
      {
        tool: "get_charges",
        path: "/v1/company/00445790/charges",
        problem: "calls a path the API does not declare",
      },
    ]);
  });
});

describe("captureToolRequests", () => {
  it("records the real URL every registered tool requests", async () => {
    const requests = await captureToolRequests(() => createServer("reg_test_key", API_BASE));

    const tools = requests.map((r) => r.tool);
    expect(tools).toContain("search_company");
    expect(tools).toContain("get_psc_chain");

    const search = requests.find((r) => r.tool === "search_company");
    expect(search.url).toContain("items_per_page=");
    expect(search.url).not.toContain("limit=");

    const chain = requests.find((r) => r.tool === "get_psc_chain");
    expect(chain.url).toContain("max_depth=");
  });
});
