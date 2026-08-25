import { Logo } from "@/components/brand";

/** Tela profissional exibida enquanto a sessão é restaurada/validada. */
export function SessionSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <Logo />
      <div className="flex flex-col items-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Restaurando sua sessão…</p>
      </div>
      <div className="w-full max-w-sm space-y-3">
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-card/60" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 animate-pulse rounded-xl border border-border bg-card/60" />
          <div className="h-16 animate-pulse rounded-xl border border-border bg-card/60" />
          <div className="h-16 animate-pulse rounded-xl border border-border bg-card/60" />
        </div>
      </div>
    </div>
  );
}
