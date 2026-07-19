"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card, PageHeading, Spinner, DaysBadge } from "@/components/ui";
import { formatShortDate } from "@/lib/utils/date";
import type { MedicationWithStock } from "@/lib/types";

const DOSE_OPTIONS = [0, 1, 2, 3];

export default function MedsPage() {
  const [meds, setMeds] = useState<MedicationWithStock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<MedicationWithStock[]>("/api/meds")
      .then(setMeds)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function logDose(med: MedicationWithStock, amount: number) {
    setSaving(med.id);
    setError(null);
    // Optimistic: reflect the new taken amount immediately.
    setMeds((prev) =>
      prev
        ? prev.map((m) =>
            m.id === med.id ? { ...m, takenToday: amount } : m,
          )
        : prev,
    );
    try {
      await apiPost("/api/meds", {
        medication_id: med.id,
        amount_taken: amount,
      });
      // Refetch to recompute derived stock / days-left.
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log");
      load();
    } finally {
      setSaving(null);
    }
  }

  if (error && !meds) {
    return (
      <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>
    );
  }
  if (!meds) return <Spinner />;

  return (
    <>
      <PageHeading title="Meds" subtitle="Tap to log today's dose" />

      {error && (
        <p className="mb-3 rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {meds.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No active medications.</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {meds.map((med) => (
          <Card key={med.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-text">{med.name}</p>
                <p className="text-xs text-muted">
                  {med.frequency} · stock {med.currentStock} {med.dose_unit ?? ""}
                </p>
                {med.stockRunsOut && (
                  <p className="text-xs text-muted">
                    Runs out {formatShortDate(med.stockRunsOut)}
                  </p>
                )}
              </div>
              <DaysBadge daysLeft={med.daysLeft} />
            </div>

            <div className="flex gap-2">
              {DOSE_OPTIONS.map((n) => {
                const active = med.takenToday === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={saving === med.id}
                    onClick={() => logDose(med, n)}
                    className={`flex-1 rounded-xl border py-3 text-lg font-semibold transition active:scale-95 disabled:opacity-60 ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-surface-2 text-text"
                    }`}
                    aria-pressed={active}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
