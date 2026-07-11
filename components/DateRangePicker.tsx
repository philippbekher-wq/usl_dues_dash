export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}) {
  const inputClass =
    "h-11 rounded-md border border-(--color-line) bg-(--color-paper-raised) px-3 text-sm text-(--color-ink) outline-none transition-colors focus-visible:border-(--color-gold) focus-visible:ring-2 focus-visible:ring-(--color-gold-soft)";

  return (
    <div className="flex gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
          From
        </span>
        <input
          type="date"
          value={startDate}
          max={endDate || undefined}
          onChange={(e) => onStartDateChange(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
          To
        </span>
        <input
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => onEndDateChange(e.target.value)}
          className={inputClass}
        />
      </label>
    </div>
  );
}
