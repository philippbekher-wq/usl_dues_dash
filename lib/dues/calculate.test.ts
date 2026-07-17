import { describe, expect, it } from "vitest";
import {
  buildTeamDuesReport,
  calculateDuesForContract,
  effectiveContractEnd,
  findOverlappingContracts,
} from "./calculate";
import type { Contract, ContractTerm, ContractYearTerm, Player, Team } from "./types";

function makeYearTerm(overrides: Partial<ContractYearTerm> = {}): ContractYearTerm {
  return {
    id: "yt1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    baseCompensation: 5000,
    ...overrides,
  };
}

function makeTerm(overrides: Partial<ContractTerm> = {}): ContractTerm {
  return {
    id: "t1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    yearTerms: [makeYearTerm()],
    ...overrides,
  };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "c1",
    playerId: "p1",
    teamId: "team1",
    effectiveDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    terminationDate: "",
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

describe("findOverlappingContracts", () => {
  it("filters by team and any date overlap (not full containment)", () => {
    const contracts = [
      makeContract({ id: "c1", teamId: "team1" }),
      makeContract({ id: "c2", teamId: "team2" }),
      // only partially overlaps the query range below — must still be included
      makeContract({ id: "c3", teamId: "team1", effectiveDate: "2026-05-01", contractEndDate: "2026-06-10" }),
      // no overlap at all
      makeContract({ id: "c4", teamId: "team1", effectiveDate: "2025-01-01", contractEndDate: "2025-12-31" }),
    ];
    const result = findOverlappingContracts(contracts, "team1", "2026-06-01", "2026-06-30");
    expect(result.map((c) => c.id).sort()).toEqual(["c1", "c3"]);
  });

  it("includes unauthorized contracts (they resolve to $0 downstream, not filtered out)", () => {
    const contracts = [makeContract({ duesAuthorization: false })];
    const result = findOverlappingContracts(contracts, "team1", "2026-01-01", "2026-12-31");
    expect(result).toHaveLength(1);
  });
});

describe("calculateDuesForContract — proration golden numbers", () => {
  it("Semi-Monthly: contract starts mid-period on the 8th, prorated 8/15 (client's worked example)", () => {
    // Use June (not January) so the Jan15 dues-season start doesn't confound
    // this test — the season-boundary interaction is tested separately below.
    const contract = makeContract({
      effectiveDate: "2026-06-08",
      terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 5000 })] })],
    });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-06-01", "2026-06-15");

    // compensationPerPaycheck = 5000*12/24 = 2500; fullPeriodDues = 25
    // periodTotalDays = 15 (Jun1-15), coveredDays = 8 (Jun8-15)
    const expectedDues = 2500 * 0.01 * (8 / 15);

    expect(result.status).toBe("CALCULATED");
    expect(result.duesPaid).toBeCloseTo(expectedDues, 8);
    expect(result.periods).toHaveLength(1);
    expect(result.periods![0]).toMatchObject({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-15",
      periodTotalDays: 15,
      coveredStart: "2026-06-08",
      coveredEnd: "2026-06-15",
      coveredDays: 8,
    });
  });

  it("Bi-Weekly: exactly two period-aligned full paychecks multiply naively (the client's original bug, now fixed)", () => {
    const contract = makeContract({
      effectiveDate: "2025-01-01",
      contractEndDate: "2026-12-31",
      terms: [
        makeTerm({
          startDate: "2025-01-01",
          endDate: "2026-12-31",
          yearTerms: [makeYearTerm({ startDate: "2025-01-01", endDate: "2026-12-31", baseCompensation: 5000 })],
        }),
      ],
    });
    const team = makeTeam({ payPeriodsPerYear: 26, payrollCycle: "Bi-Weekly" });
    // Verified grid: 2026 periods [01-29,02-11] and [02-12,02-25] — two full periods
    // (deliberately past the [01-15,01-28] season-opening period, which Bi-Weekly has no blackout for anyway).
    const result = calculateDuesForContract(contract, team, "2026-01-29", "2026-02-25");

    const compensationPerPaycheck = (5000 * 12) / 26;
    const expectedDues = compensationPerPaycheck * 0.01 * 2;

    expect(result.status).toBe("CALCULATED");
    expect(result.periods).toHaveLength(2);
    expect(result.periods!.every((p) => p.coveredDays === 14 && p.periodTotalDays === 14)).toBe(true);
    expect(result.periods!.every((p) => !p.isSeasonOpeningBlackout)).toBe(true);
    expect(result.duesPaid).toBeCloseTo(expectedDues, 8);
  });

  it("splits a single period across two Contract Year Terms proportionally", () => {
    const contract = makeContract({
      effectiveDate: "2026-01-01",
      contractEndDate: "2026-12-31",
      terms: [
        makeTerm({
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          yearTerms: [
            makeYearTerm({ id: "ytA", startDate: "2026-01-01", endDate: "2026-02-03", baseCompensation: 4000 }),
            makeYearTerm({ id: "ytB", startDate: "2026-02-04", endDate: "2026-12-31", baseCompensation: 6000 }),
          ],
        }),
      ],
    });
    const team = makeTeam({ payPeriodsPerYear: 26, payrollCycle: "Bi-Weekly" });
    // The [2026-01-29, 2026-02-11] period splits 6 days (Jan29-Feb3) under ytA, 8 days (Feb4-Feb11) under ytB.
    const result = calculateDuesForContract(contract, team, "2026-01-29", "2026-02-11");

    const contribA = ((4000 * 12) / 26) * 0.01 * (6 / 14);
    const contribB = ((6000 * 12) / 26) * 0.01 * (8 / 14);

    expect(result.periods).toHaveLength(2);
    const a = result.periods!.find((p) => p.contractYearTermId === "ytA")!;
    const b = result.periods!.find((p) => p.contractYearTermId === "ytB")!;
    expect(a.coveredDays).toBe(6);
    expect(b.coveredDays).toBe(8);
    expect(a.contribution).toBeCloseTo(contribA, 8);
    expect(b.contribution).toBeCloseTo(contribB, 8);
    expect(result.duesPaid).toBeCloseTo(contribA + contribB, 8);
  });

  it("dues season hard boundary: a period straddling Jan 15 only counts the in-season day (and is also the season-opening blackout period)", () => {
    const contract = makeContract({ effectiveDate: "2025-12-01" });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-01-01", "2026-01-15");

    expect(result.periods).toHaveLength(1);
    expect(result.periods![0].coveredDays).toBe(1);
    expect(result.periods![0].coveredStart).toBe("2026-01-15");
    expect(result.periods![0].isSeasonOpeningBlackout).toBe(true);
    expect(result.periods![0].contribution).toBe(0);
    expect(result.duesPaid).toBe(0);
  });

  it("dues season hard boundary: a period entirely in the dead zone (Dec) contributes nothing", () => {
    const contract = makeContract();
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-12-01", "2026-12-15");

    expect(result.status).toBe("NO_COVERAGE");
    expect(result.periods).toHaveLength(0);
  });

  it("Bi-Weekly last period of the year spills past Nov 15 but keeps a 14-day denominator", () => {
    const contract = makeContract();
    const team = makeTeam({ payPeriodsPerYear: 26, payrollCycle: "Bi-Weekly" });
    // Actual 2026 grid: last period is 2026-11-05 .. 2026-11-18.
    const result = calculateDuesForContract(contract, team, "2026-11-01", "2026-11-30");

    const last = result.periods!.find((p) => p.periodStart === "2026-11-05")!;
    expect(last.periodTotalDays).toBe(14);
    expect(last.coveredDays).toBe(11); // Nov 5 - Nov 15 inclusive
    expect(last.coveredEnd).toBe("2026-11-15");
  });

  it("NOT_AUTHORIZED yields $0 with no periods", () => {
    const contract = makeContract({ duesAuthorization: false });
    const team = makeTeam();
    const result = calculateDuesForContract(contract, team, "2026-06-01", "2026-06-30");

    expect(result.status).toBe("NOT_AUTHORIZED");
    expect(result.duesPaid).toBe(0);
    expect(result.periods).toBeUndefined();
  });

  it("DATA_ERROR when Pay Periods per Year is missing/zero", () => {
    const contract = makeContract();
    const team = makeTeam({ payPeriodsPerYear: 0 });
    const result = calculateDuesForContract(contract, team, "2026-06-01", "2026-06-30");

    expect(result.status).toBe("DATA_ERROR");
    expect(result.duesPaid).toBe(0);
  });

  it("DATA_ERROR when Payroll Cycle is unrecognized", () => {
    const contract = makeContract();
    const team = makeTeam({ payrollCycle: "Weekly" });
    const result = calculateDuesForContract(contract, team, "2026-06-01", "2026-06-30");

    expect(result.status).toBe("DATA_ERROR");
  });

  it("NO_COVERAGE when the contract has no Contract Year Terms at all", () => {
    const contract = makeContract({ terms: [makeTerm({ yearTerms: [] })] });
    const team = makeTeam();
    const result = calculateDuesForContract(contract, team, "2026-06-01", "2026-06-30");

    expect(result.status).toBe("NO_COVERAGE");
    expect(result.periodsConsidered).toBeGreaterThan(0);
    expect(result.periods).toHaveLength(0);
  });
});

describe("season-opening blackout rule", () => {
  it("Semi-Monthly: the [Jan1,Jan15] period is $0 even for a player present the whole time, under the default season", () => {
    const contract = makeContract({ effectiveDate: "2025-01-01" });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-01-01", "2026-01-31");

    const compensationPerPaycheck = (5000 * 12) / 24; // 2500
    const expectedTotal = compensationPerPaycheck * 0.01; // just the second (ordinary) period, $25

    const opening = result.periods!.find((p) => p.periodStart === "2026-01-01")!;
    const ordinary = result.periods!.find((p) => p.periodStart === "2026-01-16")!;

    expect(opening.isSeasonOpeningBlackout).toBe(true);
    expect(opening.contribution).toBe(0);
    // The season window [Jan15,Nov15] itself also clips this period's coverage down to just Jan 15 —
    // the blackout forces $0 regardless, but the real (season-clipped) coverage is preserved for audit.
    expect(opening.coveredDays).toBe(1);
    expect(opening.coveredStart).toBe("2026-01-15");
    expect(ordinary.isSeasonOpeningBlackout).toBeUndefined();
    expect(ordinary.contribution).toBeCloseTo(compensationPerPaycheck * 0.01, 8);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
  });

  it("Bi-Weekly: has NO season-opening blackout — the first period [Jan15,Jan28] is a normal, fully paid period (client correction: Chattanooga Red Wolves)", () => {
    const contract = makeContract({
      effectiveDate: "2025-01-01",
      terms: [makeTerm({ yearTerms: [makeYearTerm({ startDate: "2025-01-01" })] })],
    });
    const team = makeTeam({ payPeriodsPerYear: 26, payrollCycle: "Bi-Weekly" });
    const result = calculateDuesForContract(contract, team, "2026-01-15", "2026-02-11");

    const compensationPerPaycheck = (5000 * 12) / 26;
    const expectedTotal = compensationPerPaycheck * 0.01 * 2; // BOTH periods count, no blackout

    const opening = result.periods!.find((p) => p.periodStart === "2026-01-15")!;
    const ordinary = result.periods!.find((p) => p.periodStart === "2026-01-29")!;

    expect(opening.isSeasonOpeningBlackout).toBeUndefined();
    expect(opening.coveredDays).toBe(14);
    expect(opening.contribution).toBeCloseTo(compensationPerPaycheck * 0.01, 8);
    expect(ordinary.contribution).toBeCloseTo(compensationPerPaycheck * 0.01, 8);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
  });

  it("Bi-Weekly: querying exactly through the second payday (Jan 29) shows that period as a real, paid contribution (Chattanooga Red Wolves report)", () => {
    const contract = makeContract({
      effectiveDate: "2025-01-01",
      terms: [makeTerm({ yearTerms: [makeYearTerm({ startDate: "2025-01-01" })] })],
    });
    const team = makeTeam({ payPeriodsPerYear: 26, payrollCycle: "Bi-Weekly" });
    // Query ends the same day the second period's pay date lands — that period's
    // pay date (its START, Jan 29) has occurred, even though its end (Feb 11) hasn't.
    const result = calculateDuesForContract(contract, team, "2026-01-01", "2026-01-29");

    const compensationPerPaycheck = (5000 * 12) / 26;
    const ordinary = result.periods!.find((p) => p.periodStart === "2026-01-29");
    expect(ordinary).toBeDefined();
    expect(ordinary!.isSeasonOpeningBlackout).toBeUndefined();
    // Full 14/14 days credited — the query's end date (Jan 29) must NOT clip
    // this period down to a single day just because it hasn't reached Feb 11.
    expect(ordinary!.coveredDays).toBe(14);
    expect(ordinary!.contribution).toBeCloseTo(compensationPerPaycheck * 0.01, 8);
  });

  it("Semi-Monthly, mid-second-period join (the 25th): prorated normally, no blackout involved", () => {
    // Contract isn't even active until Jan 25 — well after the [Jan1,Jan15] opening period ends,
    // so that period has zero coverage and no line item at all (not a $0 blackout line, just N/A).
    const contract = makeContract({ effectiveDate: "2026-01-25" });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-01-01", "2026-01-31");

    const compensationPerPaycheck = (5000 * 12) / 24;
    // [Jan16,Jan31] (16 days) prorated for Jan25-31 (7 days) — client's original worked example, restated.
    const expectedTotal = compensationPerPaycheck * 0.01 * (7 / 16);

    expect(result.periods!.some((p) => p.periodStart === "2026-01-01")).toBe(false);
    expect(result.periods).toHaveLength(1);
    expect(result.periods![0].periodStart).toBe("2026-01-16");
    expect(result.periods![0].coveredDays).toBe(7);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
  });

  it("moves with a custom season start (proves the anchor isn't hardwired to Jan 15)", () => {
    // Season start (Mar 10) falls strictly mid-period, so the [Mar1,Mar15]
    // sliver is still blacked out — same shape as the default Jan 15 case.
    const contract = makeContract({ effectiveDate: "2025-01-01" });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(
      contract,
      team,
      "2026-03-01",
      "2026-03-31",
      { month: 3, day: 10 },
      { month: 10, day: 15 },
    );

    const compensationPerPaycheck = (5000 * 12) / 24;
    const expectedTotal = compensationPerPaycheck * 0.01; // only [Mar16,Mar31] counts

    const opening = result.periods!.find((p) => p.periodStart === "2026-03-01")!;
    const ordinary = result.periods!.find((p) => p.periodStart === "2026-03-16")!;
    expect(opening.isSeasonOpeningBlackout).toBe(true);
    expect(opening.contribution).toBe(0);
    expect(ordinary.contribution).toBeCloseTo(compensationPerPaycheck * 0.01, 8);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
  });

  it("no blackout when a custom season start lands exactly on a period's own start date (client correction: Phanuel Kavita, season start = Jan 1)", () => {
    const contract = makeContract({ effectiveDate: "2025-12-01" });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(
      contract,
      team,
      "2026-01-01",
      "2026-01-31",
      { month: 1, day: 1 },
      { month: 12, day: 31 },
    );

    const compensationPerPaycheck = (5000 * 12) / 24;
    const expectedTotal = compensationPerPaycheck * 0.01 * 2; // BOTH periods count, no blackout

    const first = result.periods!.find((p) => p.periodStart === "2026-01-01")!;
    expect(first.isSeasonOpeningBlackout).toBeUndefined();
    expect(first.coveredDays).toBe(15);
    expect(first.contribution).toBeCloseTo(compensationPerPaycheck * 0.01, 8);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
  });

  it("does NOT apply to Monthly — the January period just prorates normally against the season boundary", () => {
    const contract = makeContract({ effectiveDate: "2025-01-01" });
    const team = makeTeam({ payPeriodsPerYear: 12, payrollCycle: "Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-01-01", "2026-01-31");

    const compensationPerPaycheck = (5000 * 12) / 12; // 5000
    // [Jan1,Jan31] (31 days) clipped by season start to [Jan15,Jan31] (17 days) — genuinely prorated, not blacked out.
    const expectedTotal = compensationPerPaycheck * 0.01 * (17 / 31);

    expect(result.periods).toHaveLength(1);
    expect(result.periods![0].isSeasonOpeningBlackout).toBeUndefined();
    expect(result.periods![0].coveredDays).toBe(17);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
  });
});

describe("effectiveContractEnd", () => {
  it("returns contractEndDate when terminationDate is unset", () => {
    const contract = makeContract({ contractEndDate: "2026-12-31", terminationDate: "" });
    expect(effectiveContractEnd(contract)).toBe("2026-12-31");
  });

  it("returns the day BEFORE terminationDate when it's set and earlier than contractEndDate — the termination date itself is not a paid day", () => {
    const contract = makeContract({ contractEndDate: "2026-12-31", terminationDate: "2026-06-20" });
    expect(effectiveContractEnd(contract)).toBe("2026-06-19");
  });

  it("ignores a terminationDate that's later than contractEndDate (bad data, termination only shortens)", () => {
    const contract = makeContract({ contractEndDate: "2026-06-20", terminationDate: "2026-12-31" });
    expect(effectiveContractEnd(contract)).toBe("2026-06-20");
  });

  it("uses the day before terminationDate when contractEndDate is unset (open-ended contract) — regression for the empty-string footgun", () => {
    const contract = makeContract({ contractEndDate: "", terminationDate: "2026-06-20" });
    expect(effectiveContractEnd(contract)).toBe("2026-06-19");
  });
});

describe("Termination Date", () => {
  it("truncates dues mid-period instead of silently being ignored, and does not accrue on the termination date itself", () => {
    const contract = makeContract({
      effectiveDate: "2026-06-01",
      contractEndDate: "2026-12-31",
      terminationDate: "2026-06-20",
      terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 5000 })] })],
    });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-06-01", "2026-06-30");

    const compensationPerPaycheck = (5000 * 12) / 24; // 2500
    // [Jun1,Jun15] fully covered ($25); [Jun16,Jun30] (15 days) covered through Jun19 (day before
    // termination) = 4 days, NOT 5 — Jun 20 itself must not accrue dues.
    const expectedTotal = compensationPerPaycheck * 0.01 * 1 + compensationPerPaycheck * 0.01 * (4 / 15);

    const secondPeriod = result.periods!.find((p) => p.periodStart === "2026-06-16")!;
    expect(secondPeriod.coveredEnd).toBe("2026-06-19");
    expect(secondPeriod.coveredDays).toBe(4);
    expect(result.duesPaid).toBeCloseTo(expectedTotal, 8);
    // If termination were silently ignored, this would be $50 instead — the delta is the regression proof.
    expect(result.duesPaid).toBeLessThan(compensationPerPaycheck * 0.01 * 2);
  });

  it("excludes a contract entirely from findOverlappingContracts when terminated before the query range", () => {
    const contract = makeContract({
      effectiveDate: "2026-01-01",
      contractEndDate: "2026-12-31",
      terminationDate: "2026-05-01",
    });
    const result = findOverlappingContracts([contract], "team1", "2026-06-01", "2026-06-30");
    expect(result).toHaveLength(0);
  });

  it("a contract terminated exactly on a query's start date accrues nothing that day", () => {
    const contract = makeContract({
      effectiveDate: "2026-06-01",
      contractEndDate: "2026-12-31",
      terminationDate: "2026-07-01",
      terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 5000 })] })],
    });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-07-01", "2026-07-15");

    expect(result.status).toBe("NO_COVERAGE");
    expect(result.duesPaid).toBe(0);
  });
});

describe("only-real-paid-periods cutoff (integration)", () => {
  it("Birmingham Legion scenario: querying through Jul 17 shows dues only up to the Jul 1-15 period, not the not-yet-paid Jul 16-31 period", () => {
    const contract = makeContract({
      terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 5000 })] })],
    });
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const result = calculateDuesForContract(contract, team, "2026-01-01", "2026-07-17");

    expect(result.periods!.some((p) => p.periodStart === "2026-07-16")).toBe(false);
    const last = [...result.periods!].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).at(-1)!;
    expect(last.periodStart).toBe("2026-07-01");
    expect(last.periodEnd).toBe("2026-07-15");
    expect(last.coveredDays).toBe(15);
  });
});

describe("buildTeamDuesReport", () => {
  it("merges a player's multiple contracts into ONE row instead of scattering them across the list (client report: Angelo Kelly-Rosales' two contracts)", () => {
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const contracts = [
      makeContract({ id: "c_zed", playerId: "zed", effectiveDate: "2026-01-01" }),
      // Earlier contract: Apr 29 - May 15, base comp $3000/mo.
      makeContract({
        id: "c_early",
        playerId: "angelo",
        effectiveDate: "2026-04-29",
        contractEndDate: "2026-05-15",
        terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 3000 })] })],
      }),
      makeContract({ id: "c_mid", playerId: "mid", effectiveDate: "2026-01-01" }),
      // Later contract: May 16 - Jun 15, base comp $6000/mo (a re-signing at a higher rate).
      makeContract({
        id: "c_late",
        playerId: "angelo",
        effectiveDate: "2026-05-16",
        contractEndDate: "2026-06-15",
        terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 6000 })] })],
      }),
    ];
    const players = new Map<string, Player>([
      ["zed", { id: "zed", name: "Zed Zephyr" }],
      ["angelo", { id: "angelo", name: "Angelo Kelly-Rosales" }],
      ["mid", { id: "mid", name: "Mid Middleton" }],
    ]);

    const report = buildTeamDuesReport({ team, contracts, players, startDate: "2026-04-01", endDate: "2026-06-30" });

    // One row per player, alphabetically — not one row per contract.
    expect(report.players.map((p) => p.playerName)).toEqual(["Angelo Kelly-Rosales", "Mid Middleton", "Zed Zephyr"]);

    const angelo = report.players[0];
    expect(angelo.matchedContractIds).toEqual(["c_early", "c_late"]); // chronological, earlier contract first
    expect(angelo.status).toBe("CALCULATED");

    // c_early: Apr16-30 prorated 2/15 ($2.00) + May1-15 full ($15.00) = $17.00
    // c_late:  May16-31 full ($30.00) + Jun1-15 full ($30.00) = $60.00
    expect(angelo.duesPaid).toBeCloseTo(77, 8);
    expect(angelo.periods).toHaveLength(4);
    expect(angelo.periods!.some((p) => p.contractId === "c_early")).toBe(true);
    expect(angelo.periods!.some((p) => p.contractId === "c_late")).toBe(true);
  });

  it("a player with one CALCULATED contract and one NOT_AUTHORIZED contract shows CALCULATED overall, summing only the authorized one's dues", () => {
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const contracts = [
      makeContract({
        id: "c_ok",
        playerId: "p1",
        effectiveDate: "2026-06-01",
        contractEndDate: "2026-06-15",
        duesAuthorization: true,
        terms: [makeTerm({ yearTerms: [makeYearTerm({ baseCompensation: 5000 })] })],
      }),
      makeContract({
        id: "c_unauth",
        playerId: "p1",
        effectiveDate: "2026-06-16",
        contractEndDate: "2026-06-30",
        duesAuthorization: false,
      }),
    ];
    const players = new Map<string, Player>([["p1", { id: "p1", name: "Alice" }]]);

    const report = buildTeamDuesReport({ team, contracts, players, startDate: "2026-06-01", endDate: "2026-06-30" });

    expect(report.players).toHaveLength(1);
    expect(report.players[0].status).toBe("CALCULATED");
    expect(report.players[0].matchedContractIds).toEqual(["c_ok", "c_unauth"]);
    // Only the [Jun1,Jun15] period (from the authorized contract) contributes.
    expect(report.players[0].periods).toHaveLength(1);
    expect(report.players[0].duesPaid).toBeGreaterThan(0);
  });

  it("includes a contract that only partially overlaps the range, with a genuinely prorated value (the original bug, fixed end-to-end)", () => {
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const contracts = [
      makeContract({
        id: "c1",
        playerId: "p1",
        effectiveDate: "2026-05-01",
        contractEndDate: "2026-06-10",
        terms: [makeTerm({ startDate: "2026-01-01", endDate: "2026-12-31", yearTerms: [makeYearTerm({ startDate: "2026-01-01", endDate: "2026-12-31" })] })],
      }),
    ];
    const players = new Map<string, Player>([["p1", { id: "p1", name: "Alice" }]]);

    const report = buildTeamDuesReport({
      team,
      contracts,
      players,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(report.players).toHaveLength(1);
    expect(report.players[0].status).toBe("CALCULATED");
    expect(report.players[0].duesPaid).toBeGreaterThan(0);
  });

  it("aggregates dues across matched players into a team total", () => {
    const team = makeTeam({ payPeriodsPerYear: 24, payrollCycle: "Semi-Monthly" });
    const contracts = [
      makeContract({ id: "c1", playerId: "p1" }),
      makeContract({ id: "c2", playerId: "p2", duesPercent: 0.02 }),
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
      startDate: "2026-06-01",
      endDate: "2026-06-30",
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
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(report.players).toEqual([]);
    expect(report.teamTotalDues).toBe(0);
  });
});
