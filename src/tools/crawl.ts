import { z } from "zod";
import type { ZapFetchClient } from "../client.js";

export const crawlInputSchema = {
  url: z.string().url().describe("The root URL to start crawling from"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe("Maximum pages to crawl (default 50)"),
  maxDiscoveryDepth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Maximum link depth from root URL"),
  includePaths: z
    .array(z.string())
    .optional()
    .describe("Only crawl URLs matching these path patterns (regex)"),
  excludePaths: z
    .array(z.string())
    .optional()
    .describe("Skip URLs matching these path patterns (regex)"),
  crawlEntireDomain: z
    .boolean()
    .optional()
    .describe("Crawl entire domain, not just subpath of root URL"),
};

export const crawlDescription =
  "Crawl a website and extract content from multiple pages. Use this when the user wants to gather content from an entire site or section. " +
  "Returns a job_id for async polling. Long-running — consider asking the user before invoking if the site is large. " +
  "For a single page, use zapfetch_scrape. For URL discovery only (no content), use zapfetch_map.";

type CrawlArgs = z.infer<z.ZodObject<typeof crawlInputSchema>>;

// Start an async crawl and immediately return the job ID.
// LLM can follow up with zapfetch_crawl_status to poll.
export async function crawl(client: ZapFetchClient, args: CrawlArgs) {
  const resp = await client.post<{ id?: string; url?: string }>("/v2/crawl", args);
  return {
    job_id: resp.id,
    url: resp.url,
    hint:
      "Crawl started. Poll status with zapfetch_crawl_status(job_id) — " +
      "typical small crawl (50 pages) finishes in 30-120s. Pages are returned in the final status response.",
  };
}

export const crawlStatusInputSchema = {
  job_id: z.string().describe("The crawl job ID returned from zapfetch_crawl"),
};

export const crawlStatusDescription =
  "Check the status of a running crawl job. Returns 'scraping' (in progress) or 'completed'/'failed'/'cancelled' (done). " +
  "When status=completed, returns all crawled page content. Poll every 2-5 seconds until done.";

export async function crawlStatus(client: ZapFetchClient, args: { job_id: string }) {
  return client.get(`/v2/crawl/${encodeURIComponent(args.job_id)}`);
}
