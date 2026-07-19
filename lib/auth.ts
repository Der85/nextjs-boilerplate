import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Resolve the authenticated user for a route handler. Returns null when there
// is no session (caller should respond 401).
export async function getAuthedClient(): Promise<
  { supabase: SupabaseClient; userId: string } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase: supabase as unknown as SupabaseClient, userId: user.id };
}
