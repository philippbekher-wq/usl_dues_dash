import { z } from "zod";
import { extractMonthDay, isValidMonthDay } from "@/lib/dues/season";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date format YYYY-MM-DD");

const monthDayString = (label: string) =>
  isoDate.refine((value) => isValidMonthDay(extractMonthDay(value)), {
    message: `${label} must be a day that exists every year (e.g. not Feb 29 or the 31st of a 30-day month)`,
  });

export const duesRequestSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    teamId: z.string().min(1, "teamId is required"),
    seasonStartDate: monthDayString("Dues season start"),
    seasonEndDate: monthDayString("Dues season end"),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  })
  .refine((data) => data.seasonStartDate.slice(5, 10) <= data.seasonEndDate.slice(5, 10), {
    message: "Dues season start must be on or before dues season end (a wrapping season across Dec 31/Jan 1 isn't supported)",
    path: ["seasonEndDate"],
  });

export type DuesRequest = z.infer<typeof duesRequestSchema>;
