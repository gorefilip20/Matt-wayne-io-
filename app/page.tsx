import { Hero } from "@/components/Hero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { EmailCaptureCard } from "@/components/email/EmailCaptureCard";
import { StickyCta } from "@/components/email/StickyCta";
import { GuideContent } from "@/components/guide/GuideContent";

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 pt-0">
        <Hero />
        <GuideContent />
        <div className="mt-16">
          <EmailCaptureCard id="get-guide" />
        </div>
      </main>
      <SiteFooter />
      <StickyCta showAfterId="hero" targetId="get-guide" />
    </>
  );
}
