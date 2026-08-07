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

  it("package.json mcpName matches the registry server name", () => {
    // The registry validates the published tarball against this. A mismatch
    // fails the publish with "Registry validation failed for package".
    expect(pkg.mcpName).toBe(server.name);
  });

  it("package.json repository matches server.json, and the real repo", () => {
    // Trusted publishing signs a provenance statement naming the repo the build
    // actually ran in. If package.json disagrees, npm rejects the publish with
    // E422 "Failed to validate repository information". package.json carried a
    // stale username (eugenemerwe) long after the repo moved to vdmeu.
    const normalise = (u: string) =>
      u.replace(/^git\+/, "").replace(/\.git$/, "").toLowerCase();
    expect(normalise(pkg.repository.url)).toBe(normalise(server.repository.url));
    expect(normalise(pkg.repository.url)).toBe("https://github.com/vdmeu/registrum-mcp");
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

/**
 * Per Eugene, 2026-08-05: "all new features need to show here". The API grew
 * /compliance (the ECCTA differentiator, hard 18 Nov 2026 deadline) and
 * /kyb-report, and neither reached this package - developers discovering us
 * through MCP simply could not see them.
 *
 * These guards make that mechanical rather than remembered.
 */
describe("the package reflects what the API can actually do", () => {
  const serverSrc = readFileSync(path.join(root, "src/server.ts"), "utf-8");

  it("reports its real version to MCP clients, not a hardcoded one", () => {
    // VERSION sat at "1.0.0" while the package shipped 1.2.1, so every client
    // was told the wrong version - the same silent drift as server.json.
    const hardcoded = serverSrc.match(/const VERSION\s*=\s*["']([\d.]+)["']/);
    expect(
      hardcoded,
      "VERSION must be derived from package.json, not written as a literal"
    ).toBeNull();
  });

  it("identifies itself with a User-Agent so its usage is attributable", () => {
    // Without this the API cannot distinguish MCP-driven calls from direct
    // ones, which is why MCP adoption was invisible despite 210 downloads/mo.
    expect(serverSrc).toMatch(/["']User-Agent["']\s*:/);
  });

  it("exposes a tool for every company endpoint the API offers", () => {
    // Endpoints deliberately not surfaced go here, with a reason - so a
    // decision to omit is explicit rather than an oversight.
    const waived: Record<string, string> = {
      "kyb-report": "composite report; the underlying endpoints are each exposed",
    };
    const apiEndpoints = ["compliance", "directors", "financials", "network", "psc", "psc/chain"];
    const missing = apiEndpoints.filter((e) => {
      if (waived[e]) return false;
      const slug = e.replace("/", "_");
      return !serverSrc.includes(`"get_${slug}"`);
    });
    expect(
      missing,
      `API endpoints with no MCP tool: ${missing.join(", ")}. Add a tool, or waive it with a reason.`
    ).toEqual([]);
  });
});

/**
 * Registry-side limits that are only discoverable by failing a publish.
 *
 * The MCP registry rejects a server.json whose `description` exceeds 100
 * characters with a 422, and it does so *after* `npm publish` has already
 * succeeded in the same workflow job. So the cost of getting this wrong is not
 * a retry - it is a burnt npm version number, because npm refuses to republish
 * one. Caught for real on 2.0.1 (2026-08-07).
 */
describe("server.json satisfies MCP registry validation", () => {
  const server = JSON.parse(readFileSync(path.join(root, "server.json"), "utf-8"));

  it("description is within the registry's 100-character limit", () => {
    expect(
      server.description.length,
      `description is ${server.description.length} chars; the registry 422s above 100, ` +
        `and by then npm has already consumed the version number`
    ).toBeLessThanOrEqual(100);
  });

  it("advertises the hosted endpoint as a remote", () => {
    const urls = (server.remotes ?? []).map((r: { url: string }) => r.url);
    expect(urls).toContain("https://registrum.co.uk/api/mcp");
  });

  it("does not mark the API key as required, now that anonymous access exists", () => {
    for (const pkg of server.packages ?? []) {
      for (const env of pkg.environmentVariables ?? []) {
        expect(env.isRequired, `${env.name} must not be required`).toBeFalsy();
      }
    }
  });
});
