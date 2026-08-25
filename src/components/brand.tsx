import { Link } from "@tanstack/react-router";

import logoMark from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const MARK_SIZE: Record<LogoSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

const TEXT_SIZE: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

/** Marca reduzida (ícone) — usada em favicon, mobile e avatar do app. */
export function LogoMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: LogoSize;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25",
        MARK_SIZE[size],
        className,
      )}
    >
      <img
        src={logoMark}
        alt="ANÚNCIO ML"
        width={816}
        height={816}
        loading="lazy"
        className="h-[78%] w-[78%] object-contain"
      />
    </span>
  );
}

/** Logo completo (marca + wordmark). `compact` mostra apenas o ícone. */
export function Logo({
  className,
  to = "/",
  compact = false,
  size = "md",
}: {
  className?: string;
  to?: string;
  compact?: boolean;
  size?: LogoSize;
}) {
  return (
    <Link to={to} className={cn("group flex items-center gap-2.5", className)}>
      <LogoMark size={size} className="transition-transform group-hover:scale-105" />
      {!compact && (
        <span
          className={cn(
            "font-display font-extrabold leading-none tracking-tight",
            TEXT_SIZE[size],
          )}
        >
          ANÚNCIO
          <span className="text-primary"> ML</span>
        </span>
      )}
    </Link>
  );
}

export const SLOGAN = "Encontre. Copie. Otimize. Publique. Venda.";
