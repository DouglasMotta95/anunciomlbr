import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { retentionAlternatives } from '@/lib/growth'
export const Route=createFileRoute('/_authenticated/cancelamento')({component:Cancelamento})
const reasons=[['price','O preço não compensa para mim'],['usage','Estou usando pouco'],['missing','Falta um recurso que preciso'],['technical','Tive problemas técnicos'],['other','Outro motivo']]
function Cancelamento(){const [reason,setReason]=useState('');const alternatives=retentionAlternatives(reason);return <AppShell title="Gerenciar assinatura" description="Você mantém o controle. Sem esconder cancelamento e sem dificultar sua saída."><div className="mx-auto max-w-2xl space-y-4"><Card><CardHeader><CardTitle>Antes de cancelar, o que aconteceu?</CardTitle></CardHeader><CardContent className="space-y-2">{reasons.map(([key,label])=><button key={key} onClick={()=>setReason(key)} className={`w-full rounded-xl border p-3 text-left text-sm ${reason===key?'border-primary bg-primary/5':''}`}>{label}</button>)}</CardContent></Card>{reason&&<Card><CardHeader><CardTitle>Talvez uma destas opções resolva</CardTitle></CardHeader><CardContent className="space-y-2">{alternatives.map(a=><Button key={a.key} asChild variant="outline" className="w-full justify-start"><Link to={a.to as any}>{a.label}</Link></Button>)}<p className="pt-3 text-xs text-muted-foreground">Estas opções são sugestões. O cancelamento continua disponível conforme as regras da sua assinatura.</p></CardContent></Card>}</div></AppShell>}
