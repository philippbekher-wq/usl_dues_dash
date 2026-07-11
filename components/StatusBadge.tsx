import type { DuesStatus, NoMatchReason } from "@/lib/dues/types";

const STATUS_COPY: Record<DuesStatus, { label: string; dot: string; text: string; bg: string }> = {
  CALCULATED: {
    label: "Calculated",
    dot: "bg-(--color-ok)",
    text: "text-(--color-ok)",
    bg: "bg-(--color-ok-soft)",
  },
  NOT_AUTHORIZED: {
    label: "Not authorized",
    dot: "bg-(--color-ink-muted)",
    text: "text-(--color-ink-muted)",
    bg: "bg-(--color-paper-raised)",
  },
  NO_MATCH: {
    label: "No match",
    dot: "bg-(--color-flag)",
    text: "text-(--color-flag)",
    bg: "bg-(--color-flag-soft)",
  },
  DATA_ERROR: {
    label: "Data error",
    dot: "bg-(--color-danger)",
    text: "text-(--color-danger)",
    bg: "bg-(--color-danger-soft)",
  },
};

const REASON_COPY: Record<NoMatchReason, string> = {
  NO_CONTRACT_TERM_MATCH: "No contract term on file covers the full date range.",
  NO_CONTRACT_YEAR_TERM_MATCH: "No contract year term on file covers the full date range.",
};

export function StatusBadge({
  status,
  noMatchReason,
}: {
  status: DuesStatus;
  noMatchReason?: NoMatchReason;
}) {
  const copy = STATUS_COPY[status];
  const title = noMatchReason ? REASON_COPY[noMatchReason] : undefined;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${copy.bg} ${copy.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${copy.dot}`} aria-hidden />
      {copy.label}
      {noMatchReason ? <span className="sr-only">: {REASON_COPY[noMatchReason]}</span> : null}
    </span>
  );
}
