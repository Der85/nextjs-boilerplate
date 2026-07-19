"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginForm initialError={null} />}>
      <LoginFormWithParams />
    </Suspense>
  );
}

function LoginFormWithParams() {
  const params = useSearchParams();
  const initialError =
    params.get("error") === "not_allowed"
      ? "This account isn't allowed to use this app."
      : null;
  return <LoginForm initialError={initialError} />;
}

function LoginForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(error.message || "Sign in failed.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
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
          autoComplete="current-password"
          required
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

      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-accent px-4 py-3 text-base font-semibold text-white active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-2 text-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-accent">
          Sign up
        </Link>
      </p>
    </form>
  );
}
