import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { optimizeListing, type AiOptimization } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

const CHECKLIST_KEYS = ["Título", "Descrição", "Palavras-chave", "Atributos", "Estrutura"] as const;

type AiPanelProps = {
  title: string;
  description: string | null | undefined;
  category?: string | null;
  priceCents?: number | null;
  currentScore?: number | null;
  onApply: (result: AiOptimization) => void;
};

/** ANÚNCIO AI — analisa o anúncio e propõe melhorias. Nada é aplicado sem confirmação. */
export function AiPanel({ title, description, category, priceCents, currentScore, onApply }: AiPanelProps) {
  const optimize = useServerFn(optimizeListing);
  const [result, setResult] = useState<AiOptimization | null>(null);
  const [applied, setApplied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = useMutation({
    mutationFn: () =>
      optimize({
        data: {
          title,
          description: description ?? undefined,
          category: category ?? undefined,
          price_cents: priceCents ?? undefined,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.info("IA indisponível", { description: res.reason });
        return;
      }
      setResult(res.result);
      setApplied(false);
      toast.success("Análise concluída", { description: "Revise as sugestões antes de aplicar." });
    },
    onError: () => toast.error("A IA não conseguiu responder agora."),
  });

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> ANÚNCIO AI
          {currentScore != null && (
            <Badge variant="outline" className="ml-1">
              score atual {currentScore}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={title.trim().length < 3 || run.isPending}
          onClick={() => run.mutate()}
        >
          {run.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Analisar e otimizar
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <Badge variant="outline">antes {result.score_before}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge>depois {result.score_after}</Badge>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            {CHECKLIST_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {key} revisado(a)
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Título atual</p>
              <p className="mt-1 text-muted-foreground line-through decoration-muted-foreground/40">{title}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary">Título sugerido</p>
              <p className="mt-1 font-medium">{result.title}</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Descrição sugerida</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{result.description}</p>
          </div>

          {result.keywords?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Palavras-chave</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="text-[10px]">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.attributes?.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Atributos sugeridos</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.attributes.map((attribute) => (
                  <Badge key={attribute} variant="outline" className="text-[10px]">
                    {attribute}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.improvements?.length > 0 && (
            <ul className="space-y-1 pl-1 text-muted-foreground">
              {result.improvements.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Circle className="mt-1 h-1.5 w-1.5 shrink-0 fill-current" /> {item}
                </li>
              ))}
            </ul>
          )}

          <Button
            size="sm"
            variant={applied ? "secondary" : "default"}
            disabled={applied}
            className={cn(applied && "opacity-70")}
            onClick={() => setConfirmOpen(true)}
          >
            {applied ? "Melhorias aplicadas" : "Aplicar melhorias"}
          </Button>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aplicar melhorias sugeridas?</AlertDialogTitle>
                <AlertDialogDescription>
                  O título e a descrição atuais serão substituídos pelas sugestões da IA no
                  formulário. Nada é salvo automaticamente — você ainda poderá revisar antes de
                  salvar o anúncio.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onApply(result);
                    setApplied(true);
                    toast.success("Melhorias aplicadas ao formulário");
                  }}
                >
                  Aplicar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
