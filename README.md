# @zapfetch/mcp-server

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
npm install -g @zapfetch/mcp-server
```

## Configure

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "zapfetch": {
      "command": "npx",
      "args": ["-y", "@zapfetch/mcp-server"],
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
      "args": ["-y", "@zapfetch/mcp-server"],
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
      "args": ["-y", "@zapfetch/mcp-server"],
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

After configuration, just ask your AI assistant:

- "Scrape the top 3 posts from news.ycombinator.com/newest"
- "Find me the latest TypeScript release notes on github.com"
- "Crawl docs.example.com and summarize the authentication section"
- "Extract product name, price, and stock from these 5 rakuten.co.jp URLs as JSON"

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
