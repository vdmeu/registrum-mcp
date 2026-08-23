// Fails when a tool sends a query parameter name the API does not declare.
//
// check-endpoint-coverage.mjs validates this seam at ENDPOINT granularity: does
// a tool exist for each endpoint? It was green while search_company sent
// ?limit=N to an API that declares items_per_page (registrum-mcp#5). FastAPI
// drops an unrecognised query param silently, so nothing on either side failed
// - the caller just got the default page size. A guard at the wrong granularity
// produces confidence, which is worse than no guard.
//
// This one drives the real tools with a stubbed fetch, records the URL each one
// actually requests, and compares those parameter names against openapi.json.
// Nothing here restates the tool list or its inputs, so a tool or parameter
// added tomorrow is checked without anyone editing this file.
//
// Run: node scripts/check-param-drift.mjs
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";

const OPENAPI_URL = "https://api.registrum.co.uk/openapi.json";

/** The concrete path a tool requested, matched back to its openapi template. */
export function matchOpenApiPath(pathname, templates) {
  const actual = pathname.split("/");
  return (
    templates.find((t) => {
      const declared = t.split("/");
      if (declared.length !== actual.length) return false;
      return declared.every((seg, i) => seg.startsWith("{") || seg === actual[i]);
    }) ?? null
  );
}

/** @returns {{all: string[], required: string[]}} sorted query param names */
export function declaredQueryParams(openapi, template) {
  const params = (openapi.paths?.[template]?.get?.parameters ?? []).filter((p) => p.in === "query");
  return {
    all: params.map((p) => p.name).sort(),
    required: params.filter((p) => p.required).map((p) => p.name).sort(),
  };
}

/** A value for every input a tool declares - optional ones included, so an
 * optional parameter is exercised rather than quietly skipped. */
export function synthesizeArgs(inputSchema) {
  const args = {};
  for (const [name, prop] of Object.entries(inputSchema?.properties ?? {})) {
    if (prop.type === "string") args[name] = "00445790";
    else if (prop.type === "number" || prop.type === "integer") args[name] = prop.minimum ?? 1;
    else if (prop.type === "boolean") args[name] = true;
  }
  return args;
}

/** @param {{tool: string, url: string}[]} requests */
export function findParamDrift(requests, openapi) {
  const templates = Object.keys(openapi.paths ?? {});
  const drift = [];
  for (const { tool, url } of requests) {
    const { pathname, searchParams } = new URL(url);
    const template = matchOpenApiPath(pathname, templates);
    if (!template) {
      drift.push({ tool, path: pathname, problem: "calls a path the API does not declare" });
      continue;
    }
    const declared = declaredQueryParams(openapi, template);
    const sent = [...searchParams.keys()];
    for (const name of sent) {
      if (!declared.all.includes(name))
        drift.push({ tool, path: template, problem: `sends undeclared query parameter '${name}'` });
    }
    for (const name of declared.required) {
      if (!sent.includes(name))
        drift.push({ tool, path: template, problem: `omits required query parameter '${name}'` });
    }
  }
  return drift;
}

/** Calls every registered tool with a stubbed fetch and records its request URL. */
export async function captureToolRequests(createServer) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const client = new Client({ name: "param-drift", version: "1.0.0" });
  await client.connect(clientTransport);

  const realFetch = globalThis.fetch;
  const requests = [];
  try {
    for (const tool of (await client.listTools()).tools) {
      globalThis.fetch = async (url) => {
        requests.push({ tool: tool.name, url: String(url) });
        return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
      };
      await client.callTool({ name: tool.name, arguments: synthesizeArgs(tool.inputSchema) });
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  return requests;
}

async function main() {
  const res = await fetch(OPENAPI_URL);
  if (!res.ok) {
    console.error(`Could not fetch ${OPENAPI_URL}: ${res.status}`);
    process.exit(2); // infrastructure problem, not a drift failure
  }
  const openapi = await res.json();
  const { createServer, API_BASE } = await import("../dist/server.js");
  const requests = await captureToolRequests(() => createServer("reg_drift_check", API_BASE));
  const drift = findParamDrift(requests, openapi);

  console.log(`Tool requests checked against openapi.json: ${requests.length}`);
  if (drift.length === 0) {
    console.log("Every parameter each tool sends is declared by the API.");
    return;
  }
  console.error(`\nPARAMETER DRIFT (${drift.length}):`);
  for (const d of drift) console.error(`  ${d.tool}  ->  ${d.path}  ${d.problem}`);
  console.error("\nFix the tool in src/server.ts, or the endpoint in the API - the two must agree.");
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
