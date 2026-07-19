import type { AccountType, FinanceMonthlyEntry } from "@/lib/types";

const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurPrecise = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function formatEUR(value: number, precise = false): string {
  return (precise ? eurPrecise : eur).format(value);
}

// Monetary value of a single finance entry. Stock accounts store share
// quantity in `balance` and a unit price in `price_per_unit`; everything else
// stores a plain balance.
export function entryValue(
  accountType: AccountType,
  entry: Pick<FinanceMonthlyEntry, "balance" | "price_per_unit"> | undefined,
): number {
  if (!entry) return 0;
  if (accountType === "stock") {
    return (entry.balance ?? 0) * (entry.price_per_unit ?? 0);
  }
  return entry.balance ?? 0;
}

// Pick the most recent entry per account from a month-desc-sorted list.
export function latestEntryByAccount<
  T extends Pick<FinanceMonthlyEntry, "account_id" | "month">,
>(entriesDesc: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const e of entriesDesc) {
    if (!map.has(e.account_id)) map.set(e.account_id, e);
  }
  return map;
}
