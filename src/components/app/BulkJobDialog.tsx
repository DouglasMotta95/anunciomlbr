import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBulkJob, type BulkJobItem } from "@/lib/bulk.functions";

const KIND_LABEL: Record<string, string> = {
  copy: "Copiando anúncios",
  optimize: "Otimizando com IA",
  pause: "Pausando anúncios",
  activate: "Ativando anúncios",
  delete: "Excluindo anúncios",
};

const STATUS_LABEL: Record<BulkJobItem["status"], string> = {
  queued: "Aguardando",
  processing: "Processando",
  done: "Concluído",
  error: "Erro",
};

export function BulkJobDialog({
  jobId,
  onOpenChange,
  onFinished,
}: {
  jobId: string | null;
  onOpenChange: (open: boolean) => void;
  onFinished?: () => void;
}) {
  const fetchJob = useServerFn(getBulkJob);

  const query = useQuery({
    queryKey: ["bulk-job", jobId],
    enabled: !!jobId,
    refetchInterval: (q) => {
      const status = q.state.data?.job?.status;
      return status === "done" || status === "error" ? false : 900;
    },
    queryFn: () => fetchJob({ data: { jobId: jobId! } }),
  });

  const job = query.data?.job;
  const items = (job?.payload as { items?: BulkJobItem[] } | null)?.items ?? [];
  const finished = job?.status === "done" || job?.status === "error";

  if (finished && onFinished) onFinished();

  return (
    <Dialog open={!!jobId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{job ? KIND_LABEL[job.kind] ?? "Processando" : "Processando"}</DialogTitle>
          <DialogDescription>
            Progresso real acompanhado direto do backend — nada é marcado como concluído até a
            confirmação do servidor.
          </DialogDescription>
        </DialogHeader>

        {!job ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando status do job…
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {job.processed + job.failed}/{job.total} processados
                </span>
                <Badge variant={finished ? (job.failed > 0 ? "destructive" : "default") : "secondary"}>
                  {job.status === "queued" && "na fila"}
                  {job.status === "processing" && "processando"}
                  {job.status === "done" && "concluído"}
                  {job.status === "error" && "concluído com erros"}
                </Badge>
              </div>
              <Progress value={job.total ? ((job.processed + job.failed) / job.total) * 100 : 0} className="mt-2" />
            </div>

            <ScrollArea className="h-64 rounded-xl border border-border">
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="truncate">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {item.status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
                      {item.status === "done" && <CheckCircle2 className="h-3 w-3 text-primary" />}
                      {item.status === "error" && <AlertCircle className="h-3 w-3 text-destructive" />}
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
