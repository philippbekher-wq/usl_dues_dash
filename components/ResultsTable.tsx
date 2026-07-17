"use client";

import { Fragment, useState } from "react";
import { formatCurrency, formatDateRange } from "@/lib/format";
import type { TeamDuesReport } from "@/lib/dues/types";
import { StatusBadge } from "./StatusBadge";

export function ResultsTable({ report }: { report: TeamDuesReport }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (report.players.length === 0) {
    return (
      <div className="rounded-lg border border-(--color-line) bg-(--color-paper-raised) px-6 py-10 text-center">
        <p className="font-(family-name:--font-display) text-lg text-(--color-ink)">
          No players found
        </p>
        <p className="mt-1 text-sm text-(--color-ink-muted)">
          No contracts on {report.teamName} cover {report.startDate} through {report.endDate}.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-(--color-line)">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-(--color-line) bg-(--color-paper-raised) text-left text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
            <th className="w-8 py-3 pl-4" aria-hidden />
            <th className="py-3 pr-3">Player</th>
            <th className="py-3 pr-3">Status</th>
            <th className="py-3 pr-4 text-right font-(family-name:--font-mono)">Dues paid</th>
          </tr>
        </thead>
        <tbody>
          {report.players.map((player) => {
            const rowKey = player.playerId;
            const isExpanded = expandedId === rowKey;
            return (
              <Fragment key={rowKey}>
                <tr
                  className="cursor-pointer border-b border-(--color-line) transition-colors last:border-b-0 hover:bg-(--color-paper-raised)"
                  onClick={() => setExpandedId(isExpanded ? null : rowKey)}
                >
                  <td className="py-3 pl-4 text-(--color-ink-muted)">
                    <span
                      className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      aria-hidden
                    >
                      ›
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-(--color-ink)">{player.playerName}</td>
                  <td className="py-3 pr-3">
                    <StatusBadge status={player.status} />
                  </td>
                  <td className="py-3 pr-4 text-right font-(family-name:--font-mono) tabular-nums text-(--color-ink)">
                    {formatCurrency(player.duesPaid)}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-(--color-line) bg-(--color-paper-raised) last:border-b-0">
                    <td colSpan={4} className="px-4 py-4">
                      <PeriodBreakdown result={player} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-(--color-gold)">
            <td colSpan={3} className="py-4 pl-4 text-right font-(family-name:--font-display) text-base text-(--color-ink)">
              Team total
            </td>
            <td className="py-4 pr-4 text-right font-(family-name:--font-mono) text-lg font-semibold tabular-nums text-(--color-gold)">
              {formatCurrency(report.teamTotalDues)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PeriodBreakdown({ result }: { result: TeamDuesReport["players"][number] }) {
  const hasPeriods = Boolean(result.periods && result.periods.length > 0);

  if (!hasPeriods) {
    if (result.status === "NOT_AUTHORIZED") {
      return <p className="text-sm text-(--color-ink-muted)">None of this player&rsquo;s contracts have Dues Authorization checked.</p>;
    }

    if (result.status === "DATA_ERROR") {
      return (
        <p className="text-sm text-(--color-danger)">
          Missing or unrecognized payroll data on this team (Pay Periods per Year or Payroll Cycle) — dues could not be calculated.
        </p>
      );
    }

    return (
      <p className="text-sm text-(--color-ink-muted)">
        This player&rsquo;s contract(s) are authorized, but no pay period had covered days within the selected range and
        the dues season.{" "}
        {typeof result.periodsConsidered === "number"
          ? `0 of ${result.periodsConsidered} generated pay periods overlapped.`
          : null}
      </p>
    );
  }

  const sorted = [...result.periods!].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  const multipleContracts = result.matchedContractIds.length > 1;

  return (
    <div className="overflow-x-auto">
      {result.status === "DATA_ERROR" ? (
        <p className="mb-2 text-xs text-(--color-danger)">
          One of this player&rsquo;s other contracts has missing/unrecognized payroll data and may be excluded from this total.
        </p>
      ) : null}
      {multipleContracts ? (
        <p className="mb-2 text-xs text-(--color-ink-muted)">
          {result.matchedContractIds.length} contracts contribute to this total, shown together below in date order.
        </p>
      ) : null}
      <table className="w-full min-w-[520px] border-collapse font-(family-name:--font-mono) text-xs">
        <thead>
          <tr className="text-left text-(--color-ink-muted)">
            <th className="py-1.5 pr-4 font-medium">Period</th>
            <th className="py-1.5 pr-4 font-medium">Covered days</th>
            <th className="py-1.5 pr-4 font-medium">Base comp</th>
            <th className="py-1.5 pr-0 text-right font-medium">Contribution</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const sharesPeriodWithPrev =
              i > 0 && sorted[i - 1].periodStart === p.periodStart && sorted[i - 1].periodEnd === p.periodEnd;
            return (
              <tr
                key={`${p.periodStart}-${p.contractId}-${p.contractYearTermId}`}
                className={sharesPeriodWithPrev ? "" : "border-t border-(--color-line)"}
              >
                <td className="py-1.5 pr-4 text-(--color-ink)">
                  {formatDateRange(p.periodStart, p.periodEnd)}
                  {sharesPeriodWithPrev ? <span className="ml-1.5 text-(--color-ink-muted)">(split)</span> : null}
                  {p.isSeasonOpeningBlackout ? (
                    <span
                      className="ml-1.5 text-(--color-flag)"
                      title="First pay period of the season — no dues owed by policy, regardless of coverage."
                    >
                      (season opening — no dues)
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-4 tabular-nums text-(--color-ink)">
                  {p.coveredDays} / {p.periodTotalDays}
                </td>
                <td className="py-1.5 pr-4 tabular-nums text-(--color-ink-muted)">
                  {formatCurrency(p.baseCompensation)}
                </td>
                <td className="py-1.5 pr-0 text-right tabular-nums text-(--color-ink)">
                  {formatCurrency(p.contribution)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-(--color-line)">
            <td colSpan={3} className="py-1.5 pr-4 text-right text-(--color-ink-muted)">
              Subtotal
            </td>
            <td className="py-1.5 pr-0 text-right font-semibold tabular-nums text-(--color-ink)">
              {formatCurrency(sorted.reduce((sum, p) => sum + p.contribution, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
