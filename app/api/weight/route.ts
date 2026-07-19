import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/auth";
import { apiError, apiOk, unauthorized } from "@/lib/api-response";
import { weightSchema } from "@/lib/validations";
import { todayISO } from "@/lib/utils/date";

// GET /api/weight — recent weight entries, newest first.
export async function GET() {
  const auth = await getAuthedClient();
  if (!auth) return unauthorized();
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .order("log_date", { ascending: false })
    .limit(60);

  if (error) {
    console.error("[weight:GET] error:", error.message, error.details, error.hint);
    return apiError("Failed to load weight logs", 500, "DB_ERROR");
  }
  return apiOk(data ?? []);
}

// POST /api/weight — upsert today's weight (on user_id, log_date).
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

  const parsed = weightSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input", 400, "VALIDATION");
  }
  const { weight_kg } = parsed.data;
  const log_date = parsed.data.log_date ?? todayISO();

  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      { user_id: userId, log_date, weight_kg },
      { onConflict: "user_id,log_date" },
    )
    .select()
    .single();

  if (error) {
    console.error("[weight:POST] upsert error:", error.message, error.details, error.hint);
    return apiError("Failed to save weight", 500, "DB_ERROR");
  }
  return apiOk(data);
}
