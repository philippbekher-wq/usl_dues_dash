"use client";

import { Fragment, useState } from "react";
import { formatCurrency, formatMonths, formatPercent } from "@/lib/format";
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
            const rowKey = player.playerId + (player.matchedContractId ?? "");
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
                    <StatusBadge status={player.status} noMatchReason={player.noMatchReason} />
                  </td>
                  <td className="py-3 pr-4 text-right font-(family-name:--font-mono) tabular-nums text-(--color-ink)">
                    {formatCurrency(player.duesPaid)}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-(--color-line) bg-(--color-paper-raised) last:border-b-0">
                    <td colSpan={4} className="px-4 py-4">
                      <DuesBreakdown result={player} />
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

function DuesBreakdown({ result }: { result: TeamDuesReport["players"][number] }) {
  if (!result.breakdown) {
    return (
      <p className="text-sm text-(--color-ink-muted)">
        No calculation breakdown available for this status.
      </p>
    );
  }

  const b = result.breakdown;
  const rows: [string, string][] = [
    ["Base compensation", formatCurrency(b.baseCompensation)],
    ["Annual compensation", formatCurrency(b.annualCompensation)],
    ["Compensation / paycheck", formatCurrency(b.compensationPerPaycheck)],
    ["Pay periods / year", String(b.payPeriodsPerYear)],
    ["Payments / month", b.cycleNumber.toFixed(3)],
    ["Months in period", formatMonths(b.monthsInPeriod)],
    ["Dues %", formatPercent(b.duesPercent)],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-(family-name:--font-mono) text-xs sm:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-(--color-ink-muted)">{label}</dt>
          <dd className="tabular-nums text-(--color-ink)">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
