import { NextRequest } from "next/server";
import { getAuthedClient } from "@/lib/auth";
import { apiError, apiOk, unauthorized } from "@/lib/api-response";
import { pushSubscribeSchema } from "@/lib/validations";

// POST /api/push/subscribe — store (or refresh) a Web Push subscription for the
// logged-in user, keyed on endpoint.
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

  const parsed = pushSubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid subscription", 400, "VALIDATION");
  }
  const { endpoint, keys } = parsed.data;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push:subscribe] upsert error:", error.message, error.details, error.hint);
    return apiError("Failed to save subscription", 500, "DB_ERROR");
  }
  return apiOk({ ok: true });
}
