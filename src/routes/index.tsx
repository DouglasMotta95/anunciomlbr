import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { SessionSplash } from "@/components/SessionSplash";
import { VisitTracker } from "@/components/VisitTracker";
import { MobileStickyCta, PlanPeriodComparisonSection } from "@/components/landing/ConversionSections";
import { IllustrativeSocialProof } from "@/components/landing/IllustrativeSocialProof";
import { LaunchFaqSection } from "@/components/landing/LaunchFaqSection";
import { PremiumCapabilities, PremiumHero, ProductTrustBar } from "@/components/landing/PremiumLanding";
import { PreSaleSupport } from "@/components/landing/PreSaleSupport";
import { Reveal } from "@/components/landing/Reveal";
import { VerifiedFeaturesSection } from "@/components/landing/VerifiedFeaturesSection";
import { VideoDemoSection } from "@/components/landing/VideoDemoSection";
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
        <Reveal><VideoDemoSection /></Reveal>
        <Reveal><VerifiedFeaturesSection /></Reveal>
        <Reveal><ComparisonSection /></Reveal>
        <Reveal><IllustrativeSocialProof /></Reveal>
        <Reveal><PricingSection /></Reveal>
        <Reveal><PlanPeriodComparisonSection /></Reveal>
        <Reveal><LaunchFaqSection /></Reveal>
        <Reveal><PreSaleSupport /></Reveal>
        <Reveal><FinalCta /></Reveal>
      </main>

      <div className="border-y border-border/50 bg-surface/30 px-4 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Administração do ANÚNCIO ML</p>
            <p className="text-xs text-muted-foreground">Acesso exclusivo da equipe administrativa.</p>
          </div>
          <Link
            to="/admin/login"
            className="inline-flex shrink-0 items-center rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/15"
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> Painel administrativo
          </Link>
        </div>
      </div>

      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}