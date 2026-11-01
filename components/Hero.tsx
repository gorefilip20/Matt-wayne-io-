import { CalendarDays, Clock } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { Badge } from "./guide/Badge";
import { EmailCaptureForm } from "./email/EmailCaptureForm";

export function Hero() {
  return (
    <section id="hero" className="relative pb-10 pt-10 sm:pt-16">
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-72 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl"
        aria-hidden
      />

      <Badge>{siteConfig.badge}</Badge>

      <h1 className="mt-5 text-[2rem] font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
        The 5-Step <span className="text-brand-400">Price Action Framework</span> That Turns Random Trades Into a
        Repeatable System
      </h1>

      <p className="mt-5 text-lg leading-relaxed text-gray-400">{siteConfig.description}</p>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-xs font-bold text-white">
            {siteConfig.initials}
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-white">{siteConfig.author}</p>
            <p className="text-xs text-gray-500">{siteConfig.authorRole}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-gray-500">
          <Clock className="h-4 w-4" aria-hidden />
          {siteConfig.readTime}
        </span>
        <span className="flex items-center gap-1.5 text-gray-500">
          <CalendarDays className="h-4 w-4" aria-hidden />
          {siteConfig.updated}
        </span>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
        <p className="mb-3 text-sm font-semibold text-white">Want the printable PDF + bonus checklist?</p>
        <EmailCaptureForm source="hero" compactSuccess />
      </div>
    </section>
  );
}
