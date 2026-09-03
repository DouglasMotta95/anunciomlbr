import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPlatformFoundation, inviteWorkspaceMember } from "@/lib/platform-operations.functions";

export const Route = createFileRoute("/_authenticated/equipe")({ component: TeamPage });
function TeamPage(){
 const load=useServerFn(getPlatformFoundation); const invite=useServerFn(inviteWorkspaceMember); const [data,setData]=useState<any>(null); const [email,setEmail]=useState(""); const [role,setRole]=useState<"manager"|"operator"|"viewer">("operator"); const [busy,setBusy]=useState(false);
 const refresh=()=>load().then(setData); useEffect(()=>{void refresh();},[]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{await invite({data:{email,role}});setEmail("");await refresh();}finally{setBusy(false)}}
 return <div className="space-y-6"><div><p className="text-sm font-medium text-primary">Conta</p><h1 className="text-3xl font-semibold tracking-tight">Equipe e permissões</h1><p className="mt-2 text-muted-foreground">Cadastre operadores do ANÚNCIO ML sem compartilhar credenciais do Mercado Livre.</p></div><Card><CardHeader><CardTitle>Convidar membro</CardTitle><CardDescription>Convites ficam registrados; a ativação de login será vinculada em etapa autenticada própria.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="flex flex-col gap-3 md:flex-row"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="operador@empresa.com" required/><select className="h-10 rounded-md border bg-background px-3 text-sm" value={role} onChange={e=>setRole(e.target.value as any)}><option value="manager">Gerente</option><option value="operator">Operador</option><option value="viewer">Visualizador</option></select><Button disabled={busy}>{busy?"Salvando...":"Registrar convite"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Membros</CardTitle></CardHeader><CardContent className="space-y-2">{data?.members?.length?data.members.map((m:any)=><div key={m.id} className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-medium">{m.member_email}</div><div className="text-xs text-muted-foreground">{m.role}</div></div><span className="text-sm text-muted-foreground">{m.status}</span></div>):<p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>}</CardContent></Card></div>
}
