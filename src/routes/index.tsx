import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SessionSplash } from "@/components/SessionSplash";
import { VisitTracker } from "@/components/VisitTracker";
import { useAuth } from "@/hooks/useAuth";
import { hasAuthErrorInUrl, hasStoredSession } from "@/lib/session";
import { Reveal } from "@/components/landing/Reveal";
import { VideoDemoSection } from "@/components/landing/VideoDemoSection";
import { PartnerCta } from "@/components/landing/PartnerCta";
import { MobileStickyCta, PlanPeriodComparisonSection } from "@/components/landing/ConversionSections";
import { AiTitlesSection, DuplicationFlowSection, RadarSection, StudioSection } from "@/components/landing/VisualSections";
import { ComparisonSection, DemoSection, FaqSection, FeaturesGridSection, FinalCta, Hero, HowItWorks, LandingFooter, LandingNav, PricingSection, TestimonialsSection, TrustBar } from "@/components/landing/sections";

const title = "ANÚNCIO ML — Encontre, copie, otimize e publique anúncios";
const description = "Plataforma para vendedores do Mercado Livre: busque anúncios, copie em massa, otimize com IA e gerencie vendas, estoque e performance. Comece com 10 anúncios grátis.";

export const Route = createFileRoute("/")({head:()=>({meta:[{title},{name:"description",content:description},{property:"og:title",content:title},{property:"og:description",content:description}]}),component:LandingGate});

function LandingGate(){const {user,loading}=useAuth();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);if(!mounted)return <Landing/>;if(user)return <Navigate to="/dashboard" replace/>;if(loading&&hasStoredSession()&&!hasAuthErrorInUrl())return <SessionSplash/>;return <Landing/>}

function Landing(){return <div className="min-h-screen bg-background pb-20 md:pb-0"><VisitTracker path="/"/><LandingNav/><main><Hero/><TrustBar/><Reveal><HowItWorks/></Reveal><Reveal><VideoDemoSection/></Reveal><RadarSection/><DuplicationFlowSection/><AiTitlesSection/><StudioSection/><Reveal><DemoSection/></Reveal><Reveal><FeaturesGridSection/></Reveal><Reveal><ComparisonSection/></Reveal><Reveal><TestimonialsSection/></Reveal><Reveal><PricingSection/></Reveal><Reveal><PlanPeriodComparisonSection/></Reveal><Reveal><FaqSection/></Reveal><Reveal><FinalCta/></Reveal><Reveal><PartnerCta/></Reveal></main><LandingFooter/><MobileStickyCta/></div>}
