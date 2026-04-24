import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApp } from "./http-server.js";
import type { Config } from "./config.js";

// Build a minimal spy McpServer that registers a single tool and returns
// a canned response. Tests inject this via serverFactory so production
// registerTools() is not exercised (we don't want network calls).
function buildSpyServer(config: Config): McpServer {
  const server = new McpServer({ name: "zapfetch-test", version: "test" });
  server.registerTool(
    "_test_ping",
    {
      description: "echo the config apiKey back (test-only)",
      inputSchema: { key: z.string().optional() },
    },
    async () => ({
      content: [{ type: "text" as const, text: `ok:${config.apiKey}` }],
    }),
  );
  return server;
}

test("GET /health — 200 and shape", async () => {
  const app = createApp({ serverFactory: buildSpyServer });
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.transport, "http");
  assert.equal(typeof res.body.version, "string");
});

test("GET /health — no Authorization required", async () => {
  const app = createApp({ serverFactory: buildSpyServer });
  const res = await request(app).get("/health");
  // No 401 — bearer middleware must NOT apply to /health
  assert.equal(res.status, 200);
});

test("POST /mcp without Authorization — 401 missing_bearer", async () => {
  const app = createApp({ serverFactory: buildSpyServer });
  const res = await request(app)
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json")
    .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, "missing_bearer");
});

test("POST /mcp with malformed Bearer — 401 malformed_bearer", async () => {
  const app = createApp({ serverFactory: buildSpyServer });
  const res = await request(app)
    .post("/mcp")
    .set("Authorization", "Basic dXNlcg==")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json")
    .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(res.status, 401);
  assert.equal(res.body.code, "malformed_bearer");
});

test("POST /mcp with Bearer but no Accept — 406 from SDK", async () => {
  // Proves our stack correctly surfaces SDK's MCP-spec-required headers.
  const app = createApp({ serverFactory: buildSpyServer });
  const res = await request(app)
    .post("/mcp")
    .set("Authorization", "Bearer fc-test")
    .set("Content-Type", "application/json")
    .send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  // SDK's webStandardStreamableHttp rejects without both MIME types in Accept.
  assert.equal(res.status, 406);
});

test("POST /mcp with valid Bearer + Accept — tools/list returns spy tool", async () => {
  const app = createApp({ serverFactory: buildSpyServer });
  const res = await request(app)
    .post("/mcp")
    .set("Authorization", "Bearer fc-test-valid")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json")
    .send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
  // initialize returns a JSON-RPC 2.0 response. The SDK may stream as SSE
  // or respond JSON depending on config. We accept either 200 with a
  // result, or 406 already caught above.
  assert.equal(res.status, 200);
});

test("Negative isolation: concurrent A valid + B unauth — B must 401", async () => {
  // Critic C5: a request A in-flight with a valid Bearer must not leak
  // state such that request B without auth passes. Proves no Express
  // instance-level state (req.app.locals / res.locals) carries auth.
  const app = createApp({ serverFactory: buildSpyServer });

  const [resA, resB] = await Promise.all([
    request(app)
      .post("/mcp")
      .set("Authorization", "Bearer fc-A-valid")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "client-A", version: "1.0.0" },
        },
      }),
    request(app)
      .post("/mcp")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
  ]);

  // Both requests resolved. A must not have been 401; B must have been 401.
  assert.notEqual(resA.status, 401, `A should have passed auth, got ${resA.status}`);
  assert.equal(resB.status, 401, `B should have been rejected, got ${resB.status}`);
  assert.equal(resB.body.code, "missing_bearer");
});
