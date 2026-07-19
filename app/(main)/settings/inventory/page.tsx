"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card, PageHeading, Spinner } from "@/components/ui";
import { formatShortDate, todayISO } from "@/lib/utils/date";
import { formatEUR } from "@/lib/utils/finance";
import type { Medication, MedicationOrder } from "@/lib/types";

interface OrdersData {
  medications: Medication[];
  orders: MedicationOrder[];
}

export default function InventoryPage() {
  const [data, setData] = useState<OrdersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [medId, setMedId] = useState("");
  const [dateOrdered, setDateOrdered] = useState(todayISO());
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [dateCollected, setDateCollected] = useState("");
  const [notes, setNotes] = useState("");

  function load() {
    apiGet<OrdersData>("/api/orders")
      .then((d) => {
        setData(d);
        if (!medId && d.medications[0]) setMedId(d.medications[0].id);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const medName = (id: string) =>
    data?.medications.find((m) => m.id === id)?.name ?? "—";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!medId) {
      setError("Pick a medication");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/orders", {
        medication_id: medId,
        date_ordered: dateOrdered || null,
        quantity: quantity === "" ? null : Number(quantity),
        cost: cost === "" ? null : Number(cost),
        pharmacy: pharmacy || null,
        date_collected: dateCollected || null,
        notes: notes || null,
      });
      setQuantity("");
      setCost("");
      setPharmacy("");
      setDateCollected("");
      setNotes("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">{error}</p>
    );
  }
  if (!data) return <Spinner />;

  return (
    <>
      <Link href="/more" className="text-sm text-accent">
        ← More
      </Link>
      <PageHeading title="Inventory" subtitle="Log a reorder" />

      <Card className="flex flex-col gap-3">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Medication
            <select
              value={medId}
              onChange={(e) => setMedId(e.target.value)}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
            >
              {data.medications.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
              Date ordered
              <input
                type="date"
                value={dateOrdered}
                onChange={(e) => setDateOrdered(e.target.value)}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
              Quantity
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
              Cost (€)
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
              Date collected
              <input
                type="date"
                value={dateCollected}
                onChange={(e) => setDateCollected(e.target.value)}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Pharmacy
            <input
              type="text"
              value={pharmacy}
              onChange={(e) => setPharmacy(e.target.value)}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Log order"}
          </button>
        </form>
      </Card>

      <h2 className="mb-2 mt-6 text-lg font-semibold text-text">
        Recent orders
      </h2>
      <div className="flex flex-col gap-2">
        {data.orders.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No orders logged yet.</p>
          </Card>
        )}
        {data.orders.map((o) => (
          <Card key={o.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text">{medName(o.medication_id)}</p>
              <p className="text-xs text-muted">
                {o.quantity ?? "—"} units · ordered{" "}
                {formatShortDate(o.date_ordered)}
                {o.date_collected
                  ? ` · collected ${formatShortDate(o.date_collected)}`
                  : ""}
              </p>
            </div>
            {o.cost != null && (
              <span className="text-sm font-semibold text-text">
                {formatEUR(o.cost, true)}
              </span>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
