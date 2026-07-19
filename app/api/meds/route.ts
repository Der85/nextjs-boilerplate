import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/auth";
import { apiError, apiOk, unauthorized } from "@/lib/api-response";
import { medLogSchema } from "@/lib/validations";
import { computeStock } from "@/lib/utils/stock";
import { todayISO } from "@/lib/utils/date";
import type {
  Medication,
  MedicationLog,
  MedicationOrder,
  MedicationWithStock,
} from "@/lib/types";

// GET /api/meds — active medications enriched with derived stock + today's log.
export async function GET() {
  const auth = await getAuthedClient();
  if (!auth) return unauthorized();
  const { supabase } = auth;

  const [medsRes, ordersRes, logsRes] = await Promise.all([
    supabase
      .from("medications")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("medication_orders").select("medication_id, quantity"),
    supabase
      .from("medication_logs")
      .select("medication_id, log_date, amount_taken"),
  ]);

  const err = medsRes.error || ordersRes.error || logsRes.error;
  if (err) {
    console.error("[meds:GET] error:", err.message, err.details, err.hint);
    return apiError("Failed to load medications", 500, "DB_ERROR");
  }

  const meds = (medsRes.data ?? []) as Medication[];
  const orders = (ordersRes.data ?? []) as Pick<
    MedicationOrder,
    "medication_id" | "quantity"
  >[];
  const logs = (logsRes.data ?? []) as Pick<
    MedicationLog,
    "medication_id" | "log_date" | "amount_taken"
  >[];

  const today = todayISO();

  const enriched: MedicationWithStock[] = meds.map((med) => {
    const medOrders = orders.filter((o) => o.medication_id === med.id);
    const medLogs = logs.filter((l) => l.medication_id === med.id);
    const stock = computeStock(med, medOrders, medLogs);
    const takenToday =
      medLogs.find((l) => l.log_date === today)?.amount_taken ?? 0;
    return { ...med, ...stock, takenToday };
  });

  return apiOk(enriched);
}

// POST /api/meds — upsert today's dose taken for a medication.
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

  const parsed = medLogSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input", 400, "VALIDATION");
  }
  const { medication_id, amount_taken } = parsed.data;
  const log_date = parsed.data.log_date ?? todayISO();

  const { data, error } = await supabase
    .from("medication_logs")
    .upsert(
      { user_id: userId, medication_id, log_date, amount_taken },
      { onConflict: "medication_id,log_date" },
    )
    .select()
    .single();

  if (error) {
    console.error("[meds:POST] upsert error:", error.message, error.details, error.hint);
    return apiError("Failed to log dose", 500, "DB_ERROR");
  }

  return apiOk(data);
}
