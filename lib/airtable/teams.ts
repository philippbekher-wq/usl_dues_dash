import type { Team } from "@/lib/dues/types";
import { getBase } from "./client";
import { AirtableFetchError, isNotFoundError } from "./errors";
import { mapTeam } from "./mappers";
import { TABLES } from "./schema";

export async function fetchAllTeams(): Promise<Team[]> {
  const base = getBase();
  try {
    const records = await base(TABLES.teams).select().all();
    return records.map(mapTeam).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw new AirtableFetchError("Failed to fetch Teams", error);
  }
}

export async function fetchTeamById(teamId: string): Promise<Team | null> {
  const base = getBase();
  try {
    const record = await base(TABLES.teams).find(teamId);
    return mapTeam(record);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw new AirtableFetchError("Failed to fetch Team", error);
  }
}
