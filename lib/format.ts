import { format, parseISO } from "date-fns";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 }).format(
    value,
  );
}

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "MMM d, yyyy");
}

export function formatDateRange(start: string, end: string): string {
  return `${format(parseISO(start), "MMM d")} – ${formatDate(end)}`;
}
