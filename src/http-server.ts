#!/usr/bin/env node
//
// HTTP transport entry point for ZapFetch MCP server.
//
// Architecture (plan §2.3 + ADR):
//   - Stateless per-request: each POST /mcp builds a fresh McpServer +
//     ZapFetchClient + StreamableHTTPServerTransport. No cross-request
//     state, no session map, no shared client — multi-tenant isolation
//     is an architectural invariant, not a runtime check.
//   - SDK-native auth: bearerMiddleware sets req.auth = {token, ...};
//     transport.handleRequest reads req.auth, propagates via its WeakMap
//     into RequestHandlerExtra.authInfo on tool callbacks.
//   - GET /health: bypasses bearerMiddleware so container healthchecks
//     work without credentials.
//   - Env ZAPFETCH_API_KEY is REJECTED at boot (see assertHttpModeCleanEnv)
//     to prevent misconfigured containers from silently serving all HTTP
//     clients from the operator's key.

import express from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildServer } from "./server.js";
import { buildHttpConfig, assertHttpModeCleanEnv } from "./config.js";
import type { Config } from "./config.js";
import { bearerMiddleware } from "./bearer-middleware.js";
import { loggingMiddleware } from "./observability.js";
import { VERSION } from "./version.js";

const DEFAULT_PORT = 3000;

// ServerFactory is an injection point so tests can substitute a spy-only
// McpServer (e.g. to assert extra.authInfo.token at tool-handler layer)
// without touching the production tool registry. Production uses
// `buildServer(config)` and nothing else.
export type ServerFactory = (config: Config) => McpServer;

export interface CreateAppOptions {
  serverFactory?: ServerFactory;
}

export function createApp(opts: CreateAppOptions = {}): express.Express {
  const serverFactory = opts.serverFactory ?? buildServer;
  const app = express();

  // Body parser first so JSON is available to handlers.
  app.use(express.json({ limit: "1mb" }));

  // Structured stderr access log — must come before bearer so we log
  // 401s too. Attaches at res.on('finish').
  app.use(loggingMiddleware);

  // Health endpoint: unauthenticated by design. Docker HEALTHCHECK and
  // Kubernetes liveness probes hit this without a Bearer token.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, version: VERSION, transport: "http" });
  });

  // MCP endpoint: auth-gated. bearerMiddleware sets req.auth on success,
  // or 401s on missing/malformed.
  app.post("/mcp", bearerMiddleware, async (req: Request, res: Response) => {
    try {
      // req.auth is populated by bearerMiddleware; this is a safety assert.
      const token = req.auth?.token;
      if (!token) {
        // Should never happen; bearerMiddleware would have 401'd already.
        res.status(500).json({ error: "internal", code: "missing_auth_state" });
        return;
      }

      // Per-request stateless construction: every MCP call gets its own
      // server + client + transport tree. No cross-request sharing.
      const config = buildHttpConfig(token);
      const server = serverFactory(config);
      // enableJsonResponse: true — in stateless v0.2 we respond with plain
      // JSON rather than SSE streams. Progressive notifications are a v0.3
      // concern; for now this is simpler for curl/tests and matches the
      // single-request/single-response REST model most agent frameworks use.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      // Clean up transport/server if the client disconnects or stream ends.
      res.on("close", () => {
        transport.close?.();
        server.close?.();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      // Last-resort error handler. transport.handleRequest normally writes
      // its own JSON-RPC error response. If we get here, something broke
      // before or around the transport.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`http-server error: ${msg}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "internal", code: "handler_error" });
      }
    }
  });

  return app;
}

function resolvePort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`invalid PORT env value: ${raw}`);
    process.exit(1);
  }
  return n;
}

async function main(): Promise<void> {
  assertHttpModeCleanEnv();
  const app = createApp();
  const port = resolvePort();
  app.listen(port, () => {
    console.error(`zapfetch-mcp v${VERSION} ready (HTTP, port ${port})`);
  });
}

// Only run main() when invoked as the binary, not when imported by tests.
// import.meta.url equality check against the entry file works for both
// `node dist/http-server.js` and `tsx src/http-server.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`zapfetch-mcp http fatal: ${msg}`);
    process.exit(1);
  });
}
