export const TABLES = {
  teams: "Teams",
  players: "Players",
  contracts: "Contracts",
  contractTerms: "Contract Terms",
  contractYearTerms: "Contract Year Terms",
  duesAccounting: "Dues Accounting",
} as const;

export const FIELDS = {
  teams: {
    name: "Name",
    payPeriodsPerYear: "Pay Periods per Year",
    payrollCycle: "Payroll Cycle",
  },
  players: {
    name: "Name",
  },
  contracts: {
    effectiveDate: "Effective Date",
    contractEndDate: "Contract End Date",
    terminationDate: "Termination Date",
    contractTerms: "Contract Terms",
    duesAuthorization: "Dues Authorization",
    dues: "Dues",
    team: "Team",
    player: "Player",
  },
  contractTerms: {
    startDate: "Start Date",
    endDate: "End Date",
    contractYearTerms: "Contract Year Terms",
  },
  contractYearTerms: {
    startDate: "Start Date",
    endDate: "End Date",
    baseCompensation: "Base Compensation",
  },
  duesAccounting: {
    player: "Player",
    fullName: "Full Name",
    payrollDate: "Payroll Date",
    duesPaid: "Dues Paid",
    teamName: "Team Name",
  },
} as const;
