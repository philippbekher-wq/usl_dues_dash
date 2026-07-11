import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date format YYYY-MM-DD");

export const duesRequestSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    teamId: z.string().min(1, "teamId is required"),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be on or before endDate",
    path: ["endDate"],
  });

export type DuesRequest = z.infer<typeof duesRequestSchema>;
