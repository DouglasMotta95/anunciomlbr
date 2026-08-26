import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SessionSplash } from "@/components/SessionSplash";
import { useAuth } from "@/hooks/useAuth";
import { hasAuthErrorInUrl, hasStoredSession } from "@/lib/session";

import {
  AiSection,
  BenefitsSection,
  ComparisonSection,
  CopySection,
  DashboardSection,
  DemoSection,
  EditorSection,
  FaqSection,
  FeaturesGridSection,
  FinalCta,
  Hero,
  HowItWorks,
  InventorySection,
  LandingFooter,
  LandingNav,
  ManageSection,
  PricingSection,
  ReportsSection,
  SalesSection,
  SearchSection,
  TrustBar,
} from "@/components/landing/sections";

const title = "ANÚNCIO ML — Encontre, copie, otimize e publique anúncios";
const description =
  "Plataforma para vendedores do Mercado Livre: busque anúncios, copie em massa, otimize com IA e gerencie vendas, estoque e performance. Comece com 10 anúncios grátis.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <TrustBar />
        <DemoSection />
        <HowItWorks />
        <SearchSection />
        <CopySection />
        <AiSection />
        <EditorSection />
        <ManageSection />
        <DashboardSection />
        <ReportsSection />
        <SalesSection />
        <InventorySection />
        <BenefitsSection />
        <FeaturesGridSection />
        <ComparisonSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
