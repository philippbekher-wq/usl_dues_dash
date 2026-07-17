import type { Contract, ContractTerm, Player } from "@/lib/dues/types";
import { getBase } from "./client";
import { AirtableFetchError } from "./errors";
import { fetchRecordsByIds } from "./fetchRecordsByIds";
import { mapContractRaw, mapContractTermRaw, mapContractYearTerm, mapPlayer } from "./mappers";
import { TABLES } from "./schema";

export interface TeamContractsData {
  contracts: Contract[];
  players: Map<string, Player>;
}

/**
 * Fetches every Contract for a team, joined with its Contract Terms and Contract
 * Year Terms. Filters the full Contracts table client-side by linked Team record ID
 * (an Airtable filterByFormula on a linked field matches display-name text via
 * ARRAYJOIN, not the record ID, so JS-side filtering is simpler and robust here).
 * Terms/year-terms/players are then batch-fetched by ID rather than full-table scans.
 */
export async function fetchContractsWithTermsForTeam(teamId: string): Promise<TeamContractsData> {
  const base = getBase();

  let allContractRecords;
  try {
    allContractRecords = await base(TABLES.contracts).select().all();
  } catch (error) {
    throw new AirtableFetchError("Failed to fetch Contracts", error);
  }

  const rawContracts = allContractRecords.map(mapContractRaw).filter((c) => c.teamId === teamId);

  const termIds = Array.from(new Set(rawContracts.flatMap((c) => c.termIds)));
  const termRecords = await fetchRecordsByIds(TABLES.contractTerms, termIds);
  const rawTerms = termRecords.map(mapContractTermRaw);

  const yearTermIds = Array.from(new Set(rawTerms.flatMap((t) => t.yearTermIds)));
  const yearTermRecords = await fetchRecordsByIds(TABLES.contractYearTerms, yearTermIds);
  const yearTermsById = new Map(yearTermRecords.map((r) => [r.id, mapContractYearTerm(r)]));

  const termsById = new Map<string, ContractTerm>(
    rawTerms.map((t) => [
      t.id,
      {
        id: t.id,
        startDate: t.startDate,
        endDate: t.endDate,
        yearTerms: t.yearTermIds
          .map((id) => yearTermsById.get(id))
          .filter((yt): yt is NonNullable<typeof yt> => Boolean(yt)),
      },
    ]),
  );

  const contracts: Contract[] = rawContracts.map((c) => ({
    id: c.id,
    playerId: c.playerId,
    teamId: c.teamId,
    effectiveDate: c.effectiveDate,
    contractEndDate: c.contractEndDate,
    terminationDate: c.terminationDate,
    duesAuthorization: c.duesAuthorization,
    duesPercent: c.duesPercent,
    terms: c.termIds
      .map((id) => termsById.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
  }));

  const playerIds = Array.from(new Set(rawContracts.map((c) => c.playerId).filter(Boolean)));
  const playerRecords = await fetchRecordsByIds(TABLES.players, playerIds);
  const players = new Map(playerRecords.map((r) => [r.id, mapPlayer(r)]));

  return { contracts, players };
}
