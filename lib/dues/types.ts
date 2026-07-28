export interface Team {
  id: string;
  name: string;
  payPeriodsPerYear: number;
  payrollCycle: string;
}

export interface Player {
  id: string;
  name: string;
}

export interface ContractYearTerm {
  id: string;
  startDate: string;
  endDate: string;
  baseCompensation: number;
}

export interface ContractTerm {
  id: string;
  startDate: string;
  endDate: string;
  yearTerms: ContractYearTerm[];
}

export interface Contract {
  id: string;
  playerId: string;
  teamId: string;
  effectiveDate: string;
  contractEndDate: string;
  /** Empty string if unset. When set, effectively replaces contractEndDate everywhere (see calculate.ts's effectiveContractEnd). */
  terminationDate: string;
  duesAuthorization: boolean;
  duesPercent: number;
  terms: ContractTerm[];
}

export type DuesStatus = "CALCULATED" | "NOT_AUTHORIZED" | "NO_COVERAGE" | "DATA_ERROR";

export interface PeriodContribution {
  periodStart: string;
  periodEnd: string;
  periodTotalDays: number;
  coveredStart: string;
  coveredEnd: string;
  coveredDays: number;
  contractId: string;
  contractTermId: string;
  contractYearTermId: string;
  baseCompensation: number;
  compensationPerPaycheck: number;
  duesPercent: number;
  contribution: number;
  /** True if this is the season-opening period for the cycle — contribution is forced to 0 by policy regardless of coveredDays. */
  isSeasonOpeningBlackout?: boolean;
}

/** The result of calculating dues for a single contract — before merging across a player's other contracts, if any (see buildTeamDuesReport). */
export interface ContractDuesResult {
  duesPaid: number;
  status: DuesStatus;
  /** How many pay periods were generated for the query window before intersecting — lets NO_COVERAGE explain itself (e.g. "0 of 22 periods overlapped"). */
  periodsConsidered?: number;
  periods?: PeriodContribution[];
}

export interface DuesResult {
  playerId: string;
  playerName: string;
  duesPaid: number;
  status: DuesStatus;
  /** A player can have more than one contract with the team overlapping the query window (e.g. a mid-season re-signing) — all of them are summed into this one row. */
  matchedContractIds: string[];
  periodsConsidered?: number;
  periods?: PeriodContribution[];
}

export interface ActualDuesPayment {
  payrollDate: string;
  amount: number;
}

/** A player's real-world dues payments (Dues Accounting table) within the query range — independent of the calculated/owed figures above. */
export interface ActualDuesResult {
  playerId: string;
  playerName: string;
  totalPaid: number;
  payments: ActualDuesPayment[];
}

export interface TeamDuesReport {
  teamId: string;
  teamName: string;
  startDate: string;
  endDate: string;
  players: DuesResult[];
  teamTotalDues: number;
}

/** The full API response shape: the pure calculated report plus real-world payment data merged in by the route handler (see app/api/dues/route.ts). */
export interface TeamDuesReportWithActuals extends TeamDuesReport {
  actualDues: ActualDuesResult[];
  teamTotalActualPaid: number;
}
