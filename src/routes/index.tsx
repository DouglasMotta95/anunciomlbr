import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SessionSplash } from "@/components/SessionSplash";
import { VisitTracker } from "@/components/VisitTracker";
import { MobileStickyCta, PlanPeriodComparisonSection } from "@/components/landing/ConversionSections";
import { CreditsExplainer } from "@/components/landing/CreditsExplainer";
import { IllustrativeSocialProof } from "@/components/landing/IllustrativeSocialProof";
import { LaunchFaqSection } from "@/components/landing/LaunchFaqSection";
import { PremiumCapabilities, PremiumHero, ProductTrustBar } from "@/components/landing/PremiumLanding";
import { PreSaleSupport } from "@/components/landing/PreSaleSupport";
import { RealSocialProof } from "@/components/landing/RealSocialProof";
import { Reveal } from "@/components/landing/Reveal";
import { VerifiedFeaturesSection } from "@/components/landing/VerifiedFeaturesSection";
import {
  ComparisonSection,
  FinalCta,
  LandingFooter,
  LandingNav,
  PricingSection,
} from "@/components/landing/sections";
import { useAuth } from "@/hooks/useAuth";
import { hasAuthErrorInUrl, hasStoredSession } from "@/lib/session";

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
    ],
  }),
  component: LandingGate,
});

function LandingGate() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Landing />;
  if (user) return <Navigate to="/dashboard" replace />;
  if (loading && hasStoredSession() && !hasAuthErrorInUrl()) return <SessionSplash />;
  return <Landing />;
}

function Landing() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <VisitTracker path="/" />
      <LandingNav />
      <main>
        <PremiumHero />
        <ProductTrustBar />
        <PremiumCapabilities />
        <Reveal><RealSocialProof /></Reveal>
        <Reveal><IllustrativeSocialProof /></Reveal>
        <Reveal><VerifiedFeaturesSection /></Reveal>
        <Reveal><ComparisonSection /></Reveal>
        <Reveal><PricingSection /></Reveal>
        <Reveal><CreditsExplainer /></Reveal>
        <Reveal><PlanPeriodComparisonSection /></Reveal>
        <Reveal><LaunchFaqSection /></Reveal>
        <Reveal><PreSaleSupport /></Reveal>
        <Reveal><FinalCta /></Reveal>
      </main>

      <LandingFooter />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-5 text-xs text-muted-foreground/60">
        <div className="flex flex-wrap gap-4">
          <Link to="/termos" className="transition hover:text-foreground">Termos de Uso</Link>
          <Link to="/privacidade" className="transition hover:text-foreground">Política de Privacidade</Link>
        </div>
        <Link to="/admin/login" className="text-[10px] text-muted-foreground/35 transition hover:text-muted-foreground" rel="nofollow">
          Área administrativa
        </Link>
      </div>
      <MobileStickyCta />
    </div>
  );
}
