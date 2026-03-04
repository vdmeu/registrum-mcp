#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiKey = process.env.REGISTRUM_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "Error: REGISTRUM_API_KEY environment variable is required.\n" +
    "Get a free key at https://registrum.co.uk\n"
  );
  process.exit(1);
}

const server = createServer(apiKey);
const transport = new StdioServerTransport();
await server.connect(transport);
