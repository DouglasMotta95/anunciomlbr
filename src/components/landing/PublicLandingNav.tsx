import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

const links = [
  ["#demo", "Demonstração"],
  ["#como-funciona", "Como funciona"],
  ["#ia", "IA"],
  ["#recursos", "Recursos"],
  ["#planos", "Planos"],
  ["#faq", "FAQ"],
] as const;

/** Vitrine pública: somente navegação comercial do cliente. */
export function PublicLandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/72">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="transition-transform duration-300 hover:scale-[1.02]">
          <Logo />
        </div>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="group relative py-2 font-medium transition-colors duration-200 hover:text-foreground">
              {label}
              <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="transition-transform duration-200 hover:-translate-y-0.5">
            <Link to="/auth" search={{ mode: "login" }}>Entrar</Link>
          </Button>
          <Button asChild size="sm" className="font-semibold shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <Link to="/auth" search={{ mode: "signup" }}>Começar grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
