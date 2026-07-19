"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card, PageHeading, Spinner } from "@/components/ui";
import type { Medication, MedicationProvider } from "@/lib/types";

interface ProvidersData {
  medications: Medication[];
  providers: MedicationProvider[];
}

type Draft = {
  prescriber: string;
  pharmacy: string;
  contact: string;
  notes: string;
};

const empty: Draft = { prescriber: "", pharmacy: "", contact: "", notes: "" };

export default function ProvidersPage() {
  const [data, setData] = useState<ProvidersData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function load() {
    apiGet<ProvidersData>("/api/providers")
      .then((d) => {
        setData(d);
        const next: Record<string, Draft> = {};
        for (const med of d.medications) {
          const p = d.providers.find((x) => x.medication_id === med.id);
          next[med.id] = {
            prescriber: p?.prescriber ?? "",
            pharmacy: p?.pharmacy ?? "",
            contact: p?.contact ?? "",
            notes: p?.notes ?? "",
          };
        }
        setDrafts(next);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function setDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? empty), ...patch } }));
  }

  async function save(med: Medication) {
    const draft = drafts[med.id] ?? empty;
    setSavingId(med.id);
    setSavedId(null);
    setError(null);
    try {
      await apiPost("/api/providers", {
        medication_id: med.id,
        prescriber: draft.prescriber || null,
        pharmacy: draft.pharmacy || null,
        contact: draft.contact || null,
        notes: draft.notes || null,
      });
      setSavedId(med.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingId(null);
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
      <PageHeading title="Providers" subtitle="Per medication" />

      {error && (
        <p className="mb-3 rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {data.medications.map((med) => {
          const draft = drafts[med.id] ?? empty;
          return (
            <Card key={med.id} className="flex flex-col gap-3">
              <p className="font-semibold text-text">{med.name}</p>

              <Field
                label="Prescriber / clinic"
                value={draft.prescriber}
                onChange={(v) => setDraft(med.id, { prescriber: v })}
              />
              <Field
                label="Pharmacy / supplier"
                value={draft.pharmacy}
                onChange={(v) => setDraft(med.id, { pharmacy: v })}
              />
              <Field
                label="Contact"
                value={draft.contact}
                onChange={(v) => setDraft(med.id, { contact: v })}
              />
              <label className="flex flex-col gap-1 text-xs text-muted">
                Notes
                <textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft(med.id, { notes: e.target.value })}
                  className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
                />
              </label>

              <button
                type="button"
                disabled={savingId === med.id}
                onClick={() => save(med)}
                className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {savingId === med.id
                  ? "Saving…"
                  : savedId === med.id
                    ? "Saved ✓"
                    : "Save"}
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
      />
    </label>
  );
}
