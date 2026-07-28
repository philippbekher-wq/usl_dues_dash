"use client";

import { Fragment, useState } from "react";
import { formatCurrency, formatDate, formatDateRange } from "@/lib/format";
import type { ActualDuesResult, DuesResult, TeamDuesReportWithActuals } from "@/lib/dues/types";
import { StatusBadge } from "./StatusBadge";

export function ResultsTable({ report }: { report: TeamDuesReportWithActuals }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const actualByPlayerId = new Map(report.actualDues.map((r) => [r.playerId, r]));

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
            <th className="py-3 pr-3 text-right font-(family-name:--font-mono)">Dues owed</th>
            <th className="py-3 pr-4 text-right font-(family-name:--font-mono)">Actual paid</th>
          </tr>
        </thead>
        <tbody>
          {report.players.map((player) => {
            const rowKey = player.playerId;
            const isExpanded = expandedId === rowKey;
            const actual = actualByPlayerId.get(player.playerId);
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
                  <td className="py-3 pr-3 text-right font-(family-name:--font-mono) tabular-nums text-(--color-ink)">
                    {formatCurrency(player.duesPaid)}
                  </td>
                  <td className="py-3 pr-4 text-right font-(family-name:--font-mono) tabular-nums text-(--color-ink)">
                    {formatCurrency(actual?.totalPaid ?? 0)}
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="border-b border-(--color-line) bg-(--color-paper-raised) last:border-b-0">
                    <td colSpan={5} className="px-4 py-4">
                      <CombinedBreakdown result={player} actual={actual} />
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
            <td className="py-4 pr-3 text-right font-(family-name:--font-mono) text-lg font-semibold tabular-nums text-(--color-gold)">
              {formatCurrency(report.teamTotalDues)}
            </td>
            <td className="py-4 pr-4 text-right font-(family-name:--font-mono) text-lg font-semibold tabular-nums text-(--color-gold)">
              {formatCurrency(report.teamTotalActualPaid)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CombinedBreakdown({
  result,
  actual,
}: {
  result: DuesResult;
  actual: ActualDuesResult | undefined;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
          Dues owed (calculated)
        </h3>
        <PeriodBreakdown result={result} />
      </div>
      <div className="flex-1">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
          Actual dues paid
        </h3>
        <PaymentBreakdown actual={actual} />
      </div>
    </div>
  );
}

function PeriodBreakdown({ result }: { result: DuesResult }) {
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
      <table className="w-full min-w-[420px] border-collapse font-(family-name:--font-mono) text-xs">
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

function PaymentBreakdown({ actual }: { actual: ActualDuesResult | undefined }) {
  const payments = actual?.payments ?? [];

  if (payments.length === 0) {
    return (
      <p className="text-sm text-(--color-ink-muted)">
        No Dues Accounting payments found for this player in this date range.
      </p>
    );
  }

  return (
    <table className="w-full max-w-xs border-collapse font-(family-name:--font-mono) text-xs">
      <thead>
        <tr className="text-left text-(--color-ink-muted)">
          <th className="py-1.5 pr-4 font-medium">Payroll date</th>
          <th className="py-1.5 pr-0 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((p, i) => (
          <tr key={`${p.payrollDate}-${i}`} className="border-t border-(--color-line)">
            <td className="py-1.5 pr-4 text-(--color-ink)">{formatDate(p.payrollDate)}</td>
            <td className="py-1.5 pr-0 text-right tabular-nums text-(--color-ink)">
              {formatCurrency(p.amount)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-(--color-line)">
          <td className="py-1.5 pr-4 text-right text-(--color-ink-muted)">Subtotal</td>
          <td className="py-1.5 pr-0 text-right font-semibold tabular-nums text-(--color-ink)">
            {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
