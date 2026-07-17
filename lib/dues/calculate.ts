import { format, getYear, parseISO, subDays } from "date-fns";
import { inclusiveDayCount, intersectRanges, rangesOverlap, type DateRange } from "./dateRange";
import {
  cycleAppliesSeasonOpeningBlackout,
  cyclePaysInAdvance,
  generatePayPeriods,
  isRecognizedPayrollCycle,
  isSeasonOpeningPeriod,
} from "./payPeriods";
import { DEFAULT_SEASON_END, DEFAULT_SEASON_START, getDuesSeasonWindow, type MonthDay } from "./season";
import type {
  Contract,
  ContractDuesResult,
  DuesResult,
  DuesStatus,
  PeriodContribution,
  Player,
  Team,
  TeamDuesReport,
} from "./types";

/** The Termination Date itself is the day dues stop, not the last day dues accrue — a player terminated on the 1st owes nothing that day. */
function dayBefore(isoDate: string): string {
  return format(subDays(parseISO(isoDate), 1), "yyyy-MM-dd");
}

/** Contract End Date, or the day before Termination Date if that's set and earlier — termination only ever shortens, never extends. */
export function effectiveContractEnd(contract: Contract): string {
  if (!contract.terminationDate) return contract.contractEndDate;
  const lastAccruingDay = dayBefore(contract.terminationDate);
  if (!contract.contractEndDate) return lastAccruingDay;
  return lastAccruingDay < contract.contractEndDate ? lastAccruingDay : contract.contractEndDate;
}

export function findOverlappingContracts(
  contracts: Contract[],
  teamId: string,
  startDate: string,
  endDate: string,
): Contract[] {
  const queryRange: DateRange = { start: startDate, end: endDate };
  return contracts.filter(
    (c) =>
      c.teamId === teamId &&
      rangesOverlap({ start: c.effectiveDate, end: effectiveContractEnd(c) }, queryRange),
  );
}

export function calculateDuesForContract(
  contract: Contract,
  team: Team,
  startDate: string,
  endDate: string,
  seasonStart: MonthDay = DEFAULT_SEASON_START,
  seasonEnd: MonthDay = DEFAULT_SEASON_END,
): ContractDuesResult {
  if (!contract.duesAuthorization) {
    return {
      duesPaid: 0,
      status: "NOT_AUTHORIZED",
    };
  }

  if (!team.payPeriodsPerYear || !isRecognizedPayrollCycle(team.payrollCycle)) {
    return {
      duesPaid: 0,
      status: "DATA_ERROR",
    };
  }

  const periods = generatePayPeriods(team.payrollCycle, startDate, endDate, seasonStart, seasonEnd);
  const contractRange: DateRange = { start: contract.effectiveDate, end: effectiveContractEnd(contract) };
  const appliesBlackout = cycleAppliesSeasonOpeningBlackout(team.payrollCycle);
  // Advance-pay cycles (Bi-Weekly) deduct the full period atomically on its
  // start date — once a period has passed the "has it been paid" filter in
  // generatePayPeriods, the query's end date shouldn't clip it any further,
  // only its start date should (a legitimate "count from this date on" request).
  const paysInAdvance = cyclePaysInAdvance(team.payrollCycle);

  let totalDues = 0;
  let hadAnyCoverage = false;
  const contributions: PeriodContribution[] = [];

  for (const period of periods) {
    const periodTotalDays = inclusiveDayCount(period);
    const seasonWindow = getDuesSeasonWindow(getYear(parseISO(period.start)), seasonStart, seasonEnd);
    const isBlackoutPeriod = appliesBlackout && isSeasonOpeningPeriod(period, seasonWindow.start);
    const queryRange: DateRange = { start: startDate, end: paysInAdvance ? period.end : endDate };
    let overlappingTermsThisPeriod = 0;

    for (const term of contract.terms) {
      const termRange: DateRange = { start: term.startDate, end: term.endDate };
      for (const yearTerm of term.yearTerms) {
        const yearTermRange: DateRange = { start: yearTerm.startDate, end: yearTerm.endDate };
        const covered = intersectRanges(
          period,
          contractRange,
          queryRange,
          termRange,
          yearTermRange,
          seasonWindow,
        );
        if (!covered) continue;

        overlappingTermsThisPeriod++;
        hadAnyCoverage = true;

        const coveredDays = inclusiveDayCount(covered);
        const compensationPerPaycheck = (yearTerm.baseCompensation * 12) / team.payPeriodsPerYear;
        const contribution = isBlackoutPeriod
          ? 0
          : compensationPerPaycheck * contract.duesPercent * (coveredDays / periodTotalDays);
        totalDues += contribution;

        contributions.push({
          periodStart: period.start,
          periodEnd: period.end,
          periodTotalDays,
          coveredStart: covered.start,
          coveredEnd: covered.end,
          coveredDays,
          contractId: contract.id,
          contractTermId: term.id,
          contractYearTermId: yearTerm.id,
          baseCompensation: yearTerm.baseCompensation,
          compensationPerPaycheck,
          duesPercent: contract.duesPercent,
          contribution,
          ...(isBlackoutPeriod ? { isSeasonOpeningBlackout: true } : {}),
        });
      }
    }

    if (overlappingTermsThisPeriod > 1) {
      console.warn(
        `Contract ${contract.id} has ${overlappingTermsThisPeriod} overlapping term/year-term matches in period ${period.start}..${period.end} — dues may be double-counted. Check for overlapping Contract Term / Contract Year Term date ranges in Airtable.`,
      );
    }
  }

  return {
    duesPaid: totalDues,
    status: hadAnyCoverage ? "CALCULATED" : "NO_COVERAGE",
    periodsConsidered: periods.length,
    periods: contributions,
  };
}

// Priority order when a player has multiple contracts with differing statuses:
// a data problem on any one contract means the total may be wrong, so it wins;
// otherwise a real calculated amount is the headline; NOT_AUTHORIZED only shows
// when nothing was ever authorized; NO_COVERAGE is the fallback (nothing to report).
const STATUS_PRIORITY: DuesStatus[] = ["DATA_ERROR", "CALCULATED", "NOT_AUTHORIZED", "NO_COVERAGE"];

function combineStatuses(statuses: DuesStatus[]): DuesStatus {
  for (const candidate of STATUS_PRIORITY) {
    if (statuses.includes(candidate)) return candidate;
  }
  return "NO_COVERAGE";
}

export function buildTeamDuesReport(params: {
  team: Team;
  contracts: Contract[];
  players: Map<string, Player>;
  startDate: string;
  endDate: string;
  seasonStart?: MonthDay;
  seasonEnd?: MonthDay;
}): TeamDuesReport {
  const {
    team,
    contracts,
    players,
    startDate,
    endDate,
    seasonStart = DEFAULT_SEASON_START,
    seasonEnd = DEFAULT_SEASON_END,
  } = params;
  const matched = findOverlappingContracts(contracts, team.id, startDate, endDate);

  // A player can have more than one contract overlapping the query window
  // (e.g. released and re-signed mid-season) — merge them into a single row
  // per player rather than one row per contract, so the total is easy to
  // find and audit without hunting for a second row elsewhere in the list.
  const contractsByPlayer = new Map<string, Contract[]>();
  for (const contract of matched) {
    const list = contractsByPlayer.get(contract.playerId) ?? [];
    list.push(contract);
    contractsByPlayer.set(contract.playerId, list);
  }

  const results: DuesResult[] = Array.from(contractsByPlayer.entries()).map(([playerId, playerContracts]) => {
    const player = players.get(playerId);
    // Chronological order so the merged periods breakdown reads start-to-end.
    const sortedContracts = [...playerContracts].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    const perContract: ContractDuesResult[] = sortedContracts.map((c) =>
      calculateDuesForContract(c, team, startDate, endDate, seasonStart, seasonEnd),
    );

    return {
      playerId,
      playerName: player?.name ?? "Unknown Player",
      duesPaid: perContract.reduce((sum, r) => sum + r.duesPaid, 0),
      status: combineStatuses(perContract.map((r) => r.status)),
      matchedContractIds: sortedContracts.map((c) => c.id),
      // Identical for every contract of the same team/query window — take the first, don't sum.
      periodsConsidered: perContract.find((r) => r.periodsConsidered !== undefined)?.periodsConsidered,
      periods: perContract.flatMap((r) => r.periods ?? []),
    };
  });

  results.sort((a, b) => a.playerName.localeCompare(b.playerName));

  return {
    teamId: team.id,
    teamName: team.name,
    startDate,
    endDate,
    players: results,
    teamTotalDues: results.reduce((sum, r) => sum + r.duesPaid, 0),
  };
}
