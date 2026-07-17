import { addDays, eachMonthOfInterval, format, getYear, lastDayOfMonth, parseISO } from "date-fns";
import { DEFAULT_SEASON_END, DEFAULT_SEASON_START, monthDayToIsoForYear, type MonthDay } from "./season";

export interface PayPeriod {
  start: string;
  end: string;
}

function fmt(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function generateSemiMonthlyPeriods(rangeStart: string, rangeEnd: string): PayPeriod[] {
  const months = eachMonthOfInterval({ start: parseISO(rangeStart), end: parseISO(rangeEnd) });
  const periods: PayPeriod[] = [];
  for (const monthStart of months) {
    const year = format(monthStart, "yyyy");
    const month = format(monthStart, "MM");
    const last = fmt(lastDayOfMonth(monthStart));
    periods.push({ start: `${year}-${month}-01`, end: `${year}-${month}-15` });
    periods.push({ start: `${year}-${month}-16`, end: last });
  }
  return periods;
}

function generateMonthlyPeriods(rangeStart: string, rangeEnd: string): PayPeriod[] {
  const months = eachMonthOfInterval({ start: parseISO(rangeStart), end: parseISO(rangeEnd) });
  return months.map((monthStart) => ({
    start: fmt(monthStart),
    end: fmt(lastDayOfMonth(monthStart)),
  }));
}

// The season start is always a pay date; periods repeat every 14 days from
// there, re-anchored fresh each calendar year (no period ever crosses Dec
// 31/Jan 1 — the last period of a year starts on/before the season end but
// its *end* naturally spills a couple days past it; that's expected, not a
// bug, and the season-window intersection excludes those spillover days
// downstream).
function generateBiWeeklyPeriods(
  rangeStart: string,
  rangeEnd: string,
  seasonStart: MonthDay = DEFAULT_SEASON_START,
  seasonEnd: MonthDay = DEFAULT_SEASON_END,
): PayPeriod[] {
  const startYear = getYear(parseISO(rangeStart));
  const endYear = getYear(parseISO(rangeEnd));
  const periods: PayPeriod[] = [];

  for (let year = startYear; year <= endYear; year++) {
    let periodStart = parseISO(monthDayToIsoForYear(year, seasonStart));
    const lastAllowedStart = parseISO(monthDayToIsoForYear(year, seasonEnd));
    while (periodStart <= lastAllowedStart) {
      periods.push({ start: fmt(periodStart), end: fmt(addDays(periodStart, 13)) });
      periodStart = addDays(periodStart, 14);
    }
  }

  return periods;
}

type PeriodGenerator = (
  rangeStart: string,
  rangeEnd: string,
  seasonStart?: MonthDay,
  seasonEnd?: MonthDay,
) => PayPeriod[];

export const CYCLE_GENERATORS: Record<string, PeriodGenerator> = {
  "Semi-Monthly": generateSemiMonthlyPeriods,
  "Bi-Weekly": generateBiWeeklyPeriods,
  Monthly: generateMonthlyPeriods,
};

// Cycles that deduct dues in advance for the upcoming period (pay date =
// period start) rather than in arrears for the period just completed (pay
// date = period end). Confirmed by the client: Bi-Weekly pays on Jan 15,
// then every 14 days, in advance for the following 2 weeks — that's why the
// season-opening period is [seasonStart, seasonStart+13] (seasonStart IS the
// blacked-out pay date) and the next real payday is that period's start
// plus 14 days, not its end. Semi-Monthly/Monthly pay in arrears (15th /
// last day of month is the end of the period being paid for).
export const CYCLES_PAID_IN_ADVANCE = new Set(["Bi-Weekly"]);

export function cyclePaysInAdvance(cycle: string): boolean {
  return CYCLES_PAID_IN_ADVANCE.has(cycle.trim());
}

function payDateOf(cycle: string, period: PayPeriod): string {
  return cyclePaysInAdvance(cycle) ? period.start : period.end;
}

// The very first pay period of the season, each year, is a dues blackout for
// Semi-Monthly only (confirmed by the client). Bi-Weekly has no blackout —
// its season-opening period [seasonStart, seasonStart+13] is a normal, fully
// paid period like any other. Monthly is also excluded, since its periods
// already prorate normally against the season boundary.
export const CYCLES_WITH_SEASON_OPENING_BLACKOUT = new Set(["Semi-Monthly"]);

export function isRecognizedPayrollCycle(cycle: string): boolean {
  return cycle.trim() in CYCLE_GENERATORS;
}

export function cycleAppliesSeasonOpeningBlackout(cycle: string): boolean {
  return CYCLES_WITH_SEASON_OPENING_BLACKOUT.has(cycle.trim());
}

export function generatePayPeriods(
  cycle: string,
  rangeStart: string,
  rangeEnd: string,
  seasonStart: MonthDay = DEFAULT_SEASON_START,
  seasonEnd: MonthDay = DEFAULT_SEASON_END,
): PayPeriod[] {
  const generator = CYCLE_GENERATORS[cycle.trim()];
  if (!generator) return [];
  const periods = generator(rangeStart, rangeEnd, seasonStart, seasonEnd);
  // If a period's pay date hasn't happened yet as of rangeEnd, it hasn't
  // been paid, so it shouldn't appear at all (not even partially prorated).
  return periods.filter((p) => payDateOf(cycle, p) <= rangeEnd);
}

/**
 * Is this the pay period whose coverage would otherwise be reduced to an
 * awkward partial sliver by the season start (i.e. the season-opening
 * blackout period)? The season start must fall STRICTLY inside the period —
 * if it lands exactly on the period's own start date, there's no sliver to
 * forgive (the whole period is legitimately, fully within the season), so
 * that period is charged normally instead.
 */
export function isSeasonOpeningPeriod(period: PayPeriod, seasonStartForYear: string): boolean {
  return period.start < seasonStartForYear && seasonStartForYear <= period.end;
}
