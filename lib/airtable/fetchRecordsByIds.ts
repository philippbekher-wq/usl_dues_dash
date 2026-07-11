import type Airtable from "airtable";
import { getBase } from "./client";
import { AirtableFetchError } from "./errors";

type AirtableRecord = Airtable.Record<Airtable.FieldSet>;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Batch-fetches records by ID via chunked OR(RECORD_ID()=...) formulas (avoids a full table scan). */
export async function fetchRecordsByIds(
  table: string,
  ids: string[],
  chunkSize = 80,
): Promise<AirtableRecord[]> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return [];

  const base = getBase();
  const results: AirtableRecord[] = [];

  try {
    for (const idChunk of chunk(uniqueIds, chunkSize)) {
      const formula = `OR(${idChunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const records = await base(table).select({ filterByFormula: formula }).all();
      results.push(...records);
    }
  } catch (error) {
    throw new AirtableFetchError(`Failed to fetch records from "${table}"`, error);
  }

  return results;
}
