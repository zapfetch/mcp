// Error body sanitization for HTTP transport mode.
//
// In STDIO mode, verbose upstream error messages are fine — the user
// controls both client and server. In HTTP mode, responses may be
// forwarded to third-party agent frameworks and logged externally, so
// we never transit arbitrary upstream error strings. Only allowlisted
// error codes surface with a stable user-facing message; everything
// else collapses to "upstream_error".

import { ZapFetchError } from "./client.js";

interface SanitizedError {
  code: string;
  userMessage: string;
}

const ALLOWLIST: Record<string, string> = {
  rate_limit: "Rate limit exceeded. Check your plan quota.",
  invalid_key: "Invalid or revoked API key.",
  quota_exceeded: "Monthly credit quota exceeded.",
  upstream_unavailable: "Upstream temporarily unavailable. Retry later.",
};

export function sanitizeErrorForHttp(err: unknown): SanitizedError {
  if (err instanceof ZapFetchError) {
    const code = err.errorCode;
    if (code && code in ALLOWLIST) {
      return { code, userMessage: ALLOWLIST[code] };
    }
    // Map HTTP status into coarse categories without leaking backend text.
    if (err.status === 401 || err.status === 403) {
      return { code: "invalid_key", userMessage: ALLOWLIST.invalid_key };
    }
    if (err.status === 429) {
      return { code: "rate_limit", userMessage: ALLOWLIST.rate_limit };
    }
    if (err.status && err.status >= 500) {
      return {
        code: "upstream_unavailable",
        userMessage: ALLOWLIST.upstream_unavailable,
      };
    }
  }
  return { code: "upstream_error", userMessage: "Request failed." };
}
