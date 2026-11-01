import { ListOrdered } from "lucide-react";

type TocItem = { id: string; label: string };

export function TableOfContents({ items }: { items: TocItem[] }) {
  return (
    <nav aria-label="Guide contents" className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <ListOrdered className="h-4 w-4 text-brand-400" aria-hidden />
        What&apos;s inside
      </p>
      <ol className="mt-4 space-y-1">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-[0.9375rem] text-gray-400 transition-colors hover:bg-gray-800/60 hover:text-white"
            >
              <span className="w-5 font-mono text-xs text-gray-600 group-hover:text-brand-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
