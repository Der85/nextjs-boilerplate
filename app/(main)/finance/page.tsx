"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card, KpiCard, PageHeading, Spinner } from "@/components/ui";
import {
  entryValue,
  formatEUR,
  latestEntryByAccount,
} from "@/lib/utils/finance";
import { formatShortDate } from "@/lib/utils/date";
import type { FinanceAccount, FinanceMonthlyEntry } from "@/lib/types";

interface FinanceData {
  accounts: FinanceAccount[];
  entries: FinanceMonthlyEntry[];
  currentMonth: string;
}

// Local editable state per account.
interface Draft {
  balance: string;
  price: string;
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    apiGet<FinanceData>("/api/finance")
      .then((d) => {
        setData(d);
        // Prefill drafts from this month's entry (fall back to latest).
        const latest = latestEntryByAccount(d.entries);
        const next: Record<string, Draft> = {};
        for (const acc of d.accounts) {
          const thisMonth = d.entries.find(
            (e) => e.account_id === acc.id && e.month === d.currentMonth,
          );
          const src = thisMonth ?? latest.get(acc.id);
          next[acc.id] = {
            balance: src?.balance != null ? String(src.balance) : "",
            price: src?.price_per_unit != null ? String(src.price_per_unit) : "",
          };
        }
        setDrafts(next);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const totalWealth = useMemo(() => {
    if (!data) return 0;
    // Live total: use the draft values so the card updates as you type.
    return data.accounts.reduce((sum, acc) => {
      const draft = drafts[acc.id];
      if (!draft) return sum;
      const balance = draft.balance === "" ? 0 : Number(draft.balance);
      const price = draft.price === "" ? 0 : Number(draft.price);
      return (
        sum +
        entryValue(acc.account_type, {
          balance,
          price_per_unit: price,
        })
      );
    }, 0);
  }, [data, drafts]);

  function setDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(acc: FinanceAccount) {
    const draft = drafts[acc.id];
    if (!draft) return;
    setSavingId(acc.id);
    setError(null);
    try {
      await apiPost("/api/finance", {
        account_id: acc.id,
        balance: draft.balance === "" ? null : Number(draft.balance),
        price_per_unit:
          acc.account_type === "stock" && draft.price !== ""
            ? Number(draft.price)
            : null,
      });
      load();
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
      <PageHeading title="Finance" subtitle={`Month of ${formatShortDate(data.currentMonth)}`} />

      <KpiCard label="Total Wealth" value={formatEUR(totalWealth)} />

      {error && (
        <p className="my-3 rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {data.accounts.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No accounts yet.</p>
          </Card>
        )}
        {data.accounts.map((acc) => {
          const draft = drafts[acc.id] ?? { balance: "", price: "" };
          const isStock = acc.account_type === "stock";
          const rowValue = entryValue(acc.account_type, {
            balance: draft.balance === "" ? 0 : Number(draft.balance),
            price_per_unit: draft.price === "" ? 0 : Number(draft.price),
          });
          return (
            <Card key={acc.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-text">{acc.name}</p>
                  <p className="text-xs capitalize text-muted">
                    {acc.account_type}
                  </p>
                </div>
                <span className="text-sm font-semibold text-accent">
                  {formatEUR(rowValue, true)}
                </span>
              </div>

              {isStock ? (
                <div className="flex gap-2">
                  <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                    Shares
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={draft.balance}
                      onChange={(e) =>
                        setDraft(acc.id, { balance: e.target.value })
                      }
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                    Price / share (€)
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={draft.price}
                      onChange={(e) =>
                        setDraft(acc.id, { price: e.target.value })
                      }
                      className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Balance (€)
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={draft.balance}
                    onChange={(e) =>
                      setDraft(acc.id, { balance: e.target.value })
                    }
                    className="rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text outline-none focus:border-accent"
                  />
                </label>
              )}

              <button
                type="button"
                disabled={savingId === acc.id}
                onClick={() => save(acc)}
                className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60"
              >
                {savingId === acc.id ? "Saving…" : "Save this month"}
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
