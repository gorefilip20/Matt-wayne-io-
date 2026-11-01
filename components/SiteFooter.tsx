import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-gray-800">
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm">
        <p className="text-xs leading-relaxed text-gray-600">
          <strong className="text-gray-500">Risk disclaimer:</strong> Trading involves substantial risk of loss and is
          not suitable for every investor. Nothing on this page is financial advice. Past performance does not
          guarantee future results. Only trade with money you can afford to lose.
        </p>
        <div className="mt-6 flex flex-col gap-3 text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.brand}. All rights reserved.
          </p>
          <div className="flex gap-5">
            <a href={siteConfig.social.x} className="transition-colors hover:text-white" rel="noopener noreferrer" target="_blank">
              X / Twitter
            </a>
            <a href={siteConfig.social.youtube} className="transition-colors hover:text-white" rel="noopener noreferrer" target="_blank">
              YouTube
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
