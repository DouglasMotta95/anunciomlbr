import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Loader2, RefreshCcw, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adminListActiveSessions,
  adminListExpiringLicenses,
  adminNotifyExpiringLicenses,
} from "@/lib/admin.functions";

function relative(iso: string | null) {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  return `${h}h atrás`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function SessionsTab() {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState("15");
  const [days, setDays] = useState("10");

  const listSessions = useServerFn(adminListActiveSessions);
  const listExpiring = useServerFn(adminListExpiringLicenses);
  const notify = useServerFn(adminNotifyExpiringLicenses);

  const sessions = useQuery({
    queryKey: ["admin-active-sessions", minutes],
    queryFn: () => listSessions({ data: { minutes: Number(minutes) } }),
    refetchInterval: 60_000,
  });

  const expiring = useQuery({
    queryKey: ["admin-expiring-licenses", days],
    queryFn: () => listExpiring({ data: { days: Number(days) } }),
  });

  const sendAlerts = useMutation({
    mutationFn: () => notify({ data: { days: Number(days) } }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["admin-expiring-licenses"] });
      toast.success(
        r.notified > 0
          ? `${r.notified} cliente(s) avisado(s)${r.skipped ? ` · ${r.skipped} já avisado(s) hoje` : ""}`
          : "Nenhum novo alerta a enviar (todos já foram avisados hoje).",
      );
    },
    onError: () => toast.error("Falha ao enviar alertas."),
  });

  const rows = sessions.data?.sessions ?? [];
  const expiringRows = expiring.data?.licenses ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Logins ativos
            <Badge variant="secondary">{sessions.data?.online ?? 0} online</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={minutes} onValueChange={setMinutes}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Últimos 5 min</SelectItem>
                <SelectItem value="15">Últimos 15 min</SelectItem>
                <SelectItem value="60">Última hora</SelectItem>
                <SelectItem value="1440">Últimas 24h</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => void sessions.refetch()} title="Atualizar">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sessions.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente ativo nesse intervalo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Anúncios</TableHead>
                  <TableHead>Licença</TableHead>
                  <TableHead>Visto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s: any) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{s.full_name ?? "—"}</div>
                      <div className="text-muted-foreground">{s.email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-xs">{s.plan?.name ?? "Sem plano"}</TableCell>
                    <TableCell className="text-xs">
                      {s.ads_quota === null ? "—" : `${s.ads_used}/${s.ads_quota}`}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{s.license_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">{relative(s.last_seen_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" /> Licenças a vencer
            <Badge variant="outline">{expiringRows.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Próximos 3 dias</SelectItem>
                <SelectItem value="7">Próximos 7 dias</SelectItem>
                <SelectItem value="10">Próximos 10 dias</SelectItem>
                <SelectItem value="30">Próximos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => sendAlerts.mutate()}
              disabled={sendAlerts.isPending || expiringRows.length === 0}
            >
              {sendAlerts.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="mr-2 h-4 w-4" />
              )}
              Avisar clientes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {expiring.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : expiringRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma licença vencendo nesse período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Vence em</TableHead>
                  <TableHead>Validade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringRows.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{l.email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.code}</TableCell>
                    <TableCell className="text-xs">{l.plan?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={l.days_left <= 3 ? "destructive" : "secondary"}>
                        {l.days_left} dia(s)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(l.expires_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
