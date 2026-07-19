import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api-response";
import { sendPush, type PushPayload } from "@/lib/webpush";
import { todayISO } from "@/lib/utils/date";
import type { ReminderType } from "@/lib/types";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://adhder.io";

const MESSAGES: Record<ReminderType, PushPayload> = {
  meds: {
    title: "Meds check-in",
    body: "Log today's medication doses.",
    url: `${APP_URL}/meds`,
  },
  weight: {
    title: "Weekly weigh-in",
    body: "Time to log this week's weight.",
    url: `${APP_URL}/weight`,
  },
  finance: {
    title: "Monthly finances",
    body: "Update your account balances for the month.",
    url: `${APP_URL}/finance`,
  },
};

// GET /api/cron/reminders — hit daily by Vercel Cron. Sends whatever reminders
// are due today to every push subscription, de-duped via reminder_log.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return apiError("Unauthorized", 401, "UNAUTHENTICATED");
  }

  const now = new Date();
  const today = todayISO(now);

  // meds every day; weight on Sunday; finance on the 1st.
  const due: ReminderType[] = ["meds"];
  if (now.getDay() === 0) due.push("weight");
  if (now.getDate() === 1) due.push("finance");

  const supabase = createServiceClient();

  const [subsRes, logRes] = await Promise.all([
    supabase.from("push_subscriptions").select("user_id, endpoint, p256dh, auth"),
    supabase
      .from("reminder_log")
      .select("user_id, reminder_type")
      .eq("reminder_date", today),
  ]);

  if (subsRes.error || logRes.error) {
    const err = subsRes.error || logRes.error;
    console.error("[cron] load error:", err?.message, err?.details, err?.hint);
    return apiError("Failed to load cron data", 500, "DB_ERROR");
  }

  const subs = subsRes.data ?? [];
  const alreadySent = new Set(
    (logRes.data ?? []).map((r) => `${r.user_id}:${r.reminder_type}`),
  );

  // Group subscriptions by user.
  const subsByUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  let sent = 0;
  let pruned = 0;

  for (const [userId, userSubs] of subsByUser) {
    for (const type of due) {
      if (alreadySent.has(`${userId}:${type}`)) continue;

      const payload = MESSAGES[type];
      let anyDelivered = false;

      for (const sub of userSubs) {
        const result = await sendPush(sub, payload);
        if (result.ok) {
          anyDelivered = true;
          sent++;
        } else if (result.statusCode === 404 || result.statusCode === 410) {
          // Subscription is gone — remove it so we stop trying.
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          pruned++;
        }
      }

      // Log the reminder so we don't re-send it today, even if some endpoints
      // were pruned (as long as at least one delivered).
      if (anyDelivered) {
        const { error } = await supabase.from("reminder_log").insert({
          user_id: userId,
          reminder_type: type,
          reminder_date: today,
        });
        if (error) {
          console.error("[cron] reminder_log insert:", error.message, error.details, error.hint);
        }
      }
    }
  }

  return apiOk({ ok: true, due, sent, pruned });
}
