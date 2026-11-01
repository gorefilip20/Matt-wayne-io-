/**
 * Central place for branding + copy. Change these values to rebrand the page
 * without touching any component.
 */
export const siteConfig = {
  brand: "Edge Playbook",
  author: "Your Name",
  authorRole: "Trader & Educator",
  initials: "EP",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  badge: "Free Step-by-Step Guide",
  title: "The 5-Step Price Action Framework That Turns Random Trades Into a Repeatable System",
  description:
    "Most traders lose because they improvise every entry. This guide hands you the exact checklist for reading structure, marking levels, timing entries and sizing risk, so every trade follows the same rules.",
  readTime: "9 min read",
  updated: "Updated October 2026",
  social: {
    x: "https://x.com/",
    youtube: "https://youtube.com/",
  },
} as const;
