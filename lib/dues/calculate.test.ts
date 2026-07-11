import { describe, expect, it } from "vitest";
import {
  buildTeamDuesReport,
  calculateDuesForContract,
  findMatchingContracts,
  fullyContains,
  monthsInPeriod,
} from "./calculate";
import type { Contract, ContractTerm, ContractYearTerm, Player, Team } from "./types";

function makeYearTerm(overrides: Partial<ContractYearTerm> = {}): ContractYearTerm {
  return {
    id: "yt1",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    baseCompensation: 5000,
    ...overrides,
  };
}

function makeTerm(overrides: Partial<ContractTerm> = {}): ContractTerm {
  return {
    id: "t1",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    yearTerms: [makeYearTerm()],
    ...overrides,
  };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "c1",
    playerId: "p1",
    teamId: "team1",
    effectiveDate: "2024-01-01",
    contractEndDate: "2024-12-31",
    duesAuthorization: true,
    duesPercent: 0.01,
    terms: [makeTerm()],
    ...overrides,
  };
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "team1",
    name: "USL Test FC",
    payPeriodsPerYear: 24,
    payrollCycle: "Semi-Monthly",
    ...overrides,
  };
}

describe("fullyContains", () => {
  it("returns true when window exactly matches range", () => {
    expect(fullyContains("2024-01-01", "2024-12-31", "2024-01-01", "2024-12-31")).toBe(true);
  });

  it("returns true when window is 1 day wider on each side", () => {
    expect(fullyContains("2023-12-31", "2025-01-01", "2024-01-01", "2024-12-31")).toBe(true);
  });

  it("returns false when window starts 1 day after range start", () => {
    expect(fullyContains("2024-01-02", "2024-12-31", "2024-01-01", "2024-12-31")).toBe(false);
  });

  it("returns false when window ends 1 day before range end", () => {
    expect(fullyContains("2024-01-01", "2024-12-30", "2024-01-01", "2024-12-31")).toBe(false);
  });
});

describe("monthsInPeriod", () => {
  it("computes fractional months for a 60-day span using the 30.44 divisor", () => {
    expect(monthsInPeriod("2024-01-01", "2024-03-01")).toBeCloseTo(60 / 30.44, 10);
  });

  it("computes ~12 months for a 365-day span", () => {
    expect(monthsInPeriod("2024-01-01", "2025-01-01")).toBeCloseTo(366 / 30.44, 10);
  });

  it("returns 0 for a zero-length span", () => {
    expect(monthsInPeriod("2024-01-01", "2024-01-01")).toBe(0);
  });
});

describe("findMatchingContracts", () => {
  it("filters by team and full date containment", () => {
    const contracts = [
      makeContract({ id: "c1", teamId: "team1" }),
      makeContract({ id: "c2", teamId: "team2" }),
      makeContract({ id: "c3", teamId: "team1", effectiveDate: "2024-06-01" }),
    ];
    const result = findMatchingContracts(contracts, "team1", "2024-01-01", "2024-12-31");
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("includes unauthorized contracts (they resolve to $0 downstream, not filtered out)", () => {
    const contracts = [makeContract({ duesAuthorization: false })];
    const result = findMatchingContracts(contracts, "team1", "2024-01-01", "2024-12-31");
    expect(result).toHaveLength(1);
  });
});

describe("calculateDuesForContract - golden number cases", () => {
  it("computes dues paid for a 2-month period, semi-monthly payroll, 1% dues", () => {
    // Base Compensation 5000 -> Annual 60000 -> Comp/Paycheck 60000/24 = 2500
    // cycleNumber = 24/12 = 2, months = 60/30.44, duesPercent = 0.01
    // duesPaid = 2500 * 0.01 * (60/30.44) * 2
    const contract = makeContract();
    const team = makeTeam();
    const result = calculateDuesForContract(contract, team, "2024-01-01", "2024-03-01");

    const expectedMonths = 60 / 30.44;
    const expectedDues = 2500 * 0.01 * expectedMonths * 2;

    expect(result.status).toBe("CALCULATED");
    expect(result.duesPaid).toBeCloseTo(expectedDues, 8);
    expect(result.breakdown).toEqual({
      baseCompensation: 5000,
      annualCompensation: 60000,
      compensationPerPaycheck: 2500,
      payPeriodsPerYear: 24,
      cycleNumber: 2,
      monthsInPeriod: expectedMonths,
      duesPercent: 0.01,
    });
  });

  it("computes dues for a bi-weekly team (26 pay periods/year)", () => {
    // Base Compensation 6000 -> Annual 72000 -> Comp/Paycheck 72000/26
    // cycleNumber = 26/12, months = 30/30.44, duesPercent = 0.02
    const contract = makeContract({ duesPercent: 0.02, terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 6000 })] })] });
    const team = makeTeam({ payPeriodsPerYear: 26, payrollCycle: "Bi-Weekly" });
    const result = calculateDuesForContract(contract, team, "2024-02-01", "2024-03-02");

    const expectedMonths = 30 / 30.44;
    const compPerPaycheck = 72000 / 26;
    const cycleNumber = 26 / 12;
    const expectedDues = compPerPaycheck * 0.02 * expectedMonths * cycleNumber;

    expect(result.status).toBe("CALCULATED");
    expect(result.duesPaid).toBeCloseTo(expectedDues, 8);
  });

  it("returns NOT_AUTHORIZED with $0 dues when Dues Authorization is unchecked", () => {
    const contract = makeContract({ duesAuthorization: false });
    const team = makeTeam();
    const result = calculateDuesForContract(contract, team, "2024-01-01", "2024-03-01");

    expect(result.status).toBe("NOT_AUTHORIZED");
    expect(result.duesPaid).toBe(0);
    expect(result.breakdown).toBeUndefined();
  });

  it("returns NO_MATCH / NO_CONTRACT_TERM_MATCH when no term contains the range", () => {
    const contract = makeContract({ terms: [makeTerm({ startDate: "2024-06-01", endDate: "2024-12-31" })] });
    const team = makeTeam();
    const result = calculateDuesForContract(contract, team, "2024-01-01", "2024-03-01");

    expect(result.status).toBe("NO_MATCH");
    expect(result.noMatchReason).toBe("NO_CONTRACT_TERM_MATCH");
    expect(result.duesPaid).toBe(0);
  });

  it("returns NO_MATCH / NO_CONTRACT_YEAR_TERM_MATCH when no year-term contains the range", () => {
    const contract = makeContract({
      terms: [makeTerm({ yearTerms: [makeYearTerm({ startDate: "2024-06-01", endDate: "2024-12-31" })] })],
    });
    const team = makeTeam();
    const result = calculateDuesForContract(contract, team, "2024-01-01", "2024-03-01");

    expect(result.status).toBe("NO_MATCH");
    expect(result.noMatchReason).toBe("NO_CONTRACT_YEAR_TERM_MATCH");
    expect(result.duesPaid).toBe(0);
  });

  it("returns DATA_ERROR when the team has zero/missing Pay Periods per Year", () => {
    const contract = makeContract();
    const team = makeTeam({ payPeriodsPerYear: 0 });
    const result = calculateDuesForContract(contract, team, "2024-01-01", "2024-03-01");

    expect(result.status).toBe("DATA_ERROR");
    expect(result.duesPaid).toBe(0);
  });
});

describe("buildTeamDuesReport", () => {
  it("aggregates dues across matched players into a team total", () => {
    const team = makeTeam();
    const contracts = [
      makeContract({ id: "c1", playerId: "p1" }),
      makeContract({
        id: "c2",
        playerId: "p2",
        duesPercent: 0.02,
        terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 4000 })] })],
      }),
      makeContract({ id: "c3", playerId: "p3", duesAuthorization: false }),
    ];
    const players = new Map<string, Player>([
      ["p1", { id: "p1", name: "Alice" }],
      ["p2", { id: "p2", name: "Bob" }],
      ["p3", { id: "p3", name: "Cara" }],
    ]);

    const report = buildTeamDuesReport({
      team,
      contracts,
      players,
      startDate: "2024-01-01",
      endDate: "2024-03-01",
    });

    expect(report.players).toHaveLength(3);
    expect(report.players.find((p) => p.playerId === "p3")?.status).toBe("NOT_AUTHORIZED");
    expect(report.teamTotalDues).toBeCloseTo(
      report.players.reduce((sum, p) => sum + p.duesPaid, 0),
      10,
    );
    expect(report.teamTotalDues).toBeGreaterThan(0);
  });

  it("returns an empty report when no contracts match the team/date range", () => {
    const team = makeTeam();
    const report = buildTeamDuesReport({
      team,
      contracts: [],
      players: new Map(),
      startDate: "2024-01-01",
      endDate: "2024-03-01",
    });

    expect(report.players).toEqual([]);
    expect(report.teamTotalDues).toBe(0);
  });
});
