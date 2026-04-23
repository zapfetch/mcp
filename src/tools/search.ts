import { z } from "zod";
import type { ZapFetchClient } from "../client.js";

export const searchInputSchema = {
  query: z.string().min(1).describe("The search query"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results to return (default 10)"),
  tbs: z
    .string()
    .optional()
    .describe("Time-based search filter, e.g. 'qdr:d' for past day, 'qdr:w' for past week"),
  location: z
    .string()
    .optional()
    .describe("Search location hint, e.g. 'Tokyo, Japan' for APAC-focused results"),
};

export const searchDescription =
  "Search the web and optionally scrape results. Use this when the user wants to find information across multiple sites — like a programmable Google. " +
  "Returns structured list of result URLs with titles and snippets. Use zapfetch_scrape to fetch full content of a specific result.";

type SearchArgs = z.infer<z.ZodObject<typeof searchInputSchema>>;

export async function search(client: ZapFetchClient, args: SearchArgs) {
  const resp = await client.post<{ data?: unknown } | unknown>("/v2/search", args);
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as { data: unknown }).data;
  }
  return resp;
}
