// Config split between STDIO and HTTP transport modes.
//
// STDIO mode (v0.1 path): reads ZAPFETCH_API_KEY from env. Single-tenant;
// the operator owns both client and server.
//
// HTTP mode (v0.2 new): must NOT read ZAPFETCH_API_KEY from env. Key comes
// per-request from `Authorization: Bearer`. Env-present key in HTTP mode is
// a operator-misconfiguration (container accidentally inherits STDIO env)
// that would silently serve all HTTP clients from the operator's key —
// so we fail-fast at HTTP server boot.
//
// Note: STDIO transport uses stdout as JSON-RPC channel. Never call
// console.log (or anything writing to stdout) — it corrupts the protocol
// stream. Use console.error for diagnostics; stderr is safe.

const DEFAULT_API_URL = "https://api.zapfetch.com";

export interface Config {
  apiKey: string;
  apiUrl: string;
}

function normalizeApiUrl(raw: string | undefined): string {
  const url = raw?.trim() || DEFAULT_API_URL;
  return url.replace(/\/+$/, "");
}

export function loadStdioConfig(): Config {
  const apiKey = process.env.ZAPFETCH_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "error: ZAPFETCH_API_KEY environment variable is required.\n" +
        "get a key at https://console.zapfetch.com",
    );
    process.exit(1);
  }
  return { apiKey, apiUrl: normalizeApiUrl(process.env.ZAPFETCH_API_URL) };
}

// Backwards-compat alias so existing imports (src/index.ts) don't break
// during the split. Prefer `loadStdioConfig` in new code.
export const loadConfig = loadStdioConfig;

// Called at HTTP server boot. Rejects any accidental ZAPFETCH_API_KEY env
// leak from a misconfigured container; HTTP mode takes keys only via
// Authorization header. Exit code 2 distinguishes this from normal startup
// errors (exit 1) in container orchestrators.
export function assertHttpModeCleanEnv(): void {
  if (process.env.ZAPFETCH_API_KEY) {
    console.error(
      "FATAL: ZAPFETCH_API_KEY must not be set in HTTP mode.\n" +
        "HTTP mode takes keys per-request via `Authorization: Bearer <key>`.\n" +
        "Unset the env var or switch to STDIO mode (ZAPFETCH_TRANSPORT=stdio).",
    );
    process.exit(2);
  }
}

// Extract a Bearer token from an Authorization header value.
// Throws on missing or malformed; the HTTP handler maps the code to a
// 401 response body.
export class UnauthorizedError extends Error {
  constructor(public readonly code: "missing_bearer" | "malformed_bearer") {
    super(code);
    this.name = "UnauthorizedError";
  }
}

const BEARER_RE = /^Bearer\s+(\S+)$/;

export function parseBearer(headerValue: string | undefined): string {
  if (!headerValue) throw new UnauthorizedError("missing_bearer");
  const match = BEARER_RE.exec(headerValue.trim());
  if (!match) throw new UnauthorizedError("malformed_bearer");
  return match[1];
}

// Build a per-request Config for HTTP mode. apiKey comes from the
// request's Authorization header (parsed by bearerMiddleware which sets
// req.auth); apiUrl is shared across requests via env.
export function buildHttpConfig(apiKey: string): Config {
  return { apiKey, apiUrl: normalizeApiUrl(process.env.ZAPFETCH_API_URL) };
}
