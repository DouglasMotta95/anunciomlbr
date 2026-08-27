import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import {
  getCancellationState,
  requestCancellation,
  withdrawCancellation,
} from '@/lib/cancellation.functions'
import { retentionAlternatives } from '@/lib/growth'

export const Route = createFileRoute('/_authenticated/cancelamento')({ component: Cancelamento })

const reasons = [
  ['price', 'O preço não compensa para mim'],
  ['usage', 'Estou usando pouco'],
  ['missing', 'Falta um recurso que preciso'],
  ['technical', 'Tive problemas técnicos'],
  ['other', 'Outro motivo'],
] as const

type CancellationReason = (typeof reasons)[number][0]

function Cancelamento() {
  const stateFn = useServerFn(getCancellationState)
  const requestFn = useServerFn(requestCancellation)
  const withdrawFn = useServerFn(withdrawCancellation)
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['cancellation-state'],
    queryFn: () => stateFn(),
  })
  const [reason, setReason] = useState<CancellationReason | ''>('')
  const [details, setDetails] = useState('')
  const alternatives = retentionAlternatives(reason)

  const request = useMutation({
    mutationFn: () => {
      if (!reason) throw new Error('Selecione um motivo para continuar.')
      return requestFn({ data: { reason, details: details || null } })
    },
    onSuccess: (result) => {
      toast.success(
        result.already_requested
          ? 'Seu pedido já estava registrado.'
          : 'Pedido de cancelamento registrado.',
        {
          description: result.access_until
            ? `Seu acesso permanece disponível até ${formatDate(result.access_until)}.`
            : undefined,
        },
      )
      void qc.invalidateQueries({ queryKey: ['cancellation-state'] })
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o pedido.'),
  })

  const withdraw = useMutation({
    mutationFn: () => withdrawFn(),
    onSuccess: () => {
      toast.success('Pedido de cancelamento retirado.')
      void qc.invalidateQueries({ queryKey: ['cancellation-state'] })
    },
    onError: () => toast.error('Não foi possível retirar o pedido agora.'),
  })

  if (isLoading) {
    return (
      <AppShell title="Gerenciar assinatura">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </AppShell>
    )
  }

  if (data?.request) {
    return (
      <AppShell
        title="Gerenciar assinatura"
        description="Seu pedido está registrado e sua assinatura continua utilizável até o encerramento do período atual."
      >
        <div className="mx-auto max-w-2xl">
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle>Cancelamento solicitado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-muted/40 p-4 text-sm">
                <p>
                  <strong>Solicitado em:</strong> {formatDate(data.request.requested_at)}
                </p>
                <p>
                  <strong>Motivo:</strong>{' '}
                  {reasons.find((item) => item[0] === data.request.reason)?.[1] ?? data.request.reason}
                </p>
                {data.license?.expires_at && (
                  <p>
                    <strong>Acesso previsto até:</strong> {formatDate(data.license.expires_at)}
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Se você mudou de ideia, pode retirar o pedido. Não criamos obstáculos para cancelamento.
              </p>
              <Button onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
                {withdraw.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Retirar pedido de cancelamento
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Gerenciar assinatura"
      description="Você mantém o controle. Podemos tentar resolver o motivo, mas o pedido de cancelamento continua disponível."
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Antes de cancelar, o que aconteceu?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reasons.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setReason(key)}
                className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                  reason === key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                {label}
              </button>
            ))}
            {reason && (
              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Quer explicar um pouco mais? (opcional)"
                className="mt-3"
              />
            )}
          </CardContent>
        </Card>

        {reason && (
          <Card>
            <CardHeader>
              <CardTitle>Antes de sair, veja se alguma opção resolve</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alternatives.map((alternative) => (
                <Button key={alternative.key} asChild variant="outline" className="w-full justify-start">
                  <Link to={(alternative.to === '/planos' ? '/licenca' : alternative.to) as '/licenca'}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {alternative.label}
                  </Link>
                </Button>
              ))}
              <div className="my-4 border-t" />
              <Button
                variant="destructive"
                className="w-full"
                disabled={request.isPending}
                onClick={() => request.mutate()}
              >
                {request.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Confirmar pedido de cancelamento
              </Button>
              <p className="pt-2 text-xs text-muted-foreground">
                Registrar o pedido não apaga seus dados e não interrompe o período já pago. O processamento financeiro depende do meio de cobrança e das regras da assinatura.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
