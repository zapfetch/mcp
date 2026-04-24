// Tool handler coverage: asserts each of the 7 tools routes to the
// correct upstream path, preserves its input body, and shapes its
// response as the MCP layer expects. Existing client.test.ts already
// covers transport concerns (origin tag, error wrapping, GET/DELETE
// behavior); this file focuses on the thin wrappers in src/tools/*.
//
// Pattern matches src/client.test.ts — a local node:http server that
// echoes method/path/body and returns a canned response.

import { strict as assert } from "node:assert";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, test } from "node:test";

import { ZapFetchClient, ZapFetchError } from "./client.js";
import { scrape } from "./tools/scrape.js";
import { search } from "./tools/search.js";
import { map } from "./tools/map.js";
import { crawl, crawlStatus } from "./tools/crawl.js";
import { extract, extractStatus } from "./tools/extract.js";

describe("tool handlers", () => {
  let server: Server;
  let baseUrl: string;
  let lastMethod: string | null = null;
  let lastPath: string | null = null;
  let lastBody: Record<string, unknown> | null = null;
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
    lastMethod = null;
    lastPath = null;
    lastBody = null;
    nextStatus = 200;
    nextResponse = "{}";
  });

  const newClient = () => new ZapFetchClient({ apiKey: "test", apiUrl: baseUrl });

  // ----- scrape -----

  test("scrape — POSTs /v2/scrape with args", async () => {
    nextResponse = JSON.stringify({
      data: { markdown: "# hello", metadata: { title: "Example" } },
    });
    const result = await scrape(newClient(), {
      url: "https://example.com",
      formats: ["markdown"],
    });
    assert.equal(lastMethod, "POST");
    assert.equal(lastPath, "/v2/scrape");
    assert.equal((lastBody as Record<string, unknown>).url, "https://example.com");
    assert.deepEqual((lastBody as Record<string, unknown>).formats, ["markdown"]);
    assert.deepEqual(result, { markdown: "# hello", metadata: { title: "Example" } });
  });

  test("scrape — unwraps .data when present", async () => {
    nextResponse = JSON.stringify({ data: { foo: 1 } });
    const result = await scrape(newClient(), { url: "https://example.com" });
    assert.deepEqual(result, { foo: 1 });
  });

  test("scrape — returns full response when no .data", async () => {
    nextResponse = JSON.stringify({ foo: 2 });
    const result = await scrape(newClient(), { url: "https://example.com" });
    assert.deepEqual(result, { foo: 2 });
  });

  // ----- search -----

  test("search — POSTs /v2/search with query", async () => {
    nextResponse = JSON.stringify({
      data: [{ title: "r1", url: "https://a.example" }],
    });
    const result = await search(newClient(), {
      query: "typescript 5.7",
      limit: 3,
    });
    assert.equal(lastMethod, "POST");
    assert.equal(lastPath, "/v2/search");
    assert.equal((lastBody as Record<string, unknown>).query, "typescript 5.7");
    assert.equal((lastBody as Record<string, unknown>).limit, 3);
    assert.deepEqual(result, [{ title: "r1", url: "https://a.example" }]);
  });

  test("search — preserves optional location field", async () => {
    nextResponse = JSON.stringify({ data: [] });
    await search(newClient(), { query: "rakuten", location: "Tokyo, Japan" });
    assert.equal((lastBody as Record<string, unknown>).location, "Tokyo, Japan");
  });

  // ----- map -----

  test("map — POSTs /v2/map with url", async () => {
    nextResponse = JSON.stringify({
      data: { links: ["https://a.example/1", "https://a.example/2"] },
    });
    const result = await map(newClient(), { url: "https://a.example" });
    assert.equal(lastMethod, "POST");
    assert.equal(lastPath, "/v2/map");
    assert.deepEqual(result, { links: ["https://a.example/1", "https://a.example/2"] });
  });

  test("map — forwards sitemap mode", async () => {
    nextResponse = JSON.stringify({ data: { links: [] } });
    await map(newClient(), { url: "https://a.example", sitemap: "only" });
    assert.equal((lastBody as Record<string, unknown>).sitemap, "only");
  });

  // ----- crawl -----

  test("crawl — POSTs /v2/crawl and wraps response with job_id + hint", async () => {
    nextResponse = JSON.stringify({
      id: "job-abc-123",
      url: "https://a.example",
    });
    const result = await crawl(newClient(), { url: "https://a.example", limit: 50 });
    assert.equal(lastMethod, "POST");
    assert.equal(lastPath, "/v2/crawl");
    assert.equal((result as { job_id: string }).job_id, "job-abc-123");
    assert.equal((result as { url: string }).url, "https://a.example");
    // Hint is narration the LLM uses to decide polling behavior — its
    // presence is part of the tool contract, not its exact text.
    assert.ok(typeof (result as { hint: string }).hint === "string");
    assert.ok((result as { hint: string }).hint.includes("zapfetch_crawl_status"));
  });

  test("crawl — forwards includePaths / excludePaths / depth options", async () => {
    nextResponse = JSON.stringify({ id: "job-x" });
    await crawl(newClient(), {
      url: "https://a.example",
      includePaths: ["/blog/.*"],
      excludePaths: ["/admin/.*"],
      maxDiscoveryDepth: 3,
    });
    const body = lastBody as Record<string, unknown>;
    assert.deepEqual(body.includePaths, ["/blog/.*"]);
    assert.deepEqual(body.excludePaths, ["/admin/.*"]);
    assert.equal(body.maxDiscoveryDepth, 3);
  });

  // ----- crawlStatus -----

  test("crawlStatus — GETs /v2/crawl/<job_id>", async () => {
    nextResponse = JSON.stringify({ status: "scraping", completed: 5, total: 50 });
    const result = await crawlStatus(newClient(), { job_id: "job-abc-123" });
    assert.equal(lastMethod, "GET");
    assert.equal(lastPath, "/v2/crawl/job-abc-123");
    assert.deepEqual(result, { status: "scraping", completed: 5, total: 50 });
  });

  test("crawlStatus — URL-encodes job_id containing slashes", async () => {
    nextResponse = JSON.stringify({ status: "completed" });
    await crawlStatus(newClient(), { job_id: "job/with/slashes" });
    // Slashes in a path segment must be percent-encoded so the server
    // routes to /v2/crawl/<encoded> rather than matching a deeper path.
    assert.equal(lastPath, "/v2/crawl/job%2Fwith%2Fslashes");
  });

  // ----- extract -----

  test("extract — POSTs /v2/extract and wraps response with job_id + hint", async () => {
    nextResponse = JSON.stringify({ id: "ext-9" });
    const result = await extract(newClient(), {
      urls: ["https://a.example/1"],
      prompt: "extract title",
    });
    assert.equal(lastMethod, "POST");
    assert.equal(lastPath, "/v2/extract");
    assert.equal((result as { job_id: string }).job_id, "ext-9");
    assert.ok((result as { hint: string }).hint.includes("zapfetch_extract_status"));
  });

  test("extract — passes through optional schema field", async () => {
    nextResponse = JSON.stringify({ id: "ext-10" });
    const schema = {
      type: "object",
      properties: { title: { type: "string" } },
    };
    await extract(newClient(), {
      urls: ["https://a.example/1"],
      prompt: "extract",
      schema,
    });
    assert.deepEqual((lastBody as Record<string, unknown>).schema, schema);
  });

  test("extract — returns raw response if id missing", async () => {
    nextResponse = JSON.stringify({ error: "no-id-form" });
    const result = await extract(newClient(), {
      urls: ["https://a.example/1"],
      prompt: "extract",
    });
    // No id → unwrap to raw response; caller decides how to surface error.
    assert.deepEqual(result, { error: "no-id-form" });
  });

  // ----- extractStatus -----

  test("extractStatus — GETs /v2/extract/<job_id>", async () => {
    nextResponse = JSON.stringify({ status: "completed", data: [{ title: "x" }] });
    const result = await extractStatus(newClient(), { job_id: "ext-9" });
    assert.equal(lastMethod, "GET");
    assert.equal(lastPath, "/v2/extract/ext-9");
    assert.deepEqual(result, { status: "completed", data: [{ title: "x" }] });
  });

  // ----- error propagation -----

  test("errors bubble up from any tool unchanged", async () => {
    // client.ts reads `code` (not `error`) from the response body as
    // the machine-readable error identifier; `error` / `message` fall
    // back into the human-readable `msg`. See client.ts:60-67.
    nextStatus = 429;
    nextResponse = JSON.stringify({
      error: "Too many requests",
      code: "rate_limit",
    });
    try {
      await scrape(newClient(), { url: "https://a.example" });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof ZapFetchError);
      assert.equal((err as ZapFetchError).status, 429);
      assert.equal((err as ZapFetchError).errorCode, "rate_limit");
      assert.equal((err as ZapFetchError).message, "Too many requests");
    }
  });

  test("origin tag is still injected on tool calls (sanity: wraps client.post)", async () => {
    // Separate check from client.test.ts: confirms the tool path
    // actually uses client.post (and therefore inherits origin tagging).
    nextResponse = JSON.stringify({ data: {} });
    await scrape(newClient(), { url: "https://a.example" });
    assert.ok(typeof (lastBody as Record<string, unknown>).origin === "string");
    assert.ok(((lastBody as Record<string, unknown>).origin as string).startsWith("mcp/"));
  });
});
