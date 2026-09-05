import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

const links = [
  ["#demo-interativa", "Demonstração"],
  ["#produto-por-dentro", "Por dentro"],
  ["#recursos", "Recursos"],
  ["#planos", "Planos"],
  ["#faq", "FAQ"],
] as const;

/** Vitrine pública: somente navegação comercial do cliente. */
export function PublicLandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/82">
      <div className="mx-auto grid h-[72px] max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 lg:flex lg:justify-between">
        <div className="min-w-0 transition-transform duration-300 hover:scale-[1.02]">
          <Logo />
        </div>
        <nav className="hidden items-center gap-7 text-[13px] text-muted-foreground lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="group relative py-2 font-semibold transition-colors duration-200 hover:text-foreground">
              {label}
              <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden transition-transform duration-200 hover:-translate-y-0.5 sm:inline-flex">
            <Link to="/auth" search={{ mode: "login" }}>Entrar</Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5 font-bold shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <Link to="/auth" search={{ mode: "signup" }}>Começar grátis <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="lg:hidden" aria-label="Abrir navegação">
            <a href="#recursos"><Menu className="h-4 w-4" /></a>
          </Button>
        </div>
      </div>
    </header>
  );
}
