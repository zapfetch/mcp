import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeErrorForHttp } from "./error-sanitize.js";
import { ZapFetchError } from "./client.js";

test("sanitize — allowlisted errorCode passes through with user message", () => {
  const err = new ZapFetchError("raw backend detail", 429, "rate_limit");
  const out = sanitizeErrorForHttp(err);
  assert.equal(out.code, "rate_limit");
  assert.ok(out.userMessage.includes("Rate limit"));
  assert.ok(!out.userMessage.includes("raw backend detail"));
});

test("sanitize — 401 status maps to invalid_key regardless of message", () => {
  const err = new ZapFetchError("Firecrawl internal: customer_id mismatch", 401);
  const out = sanitizeErrorForHttp(err);
  assert.equal(out.code, "invalid_key");
  assert.ok(!out.userMessage.includes("customer_id"));
});

test("sanitize — 5xx status maps to upstream_unavailable", () => {
  const err = new ZapFetchError("redis connection pool exhausted", 503);
  const out = sanitizeErrorForHttp(err);
  assert.equal(out.code, "upstream_unavailable");
  assert.ok(!out.userMessage.includes("redis"));
});

test("sanitize — unknown ZapFetchError collapses to upstream_error", () => {
  const err = new ZapFetchError("weird debug string: xyz-bucket-0", 418, "teapot");
  const out = sanitizeErrorForHttp(err);
  assert.equal(out.code, "upstream_error");
  assert.ok(!out.userMessage.includes("xyz-bucket"));
});

test("sanitize — non-ZapFetchError collapses to upstream_error", () => {
  const err = new Error("some generic js error");
  const out = sanitizeErrorForHttp(err);
  assert.equal(out.code, "upstream_error");
  assert.ok(!out.userMessage.includes("generic js error"));
});
