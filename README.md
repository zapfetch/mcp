# @zapfetchdev/mcp-server

MCP (Model Context Protocol) server for [ZapFetch](https://zapfetch.com) — APAC-native web scraping API for AI agents.

Use ZapFetch directly from Claude Desktop, Cursor, Windsurf, and any other MCP-compatible client.

## Tools

- `zapfetch_scrape` — scrape a single URL
- `zapfetch_search` — web search with optional content extraction
- `zapfetch_crawl` — crawl a website (async, returns job_id)
- `zapfetch_crawl_status` — poll crawl job progress
- `zapfetch_map` — discover URLs on a site (fast, no content)
- `zapfetch_extract` — extract structured data with a prompt + schema
- `zapfetch_extract_status` — poll extract job progress

Docs: https://docs.zapfetch.com

For docs lookups, Claude/Cursor/Windsurf can also use the auto-generated Mintlify MCP at `https://docs.zapfetch.com/mcp`.

## Prerequisites

- Node.js 20+
- A ZapFetch API key ([get one here](https://console.zapfetch.com))

## Install

```bash
npm install -g @zapfetchdev/mcp-server
```

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "zapfetch": {
      "command": "npx",
      "args": ["-y", "@zapfetchdev/mcp-server"],
      "env": {
        "ZAPFETCH_API_KEY": "zf-your-api-key"
      }
    }
  }
}
```

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zapfetch": {
      "command": "npx",
      "args": ["-y", "@zapfetchdev/mcp-server"],
      "env": { "ZAPFETCH_API_KEY": "zf-your-api-key" }
    }
  }
}
```

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "zapfetch": {
      "command": "npx",
      "args": ["-y", "@zapfetchdev/mcp-server"],
      "env": { "ZAPFETCH_API_KEY": "zf-your-api-key" }
    }
  }
}
```

## Environment Variables

| Variable            | Required | Default                   | Description                  |
|---------------------|----------|---------------------------|------------------------------|
| `ZAPFETCH_API_KEY`  | yes      | —                         | Your ZapFetch API key        |
| `ZAPFETCH_API_URL`  | no       | `https://api.zapfetch.com`| Override for self-host / dev |

## Usage Examples

After configuration, ask your AI assistant naturally — it will pick the right tool automatically.

### Scrape a single page

> "Scrape https://rakuten.co.jp and give me the main content as markdown."

Uses `zapfetch_scrape`. Best for a known URL where you want raw page content quickly. If the page is geo-blocked or returns sparse content, follow up with a search instead.

### Search the web

> "Find the top 5 recent blog posts about TypeScript 5.7 and summarize each one."

Uses `zapfetch_search`. Returns ranked results with optional content extraction. Useful when you don't have a specific URL yet, or as a fallback when a direct scrape comes up empty.

### Crawl a site (multi-page)

> "Crawl https://docs.example.com starting from the root, up to 50 pages, and summarize the authentication section."

Uses `zapfetch_crawl` to kick off an async job (returns a `job_id`), then `zapfetch_crawl_status` to poll until complete. The assistant handles the polling loop — you just wait for the result.

**Tip:** For large sites, map first (see below) to identify which URLs are worth crawling before committing.

### Map a site (URL discovery)

> "List all URLs under https://docs.example.com/api so I can decide which pages to scrape."

Uses `zapfetch_map`. Returns URLs only — no content fetched — so it's fast even on large sites. Pair with `zapfetch_scrape` to cherry-pick the pages you actually need:

> "Map https://stripe.com/docs, then scrape the 3 pages most relevant to webhook setup."

### Extract structured data

> "Extract product name, price, currency, and stock status from these 5 rakuten.co.jp product URLs. Return as a JSON array."

Uses `zapfetch_extract` with a prompt and optional JSON schema. The job is async — `zapfetch_extract_status` polls it to completion. Good for turning arbitrary product pages, job listings, or articles into structured records at scale.

### Poll extract job status

> "Check whether the extract job job_abc123 is done."

Uses `zapfetch_extract_status` directly. You rarely need to ask for this by name — the assistant calls it automatically after `zapfetch_extract` — but it's useful if you started a job in a previous session and want to retrieve results later.

### Combining tools

Tools compose naturally. A few common patterns:

- **Survey then scrape:** map a large site to get all URLs, filter to the relevant ones, scrape each.
- **Search then scrape:** search to find the canonical source for a topic, then scrape that page for full content.
- **Scrape with fallback:** if `zapfetch_scrape` returns thin content (e.g. JS-heavy page), the assistant can fall back to `zapfetch_search` to find a cached or mirror version.

## Migrating from Firecrawl MCP

ZapFetch is Firecrawl-compatible at the API level, but this MCP uses `zapfetch_*` tool names (not `firecrawl_*`) to avoid conflicts if you run both. Capabilities are 1:1 — just update prompts referring to tool names.

## Development

```bash
pnpm install        # or npm install
npm run typecheck
npm run build       # -> dist/
```

Local test with Claude Desktop pointed at your build:

```json
{
  "mcpServers": {
    "zapfetch-dev": {
      "command": "node",
      "args": ["/absolute/path/to/zapfetch-mcp/dist/index.js"],
      "env": { "ZAPFETCH_API_KEY": "zf-..." }
    }
  }
}
```

## License

MIT
