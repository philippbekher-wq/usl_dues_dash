import { differenceInCalendarDays, parseISO } from "date-fns";
import { AVG_DAYS_PER_MONTH } from "./constants";
import type { Contract, DuesResult, Player, Team, TeamDuesReport } from "./types";

/** Inclusive containment: does [windowStart, windowEnd] fully contain [rangeStart, rangeEnd]? */
export function fullyContains(
  windowStart: string,
  windowEnd: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return windowStart <= rangeStart && windowEnd >= rangeEnd;
}

export function findMatchingContracts(
  contracts: Contract[],
  teamId: string,
  startDate: string,
  endDate: string,
): Contract[] {
  return contracts.filter(
    (c) =>
      c.teamId === teamId &&
      fullyContains(c.effectiveDate, c.contractEndDate, startDate, endDate),
  );
}

function findMatchingTerm<T extends { startDate: string; endDate: string }>(
  terms: T[],
  startDate: string,
  endDate: string,
): T | undefined {
  return terms.find((t) => fullyContains(t.startDate, t.endDate, startDate, endDate));
}

export function monthsInPeriod(startDate: string, endDate: string): number {
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
  return days / AVG_DAYS_PER_MONTH;
}

export function calculateDuesForContract(
  contract: Contract,
  team: Team,
  startDate: string,
  endDate: string,
): Omit<DuesResult, "playerId" | "playerName"> {
  if (!contract.duesAuthorization) {
    return {
      duesPaid: 0,
      status: "NOT_AUTHORIZED",
      matchedContractId: contract.id,
    };
  }

  const term = findMatchingTerm(contract.terms, startDate, endDate);
  if (!term) {
    return {
      duesPaid: 0,
      status: "NO_MATCH",
      noMatchReason: "NO_CONTRACT_TERM_MATCH",
      matchedContractId: contract.id,
    };
  }

  const yearTerm = findMatchingTerm(term.yearTerms, startDate, endDate);
  if (!yearTerm) {
    return {
      duesPaid: 0,
      status: "NO_MATCH",
      noMatchReason: "NO_CONTRACT_YEAR_TERM_MATCH",
      matchedContractId: contract.id,
      matchedContractTermId: term.id,
    };
  }

  if (!team.payPeriodsPerYear) {
    return {
      duesPaid: 0,
      status: "DATA_ERROR",
      matchedContractId: contract.id,
      matchedContractTermId: term.id,
      matchedContractYearTermId: yearTerm.id,
    };
  }

  const annualCompensation = yearTerm.baseCompensation * 12;
  const compensationPerPaycheck = annualCompensation / team.payPeriodsPerYear;
  const cycleNumber = team.payPeriodsPerYear / 12;
  const months = monthsInPeriod(startDate, endDate);
  const duesPercent = contract.duesPercent;
  const duesPaid = compensationPerPaycheck * duesPercent * months * cycleNumber;

  return {
    duesPaid,
    status: "CALCULATED",
    matchedContractId: contract.id,
    matchedContractTermId: term.id,
    matchedContractYearTermId: yearTerm.id,
    breakdown: {
      baseCompensation: yearTerm.baseCompensation,
      annualCompensation,
      compensationPerPaycheck,
      payPeriodsPerYear: team.payPeriodsPerYear,
      cycleNumber,
      monthsInPeriod: months,
      duesPercent,
    },
  };
}

export function buildTeamDuesReport(params: {
  team: Team;
  contracts: Contract[];
  players: Map<string, Player>;
  startDate: string;
  endDate: string;
}): TeamDuesReport {
  const { team, contracts, players, startDate, endDate } = params;
  const matched = findMatchingContracts(contracts, team.id, startDate, endDate);

  const seenPlayerIds = new Set<string>();
  for (const contract of matched) {
    if (seenPlayerIds.has(contract.playerId)) {
      console.warn(
        `Player ${contract.playerId} has multiple contracts matching team ${team.id} for ${startDate}..${endDate}`,
      );
    }
    seenPlayerIds.add(contract.playerId);
  }

  const results: DuesResult[] = matched.map((contract) => {
    const player = players.get(contract.playerId);
    return {
      playerId: contract.playerId,
      playerName: player?.name ?? "Unknown Player",
      ...calculateDuesForContract(contract, team, startDate, endDate),
    };
  });

  return {
    teamId: team.id,
    teamName: team.name,
    startDate,
    endDate,
    players: results,
    teamTotalDues: results.reduce((sum, r) => sum + r.duesPaid, 0),
  };
}
