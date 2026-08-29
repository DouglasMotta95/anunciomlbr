import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * Navegação da landing pública.
 *
 * Este cabeçalho é intencionalmente independente do estado da sessão e de
 * qualquer papel administrativo. A vitrine pública sempre apresenta apenas
 * as ações comerciais do cliente: entrar ou criar conta.
 */
export function PublicLandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#demo" className="transition-colors hover:text-foreground">Demonstração</a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">Como funciona</a>
          <a href="#ia" className="transition-colors hover:text-foreground">IA</a>
          <a href="#recursos" className="transition-colors hover:text-foreground">Recursos</a>
          <a href="#planos" className="transition-colors hover:text-foreground">Planos</a>
          <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "login" }}>Entrar</Link>
          </Button>
          <Button asChild size="sm" className="font-semibold">
            <Link to="/auth" search={{ mode: "signup" }}>Começar grátis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
