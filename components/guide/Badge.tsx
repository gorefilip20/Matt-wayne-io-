import { Flame } from "lucide-react";

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400 shadow-glow-sm sm:text-[0.8125rem]">
      <Flame className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}
