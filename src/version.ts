import { createRequire } from "node:module";

/**
 * Single source of truth for the version we report to MCP clients.
 *
 * This was previously a literal `const VERSION = "1.0.0"` in server.ts, which
 * stayed frozen while the package shipped 1.1.0 and 1.2.x - so every client
 * was told the wrong version for five months. Same drift class as server.json
 * vs package.json; both are now pinned by tests.
 */
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string; name: string };

export const VERSION: string = pkg.version;
export const PACKAGE_NAME: string = pkg.name;

/** Sent on every API call so MCP-driven usage is distinguishable from direct
 * API traffic. Without it, adoption of this package is invisible server-side. */
export const USER_AGENT = `${PACKAGE_NAME}/${VERSION} (+https://registrum.co.uk)`;
