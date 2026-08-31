import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * No em dashes in this package's source (vdmeu/CH-Api#132).
 *
 * House style is hyphens. This repo was already clean when the sweep ran -
 * 0 of the 749 across the three sibling repos were here - so this gate is not
 * a cleanup. It is what keeps a clean repo clean, which is cheaper than
 * sweeping it later and is the reason the issue asked for a gate here too.
 *
 * It matters more here than the count suggests: every tool description in
 * `server.ts` is shipped to npm and read by a model, so this source *is* the
 * customer-visible copy. There is no separate docs surface to catch it.
 *
 * Two deliberate limits, both from the issue:
 *   - Asserts on U+2014 only, never "any non-ASCII". Real Companies House
 *     data carries `£`, `…` and accented company names.
 *   - Scans `src/` only, never fixtures or captured API responses - Companies
 *     House returns em dashes inside real company names and filing
 *     descriptions, and failing on those would push someone to hand-edit a
 *     captured fixture to satisfy a lint rule (CH-Api#54).
 */
const EM_DASH = "—";
const SRC = path.resolve(__dirname);
const SKIP_DIRS = new Set(["node_modules", "dist", "__pycache__", ".git"]);
const EXTS = [".ts", ".tsx", ".mjs", ".js"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (EXTS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

describe("house style", () => {
  it("has no em dashes in source", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      // This spec necessarily contains the character it forbids, in EM_DASH
      // above. Skipping the file by name would be a hole the moment someone
      // adds prose to it, so skip only by identity.
      if (path.resolve(file) === path.resolve(__filename)) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes(EM_DASH)) {
            offenders.push(`${path.relative(SRC, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
          }
        });
    }
    expect(
      offenders,
      `${offenders.length} em dash(es) (U+2014) in source. House style is a hyphen: ` +
        `use ' - ' between clauses. Tool descriptions here ship to npm and are read ` +
        `by a model, so this is customer-visible copy.\n  ` + offenders.join("\n  ")
    ).toEqual([]);
  });

  it("is actually looking at this package's source", () => {
    // Guards the guard: a walker that silently returns nothing would make the
    // check above pass forever. server.ts is the file that must always be scanned.
    const files = sourceFiles(SRC).map((f) => path.basename(f));
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain("server.ts");
  });
});
