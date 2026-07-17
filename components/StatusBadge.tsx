import type { DuesStatus } from "@/lib/dues/types";

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
  NO_COVERAGE: {
    label: "No coverage",
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

export function StatusBadge({ status, detail }: { status: DuesStatus; detail?: string }) {
  const copy = STATUS_COPY[status];

  return (
    <span
      title={detail}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${copy.bg} ${copy.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${copy.dot}`} aria-hidden />
      {copy.label}
      {detail ? <span className="sr-only">: {detail}</span> : null}
    </span>
  );
}
