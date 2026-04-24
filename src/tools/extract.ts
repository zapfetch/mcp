import { z } from "zod";
import type { ZapFetchClient } from "../client.js";

export const extractInputSchema = {
  urls: z
    .array(z.string().url())
    .min(1)
    .max(100)
    .describe("URLs to extract structured data from"),
  prompt: z
    .string()
    .min(1)
    .describe(
      "What to extract. Be specific — e.g. 'product name, price, and availability from each page'",
    ),
  schema: z
    .record(z.any())
    .optional()
    .describe(
      "Optional JSON schema describing the output shape. Improves consistency when extracting across many URLs.",
    ),
};

export const extractDescription =
  "Extract structured data from one or more URLs using natural language prompt + optional JSON schema. " +
  "Use this when the user wants JSON-shaped data (not markdown), especially across multiple pages with the same structure " +
  "(e.g. product listings, job postings, article metadata). Returns a job — poll with zapfetch_extract_status.";

type ExtractArgs = z.infer<z.ZodObject<typeof extractInputSchema>>;

export async function extract(client: ZapFetchClient, args: ExtractArgs) {
  const resp = await client.post<{ id?: string } | unknown>("/v2/extract", args);
  if (resp && typeof resp === "object" && "id" in resp) {
    return {
      job_id: (resp as { id: string }).id,
      hint: "Extract started. Poll status with zapfetch_extract_status(job_id). Typical completion: 20-60s.",
    };
  }
  return resp;
}

export const extractStatusInputSchema = {
  job_id: z.string().describe("The extract job ID returned from zapfetch_extract"),
};

export const extractStatusDescription =
  "Check the status of a running extract job. Returns 'processing' (in progress) or 'completed'/'failed'/'cancelled' (done). " +
  "When status=completed, returns the extracted structured data for all input URLs. Poll every 2-5 seconds until done.";

export async function extractStatus(client: ZapFetchClient, args: { job_id: string }) {
  return client.get(`/v2/extract/${encodeURIComponent(args.job_id)}`);
}
