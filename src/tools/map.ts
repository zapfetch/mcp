import { z } from "zod";
import type { ZapFetchClient } from "../client.js";

export const mapInputSchema = {
  url: z.string().url().describe("The URL to map — discover all URLs on this site"),
  search: z
    .string()
    .optional()
    .describe("Filter discovered URLs by this search term (matches URL, title, or description)"),
  limit: z.number().int().min(1).max(5000).optional().describe("Max URLs to return (default 100)"),
  sitemap: z
    .enum(["include", "skip", "only"])
    .optional()
    .describe("How to use the site's sitemap.xml: include (default), skip, or only"),
};

export const mapDescription =
  "Discover all URLs on a website without crawling content. Fast — use this to survey a site before deciding what to crawl. " +
  "Returns list of URLs, optionally with titles/descriptions. Much cheaper than zapfetch_crawl (no content extraction). " +
  "Use zapfetch_scrape or zapfetch_crawl on specific URLs from the result.";

type MapArgs = {
  url: string;
  search?: string;
  limit?: number;
  sitemap?: "include" | "skip" | "only";
};

export async function map(client: ZapFetchClient, args: MapArgs) {
  const resp = await client.post<{ data?: unknown } | unknown>("/v2/map", args);
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as { data: unknown }).data;
  }
  return resp;
}
