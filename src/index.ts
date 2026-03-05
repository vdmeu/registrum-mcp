#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const apiKey = process.env.REGISTRUM_API_KEY ?? "";
if (!apiKey) {
  process.stderr.write(
    "Warning: REGISTRUM_API_KEY is not set. Tool calls will fail until you set it.\n" +
    "Get a free key at https://registrum.co.uk\n"
  );
}

const server = createServer(apiKey);
const transport = new StdioServerTransport();
await server.connect(transport);
