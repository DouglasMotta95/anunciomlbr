import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  to = "/",
  compact = false,
}: {
  className?: string;
  to?: string;
  compact?: boolean;
}) {
  return (
    <Link to={to} className={cn("group flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <span className="font-display text-sm font-extrabold">ML</span>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-secondary ring-2 ring-background" />
      </span>
      {!compact && (
        <span className="font-display text-base font-extrabold leading-none tracking-tight">
          ANÚNCIO
          <span className="text-primary"> ML</span>
        </span>
      )}
    </Link>
  );
}

export const SLOGAN = "Encontre. Copie. Otimize. Publique. Venda.";
