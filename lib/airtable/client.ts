import Airtable from "airtable";

let cachedBase: Airtable.Base | null = null;

export function getBase(): Airtable.Base {
  if (cachedBase) return cachedBase;

  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    throw new Error("Missing AIRTABLE_PAT or AIRTABLE_BASE_ID environment variables.");
  }

  cachedBase = new Airtable({ apiKey }).base(baseId);
  return cachedBase;
}
