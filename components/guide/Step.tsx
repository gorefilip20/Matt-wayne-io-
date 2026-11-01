type StepProps = {
  number: number;
  title: string;
  id: string;
  children: React.ReactNode;
};

/** A numbered section of the guide with an anchor for the table of contents. */
export function Step({ number, title, id, children }: StepProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <div className="mt-14 flex items-center gap-3">
        <span className="inline-flex shrink-0 items-center rounded-md border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-brand-400">
          Step {number}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent" aria-hidden />
      </div>
      <h2 id={`${id}-title`} className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
        {title}
      </h2>
      <div className="guide-prose mt-5">{children}</div>
    </section>
  );
}
