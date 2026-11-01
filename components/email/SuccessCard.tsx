import { CheckCircle2, Inbox, MailSearch, Star } from "lucide-react";

type SuccessCardProps = {
  email: string;
  message?: string;
  compact?: boolean;
};

export function SuccessCard({ email, message, compact = false }: SuccessCardProps) {
  // The API's default "Subscribed successfully" is for machines; only surface
  // friendlier messages such as the "welcome back" one for repeat signups.
  const customMessage = message && message !== "Subscribed successfully" ? message : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-up rounded-2xl border border-brand-500/40 bg-gradient-to-b from-brand-500/10 to-gray-900/40 p-5 shadow-glow-sm sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/15 ring-1 ring-brand-500/40">
          <CheckCircle2 className="h-5 w-5 text-brand-400" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold text-white">Check your inbox! Your guide is on the way.</p>
          <p className="mt-1 break-words text-sm text-gray-400">
            {customMessage ?? (
              <>
                We just sent it to <span className="font-medium text-gray-200">{email}</span>.
              </>
            )}
          </p>
        </div>
      </div>

      {!compact && (
        <ol className="mt-5 space-y-3 border-t border-gray-800 pt-5 text-sm">
          <li className="flex items-start gap-3">
            <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
            <span>
              <strong className="text-white">Open the email</strong> titled &quot;Your free guide&quot;. It usually lands within 2 minutes.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <MailSearch className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
            <span>
              <strong className="text-white">Not there?</strong> Check your Spam or Promotions tab and drag it into your Primary inbox.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Star className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
            <span>
              <strong className="text-white">Add us to your contacts</strong> so the bonus tools don&apos;t get filtered.
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}
