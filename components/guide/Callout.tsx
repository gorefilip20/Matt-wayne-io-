import { AlertTriangle, Info, Lightbulb } from "lucide-react";

const variants = {
  tip: { icon: Lightbulb, label: "Pro tip", border: "border-l-brand-500", text: "text-brand-400", bg: "bg-brand-500/[0.06]" },
  warning: { icon: AlertTriangle, label: "Watch out", border: "border-l-amber-400", text: "text-amber-400", bg: "bg-amber-400/[0.06]" },
  info: { icon: Info, label: "Note", border: "border-l-sky-400", text: "text-sky-400", bg: "bg-sky-400/[0.06]" },
} as const;

type CalloutProps = {
  variant?: keyof typeof variants;
  title?: string;
  children: React.ReactNode;
};

export function Callout({ variant = "tip", title, children }: CalloutProps) {
  const v = variants[variant];
  const Icon = v.icon;
  return (
    <aside className={`rounded-r-xl border border-l-4 border-gray-800 ${v.border} ${v.bg} px-4 py-4 sm:px-5`}>
      <p className={`flex items-center gap-2 text-sm font-semibold ${v.text}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {title ?? v.label}
      </p>
      <div className="mt-2 text-[0.9375rem] leading-relaxed text-gray-300 [&_strong]:text-white">{children}</div>
    </aside>
  );
}
