import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The MCP registry publishes from server.json, npm publishes from package.json.
 * Nothing kept them in step, so the registry sat at v1.0.2 while npm was at
 * v1.2.0 - anyone discovering us through the official registry got a pointer
 * two minor versions behind for five months (CH-Api#75).
 *
 * `prepublishOnly` runs this suite, so a mismatch now blocks the publish that
 * would create it.
 */
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
const server = JSON.parse(readFileSync(path.join(root, "server.json"), "utf-8"));

describe("release metadata stays in step", () => {
  it("server.json version matches package.json", () => {
    expect(server.version).toBe(pkg.version);
  });

  it("the npm package entry inside server.json matches too", () => {
    const npmPkg = server.packages.find(
      (p: { registryType: string }) => p.registryType === "npm"
    );
    expect(npmPkg).toBeDefined();
    expect(npmPkg.identifier).toBe(pkg.name);
    expect(npmPkg.version).toBe(pkg.version);
  });
});

/**
 * Attribution (CH-Api#76). This package is the only developer channel with
 * measurable pull - 210 npm downloads in the month to 2026-08-03 - yet every
 * route it offered to sign up was untagged, so not one of those downloads could
 * ever be connected to a signup. api_keys.utm_source was NULL on all 41 rows.
 */
describe("signup links are attributable", () => {
  const sources = {
    "src/index.ts": readFileSync(path.join(root, "src/index.ts"), "utf-8"),
    "src/server.ts": readFileSync(path.join(root, "src/server.ts"), "utf-8"),
    "README.md": readFileSync(path.join(root, "README.md"), "utf-8"),
  };

  for (const [file, content] of Object.entries(sources)) {
    it(`${file} tags every registrum.co.uk signup link with utm_source=mcp`, () => {
      // Bare links to the site root are the ones that create signups; docs and
      // api subdomain links are not signup routes.
      const bare = content.match(/https:\/\/registrum\.co\.uk(?![a-z0-9./?=&-])/gi) ?? [];
      expect(
        bare,
        `${file} has an untagged signup link - it must carry ?utm_source=mcp`
      ).toHaveLength(0);
    });
  }

  it("server.json's key-acquisition hint is tagged too", () => {
    const npmPkg = server.packages.find(
      (p: { registryType: string }) => p.registryType === "npm"
    );
    const env = npmPkg.environmentVariables.find(
      (e: { name: string }) => e.name === "REGISTRUM_API_KEY"
    );
    expect(env.description).toContain("utm_source=mcp");
  });
});
