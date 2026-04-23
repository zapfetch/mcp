import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZapFetchClient, ZapFetchError } from "./client.js";
import type { Config } from "./config.js";

import {
  scrape,
  scrapeInputSchema,
  scrapeDescription,
} from "./tools/scrape.js";
import {
  search,
  searchInputSchema,
  searchDescription,
} from "./tools/search.js";
import {
  crawl,
  crawlInputSchema,
  crawlDescription,
  crawlStatus,
  crawlStatusInputSchema,
  crawlStatusDescription,
} from "./tools/crawl.js";
import {
  map,
  mapInputSchema,
  mapDescription,
} from "./tools/map.js";
import {
  extract,
  extractInputSchema,
  extractDescription,
  extractStatus,
  extractStatusInputSchema,
  extractStatusDescription,
} from "./tools/extract.js";

export function buildServer(config: Config): McpServer {
  const client = new ZapFetchClient(config);

  const server = new McpServer({
    name: "zapfetch",
    version: "0.1.0",
  });

  const wrap = <A>(
    fn: (c: ZapFetchClient, args: A) => Promise<unknown>,
  ) =>
    async (args: A) => {
      try {
        const result = await fn(client, args);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const msg =
          err instanceof ZapFetchError
            ? `ZapFetch API error (${err.status ?? "?"}): ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: msg }],
        };
      }
    };

  server.registerTool(
    "zapfetch_scrape",
    { description: scrapeDescription, inputSchema: scrapeInputSchema },
    wrap(scrape),
  );

  server.registerTool(
    "zapfetch_search",
    { description: searchDescription, inputSchema: searchInputSchema },
    wrap(search),
  );

  server.registerTool(
    "zapfetch_crawl",
    { description: crawlDescription, inputSchema: crawlInputSchema },
    wrap(crawl),
  );

  server.registerTool(
    "zapfetch_crawl_status",
    { description: crawlStatusDescription, inputSchema: crawlStatusInputSchema },
    wrap(crawlStatus),
  );

  server.registerTool(
    "zapfetch_map",
    { description: mapDescription, inputSchema: mapInputSchema },
    wrap(map),
  );

  server.registerTool(
    "zapfetch_extract",
    { description: extractDescription, inputSchema: extractInputSchema },
    wrap(extract),
  );

  server.registerTool(
    "zapfetch_extract_status",
    { description: extractStatusDescription, inputSchema: extractStatusInputSchema },
    wrap(extractStatus),
  );

  return server;
}
