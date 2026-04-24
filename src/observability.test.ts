import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { loggingMiddleware } from "./observability.js";

// Intercept stderr writes for the duration of a callback so we can
// assert what the logger does (and does not) emit.
async function captureStderr<T>(fn: () => Promise<T>): Promise<{ out: T; log: string }> {
  const originalWrite = process.stderr.write.bind(process.stderr);
  const chunks: string[] = [];
  (process.stderr.write as unknown as (buf: string | Uint8Array) => boolean) = ((
    buf: string | Uint8Array,
  ) => {
    chunks.push(typeof buf === "string" ? buf : Buffer.from(buf).toString());
    return true;
  }) as typeof process.stderr.write;
  try {
    const out = await fn();
    return { out, log: chunks.join("") };
  } finally {
    process.stderr.write = originalWrite;
  }
}

test("logger emits allowlisted JSON with no Authorization leak", async () => {
  const app = express();
  app.use(loggingMiddleware);
  app.post("/echo", (_, res) => res.json({ ok: true }));

  const { log } = await captureStderr(async () => {
    await request(app)
      .post("/echo")
      .set("Authorization", "Bearer fc-SUPER-SECRET-12345")
      .send({ body_secret: "also-must-not-leak" });
  });

  // log has exactly one line (res.on('finish') writes once)
  const lines = log.trim().split("\n").filter((l) => l.length > 0);
  assert.equal(lines.length, 1, "expected exactly one log line");

  const entry = JSON.parse(lines[0]) as Record<string, unknown>;

  // Allowlist: exactly these keys, nothing else.
  const allowed = ["ts", "method", "path", "status", "ms", "origin_ip"];
  const keys = Object.keys(entry).sort();
  assert.deepEqual(keys, [...allowed].sort(), `unexpected keys: ${keys}`);

  // Redaction: the secret must not appear anywhere in the raw log output.
  assert.ok(
    !log.includes("fc-SUPER-SECRET-12345"),
    `bearer token leaked into stderr: ${log}`,
  );
  assert.ok(
    !log.includes("also-must-not-leak"),
    `body content leaked into stderr: ${log}`,
  );
  assert.ok(
    !log.toLowerCase().includes("authorization"),
    `authorization header key leaked into stderr: ${log}`,
  );
});

test("logger emits status and method correctly on 401 path", async () => {
  const app = express();
  app.use(loggingMiddleware);
  app.get("/forbidden", (_, res) => res.status(401).json({ error: "x" }));

  const { log } = await captureStderr(async () => {
    await request(app).get("/forbidden");
  });

  const entry = JSON.parse(log.trim()) as { method: string; status: number; path: string };
  assert.equal(entry.method, "GET");
  assert.equal(entry.status, 401);
  assert.equal(entry.path, "/forbidden");
});
