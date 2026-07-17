import { describe, expect, it } from "vitest";
import {
  CYCLE_GENERATORS,
  cycleAppliesSeasonOpeningBlackout,
  generatePayPeriods,
  isRecognizedPayrollCycle,
  isSeasonOpeningPeriod,
} from "./payPeriods";
import { inclusiveDayCount } from "./dateRange";

describe("isRecognizedPayrollCycle / generatePayPeriods dispatch", () => {
  it("recognizes the three confirmed cycle names", () => {
    expect(isRecognizedPayrollCycle("Semi-Monthly")).toBe(true);
    expect(isRecognizedPayrollCycle("Bi-Weekly")).toBe(true);
    expect(isRecognizedPayrollCycle("Monthly")).toBe(true);
  });

  it("tolerates surrounding whitespace but not case differences", () => {
    expect(isRecognizedPayrollCycle(" Bi-Weekly ")).toBe(true);
    expect(isRecognizedPayrollCycle("bi-weekly")).toBe(false);
  });

  it("returns false/[] for an unrecognized cycle", () => {
    expect(isRecognizedPayrollCycle("Weekly")).toBe(false);
    expect(generatePayPeriods("Weekly", "2026-01-01", "2026-01-31")).toEqual([]);
  });

  it("CYCLE_GENERATORS is the single source of truth used by isRecognizedPayrollCycle", () => {
    expect(Object.keys(CYCLE_GENERATORS).sort()).toEqual(["Bi-Weekly", "Monthly", "Semi-Monthly"]);
  });
});

describe("Semi-Monthly periods", () => {
  it("generates 1st-15th and 16th-end for each month in range", () => {
    // rangeEnd covers the full last period (Feb 29) so this test is purely
    // about calendar shape, not the paid-periods cutoff (tested separately below).
    const periods = generatePayPeriods("Semi-Monthly", "2024-01-01", "2024-02-29");
    expect(periods).toEqual([
      { start: "2024-01-01", end: "2024-01-15" },
      { start: "2024-01-16", end: "2024-01-31" },
      { start: "2024-02-01", end: "2024-02-15" },
      { start: "2024-02-16", end: "2024-02-29" }, // leap year
    ]);
  });

  it("uses Feb 28 as month-end in a non-leap year", () => {
    const periods = generatePayPeriods("Semi-Monthly", "2025-02-01", "2025-02-28");
    expect(periods).toEqual([
      { start: "2025-02-01", end: "2025-02-15" },
      { start: "2025-02-16", end: "2025-02-28" },
    ]);
    expect(inclusiveDayCount(periods[1])).toBe(13);
  });

  it("2024 leap Feb second-half period has 14 days", () => {
    const periods = generatePayPeriods("Semi-Monthly", "2024-02-01", "2024-02-29");
    expect(inclusiveDayCount(periods[1])).toBe(14);
  });
});

describe("Monthly periods", () => {
  it("generates one full-month period per month in range", () => {
    // rangeEnd covers the full last period (Mar 31) — calendar shape only.
    const periods = generatePayPeriods("Monthly", "2024-01-01", "2024-03-31");
    expect(periods).toEqual([
      { start: "2024-01-01", end: "2024-01-31" },
      { start: "2024-02-01", end: "2024-02-29" },
      { start: "2024-03-01", end: "2024-03-31" },
    ]);
  });
});

describe("only-real-paid-periods cutoff", () => {
  it("Semi-Monthly: excludes the 16th-end period when rangeEnd falls before its pay date (client's Birmingham Legion scenario)", () => {
    // Query Jan 1 - Jul 17: Jul 16-31 pays on Jul 31, which hasn't happened
    // yet as of Jul 17, so it must not appear at all — not even partially.
    const periods = generatePayPeriods("Semi-Monthly", "2026-01-01", "2026-07-17");
    const last = periods[periods.length - 1];
    expect(last).toEqual({ start: "2026-07-01", end: "2026-07-15" });
    expect(periods.some((p) => p.start === "2026-07-16")).toBe(false);
  });

  it("Semi-Monthly: includes a period whose pay date exactly equals rangeEnd (inclusive boundary)", () => {
    const periods = generatePayPeriods("Semi-Monthly", "2026-07-01", "2026-07-15");
    expect(periods).toEqual([{ start: "2026-07-01", end: "2026-07-15" }]);
  });

  it("Monthly: excludes a not-yet-paid month", () => {
    const periods = generatePayPeriods("Monthly", "2024-01-01", "2024-03-01");
    expect(periods).toEqual([
      { start: "2024-01-01", end: "2024-01-31" },
      { start: "2024-02-01", end: "2024-02-29" },
    ]);
    expect(periods.some((p) => p.start === "2024-03-01")).toBe(false);
  });

  it("Bi-Weekly: pay date is the period's START, not its end — excludes a period whose start hasn't happened yet", () => {
    // Query ends Jan 20, before the next payday (Jan 29) — that period must not appear.
    const periods = generatePayPeriods("Bi-Weekly", "2026-01-01", "2026-01-20");
    expect(periods).toEqual([{ start: "2026-01-15", end: "2026-01-28" }]);
  });

  it("Bi-Weekly: includes a period as soon as its start (pay date) has passed, even though its end hasn't (client's Chattanooga Red Wolves report)", () => {
    // Season starts Jan 15 (blackout); the real first payment is 2 weeks later on Jan 29 —
    // that period must appear even though the query ends the same day its pay date lands.
    const periods = generatePayPeriods("Bi-Weekly", "2026-01-01", "2026-01-29");
    const last = periods[periods.length - 1];
    expect(last).toEqual({ start: "2026-01-29", end: "2026-02-11" });
  });
});

describe("Bi-Weekly periods", () => {
  it("anchors at Jan 15 and repeats every 14 days (verified against actual 2026 grid)", () => {
    const periods = generatePayPeriods("Bi-Weekly", "2026-01-01", "2026-03-01");
    expect(periods[0]).toEqual({ start: "2026-01-15", end: "2026-01-28" });
    expect(periods[1]).toEqual({ start: "2026-01-29", end: "2026-02-11" });
    expect(periods[2]).toEqual({ start: "2026-02-12", end: "2026-02-25" });
  });

  it("generates exactly 22 periods per year, each 14 days long", () => {
    const periods = generatePayPeriods("Bi-Weekly", "2026-01-01", "2026-12-31");
    expect(periods).toHaveLength(22);
    for (const p of periods) {
      expect(inclusiveDayCount(p)).toBe(14);
    }
  });

  it("the last period of the year spills past Nov 15 but stays a full 14 days (2026)", () => {
    const periods = generatePayPeriods("Bi-Weekly", "2026-01-01", "2026-12-31");
    const last = periods[periods.length - 1];
    expect(last).toEqual({ start: "2026-11-05", end: "2026-11-18" });
    expect(inclusiveDayCount(last)).toBe(14);
  });

  it("the last period of the year spills past Nov 15 but stays a full 14 days (2024, leap year)", () => {
    const periods = generatePayPeriods("Bi-Weekly", "2024-01-01", "2024-12-31");
    const last = periods[periods.length - 1];
    expect(last).toEqual({ start: "2024-11-04", end: "2024-11-17" });
    expect(inclusiveDayCount(last)).toBe(14);
  });

  it("re-anchors fresh each year for a multi-year range, no cross-year period", () => {
    const periods = generatePayPeriods("Bi-Weekly", "2025-12-01", "2026-02-01");
    // 2025's last period (Nov 5 - Nov 18) should NOT appear; nothing generated
    // for the Nov16-Jan14 dead zone; 2026 starts fresh at Jan 15.
    expect(periods.every((p) => p.start >= "2026-01-15" || p.start <= "2025-11-15")).toBe(true);
    expect(periods.some((p) => p.start === "2026-01-15")).toBe(true);
  });

  it("a period spanning Feb 29 in a leap year still has 14 days", () => {
    const periods = generatePayPeriods("Bi-Weekly", "2024-01-01", "2024-12-31");
    const spanning = periods.find((p) => p.start <= "2024-02-29" && p.end >= "2024-02-29");
    expect(spanning).toBeDefined();
    expect(inclusiveDayCount(spanning!)).toBe(14);
  });

  it("anchors at a custom season start instead of the default Jan 15", () => {
    const periods = generatePayPeriods(
      "Bi-Weekly",
      "2026-01-01",
      "2026-04-01",
      { month: 3, day: 1 },
      { month: 10, day: 15 },
    );
    expect(periods[0]).toEqual({ start: "2026-03-01", end: "2026-03-14" });
    expect(periods[1]).toEqual({ start: "2026-03-15", end: "2026-03-28" });
  });

  it("stops generating at a custom season end instead of the default Nov 15", () => {
    const periods = generatePayPeriods(
      "Bi-Weekly",
      "2026-01-01",
      "2026-12-31",
      { month: 3, day: 1 },
      { month: 10, day: 15 },
    );
    const last = periods[periods.length - 1];
    // 14-day grid from Mar 1: last period starting on/before Oct 15.
    expect(last.start <= "2026-10-15").toBe(true);
    expect(periods.every((p) => p.start >= "2026-03-01")).toBe(true);
  });
});

describe("cycleAppliesSeasonOpeningBlackout", () => {
  it("applies to Semi-Monthly only", () => {
    expect(cycleAppliesSeasonOpeningBlackout("Semi-Monthly")).toBe(true);
  });

  it("does not apply to Bi-Weekly — its season-opening period is a normal, fully paid period (client correction)", () => {
    expect(cycleAppliesSeasonOpeningBlackout("Bi-Weekly")).toBe(false);
  });

  it("does not apply to Monthly", () => {
    expect(cycleAppliesSeasonOpeningBlackout("Monthly")).toBe(false);
  });

  it("tolerates whitespace like isRecognizedPayrollCycle", () => {
    expect(cycleAppliesSeasonOpeningBlackout(" Semi-Monthly ")).toBe(true);
  });
});

describe("isSeasonOpeningPeriod", () => {
  it("identifies the Semi-Monthly period containing the default season start (Jan 15)", () => {
    expect(isSeasonOpeningPeriod({ start: "2026-01-01", end: "2026-01-15" }, "2026-01-15")).toBe(true);
    expect(isSeasonOpeningPeriod({ start: "2026-01-16", end: "2026-01-31" }, "2026-01-15")).toBe(false);
  });

  it("does NOT flag a period whose season start lands exactly on its own start date — no partial sliver to forgive (client correction: custom season start = Jan 1)", () => {
    // Jan 1 is period [Jan1,Jan15]'s own natural start, not a mid-period cutoff —
    // the whole period is legitimately, fully within the season.
    expect(isSeasonOpeningPeriod({ start: "2026-01-01", end: "2026-01-15" }, "2026-01-01")).toBe(false);
    // Same logic for a Bi-Weekly-shaped period anchored exactly at the season start.
    expect(isSeasonOpeningPeriod({ start: "2026-01-15", end: "2026-01-28" }, "2026-01-15")).toBe(false);
  });

  it("resolves unambiguously for a season start on a period boundary (day 16)", () => {
    expect(isSeasonOpeningPeriod({ start: "2026-01-01", end: "2026-01-15" }, "2026-01-16")).toBe(false);
    // Jan 16 is [Jan16,Jan31]'s own start — no sliver, not the opening period.
    expect(isSeasonOpeningPeriod({ start: "2026-01-16", end: "2026-01-31" }, "2026-01-16")).toBe(false);
  });

  it("resolves unambiguously for a season start mid-period (day 20)", () => {
    expect(isSeasonOpeningPeriod({ start: "2026-01-16", end: "2026-01-31" }, "2026-01-20")).toBe(true);
    expect(isSeasonOpeningPeriod({ start: "2026-02-01", end: "2026-02-15" }, "2026-01-20")).toBe(false);
  });
});
