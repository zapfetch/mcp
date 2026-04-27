import { strict as assert } from "node:assert";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, test } from "node:test";

import { ZapFetchClient, ZapFetchError } from "./client.js";
import { VERSION } from "./version.js";

describe("ZapFetchClient", () => {
  let server: Server;
  let baseUrl: string;
  let lastBody: Record<string, unknown> | null = null;
  let lastMethod: string | null = null;
  let lastPath: string | null = null;
  let nextStatus = 200;
  let nextResponse = "{}";

  before(
    () =>
      new Promise<void>((resolve, reject) => {
        server = createServer((req, res) => {
          lastMethod = req.method ?? null;
          lastPath = req.url ?? null;
          let chunks = "";
          req.on("data", (c) => {
            chunks += c.toString();
          });
          req.on("end", () => {
            lastBody = chunks ? (JSON.parse(chunks) as Record<string, unknown>) : null;
            res.writeHead(nextStatus, { "Content-Type": "application/json" });
            res.end(nextResponse);
          });
        });
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          const addr = server.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      }),
  );

  after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  );

  beforeEach(() => {
    lastBody = null;
    lastMethod = null;
    lastPath = null;
    nextStatus = 200;
    nextResponse = "{}";
  });

  const newClient = () => new ZapFetchClient({ apiKey: "test", apiUrl: baseUrl });

  test("POST injects origin=mcp/zapfetch@<version>", async () => {
    await newClient().post("/v2/scrape", { url: "https://example.com" });
    assert.equal(lastMethod, "POST");
    assert.equal(lastPath, "/v2/scrape");
    assert.ok(lastBody);
    assert.equal(lastBody.url, "https://example.com");
    assert.equal(lastBody.origin, `mcp/zapfetch@${VERSION}`);
  });

  test("POST preserves caller-provided origin if already set", async () => {
    await newClient().post("/v2/scrape", {
      url: "https://a.com",
      origin: "mcp/some-wrapper@1.0",
    });
    assert.ok(lastBody);
    assert.equal(lastBody.origin, "mcp/some-wrapper@1.0");
  });

  test("GET sends no body and does not error on origin injection", async () => {
    await newClient().get("/v2/crawl/job-1");
    assert.equal(lastMethod, "GET");
    assert.equal(lastBody, null);
  });

  test("DELETE sends no body", async () => {
    await newClient().delete("/v2/crawl/job-1");
    assert.equal(lastMethod, "DELETE");
    assert.equal(lastBody, null);
  });

  test("non-2xx response throws ZapFetchError with status + message", async () => {
    nextStatus = 429;
    nextResponse = JSON.stringify({ error: "slow down", code: "rate_limited" });
    await assert.rejects(
      newClient().post("/v2/scrape", { url: "https://a.com" }),
      (err) => {
        assert.ok(err instanceof ZapFetchError, "expected ZapFetchError");
        assert.equal(err.status, 429);
        assert.equal(err.message, "slow down");
        assert.equal(err.errorCode, "rate_limited");
        return true;
      },
    );
  });
});
