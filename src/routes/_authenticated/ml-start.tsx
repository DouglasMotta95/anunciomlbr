import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { getMlAuthorizationUrl } from "@/lib/ml.functions";

const title = "Conectando Mercado Livre — ANÚNCIO ML";
const description = "Iniciando a autorização oficial do Mercado Livre.";

export const Route = createFileRoute("/_authenticated/ml-start")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MercadoLivreStartPage,
});

function MercadoLivreStartPage() {
  const navigate = useNavigate();
  const getAuthUrl = useServerFn(getMlAuthorizationUrl);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function startOAuth() {
      try {
        const result = await getAuthUrl();
        if (!result.configured || !result.url) {
          toast.error("Integração indisponível", {
            description:
              result.reason === "state_error"
                ? "Não foi possível criar a sessão segura de conexão. Tente novamente."
                : "A configuração oficial do Mercado Livre está pendente.",
          });
          navigate({ to: "/integracoes", replace: true, search: { ml: "start_error" } });
          return;
        }

        window.location.replace(result.url);
      } catch (error) {
        console.error("ML OAuth start failed", error);
        toast.error("Não foi possível iniciar a conexão com o Mercado Livre.");
        navigate({ to: "/integracoes", replace: true, search: { ml: "start_error" } });
      }
    }

    void startOAuth();
  }, [getAuthUrl, navigate]);

  return (
    <AppShell title="Conectando Mercado Livre">
      <Card className="max-w-xl">
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Redirecionando para a autorização oficial do Mercado Livre...
        </CardContent>
      </Card>
    </AppShell>
  );
}