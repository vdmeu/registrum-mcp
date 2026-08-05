// Mirrors package.json's version into server.json.
//
// Wired to npm's `version` lifecycle, so `npm version patch` always syncs both
// and stages the result. Doing this by hand drifted twice in one evening -
// once for five months (registry on v1.0.2 vs npm v1.2.0), once because a
// script read package.json with Windows' default cp1252 codec and died.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(path.join(root, f), "utf-8"));

const pkg = read("package.json");
const server = read("server.json");

server.version = pkg.version;
for (const p of server.packages ?? []) {
  if (p.registryType === "npm") p.version = pkg.version;
}
writeFileSync(path.join(root, "server.json"), `${JSON.stringify(server, null, 2)}\n`);
console.log(`server.json synced to ${pkg.version}`);
