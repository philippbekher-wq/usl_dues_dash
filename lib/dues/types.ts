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
  duesAuthorization: boolean;
  duesPercent: number;
  terms: ContractTerm[];
}

export type DuesStatus = "CALCULATED" | "NOT_AUTHORIZED" | "NO_MATCH" | "DATA_ERROR";

export type NoMatchReason = "NO_CONTRACT_TERM_MATCH" | "NO_CONTRACT_YEAR_TERM_MATCH";

export interface DuesBreakdown {
  baseCompensation: number;
  annualCompensation: number;
  compensationPerPaycheck: number;
  payPeriodsPerYear: number;
  cycleNumber: number;
  monthsInPeriod: number;
  duesPercent: number;
}

export interface DuesResult {
  playerId: string;
  playerName: string;
  duesPaid: number;
  status: DuesStatus;
  noMatchReason?: NoMatchReason;
  matchedContractId?: string;
  matchedContractTermId?: string;
  matchedContractYearTermId?: string;
  breakdown?: DuesBreakdown;
}

export interface TeamDuesReport {
  teamId: string;
  teamName: string;
  startDate: string;
  endDate: string;
  players: DuesResult[];
  teamTotalDues: number;
}
