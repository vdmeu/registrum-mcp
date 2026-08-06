#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

const apiKey = process.env.REGISTRUM_API_KEY ?? "";
if (!apiKey) {
  process.stderr.write(
    "Warning: REGISTRUM_API_KEY is not set. Tool calls will fail until you set it.\n" +
    "Get a free key at https://registrum.co.uk/?utm_source=mcp&utm_campaign=server\n"
  );
}

// A factory rather than a single instance: serveStdio builds one server per
// connection, and pins it to the protocol era the client handshook with, so
// the same tool definitions serve both 2025-era and 2026-07-28 clients.
serveStdio(() => createServer(apiKey));
