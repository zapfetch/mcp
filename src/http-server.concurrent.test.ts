import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createApp } from "./http-server.js";
import type { Config } from "./config.js";

// Plan Scenario 1 hard detection: prove the SDK propagates per-request
// auth info (set by bearerMiddleware at the Express layer) all the way
// into tool handlers without cross-request leakage.
//
// Construction: a shared `capturedTokens` array, and each buildSpyServer
// closure captures the config.apiKey when the server is built. The spy
// tool `_test_authinfo` also reads `extra.authInfo.token` inside the tool
// callback — so we can cross-verify:
//   - per-request McpServer was built with the correct apiKey (config-level)
//   - tool handler saw the correct extra.authInfo.token (SDK WeakMap-level)
//
// If either level leaks across concurrent requests, the sorted/deduped
// assertion at the end will fail.

interface Captured {
  configApiKey: string;
  authInfoToken: string | undefined;
}

const N_CONCURRENT = 10;

test(
  `${N_CONCURRENT} concurrent requests with distinct Bearers isolate ` +
    `auth at both config and tool-handler layers`,
  async () => {
    const captured: Captured[] = [];

    const spyFactory = (config: Config): McpServer => {
      const server = new McpServer({
        name: "zapfetch-test",
        version: "test",
      });
      server.registerTool(
        "_test_authinfo",
        {
          description: "capture per-request authInfo (test-only)",
          inputSchema: { nonce: z.string() },
        },
        async (_args, extra) => {
          captured.push({
            configApiKey: config.apiKey,
            authInfoToken: extra.authInfo?.token,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: `captured:${extra.authInfo?.token ?? "MISSING"}`,
              },
            ],
          };
        },
      );
      return server;
    };

    const app = createApp({ serverFactory: spyFactory });

    // Fire N concurrent tool calls, each with a distinct Bearer token.
    // We use `method: "tools/call"` directly — SDK stateless mode handles
    // request-scoped initialization transparently.
    const tokens = Array.from(
      { length: N_CONCURRENT },
      (_, i) => `fc-test-${i}`,
    );

    const requests = tokens.map((tok, i) =>
      request(app)
        .post("/mcp")
        .set("Authorization", `Bearer ${tok}`)
        .set("Accept", "application/json, text/event-stream")
        .set("Content-Type", "application/json")
        .send({
          jsonrpc: "2.0",
          id: i,
          method: "tools/call",
          params: {
            name: "_test_authinfo",
            arguments: { nonce: `n-${i}` },
          },
        }),
    );

    const responses = await Promise.all(requests);

    // Collect responses that actually reached the tool handler. If stateless
    // SDK mode requires prior `initialize`, some calls may error before
    // touching the handler — in that case we'll see fewer captured entries
    // than requests, which is itself a diagnostic signal.
    const reachedHandler = responses.filter((r) => r.status === 200).length;

    if (captured.length === 0) {
      // If the SDK gate blocks tools/call without initialize in stateless
      // mode, surface a diagnostic rather than a silent pass. Test should
      // fail in that case so we know to adjust the stateless pattern.
      const statusCodes = responses.map((r) => r.status);
      const firstBody = responses[0].body;
      assert.fail(
        `No tool handler invocations captured. Response status codes: ` +
          `${JSON.stringify(statusCodes)}. First body: ${JSON.stringify(firstBody)}`,
      );
    }

    assert.equal(
      captured.length,
      N_CONCURRENT,
      `Expected ${N_CONCURRENT} handler invocations, got ${captured.length}. ` +
        `HTTP responses reaching 200: ${reachedHandler}.`,
    );

    // Invariant 1: each captured config.apiKey matches some sent token.
    const configKeys = captured.map((c) => c.configApiKey).sort();
    const expectedTokens = [...tokens].sort();
    assert.deepEqual(
      configKeys,
      expectedTokens,
      `config.apiKey leak: tokens seen at config layer did not match the sent set.`,
    );

    // Invariant 2: each captured extra.authInfo.token matches some sent token.
    // This is the critical multi-tenant assertion — proves the SDK's WeakMap
    // propagation from req.auth → tool callback's extra.authInfo is
    // per-request-isolated.
    const authInfoTokens = captured
      .map((c) => c.authInfoToken)
      .filter((t): t is string => typeof t === "string")
      .sort();
    assert.deepEqual(
      authInfoTokens,
      expectedTokens,
      `extra.authInfo.token leak at SDK layer: tokens seen inside tool ` +
        `handlers did not match the sent set.`,
    );

    // Invariant 3: all N tokens are distinct (no duplicates, no misses).
    assert.equal(
      new Set(authInfoTokens).size,
      N_CONCURRENT,
      `Duplicate or missing authInfo.token values across concurrent requests.`,
    );

    // Invariant 4: config-level and authInfo-level tokens agree per request.
    // Sort by token to align the two arrays.
    for (const entry of captured) {
      assert.equal(
        entry.configApiKey,
        entry.authInfoToken,
        `Per-request mismatch: config.apiKey (${entry.configApiKey}) ` +
          `!= extra.authInfo.token (${entry.authInfoToken}). ` +
          `Indicates bearerMiddleware and buildHttpConfig disagree about ` +
          `which key belongs to which request.`,
      );
    }
  },
);
