"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface MoodEntry {
  id: string;
  mood_score: number;
  note: string | null;
  created_at: string;
}

interface WeeklyStats {
  moodAvg: number | null;
  moodCount: number;
  allyCount: number;
  impulseCount: number;
  impulseSuccessRate: number | null;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function moodLabel(score: number) {
  if (score <= 2) return "Rough";
  if (score <= 4) return "Low";
  if (score <= 6) return "OK";
  if (score <= 8) return "Good";
  return "Great";
}

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [moodScore, setMoodScore] = useState(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    moodAvg: null,
    moodCount: 0,
    allyCount: 0,
    impulseCount: 0,
    impulseSuccessRate: null,
  });

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUser(session.user);
      await Promise.all([fetchEntries(), fetchWeeklyStats(session.user.id)]);
      setLoading(false);
    };

    run();
  }, [router]);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from("mood_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) setEntries(data);
  };

  const fetchWeeklyStats = async (userId: string) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const { data: moodData } = await supabase
      .from("mood_entries")
      .select("mood_score")
      .gte("created_at", weekAgoISO);

    const { count: allyCount } = await supabase
      .from("ally_sessions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoISO);

    const { data: impulseData } = await supabase
      .from("impulse_events")
      .select("acted_on_impulse")
      .gte("created_at", weekAgoISO);

    const moodScores = moodData?.map((m) => m.mood_score) || [];
    const moodAvg =
      moodScores.length > 0
        ? Math.round(
            (moodScores.reduce((a, b) => a + b, 0) / moodScores.length) * 10
          ) / 10
        : null;

    const impulseResults =
      impulseData?.filter((i) => i.acted_on_impulse !== null) || [];
    const impulseSuccesses = impulseResults.filter(
      (i) => i.acted_on_impulse === false
    ).length;
    const impulseSuccessRate =
      impulseResults.length > 0
        ? Math.round((impulseSuccesses / impulseResults.length) * 100)
        : null;

    setWeeklyStats({
      moodAvg,
      moodCount: moodScores.length,
      allyCount: allyCount || 0,
      impulseCount: impulseData?.length || 0,
      impulseSuccessRate,
    });
  };

  const weekChartData = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // entries is descending (newest first), reverse for chart
    return entries
      .filter((e) => new Date(e.created_at) >= weekAgo)
      .map((e) => ({ day: formatDateShort(e.created_at), mood: e.mood_score }))
      .reverse();
  }, [entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const { error } = await supabase.from("mood_entries").insert({
      user_id: user.id,
      mood_score: moodScore,
      note: note.trim() ? note.trim() : null,
    });

    if (!error) {
      setMoodScore(5);
      setNote("");
      await fetchEntries();
      await fetchWeeklyStats(user.id);
      // gentle feedback: scroll to chart so they see the payoff
      document.getElementById("week")?.scrollIntoView({ behavior: "smooth" });
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("mood_entries").delete().eq("id", id);
    if (!error) await fetchEntries();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
          <div className="h-5 w-40 bg-slate-200 rounded mb-3 animate-pulse" />
          <div className="h-4 w-56 bg-slate-200 rounded mb-6 animate-pulse" />
          <div className="h-10 w-full bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-10 w-full bg-slate-200 rounded-xl mt-3 animate-pulse" />
          <div className="h-10 w-full bg-slate-200 rounded-xl mt-3 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm text-slate-600">{greeting()}</div>
            <h1 className="text-lg font-semibold leading-tight text-slate-900">
              ADHDer
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Primary actions */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                What do you need right now?
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Pick one. Small steps count.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() =>
                document
                  .getElementById("checkin")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className={cx(
                "rounded-2xl border p-4 text-left",
                "bg-slate-50 hover:bg-slate-100 active:bg-slate-200",
                "border-slate-200"
              )}
            >
              <div className="text-2xl">🧭</div>
              <div className="mt-2 font-semibold">Check in</div>
              <div className="text-sm text-slate-600 mt-1">
                Log how you feel
              </div>
            </button>

            <button
              onClick={() => router.push("/ally")}
              className={cx(
                "rounded-2xl border p-4 text-left",
                "bg-purple-50 hover:bg-purple-100 active:bg-purple-200",
                "border-purple-200"
              )}
            >
              <div className="text-2xl">💜</div>
              <div className="mt-2 font-semibold text-purple-900">I’m stuck</div>
              <div className="text-sm text-purple-800/80 mt-1">
                Can’t start or focus
              </div>
            </button>

            <button
              onClick={() => router.push("/brake")}
              className={cx(
                "rounded-2xl border p-4 text-left",
                "bg-amber-50 hover:bg-amber-100 active:bg-amber-200",
                "border-amber-200"
              )}
            >
              <div className="text-2xl">🛑</div>
              <div className="mt-2 font-semibold text-amber-900">
                Hit the brake
              </div>
              <div className="text-sm text-amber-800/80 mt-1">
                About to react
              </div>
            </button>
          </div>
        </section>

        {/* Weekly snapshot */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-5" id="week">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Your last 7 days
              </h2>
              <div className="text-xs text-slate-500">
                Mood trend (higher is better)
              </div>
            </div>

            <div className="mt-4 h-52 sm:h-64">
              {weekChartData.length === 0 ? (
                <div className="h-full rounded-xl border border-dashed border-slate-300 grid place-items-center text-sm text-slate-600 px-6 text-center">
                  No check-ins yet this week. Do one quick check-in below.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weekChartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickMargin={8} />
                    <YAxis domain={[1, 10]} tickMargin={8} />
                    <Tooltip />
                    <Line type="monotone" dataKey="mood" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Weekly snapshot
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs text-slate-600">Avg mood</div>
                <div className="mt-1 text-2xl font-semibold">
                  {weeklyStats.moodAvg ?? "–"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {weeklyStats.moodCount} check-ins
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs text-slate-600">Tools used</div>
                <div className="mt-1 text-2xl font-semibold">
                  {weeklyStats.allyCount + weeklyStats.impulseCount}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Ally + Brake
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs text-slate-600">Ally</div>
                <div className="mt-1 text-2xl font-semibold">
                  {weeklyStats.allyCount}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  sessions
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <div className="text-xs text-slate-600">Brake</div>
                <div className="mt-1 text-2xl font-semibold">
                  {weeklyStats.impulseSuccessRate !== null
                    ? `${weeklyStats.impulseSuccessRate}%`
                    : "–"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  success rate
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-900 text-white p-4">
              <div className="text-sm font-semibold">Tiny win prompt</div>
              <div className="text-sm text-white/80 mt-1">
                What’s one thing you did this week that counts, even if it was small?
              </div>
            </div>
          </div>
        </section>

        {/* Check-in */}
        <section
          id="checkin"
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Quick check-in
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                No overthinking. Pick a number, add a note if you want.
              </p>
            </div>

            <div className="shrink-0 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-center">
              <div className="text-xs text-slate-600">Right now</div>
              <div className="text-sm font-semibold">{moodLabel(moodScore)}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-800">
                Mood (1 to 10)
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={moodScore}
                  onChange={(e) => setMoodScore(parseInt(e.target.value, 10))}
                  className="w-full"
                  aria-label="Mood score"
                />
                <div className="w-12 text-right text-sm font-semibold">
                  {moodScore}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="note" className="text-sm font-medium text-slate-800">
                Note (optional)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What’s going on? One sentence is enough."
                className={cx(
                  "mt-2 w-full rounded-2xl border border-slate-200 bg-white",
                  "px-4 py-3 text-sm",
                  "min-h-[96px]",
                  "placeholder:text-slate-400"
                )}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className={cx(
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {saving ? "Saving..." : "Save check-in"}
            </button>
          </form>
        </section>

        {/* Recent entries */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Recent check-ins
            </h2>
            <div className="text-xs text-slate-500">Last 30</div>
          </div>

          <div className="mt-4 space-y-3">
            {entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                Nothing here yet. Do a quick check-in above.
              </div>
            ) : (
              entries.slice(0, 10).map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Mood: {e.mood_score} ({moodLabel(e.mood_score)})
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(e.created_at).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(e.id)}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white active:bg-slate-200 border border-slate-200"
                    >
                      Delete
                    </button>
                  </div>

                  {e.note ? (
                    <div className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">
                      {e.note}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Mobile sticky bottom helper */}
      <div className="sm:hidden sticky bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 grid grid-cols-3 gap-2">
          <button
            onClick={() =>
              document.getElementById("checkin")?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold"
          >
            Check-in
          </button>
          <button
            onClick={() => router.push("/ally")}
            className="rounded-xl bg-purple-100 px-3 py-2 text-xs font-semibold text-purple-900"
          >
            I’m stuck
          </button>
          <button
            onClick={() => router.push("/brake")}
            className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900"
          >
            Brake
          </button>
        </div>
      </div>
    </div>
  );
}