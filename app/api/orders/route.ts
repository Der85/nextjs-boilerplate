import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/auth";
import { apiError, apiOk, unauthorized } from "@/lib/api-response";
import { orderSchema } from "@/lib/validations";
import type { Medication, MedicationOrder } from "@/lib/types";

// GET /api/orders — active medications plus recent reorder history.
export async function GET() {
  const auth = await getAuthedClient();
  if (!auth) return unauthorized();
  const { supabase } = auth;

  const [medsRes, ordersRes] = await Promise.all([
    supabase
      .from("medications")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("medication_orders")
      .select("*")
      .order("date_ordered", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const err = medsRes.error || ordersRes.error;
  if (err) {
    console.error("[orders:GET] error:", err.message, err.details, err.hint);
    return apiError("Failed to load orders", 500, "DB_ERROR");
  }

  return apiOk({
    medications: (medsRes.data ?? []) as Medication[],
    orders: (ordersRes.data ?? []) as MedicationOrder[],
  });
}

// POST /api/orders — insert a new reorder record.
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

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input", 400, "VALIDATION");
  }
  const {
    medication_id,
    date_ordered,
    quantity,
    cost,
    pharmacy,
    date_collected,
    notes,
  } = parsed.data;

  const { data, error } = await supabase
    .from("medication_orders")
    .insert({
      user_id: userId,
      medication_id,
      date_ordered: date_ordered ?? null,
      quantity: quantity ?? null,
      cost: cost ?? null,
      pharmacy: pharmacy ?? null,
      date_collected: date_collected ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[orders:POST] insert error:", error.message, error.details, error.hint);
    return apiError("Failed to save order", 500, "DB_ERROR");
  }
  return apiOk(data);
}
