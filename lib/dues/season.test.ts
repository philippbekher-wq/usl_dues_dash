import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEASON_END,
  DEFAULT_SEASON_START,
  extractMonthDay,
  getDuesSeasonWindow,
  isValidMonthDay,
  monthDayToIsoForYear,
} from "./season";

describe("monthDayToIsoForYear", () => {
  it("zero-pads month and day", () => {
    expect(monthDayToIsoForYear(2026, { month: 1, day: 15 })).toBe("2026-01-15");
    expect(monthDayToIsoForYear(2026, { month: 11, day: 5 })).toBe("2026-11-05");
  });
});

describe("getDuesSeasonWindow", () => {
  it("returns the default Jan 15 - Nov 15 window when given the default constants", () => {
    expect(getDuesSeasonWindow(2026, DEFAULT_SEASON_START, DEFAULT_SEASON_END)).toEqual({
      start: "2026-01-15",
      end: "2026-11-15",
    });
  });

  it("supports a custom season window", () => {
    expect(getDuesSeasonWindow(2026, { month: 3, day: 1 }, { month: 10, day: 15 })).toEqual({
      start: "2026-03-01",
      end: "2026-10-15",
    });
  });
});

describe("extractMonthDay", () => {
  it("discards the year and returns month/day", () => {
    expect(extractMonthDay("2026-01-15")).toEqual({ month: 1, day: 15 });
    expect(extractMonthDay("2024-11-05")).toEqual({ month: 11, day: 5 });
  });
});

describe("isValidMonthDay", () => {
  it("accepts valid recurring month-days, including default season bounds", () => {
    expect(isValidMonthDay(DEFAULT_SEASON_START)).toBe(true);
    expect(isValidMonthDay(DEFAULT_SEASON_END)).toBe(true);
    expect(isValidMonthDay({ month: 2, day: 28 })).toBe(true);
    expect(isValidMonthDay({ month: 4, day: 30 })).toBe(true);
  });

  it("rejects Feb 29 — not valid every year", () => {
    expect(isValidMonthDay({ month: 2, day: 29 })).toBe(false);
  });

  it("rejects day 31 in a 30-day month", () => {
    expect(isValidMonthDay({ month: 4, day: 31 })).toBe(false);
    expect(isValidMonthDay({ month: 9, day: 31 })).toBe(false);
  });

  it("rejects out-of-range months", () => {
    expect(isValidMonthDay({ month: 0, day: 15 })).toBe(false);
    expect(isValidMonthDay({ month: 13, day: 1 })).toBe(false);
  });

  it("rejects zero/negative days", () => {
    expect(isValidMonthDay({ month: 1, day: 0 })).toBe(false);
  });
});
