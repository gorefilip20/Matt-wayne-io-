"use client";

import { AlertCircle, ArrowRight, Loader2, Mail } from "lucide-react";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { validateEmail } from "@/lib/validation";
import { SuccessCard } from "./SuccessCard";
import { useSubscribed } from "./use-subscribed";

type ApiResponse = { success: boolean; message: string; alreadySubscribed?: boolean; field?: "email" };

type EmailCaptureFormProps = {
  /** Visible label for screen readers + analytics. */
  source: string;
  ctaLabel?: string;
  /** Hides the next-steps list in the success card (for tight spots). */
  compactSuccess?: boolean;
};

export function EmailCaptureForm({
  source,
  ctaLabel = "Claim My Free Guide Now 🚀",
  compactSuccess = false,
}: EmailCaptureFormProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const { subscribedEmail, markSubscribed } = useSubscribed();

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  if (subscribedEmail) {
    return <SuccessCard email={subscribedEmail} message={serverMessage} compact={compactSuccess} />;
  }

  function handleChange(value: string) {
    setEmail(value);
    // Once the user has seen an error, re-validate live so it clears as soon as it's fixed.
    if (touched) {
      const result = validateEmail(value);
      setError(result.ok ? null : result.error);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setTouched(true);
    const result = validateEmail(email);
    if (!result.ok) {
      setError(result.error);
      inputRef.current?.focus();
      return;
    }
    setError(null);

    const honeypot = new FormData(event.currentTarget).get("company");

    startTransition(async () => {
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: result.email, company: honeypot ?? "", source }),
        });
        const data = (await res.json().catch(() => null)) as ApiResponse | null;

        if (!res.ok || !data?.success) {
          setError(data?.message ?? "Something went wrong. Please try again.");
          inputRef.current?.focus();
          return;
        }

        setServerMessage(data.message);
        markSubscribed(result.email);
      } catch {
        setError("Network error. Check your connection and try again.");
      }
    });
  }

  const hasError = Boolean(error);

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full" aria-busy={isPending}>
      {/* Honeypot: hidden from humans and assistive tech, bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-company`}>Company</label>
        <input id={`${id}-company`} name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${hasError ? "text-red-400" : "text-gray-500"}`}
            aria-hidden
          />
          <input
            ref={inputRef}
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Enter your best email..."
            value={email}
            disabled={isPending}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => {
              if (email) {
                setTouched(true);
                const result = validateEmail(email);
                setError(result.ok ? null : result.error);
              }
            }}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : hintId}
            className={`h-14 w-full rounded-xl border bg-gray-900 pl-12 pr-4 text-base text-white placeholder:text-gray-500 transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 ${
              hasError
                ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30"
                : "border-gray-800 hover:border-gray-700 focus:border-brand-500 focus:ring-brand-500/30"
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="group inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 text-base font-bold text-[#04140D] shadow-glow transition-all hover:bg-brand-400 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.5),0_10px_40px_-6px_rgba(16,185,129,0.75)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 sm:px-7"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Processing...
            </>
          ) : (
            <>
              {ctaLabel}
              <ArrowRight className="hidden h-5 w-5 transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
            </>
          )}
        </button>
      </div>

      <div className="mt-3 min-h-[1.25rem]">
        {hasError ? (
          <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : (
          <p id={hintId} className="text-xs text-gray-500 sm:text-[0.8125rem]">
            No spam. Unsubscribe anytime. Sent straight to your inbox.
          </p>
        )}
      </div>
    </form>
  );
}
