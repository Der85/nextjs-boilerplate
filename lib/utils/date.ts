// Local-date helpers. We store dates as plain YYYY-MM-DD (no timezone) so
// "today" tracks the user's device, not UTC.

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// First of the current month, as YYYY-MM-DD.
export function firstOfMonthISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

// Human-friendly short date, e.g. "19 Jul 2026".
export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, day] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
