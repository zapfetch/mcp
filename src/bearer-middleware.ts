// Custom Bearer middleware for HTTP transport.
//
// Why not the SDK's built-in @modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js:
//   - it requires a `verifier` plus `expiresAt` validation
//   - ZapFetch API keys are opaque, non-expiring, and pass through to upstream —
//     edge-level validity checks are out of scope for v0.2
//
// Plan semantics (Principle 2): "presence validation only, not validity".
// A bad token surfaces as 401/403 from upstream `fetch`, not from us.
//
// Contract: on success, attach `req.auth = {token, clientId, scopes:[]}`
// so StreamableHTTPServerTransport propagates it via WeakMap into
// `extra.authInfo.token` in tool handlers. Field name is `req.auth`
// (matches SDK `bearerAuth.d.ts:22-24`), NOT `req.authInfo`.
//
// Must NEVER write auth state to `req.app.locals` or `res.locals` —
// those are Express-instance-shared and would leak across tenants.

import type { Request, Response, NextFunction } from "express";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { parseBearer, UnauthorizedError } from "./config.js";

// Express module augmentation: the SDK declares `Request.auth?: AuthInfo`
// globally when the SDK's own middleware is imported, but we declare it
// explicitly here so this module type-checks regardless of import order.
declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthInfo;
  }
}

export function bearerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const token = parseBearer(req.header("authorization"));
    // SDK's AuthInfo requires token + clientId + scopes[]. expiresAt is
    // optional; leaving it unset means our middleware doesn't trigger
    // the SDK's built-in expiry check (good, our keys don't carry expiry).
    req.auth = {
      token,
      clientId: "zapfetch-http",
      scopes: [],
    };
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: "unauthorized", code: err.code });
      return;
    }
    // Defensive: never swallow unknown errors here.
    throw err;
  }
}
