import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircleQuestion, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { answerSellerQuestion, listSellerQuestions, suggestQuestionAnswer, type MlQuestion } from "@/lib/ml-questions.functions";

export const Route = createFileRoute("/_authenticated/perguntas")({
  head: () => ({ meta: [{ title: "Perguntas dos clientes — ANÚNCIO ML" }, { name: "robots", content: "noindex" }] }),
  component: QuestionsPage,
});

function QuestionsPage() {
  const listFn = useServerFn(listSellerQuestions);
  const answerFn = useServerFn(answerSellerQuestion);
  const suggestFn = useServerFn(suggestQuestionAnswer);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["ml-questions"], queryFn: () => listFn(), refetchInterval: 60_000 });
  const questions = data?.questions ?? [];
  const unanswered = questions.filter((q) => q.status === "UNANSWERED");

  return <AppShell title="Perguntas dos clientes" description="Responda dúvidas do Mercado Livre mais rápido com sugestões da IA — você revisa antes de enviar.">
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric label="Recebidas" value={data?.total ?? questions.length}/><Metric label="Sem resposta" value={unanswered.length}/><Metric label="Respondidas na lista" value={questions.filter((q)=>q.status === "ANSWERED").length}/></div>
    {isLoading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin"/>Carregando perguntas…</CardContent></Card> : error ? <Card><CardContent className="py-10 text-center"><p className="font-semibold">Não foi possível carregar as perguntas.</p><p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Confira a conexão com o Mercado Livre."}</p></CardContent></Card> : questions.length === 0 ? <Card><CardContent className="py-12 text-center"><MessageCircleQuestion className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-semibold">Nenhuma pergunta encontrada.</p></CardContent></Card> : <div className="space-y-3">{questions.map((q)=><QuestionCard key={q.id} question={q} answerFn={answerFn} suggestFn={suggestFn} afterSend={()=>qc.invalidateQueries({queryKey:["ml-questions"]})}/>)}</div>}
  </AppShell>;
}

function QuestionCard({ question, answerFn, suggestFn, afterSend }: { question: MlQuestion; answerFn: ReturnType<typeof useServerFn<typeof answerSellerQuestion>>; suggestFn: ReturnType<typeof useServerFn<typeof suggestQuestionAnswer>>; afterSend: () => void }) {
  const [text, setText] = useState(question.answer?.text ?? "");
  const answered = question.status === "ANSWERED";
  const suggest = useMutation({ mutationFn: () => suggestFn({ data: { question_id: question.id, item_id: question.item_id, question: question.text } }), onSuccess: (result) => { if (!result.ok) { toast.error(result.reason); return; } setText(result.suggestion.answer); toast.success(`Sugestão gerada · confiança ${result.suggestion.confidence}`); }, onError: ()=>toast.error("Não foi possível gerar a sugestão") });
  const send = useMutation({ mutationFn: () => answerFn({ data: { question_id: question.id, text: text.trim() } }), onSuccess: ()=>{toast.success("Resposta enviada ao Mercado Livre"); afterSend();}, onError:(e)=>toast.error(e instanceof Error ? e.message : "Falha ao responder") });
  return <Card><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle className="text-base">{question.item_id}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(question.date_created)}</p></div><Badge variant={answered?"default":"secondary"}>{answered?"Respondida":"Aguardando resposta"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="rounded-xl bg-muted/50 p-3"><p className="text-sm">{question.text}</p></div><Textarea rows={3} disabled={answered} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Digite sua resposta ou peça uma sugestão à IA…" maxLength={2000}/><div className="flex flex-wrap justify-between gap-2"><span className="text-xs text-muted-foreground">{text.length}/2000 caracteres</span>{!answered&&<div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>suggest.mutate()} disabled={suggest.isPending}>{suggest.isPending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Sugerir com IA</Button><Button size="sm" onClick={()=>send.mutate()} disabled={send.isPending||!text.trim()}>{send.isPending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Send className="mr-2 h-4 w-4"/>}Enviar resposta</Button></div>}</div></CardContent></Card>;
}

function Metric({label,value}:{label:string;value:number}){return <Card><CardContent className="pt-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></CardContent></Card>}
