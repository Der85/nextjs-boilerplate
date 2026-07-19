"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message || "Sign up failed.");
        return;
      }
      // If email confirmation is off, a session is returned immediately.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setNotice("Account created. Check your email to confirm, then sign in.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-muted">
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base text-text outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base text-text outline-none focus:border-accent"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-ok/15 px-3 py-2 text-sm text-ok">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create account"}
      </button>

      <p className="mt-2 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}
