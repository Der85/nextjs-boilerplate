import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/auth";
import { apiError, apiOk, unauthorized } from "@/lib/api-response";
import { providerSchema } from "@/lib/validations";
import type { Medication, MedicationProvider } from "@/lib/types";

// GET /api/providers — active medications plus their provider info.
export async function GET() {
  const auth = await getAuthedClient();
  if (!auth) return unauthorized();
  const { supabase } = auth;

  const [medsRes, providersRes] = await Promise.all([
    supabase
      .from("medications")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("medication_providers").select("*"),
  ]);

  const err = medsRes.error || providersRes.error;
  if (err) {
    console.error("[providers:GET] error:", err.message, err.details, err.hint);
    return apiError("Failed to load providers", 500, "DB_ERROR");
  }

  return apiOk({
    medications: (medsRes.data ?? []) as Medication[],
    providers: (providersRes.data ?? []) as MedicationProvider[],
  });
}

// POST /api/providers — upsert provider info for a medication (one row per med).
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

  const parsed = providerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid input", 400, "VALIDATION");
  }
  const { medication_id, prescriber, pharmacy, contact, notes } = parsed.data;

  const { data, error } = await supabase
    .from("medication_providers")
    .upsert(
      {
        user_id: userId,
        medication_id,
        prescriber: prescriber ?? null,
        pharmacy: pharmacy ?? null,
        contact: contact ?? null,
        notes: notes ?? null,
      },
      { onConflict: "medication_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[providers:POST] upsert error:", error.message, error.details, error.hint);
    return apiError("Failed to save provider", 500, "DB_ERROR");
  }
  return apiOk(data);
}
