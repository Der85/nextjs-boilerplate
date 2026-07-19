"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { Card, KpiCard, PageHeading, Spinner, DaysBadge } from "@/components/ui";
import { entryValue, latestEntryByAccount, formatEUR } from "@/lib/utils/finance";
import { formatShortDate } from "@/lib/utils/date";
import type {
  MedicationWithStock,
  WeightLog,
  FinanceAccount,
  FinanceMonthlyEntry,
} from "@/lib/types";

export default function DashboardPage() {
  const [meds, setMeds] = useState<MedicationWithStock[] | null>(null);
  const [weights, setWeights] = useState<WeightLog[] | null>(null);
  const [finance, setFinance] = useState<{
    accounts: FinanceAccount[];
    entries: FinanceMonthlyEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<MedicationWithStock[]>("/api/meds"),
      apiGet<WeightLog[]>("/api/weight"),
      apiGet<{ accounts: FinanceAccount[]; entries: FinanceMonthlyEntry[] }>(
        "/api/finance",
      ),
    ])
      .then(([m, w, f]) => {
        setMeds(m);
        setWeights(w);
        setFinance(f);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>
    );
  }
  if (!meds || !weights || !finance) return <Spinner />;

  // Total wealth from the latest entry per account.
  const latest = latestEntryByAccount(finance.entries);
  const totalWealth = finance.accounts.reduce(
    (sum, acc) => sum + entryValue(acc.account_type, latest.get(acc.id)),
    0,
  );

  const latestWeight = weights[0];

  // Next medication to run out.
  const withDays = meds.filter((m) => m.daysLeft !== null);
  const nextOut =
    withDays.length > 0
      ? withDays.reduce((min, m) =>
          (m.daysLeft ?? Infinity) < (min.daysLeft ?? Infinity) ? m : min,
        )
      : null;

  const belowSeven = meds.filter(
    (m) => m.daysLeft !== null && m.daysLeft < 7,
  ).length;

  return (
    <>
      <PageHeading title="Dashboard" subtitle="Your day at a glance" />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total Wealth" value={formatEUR(totalWealth)} />
        <KpiCard
          label="Current Weight"
          value={latestWeight?.weight_kg != null ? `${latestWeight.weight_kg} kg` : "—"}
          hint={latestWeight ? formatShortDate(latestWeight.log_date) : "No entries"}
        />
        <KpiCard
          label="Next Med Runs Out"
          value={
            nextOut ? `${Math.max(0, Math.floor(nextOut.daysLeft ?? 0))}d` : "—"
          }
          hint={nextOut ? nextOut.name : "No data"}
          tone={
            nextOut && (nextOut.daysLeft ?? 99) < 7
              ? "bad"
              : nextOut && (nextOut.daysLeft ?? 99) <= 14
                ? "warn"
                : "default"
          }
        />
        <KpiCard
          label="Meds < 7-Day Stock"
          value={belowSeven}
          tone={belowSeven > 0 ? "bad" : "ok"}
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Medications</h2>
        <Link href="/meds" className="text-sm text-accent">
          Log doses →
        </Link>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {meds.length === 0 && (
          <Card>
            <p className="text-sm text-muted">
              No medications yet. Seed them in Supabase or add them via SQL.
            </p>
          </Card>
        )}
        {meds.map((m) => (
          <Link key={m.id} href="/meds">
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-medium text-text">{m.name}</p>
                <p className="text-xs text-muted">
                  Stock {m.currentStock} {m.dose_unit ?? ""} ·{" "}
                  {m.stockRunsOut
                    ? `out ${formatShortDate(m.stockRunsOut)}`
                    : "no estimate"}
                </p>
              </div>
              <DaysBadge daysLeft={m.daysLeft} />
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
