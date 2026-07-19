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
  medication: Pick<Medication, "frequency">,
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

  const fallbackPerDay = medication.frequency === "weekly" ? 1 / 7 : 1;
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
