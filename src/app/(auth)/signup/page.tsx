import Link from "next/link";
import { signup } from "../actions";
import { GlassCard } from "@/components/shared/GlassCard";
import { Logo } from "@/components/brand/Logo";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <GlassCard className="hairline w-full max-w-sm space-y-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={60} wordmark={false} />
        <div>
          <h1 className="display-3">
            Create your <span className="text-gradient">account</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Your academic OS starts here</p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <form action={signup} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-sm font-medium">
            Name
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            placeholder="Erick"
            className="field w-full px-4 py-2.5 text-sm outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@university.edu"
            className="field w-full px-4 py-2.5 text-sm outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="field w-full px-4 py-2.5 text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          className="pressable w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
        >
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </GlassCard>
  );
}
