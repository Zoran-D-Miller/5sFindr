"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signIn, signUp } from "@/server/actions/auth";
import { PasswordInput } from "./PasswordInput";

const inputCls =
  "w-full rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-3 text-white placeholder:text-white/30 outline-none focus:border-pitch";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-pitch py-3.5 font-bold text-ink-900 shadow-glow transition hover:bg-pitch-dark disabled:opacity-60"
    >
      {pending ? "One sec…" : label}
    </button>
  );
}

export function AuthForm({
  mode,
  next,
  defaultRef,
}: {
  mode: "login" | "signup";
  next?: string;
  defaultRef?: string;
}) {
  const action = mode === "signup" ? signUp : signIn;
  const [state, formAction] = useFormState(action, {});
  const isSignup = mode === "signup";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-center text-xl font-extrabold tracking-tight">
        5s<span className="text-pitch">Findr</span>
      </Link>

      <h1 className="text-2xl font-black tracking-tight">
        {isSignup ? "Create your profile" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-white/50">
        {isSignup
          ? "30 days of Premium + 1 free token. No card needed."
          : "Log in to find your next 5-a-side."}
      </p>

      <form action={formAction} className="mt-7 space-y-3">
        {isSignup && (
          <input
            name="name"
            placeholder="Your name"
            autoComplete="name"
            className={inputCls}
            required
          />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          className={inputCls}
          required
        />
        <PasswordInput
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
        />

        {next && <input type="hidden" name="next" value={next} />}
        {isSignup && <input type="hidden" name="ref" value={defaultRef ?? ""} />}

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

        <div className="pt-1">
          <SubmitButton label={isSignup ? "Get started free" : "Log in"} />
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-pitch">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-pitch">
              Create a profile
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
