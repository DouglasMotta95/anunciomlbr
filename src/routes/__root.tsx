import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const CUSTOMER_OAUTH_INTENT = "anuncioml_customer_oauth_intent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "ANÚNCIO ML" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function OAuthReturnBridge() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sessionStorage.getItem(CUSTOMER_OAUTH_INTENT)) return;

    let disposed = false;
    let completed = false;
    const retryTimers: number[] = [];

    const finishWithSession = () => {
      if (disposed || completed) return;
      completed = true;
      void navigate({ to: "/auth", replace: true });
    };

    if (user) {
      finishWithSession();
      return;
    }

    // O retorno do broker e a restauração do Supabase são assíncronos. A leitura
    // inicial de getSession pode terminar antes de o evento SIGNED_IN persistir os
    // tokens. Não redirecionamos para /auth até existir uma sessão confirmada.
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finishWithSession();
    });

    if (!loading) {
      for (const delay of [150, 400, 900, 1800, 3200, 5000]) {
        const timer = window.setTimeout(() => {
          if (disposed || completed) return;
          void supabase.auth.getSession().then(({ data }) => {
            if (data.session?.user) finishWithSession();
          });
        }, delay);
        retryTimers.push(timer);
      }
    }

    // Se o provedor foi cancelado ou realmente não criou sessão, devolvemos o
    // usuário ao formulário somente depois de dar tempo suficiente ao callback.
    const fallbackTimer = window.setTimeout(() => {
      if (disposed || completed) return;
      sessionStorage.removeItem(CUSTOMER_OAUTH_INTENT);
      void navigate({ to: "/auth", replace: true });
    }, 12000);

    return () => {
      disposed = true;
      authSubscription.subscription.unsubscribe();
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(fallbackTimer);
    };
  }, [loading, user, navigate]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <OAuthReturnBridge />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
