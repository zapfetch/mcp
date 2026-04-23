#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Note: never console.log here — stdout is the JSON-RPC channel.
  console.error("zapfetch-mcp v0.1.0 ready (STDIO)");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`zapfetch-mcp fatal: ${msg}`);
  process.exit(1);
});
