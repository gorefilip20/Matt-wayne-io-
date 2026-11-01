import { CheckCircle2 } from "lucide-react";

type ChecklistProps = {
  title?: string;
  items: React.ReactNode[];
};

/** Visual checklist card with green check icons. */
export function Checklist({ title, items }: ChecklistProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
      {title && <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">{title}</p>}
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-gray-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
