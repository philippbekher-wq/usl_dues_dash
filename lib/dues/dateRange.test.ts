import { describe, expect, it } from "vitest";
import { inclusiveDayCount, intersectRanges, rangesOverlap } from "./dateRange";

describe("rangesOverlap", () => {
  it("returns true for overlapping ranges", () => {
    expect(rangesOverlap({ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" })).toBe(true);
  });

  it("returns true for touching ranges (end of A == start of B)", () => {
    expect(rangesOverlap({ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-10", end: "2024-01-20" })).toBe(true);
  });

  it("returns false for non-overlapping ranges", () => {
    expect(rangesOverlap({ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-11", end: "2024-01-20" })).toBe(false);
  });
});

describe("intersectRanges", () => {
  it("returns the overlap of two ranges", () => {
    expect(intersectRanges({ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-05", end: "2024-01-15" })).toEqual({
      start: "2024-01-05",
      end: "2024-01-10",
    });
  });

  it("returns a 1-day range for touching ranges", () => {
    expect(intersectRanges({ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-10", end: "2024-01-20" })).toEqual({
      start: "2024-01-10",
      end: "2024-01-10",
    });
  });

  it("returns null for non-overlapping ranges", () => {
    expect(intersectRanges({ start: "2024-01-01", end: "2024-01-10" }, { start: "2024-01-11", end: "2024-01-20" })).toBeNull();
  });

  it("intersects 3+ ranges", () => {
    expect(
      intersectRanges(
        { start: "2024-01-01", end: "2024-01-31" },
        { start: "2024-01-10", end: "2024-01-25" },
        { start: "2024-01-15", end: "2024-01-20" },
      ),
    ).toEqual({ start: "2024-01-15", end: "2024-01-20" });
  });

  it("intersects 5 ranges to null when one excludes the rest", () => {
    expect(
      intersectRanges(
        { start: "2024-01-01", end: "2024-01-31" },
        { start: "2024-01-10", end: "2024-01-25" },
        { start: "2024-01-15", end: "2024-01-20" },
        { start: "2024-01-01", end: "2024-01-31" },
        { start: "2024-02-01", end: "2024-02-28" },
      ),
    ).toBeNull();
  });

  it("returns a single range unchanged", () => {
    expect(intersectRanges({ start: "2024-01-01", end: "2024-01-10" })).toEqual({
      start: "2024-01-01",
      end: "2024-01-10",
    });
  });
});

describe("inclusiveDayCount", () => {
  it("returns 1 for a same-day range", () => {
    expect(inclusiveDayCount({ start: "2024-01-01", end: "2024-01-01" })).toBe(1);
  });

  it("returns 15 for Jan 1 - Jan 15", () => {
    expect(inclusiveDayCount({ start: "2024-01-01", end: "2024-01-15" })).toBe(15);
  });

  it("returns 14 for a 14-day bi-weekly period", () => {
    expect(inclusiveDayCount({ start: "2026-01-15", end: "2026-01-28" })).toBe(14);
  });
});
