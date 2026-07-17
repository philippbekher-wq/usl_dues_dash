"use client";

import { useState } from "react";

const inputClass =
  "h-11 rounded-md border border-(--color-line) bg-(--color-paper-raised) px-3 text-sm text-(--color-ink) outline-none transition-colors focus-visible:border-(--color-gold) focus-visible:ring-2 focus-visible:ring-(--color-gold-soft)";

export function SeasonRangePicker({
  seasonStartDate,
  seasonEndDate,
  onSeasonStartDateChange,
  onSeasonEndDateChange,
  error,
}: {
  seasonStartDate: string;
  seasonEndDate: string;
  onSeasonStartDateChange: (value: string) => void;
  onSeasonEndDateChange: (value: string) => void;
  error?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-(--color-line) pt-3">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-(--color-ink-muted) transition-colors hover:text-(--color-ink)"
      >
        <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
        Dues season settings
      </button>

      {isOpen ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
              Season start
            </span>
            <input
              type="date"
              value={seasonStartDate}
              onChange={(e) => onSeasonStartDateChange(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
              Season end
            </span>
            <input
              type="date"
              value={seasonEndDate}
              onChange={(e) => onSeasonEndDateChange(e.target.value)}
              className={inputClass}
            />
          </label>
          <p className="text-xs text-(--color-ink-muted) sm:pb-3">
            Only the month and day matter — the year shown is ignored.
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-(--color-flag)">{error}</p> : null}
    </div>
  );
}
