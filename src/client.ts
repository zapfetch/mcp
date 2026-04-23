import type { Config } from "./config.js";

const USER_AGENT = "zapfetch-mcp/0.1.0";

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
    return this.request<T>("POST", path, body);
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
