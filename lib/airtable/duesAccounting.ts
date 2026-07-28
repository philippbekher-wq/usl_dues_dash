import { addDays, format, parseISO, subDays } from "date-fns";
import type { ActualDuesPayment, ActualDuesResult, Player } from "@/lib/dues/types";
import { getBase } from "./client";
import { AirtableFetchError } from "./errors";
import { FIELDS, TABLES } from "./schema";

function toDateOnly(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function toLinkedIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Fetches real payroll dues payments (Dues Accounting table) with a Payroll Date
 * inside [startDate, endDate] and a Team Name matching the given team, matched to
 * the given players via the table's linked "Player" record — falling back to an
 * exact "Full Name" text match only for the records that have no linked Player (a
 * real gap in the source data). The Team Name check matters for a player traded
 * mid-window: without it, a payment remitted by their old team's payroll would show
 * up under the new team's report too, since the player-only match doesn't know which
 * team's payroll actually made the payment. "Team Name" is free text entered at
 * submission time, so the comparison is trimmed/case-insensitive rather than exact.
 * Returns one ActualDuesResult per input player, in the same order, even when a
 * player has no matching payments in range.
 */
export async function fetchActualDuesForPlayers(
  players: Player[],
  teamName: string,
  startDate: string,
  endDate: string,
): Promise<ActualDuesResult[]> {
  const base = getBase();
  const idByName = new Map(players.map((p) => [p.name, p.id]));
  const knownIds = new Set(players.map((p) => p.id));
  const normalizedTeamName = teamName.trim().toLowerCase();

  // IS_AFTER/IS_BEFORE are exclusive, so widen the bounds by a day on each side
  // to make the filtered range inclusive of startDate and endDate themselves.
  const lowerBound = format(subDays(parseISO(startDate), 1), "yyyy-MM-dd");
  const upperBound = format(addDays(parseISO(endDate), 1), "yyyy-MM-dd");
  const formula = `AND(IS_AFTER({${FIELDS.duesAccounting.payrollDate}}, "${lowerBound}"), IS_BEFORE({${FIELDS.duesAccounting.payrollDate}}, "${upperBound}"))`;

  let records;
  try {
    records = await base(TABLES.duesAccounting).select({ filterByFormula: formula }).all();
  } catch (error) {
    throw new AirtableFetchError("Failed to fetch Dues Accounting", error);
  }

  const paymentsByPlayerId = new Map<string, ActualDuesPayment[]>();

  for (const record of records) {
    const recordTeamName = String(record.get(FIELDS.duesAccounting.teamName) ?? "").trim().toLowerCase();
    if (recordTeamName !== normalizedTeamName) continue;

    const linkedIds = toLinkedIds(record.get(FIELDS.duesAccounting.player));
    const fullName = String(record.get(FIELDS.duesAccounting.fullName) ?? "");
    const playerId = linkedIds.find((id) => knownIds.has(id)) ?? idByName.get(fullName);
    if (!playerId) continue;

    const payment: ActualDuesPayment = {
      payrollDate: toDateOnly(record.get(FIELDS.duesAccounting.payrollDate)),
      amount: Number(record.get(FIELDS.duesAccounting.duesPaid) ?? 0),
    };

    const list = paymentsByPlayerId.get(playerId) ?? [];
    list.push(payment);
    paymentsByPlayerId.set(playerId, list);
  }

  return players.map((player) => {
    const payments = (paymentsByPlayerId.get(player.id) ?? []).sort((a, b) =>
      a.payrollDate.localeCompare(b.payrollDate),
    );
    return {
      playerId: player.id,
      playerName: player.name,
      totalPaid: payments.reduce((sum, p) => sum + p.amount, 0),
      payments,
    };
  });
}
