"use client";

import { useState } from "react";
import type { TeamDuesReport } from "@/lib/dues/types";
import { DateRangePicker } from "./DateRangePicker";
import { ResultsTable } from "./ResultsTable";
import { TeamSelector, type TeamOption } from "./TeamSelector";

type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; report: TeamDuesReport };

export function DashboardClient({ teams }: { teams: TeamOption[] }) {
  const [teamId, setTeamId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [state, setState] = useState<RequestState>({ status: "idle" });

  const canSubmit = Boolean(teamId && startDate && endDate) && startDate <= endDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setState({ status: "loading" });
    try {
      const res = await fetch("/api/dues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, startDate, endDate }),
      });
      const body = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: body.error ?? "Something went wrong." });
        return;
      }

      setState({ status: "success", report: body as TeamDuesReport });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Try again." });
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-(--color-line) bg-(--color-paper-raised) p-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <TeamSelector teams={teams} value={teamId} onChange={setTeamId} />
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit || state.status === "loading"}
          className="h-11 shrink-0 rounded-md bg-(--color-pitch) px-6 text-sm font-medium text-(--color-paper) transition-colors hover:bg-(--color-pitch-dark) disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-gold)"
        >
          {state.status === "loading" ? "Calculating…" : "Calculate"}
        </button>
      </form>

      {startDate && endDate && startDate > endDate ? (
        <p className="text-sm text-(--color-flag)">The end date must be on or after the start date.</p>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-lg border border-(--color-danger) bg-(--color-danger-soft) px-5 py-4 text-sm text-(--color-danger)">
          {state.message}
        </div>
      ) : null}

      {state.status === "success" ? <ResultsTable report={state.report} /> : null}

      {state.status === "idle" ? (
        <div className="rounded-lg border border-dashed border-(--color-line) px-6 py-10 text-center text-sm text-(--color-ink-muted)">
          Select a team and a date range, then calculate to see accumulated dues per player.
        </div>
      ) : null}
    </div>
  );
}
