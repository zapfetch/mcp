import { z } from "zod";
import type { ZapFetchClient } from "../client.js";

export const scrapeInputSchema = {
  url: z.string().url().describe("The URL to scrape"),
  formats: z
    .array(z.enum(["markdown", "html", "rawHtml", "links", "screenshot"]))
    .optional()
    .describe("Output formats to return. Default: ['markdown']"),
  onlyMainContent: z
    .boolean()
    .optional()
    .describe("Strip nav/footer/sidebar to keep main article only"),
  waitFor: z
    .number()
    .int()
    .min(0)
    .max(60000)
    .optional()
    .describe("Milliseconds to wait for JS rendering before extracting"),
  mobile: z.boolean().optional().describe("Emulate mobile user agent"),
  location: z
    .object({
      country: z.string().describe("ISO 3166-1 alpha-2 country code, e.g. JP, KR, CN, SG"),
      languages: z.array(z.string()).optional(),
    })
    .optional()
    .describe("Geographic location — use for APAC sites needing local IPs"),
};

export const scrapeDescription =
  "Scrape a single web page. Use this when the user wants to extract the content of ONE specific URL. " +
  "Returns clean markdown (and other formats) of the page content. For crawling multiple URLs on a site, use zapfetch_crawl instead.";

type ScrapeArgs = z.infer<z.ZodObject<typeof scrapeInputSchema>>;

export async function scrape(client: ZapFetchClient, args: ScrapeArgs) {
  const resp = await client.post<{ data?: unknown } | unknown>("/v2/scrape", args);
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as { data: unknown }).data;
  }
  return resp;
}
