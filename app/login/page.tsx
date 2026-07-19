"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    router.push(searchParams.get("next") || "/");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-(--color-line) bg-(--color-paper-raised) p-6"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
          Email
        </span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-(--color-line) bg-(--color-paper) px-3 py-2 text-sm"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
          Password
        </span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-(--color-line) bg-(--color-paper) px-3 py-2 text-sm"
        />
      </label>

      {error ? <p className="mt-3 text-sm text-(--color-danger)">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-md bg-(--color-pitch) px-4 py-2 text-sm font-medium text-(--color-paper) disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-(--color-gold)">
          USL Front Office
        </p>
        <h1 className="font-(family-name:--font-display) text-2xl text-(--color-ink)">
          Dues Dashboard
        </h1>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
