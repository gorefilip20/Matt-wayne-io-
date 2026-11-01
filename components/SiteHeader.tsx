import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-800/70 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2.5" aria-label={`${siteConfig.brand} home`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-extrabold text-[#04140D] shadow-glow-sm">
            {siteConfig.initials}
          </span>
          <span className="text-[0.9375rem] font-bold tracking-tight text-white">{siteConfig.brand}</span>
        </a>
        <a
          href="#get-guide"
          className="rounded-lg border border-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:border-brand-500/50 hover:text-white"
        >
          Get the guide
        </a>
      </div>
    </header>
  );
}
