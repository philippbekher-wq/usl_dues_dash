import { differenceInCalendarDays, parseISO } from "date-fns";

export interface DateRange {
  start: string;
  end: string;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Inclusive n-way intersection. Returns null if the ranges don't all overlap. */
export function intersectRanges(...ranges: DateRange[]): DateRange | null {
  const start = ranges.reduce((max, r) => (r.start > max ? r.start : max), ranges[0].start);
  const end = ranges.reduce((min, r) => (r.end < min ? r.end : min), ranges[0].end);
  return start <= end ? { start, end } : null;
}

export function inclusiveDayCount(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1;
}
