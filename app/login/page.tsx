"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClass =
  "rounded-md border border-(--color-line) bg-(--color-paper) px-3 py-2 text-sm";
const labelClass = "text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)";
const cardClass =
  "w-full max-w-sm rounded-lg border border-(--color-line) bg-(--color-paper-raised) p-6";
const submitClass =
  "mt-5 w-full rounded-md bg-(--color-pitch) px-4 py-2 text-sm font-medium text-(--color-paper) disabled:opacity-60";

const RESET_PASSWORD_FORM_URL = "https://forms.fillout.com/t/9AMvexW7SYus";

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = new URL(RESET_PASSWORD_FORM_URL);
    url.searchParams.set("email", email);
    window.location.href = url.toString();
  }

  return (
    <form onSubmit={handleSubmit} className={cardClass}>
      <p className="mb-4 text-sm text-(--color-ink-muted)">
        Enter your email to request a password reset from the team.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Email</span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      <button type="submit" className={submitClass}>
        Reset password
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-xs font-medium text-(--color-ink-muted) hover:text-(--color-ink)"
      >
        ← Back to sign in
      </button>
    </form>
  );
}

function SignInForm({ onForgotPassword }: { onForgotPassword: () => void }) {
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
    <form onSubmit={handleSubmit} className={cardClass}>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Email</span>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className={labelClass}>Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      {error ? <p className="mt-3 text-sm text-(--color-danger)">{error}</p> : null}

      <button type="submit" disabled={loading} className={submitClass}>
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <button
        type="button"
        onClick={onForgotPassword}
        className="mt-4 text-xs font-medium text-(--color-ink-muted) hover:text-(--color-ink)"
      >
        Forgot password?
      </button>
    </form>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "forgot-password">("sign-in");

  if (mode === "forgot-password") {
    return <ForgotPasswordForm onBack={() => setMode("sign-in")} />;
  }

  return <SignInForm onForgotPassword={() => setMode("forgot-password")} />;
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
