import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBearer,
  UnauthorizedError,
  assertHttpModeCleanEnv,
  loadStdioConfig,
  buildHttpConfig,
} from "./config.js";

test("parseBearer — valid Bearer returns token", () => {
  assert.equal(parseBearer("Bearer fc-abc123"), "fc-abc123");
});

test("parseBearer — multiple spaces between Bearer and token", () => {
  assert.equal(parseBearer("Bearer   fc-abc"), "fc-abc");
});

test("parseBearer — leading/trailing whitespace trimmed", () => {
  assert.equal(parseBearer("  Bearer fc-xyz  "), "fc-xyz");
});

test("parseBearer — missing header throws missing_bearer", () => {
  try {
    parseBearer(undefined);
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof UnauthorizedError);
    assert.equal((err as UnauthorizedError).code, "missing_bearer");
  }
});

test("parseBearer — empty header throws missing_bearer", () => {
  try {
    parseBearer("");
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof UnauthorizedError);
    assert.equal((err as UnauthorizedError).code, "missing_bearer");
  }
});

test("parseBearer — wrong scheme (Basic) throws malformed_bearer", () => {
  try {
    parseBearer("Basic dXNlcjpwYXNz");
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof UnauthorizedError);
    assert.equal((err as UnauthorizedError).code, "malformed_bearer");
  }
});

test("parseBearer — no token after Bearer throws malformed_bearer", () => {
  try {
    parseBearer("Bearer");
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof UnauthorizedError);
    assert.equal((err as UnauthorizedError).code, "malformed_bearer");
  }
});

test("parseBearer — Bearer with only whitespace token throws", () => {
  try {
    parseBearer("Bearer   ");
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof UnauthorizedError);
    assert.equal((err as UnauthorizedError).code, "malformed_bearer");
  }
});

test("assertHttpModeCleanEnv — rejects when ZAPFETCH_API_KEY is set", () => {
  // Spawn via child_process so process.exit(2) doesn't kill the test runner.
  // We avoid this by using a process.exit stub instead.
  const originalExit = process.exit;
  const originalErr = process.env.ZAPFETCH_API_KEY;
  const originalConsoleError = console.error;

  let exitCode: number | undefined;
  (process.exit as unknown as (code?: number) => void) = ((
    code?: number,
  ) => {
    exitCode = code;
    throw new Error(`__test_exit__${code}`);
  }) as typeof process.exit;
  console.error = () => {};

  try {
    process.env.ZAPFETCH_API_KEY = "fc-should-not-be-set";
    assert.throws(() => assertHttpModeCleanEnv(), /__test_exit__2/);
    assert.equal(exitCode, 2);
  } finally {
    process.exit = originalExit;
    console.error = originalConsoleError;
    if (originalErr === undefined) {
      delete process.env.ZAPFETCH_API_KEY;
    } else {
      process.env.ZAPFETCH_API_KEY = originalErr;
    }
  }
});

test("assertHttpModeCleanEnv — passes when env is clean", () => {
  const originalErr = process.env.ZAPFETCH_API_KEY;
  delete process.env.ZAPFETCH_API_KEY;
  try {
    assert.doesNotThrow(() => assertHttpModeCleanEnv());
  } finally {
    if (originalErr !== undefined) {
      process.env.ZAPFETCH_API_KEY = originalErr;
    }
  }
});

test("loadStdioConfig — reads env and normalizes trailing slashes", () => {
  const prev = {
    key: process.env.ZAPFETCH_API_KEY,
    url: process.env.ZAPFETCH_API_URL,
  };
  process.env.ZAPFETCH_API_KEY = "  fc-test-key  ";
  process.env.ZAPFETCH_API_URL = "https://api.example.com///";
  try {
    const config = loadStdioConfig();
    assert.equal(config.apiKey, "fc-test-key");
    assert.equal(config.apiUrl, "https://api.example.com");
  } finally {
    if (prev.key === undefined) delete process.env.ZAPFETCH_API_KEY;
    else process.env.ZAPFETCH_API_KEY = prev.key;
    if (prev.url === undefined) delete process.env.ZAPFETCH_API_URL;
    else process.env.ZAPFETCH_API_URL = prev.url;
  }
});

test("buildHttpConfig — uses provided token and env-based apiUrl", () => {
  const prev = process.env.ZAPFETCH_API_URL;
  process.env.ZAPFETCH_API_URL = "https://api.example.com";
  try {
    const config = buildHttpConfig("fc-per-request");
    assert.equal(config.apiKey, "fc-per-request");
    assert.equal(config.apiUrl, "https://api.example.com");
  } finally {
    if (prev === undefined) delete process.env.ZAPFETCH_API_URL;
    else process.env.ZAPFETCH_API_URL = prev;
  }
});
