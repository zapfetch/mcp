// Structured stderr logging for HTTP transport.
//
// Contract (plan §Observability):
//   - Allowlist fields: ts, method, path, status, ms, origin_ip
//   - Forbidden fields: authorization (any case), req.body, query, set-cookie,
//     headers object
//   - Emit at res.on('finish') so status/ms are final
//   - Logger must NOT interpolate any header or body content
//
// Unit-tested in src/observability.test.ts: a request carrying
// `Authorization: Bearer fc-secret` must not produce `fc-secret`
// anywhere in stderr output.

import type { Request, Response, NextFunction } from "express";

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const ms = Number((endedAt - startedAt) / 1_000_000n);

    // Strict allowlist — build object explicitly, never spread req or headers.
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
      origin_ip: req.ip ?? null,
    };

    // stderr only: stdout is reserved for any future STDIO co-use scenario
    // and for avoiding log noise in container stdout metrics.
    process.stderr.write(JSON.stringify(entry) + "\n");
  });

  next();
}
