import type { Medication, MedicationLog, MedicationOrder } from "@/lib/types";

const WINDOW_DAYS = 28; // trailing 4 weeks used to estimate consumption

export interface StockResult {
  currentStock: number;
  avgPerDay: number;
  daysLeft: number | null; // null when avgPerDay is 0
  stockRunsOut: string | null; // ISO date (YYYY-MM-DD)
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Derive current stock and days-left for one medication from its order and log
// history. Pure so it can run on the server (API/dashboard) or the client.
export function computeStock(
  medication: Pick<Medication, "frequency" | "days_per_unit">,
  orders: Pick<MedicationOrder, "quantity">[],
  logs: Pick<MedicationLog, "log_date" | "amount_taken">[],
  today: Date = new Date(),
): StockResult {
  const totalOrdered = orders.reduce((sum, o) => sum + (o.quantity ?? 0), 0);
  const totalTaken = logs.reduce((sum, l) => sum + (l.amount_taken ?? 0), 0);
  const currentStock = totalOrdered - totalTaken;

  // Consumption over the trailing window.
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffISO = toISODate(cutoff);

  const recentTaken = logs
    .filter((l) => l.log_date >= cutoffISO)
    .reduce((sum, l) => sum + (l.amount_taken ?? 0), 0);

  // `days_per_unit` = how many days one unit lasts, so consumption is its
  // inverse: a weekly pen (7) → 1/7 per day; a tablet taken 3×/day (1/3) → 3
  // per day. This is the fallback until enough log history exists to average.
  const perUnitDays =
    medication.days_per_unit && medication.days_per_unit > 0
      ? medication.days_per_unit
      : medication.frequency === "weekly"
        ? 7
        : 1;
  const fallbackPerDay = 1 / perUnitDays;
  const avgPerDay = recentTaken > 0 ? recentTaken / WINDOW_DAYS : fallbackPerDay;

  if (avgPerDay <= 0) {
    return { currentStock, avgPerDay: 0, daysLeft: null, stockRunsOut: null };
  }

  const daysLeft = currentStock / avgPerDay;
  const runsOut = new Date(today);
  runsOut.setDate(runsOut.getDate() + Math.floor(daysLeft));

  return {
    currentStock,
    avgPerDay,
    daysLeft,
    stockRunsOut: toISODate(runsOut),
  };
}
