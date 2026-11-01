"use client";

import { ArrowDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSubscribed } from "./use-subscribed";

type StickyCtaProps = {
  /** Element id whose bottom edge must scroll out of view before the bar shows. */
  showAfterId: string;
  /** The form section the bar links to; the bar hides while it's on screen. */
  targetId: string;
};

/**
 * Floating "get the guide" bar. Appears once the hero form is off screen,
 * hides near the end-of-guide form and after a successful signup.
 */
export function StickyCta({ showAfterId, targetId }: StickyCtaProps) {
  const { subscribedEmail } = useSubscribed();
  const [pastHero, setPastHero] = useState(false);
  const [targetVisible, setTargetVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(showAfterId);
    const target = document.getElementById(targetId);
    if (!hero || !target) return;

    const heroObserver = new IntersectionObserver(([entry]) => {
      setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    const targetObserver = new IntersectionObserver(([entry]) => setTargetVisible(entry.isIntersecting), {
      rootMargin: "0px 0px 100px 0px",
    });

    heroObserver.observe(hero);
    targetObserver.observe(target);
    return () => {
      heroObserver.disconnect();
      targetObserver.disconnect();
    };
  }, [showAfterId, targetId]);

  const visible = pastHero && !targetVisible && !dismissed && !subscribedEmail;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all duration-300 sm:bottom-4 sm:px-4 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/95 p-2.5 pl-4 shadow-2xl shadow-black/60 backdrop-blur-md">
        <p className="min-w-0 flex-1 truncate text-sm text-gray-300">
          <span className="font-semibold text-white">Free guide + toolkit</span>
          <span className="hidden sm:inline"> sent straight to your inbox</span>
        </p>
        <a
          href={`#${targetId}`}
          tabIndex={visible ? 0 : -1}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-bold text-[#04140D] shadow-glow transition-colors hover:bg-brand-400"
        >
          Get it free
          <ArrowDown className="h-4 w-4" aria-hidden />
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          tabIndex={visible ? 0 : -1}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
