import { DateField } from "./DateField";

const inputClass =
  "h-11 rounded-md border border-(--color-line) bg-(--color-paper-raised) px-3 text-sm text-(--color-ink) outline-none transition-colors focus-visible:border-(--color-gold) focus-visible:ring-2 focus-visible:ring-(--color-gold-soft)";

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
  return (
    <div className="flex gap-3">
      <DateField label="From" value={startDate} onChange={onStartDateChange} className={inputClass} />
      <DateField label="To" value={endDate} onChange={onEndDateChange} className={inputClass} />
    </div>
  );
}
