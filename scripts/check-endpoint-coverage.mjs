// Fails when the API exposes a company endpoint this package has no tool for.
//
// docs/CROSS-PROJECT-IMPACT.md already says "any new GET endpoint needs a
// matching tool" and rates it high priority. That rule was in place when
// /compliance shipped, and this package still went five months without it -
// so the rule is not the control. This is.
//
// Run: node scripts/check-endpoint-coverage.mjs [--json]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPENAPI_URL = "https://api.registrum.co.uk/openapi.json";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Endpoints deliberately not surfaced, each with a reason. An omission must
 * be a decision, not an oversight. */
export const WAIVED = {
  "kyb-report": "composite report; its underlying endpoints are each exposed",
};

/** @param {object} openapi @returns {string[]} e.g. ["compliance","psc/chain"] */
export function companyEndpointsFrom(openapi) {
  const out = new Set();
  for (const p of Object.keys(openapi.paths ?? {})) {
    const m = p.match(/^\/v1\/company\/\{company_number\}\/(.+)$/);
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}

/** @param {string} serverSrc @returns {string[]} registered tool names */
export function registeredTools(serverSrc) {
  return [...serverSrc.matchAll(/registerTool\(\s*["']([a-z_]+)["']/g)].map((m) => m[1]);
}

/** Endpoints with no corresponding tool, excluding waived ones. */
export function findUncovered(endpoints, tools, waived = WAIVED) {
  return endpoints.filter((e) => {
    if (waived[e]) return false;
    return !tools.includes(`get_${e.replace(/\//g, "_")}`);
  });
}

async function main() {
  const res = await fetch(OPENAPI_URL);
  if (!res.ok) {
    console.error(`Could not fetch ${OPENAPI_URL}: ${res.status}`);
    process.exit(2); // infrastructure problem, not a coverage failure
  }
  const endpoints = companyEndpointsFrom(await res.json());
  const tools = registeredTools(readFileSync(path.join(__dirname, "..", "src", "server.ts"), "utf-8"));
  const missing = findUncovered(endpoints, tools);

  console.log(`API company endpoints: ${endpoints.length} | MCP tools: ${tools.length}`);
  if (missing.length === 0) {
    console.log("All API endpoints are exposed as MCP tools.");
    return;
  }
  console.error(`\nUNCOVERED ENDPOINTS (${missing.length}):`);
  for (const m of missing) console.error(`  /company/{n}/${m}  ->  needs tool get_${m.replace(/\//g, "_")}`);
  console.error("\nAdd a tool, or waive it with a reason in WAIVED.");
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
