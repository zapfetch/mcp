import type { Config } from "./config.js";
import { VERSION } from "./version.js";

const USER_AGENT = `zapfetch-mcp/${VERSION}`;

// ORIGIN_TAG marks requests originating from this MCP server. The ZapFetch
// backend's compat layer (and upstream Firecrawl) both check whether the
// request body's `origin` field contains "mcp", which lets billingHints
// split usage into "from MCP client" vs "from direct API/SDK" without any
// extra header plumbing. Keep the "mcp/" prefix — that substring is the
// signal the backend looks for.
const ORIGIN_TAG = `mcp/zapfetch@${VERSION}`;

export class ZapFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "ZapFetchError";
  }
}

export class ZapFetchClient {
  constructor(private readonly config: Config) {}

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, withOrigin(body));
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path, undefined);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path, undefined);
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "User-Agent": USER_AGENT,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const resp = await fetch(`${this.config.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await resp.text();
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`;
      let code: string | undefined;
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string; code?: string };
        msg = parsed.error ?? parsed.message ?? msg;
        code = parsed.code;
      } catch {
        // body isn't JSON; keep default msg
      }
      throw new ZapFetchError(msg, resp.status, code);
    }

    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }
}

// withOrigin stamps ORIGIN_TAG onto a JSON-object request body so backend
// telemetry can attribute the call to this MCP server. Callers that already
// set `origin` (e.g. integrations layered on top of us) keep their value;
// non-object bodies (arrays, primitives, null) pass through untouched.
function withOrigin(body: unknown): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.origin === "string" && record.origin.length > 0) {
    return body;
  }
  return { ...record, origin: ORIGIN_TAG };
}
