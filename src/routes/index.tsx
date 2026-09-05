import { createFileRoute, Link } from "@tanstack/react-router";

import { VisitTracker } from "@/components/VisitTracker";
import { MobileStickyCta, PlanPeriodComparisonSection } from "@/components/landing/ConversionSections";
import { CreditsExplainer } from "@/components/landing/CreditsExplainer";
import { InteractiveProductDemo } from "@/components/landing/InteractiveProductDemo";
import { LaunchFaqSection } from "@/components/landing/LaunchFaqSection";
import { PlanPurchaseSection } from "@/components/landing/PlanPurchaseSection";
import { PremiumCapabilities, PremiumHero, ProductTrustBar } from "@/components/landing/PremiumLanding";
import { PreSaleSupport } from "@/components/landing/PreSaleSupport";
import { ProductInsideShowcase } from "@/components/landing/ProductInsideShowcase";
import { ProductScreensCarousel } from "@/components/landing/ProductScreensCarousel";
import { PublicLandingNav } from "@/components/landing/PublicLandingNav";
import { RealSocialProof } from "@/components/landing/RealSocialProof";
import { Reveal } from "@/components/landing/Reveal";
import { SalesShowcase } from "@/components/landing/SalesShowcase";
import { VerifiedFeaturesSection } from "@/components/landing/VerifiedFeaturesSection";
import { ComparisonSection, FinalCta, LandingFooter } from "@/components/landing/sections";

const title = "ANÚNCIO ML — Encontre, copie, otimize e publique anúncios";
const description =
  "Plataforma independente para vendedores do Mercado Livre: busque anúncios, crie cópias, otimize com IA e acompanhe sua operação. Comece com 10 anúncios para testar.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="landing-premium min-h-screen bg-background pb-20 md:pb-0">
      <VisitTracker path="/" />
      <PublicLandingNav />
      <main>
        <PremiumHero />
        <ProductTrustBar />
        <Reveal><InteractiveProductDemo /></Reveal>
        <Reveal><ProductInsideShowcase /></Reveal>
        <Reveal><ProductScreensCarousel /></Reveal>
        <Reveal><SalesShowcase /></Reveal>
        <Reveal><PremiumCapabilities /></Reveal>
        <Reveal><VerifiedFeaturesSection /></Reveal>
        <Reveal><RealSocialProof /></Reveal>
        <Reveal><ComparisonSection /></Reveal>
        <Reveal><PlanPurchaseSection /></Reveal>
        <Reveal><CreditsExplainer /></Reveal>
        <Reveal><PlanPeriodComparisonSection /></Reveal>
        <Reveal><LaunchFaqSection /></Reveal>
        <Reveal><PreSaleSupport /></Reveal>
        <Reveal><FinalCta /></Reveal>
      </main>

      <LandingFooter />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 px-4 pb-5 text-xs text-muted-foreground/60">
        <Link to="/termos" className="transition hover:text-foreground">Termos de Uso</Link>
        <Link to="/privacidade" className="transition hover:text-foreground">Política de Privacidade</Link>
      </div>
      <MobileStickyCta />
    </div>
  );
}
