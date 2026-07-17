import { getDate, getDaysInMonth, getMonth, parseISO } from "date-fns";
import type { DateRange } from "./dateRange";

export interface MonthDay {
  month: number;
  day: number;
}

// Default dues-collection season, used only as the frontend's default input
// values now — staff can override via the dashboard, see lib/validation.ts.
export const DEFAULT_SEASON_START: MonthDay = { month: 1, day: 15 };
export const DEFAULT_SEASON_END: MonthDay = { month: 11, day: 15 };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthDayToIsoForYear(year: number, md: MonthDay): string {
  return `${year}-${pad(md.month)}-${pad(md.day)}`;
}

export function getDuesSeasonWindow(year: number, seasonStart: MonthDay, seasonEnd: MonthDay): DateRange {
  return {
    start: monthDayToIsoForYear(year, seasonStart),
    end: monthDayToIsoForYear(year, seasonEnd),
  };
}

export function extractMonthDay(isoDate: string): MonthDay {
  const parsed = parseISO(isoDate);
  return { month: getMonth(parsed) + 1, day: getDate(parsed) };
}

// A recurring month-day boundary must be valid in EVERY year, so check against
// a non-leap reference year — Feb 29 is valid in leap years but not every year.
const NON_LEAP_REFERENCE_YEAR = 2023;

export function isValidMonthDay(md: MonthDay): boolean {
  if (!Number.isInteger(md.month) || !Number.isInteger(md.day)) return false;
  if (md.month < 1 || md.month > 12 || md.day < 1) return false;
  const daysInMonth = getDaysInMonth(new Date(NON_LEAP_REFERENCE_YEAR, md.month - 1, 1));
  return md.day <= daysInMonth;
}
