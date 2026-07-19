"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card, PageHeading, Spinner } from "@/components/ui";
import { formatShortDate, todayISO } from "@/lib/utils/date";
import type { WeightLog } from "@/lib/types";

export default function WeightPage() {
  const [logs, setLogs] = useState<WeightLog[] | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    apiGet<WeightLog[]>("/api/weight")
      .then(setLogs)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const latest = logs?.[0];
  // "Since last entry" compares against the most recent entry that is not today.
  const previous = logs?.find((l) => l.log_date !== todayISO());
  const delta =
    value && previous?.weight_kg != null
      ? Number(value) - previous.weight_kg
      : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const weight = Number(value);
    if (!weight || weight <= 0) {
      setError("Enter a valid weight");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/weight", { weight_kg: weight });
      setValue("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (error && !logs) {
    return (
      <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>
    );
  }
  if (!logs) return <Spinner />;

  return (
    <>
      <PageHeading title="Weight" subtitle="Log today's weight (kg)" />

      <Card className="flex flex-col gap-4">
        <form onSubmit={save} className="flex flex-col gap-3">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={latest?.weight_kg != null ? String(latest.weight_kg) : "0.0"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface-2 py-6 text-center text-5xl font-bold text-text outline-none focus:border-accent"
          />
          {delta !== null && (
            <p
              className={`text-center text-sm font-medium ${
                delta <= 0 ? "text-ok" : "text-warn"
              }`}
            >
              {delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)} kg since last
              entry
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent py-3 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save weight"}
          </button>
        </form>
      </Card>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-text">
        Recent entries
      </h2>
      <div className="flex flex-col gap-2">
        {logs.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No entries yet.</p>
          </Card>
        )}
        {logs.map((log, i) => {
          const prev = logs[i + 1];
          const d =
            log.weight_kg != null && prev?.weight_kg != null
              ? log.weight_kg - prev.weight_kg
              : null;
          return (
            <Card key={log.id} className="flex items-center justify-between">
              <span className="text-sm text-muted">
                {formatShortDate(log.log_date)}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-lg font-semibold text-text">
                  {log.weight_kg ?? "—"} kg
                </span>
                {d !== null && (
                  <span
                    className={`text-xs font-medium ${
                      d <= 0 ? "text-ok" : "text-warn"
                    }`}
                  >
                    {d <= 0 ? "▼" : "▲"} {Math.abs(d).toFixed(1)}
                  </span>
                )}
              </span>
            </Card>
          );
        })}
      </div>
    </>
  );
}
