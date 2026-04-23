// STDIO transport uses stdout as JSON-RPC channel. Never call console.log
// (or anything that writes to stdout) — it corrupts the protocol stream.
// Use console.error for diagnostics; it goes to stderr and is safe.

const DEFAULT_API_URL = "https://api.zapfetch.com";

export interface Config {
  apiKey: string;
  apiUrl: string;
}

export function loadConfig(): Config {
  const apiKey = process.env.ZAPFETCH_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "error: ZAPFETCH_API_KEY environment variable is required.\n" +
        "get a key at https://console.zapfetch.com",
    );
    process.exit(1);
  }
  const rawUrl = process.env.ZAPFETCH_API_URL?.trim() || DEFAULT_API_URL;
  const apiUrl = rawUrl.replace(/\/+$/, "");
  return { apiKey, apiUrl };
}
