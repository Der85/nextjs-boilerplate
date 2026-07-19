import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/auth";
import { apiError, apiOk, unauthorized } from "@/lib/api-response";
import { financeSchema } from "@/lib/validations";
import { firstOfMonthISO } from "@/lib/utils/date";
import type { FinanceAccount, FinanceMonthlyEntry } from "@/lib/types";

// GET /api/finance — active accounts, all entries (month desc), and the
// current month for prefilling inputs.
export async function GET() {
  const auth = await getAuthedClient();
  if (!auth) return unauthorized();
  const { supabase } = auth;

  const [accountsRes, entriesRes] = await Promise.all([
    supabase
      .from("finance_accounts")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("finance_monthly_entries")
      .select("*")
      .order("month", { ascending: false }),
  ]);

  const err = accountsRes.error || entriesRes.error;
  if (err) {
    console.error("[finance:GET] error:", err.message, err.details, err.hint);
    return apiError("Failed to load finances", 500, "DB_ERROR");
  }

  return apiOk({
    accounts: (accountsRes.data ?? []) as FinanceAccount[],
    entries: (entriesRes.data ?? []) as FinanceMonthlyEntry[],
    currentMonth: firstOfMonthISO(),
  });
}

// POST /api/finance — upsert this month's entry for an account.
export async function POST(request: NextRequest) {
  const auth = await getAuthedClient();
  if (!auth) return unauthorized();
  const { supabase, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON", 400, "BAD_REQUEST");
  }

  const parsed = financeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input", 400, "VALIDATION");
  }
  const { account_id, balance, price_per_unit } = parsed.data;
  const month = parsed.data.month ?? firstOfMonthISO();

  const { data, error } = await supabase
    .from("finance_monthly_entries")
    .upsert(
      {
        user_id: userId,
        account_id,
        month,
        balance: balance ?? null,
        price_per_unit: price_per_unit ?? null,
      },
      { onConflict: "account_id,month" },
    )
    .select()
    .single();

  if (error) {
    console.error("[finance:POST] upsert error:", error.message, error.details, error.hint);
    return apiError("Failed to save entry", 500, "DB_ERROR");
  }
  return apiOk(data);
}
