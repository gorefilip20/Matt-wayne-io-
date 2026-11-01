import { CheckCircle2, FileText, Gift } from "lucide-react";
import { EmailCaptureForm } from "./EmailCaptureForm";

const perks = [
  "The printable 1-page pre-trade checklist",
  "Position-size calculator spreadsheet",
  "5 annotated chart examples for every step",
];

/** End-of-guide conversion block: what you get + the form. */
export function EmailCaptureCard({ id = "get-guide" }: { id?: string }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-400">
          <Gift className="h-3.5 w-3.5" aria-hidden />
          Free PDF + bonus toolkit
        </span>
        <h2 id={`${id}-title`} className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Get the complete guide in your inbox
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-400">
          Keep the full framework on hand while you trade, plus the tools that make it stick.
        </p>

        <ul className="mt-5 grid gap-2.5 sm:grid-cols-1">
          {perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-sm text-gray-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
              {perk}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <EmailCaptureForm source="end-of-guide" />
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Instant delivery. Read it on any device.
        </p>
      </div>
    </section>
  );
}
