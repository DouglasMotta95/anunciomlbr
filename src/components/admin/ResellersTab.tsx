import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDate } from "@/lib/format";
import { adminCreateReseller, adminListResellers } from "@/lib/seller-growth.functions";

export function ResellersTab() {
  const list = useServerFn(adminListResellers);
  const create = useServerFn(adminCreateReseller);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [discount, setDiscount] = useState("20");
  const [wallet, setWallet] = useState("0");
  const { data: resellers = [], isLoading } = useQuery({ queryKey: ["admin-resellers"], queryFn: () => list() });
  const mutation = useMutation({
    mutationFn: () => create({ data: { name: name.trim(), email: email.trim(), discount_percent: Number(discount), wallet_cents: Math.round(Number(wallet.replace(",", ".")) * 100) } }),
    onSuccess: () => { setName(""); setEmail(""); setWallet("0"); qc.invalidateQueries({ queryKey: ["admin-resellers"] }); toast.success("Revendedor criado"); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao criar revendedor"),
  });

  return <div className="space-y-4">
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4 text-primary"/> Novo revendedor</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nome do parceiro" /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="parceiro@email.com" /></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Desconto (%)</Label><Input value={discount} onChange={(e)=>setDiscount(e.target.value)} /></div><div><Label>Saldo inicial (R$)</Label><Input value={wallet} onChange={(e)=>setWallet(e.target.value)} /></div></div>
          <Button className="w-full" disabled={mutation.isPending || name.trim().length < 2 || !email.includes("@")} onClick={()=>mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Criar revendedor</Button>
          <p className="text-xs text-muted-foreground">O revendedor fica isolado do painel administrativo. Desconto e saldo servem como base comercial para venda de licenças.</p>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader><CardTitle className="text-base">Rede de revendedores</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : resellers.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum revendedor cadastrado.</p> : <Table><TableHeader><TableRow><TableHead>Revendedor</TableHead><TableHead>Status</TableHead><TableHead>Desconto</TableHead><TableHead>Saldo</TableHead><TableHead>Vendas</TableHead><TableHead>Comissão</TableHead><TableHead>Desde</TableHead></TableRow></TableHeader><TableBody>{resellers.map((r:any)=><TableRow key={r.id}><TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell><TableCell><Badge variant={r.status === "active" ? "default" : "outline"}>{r.status === "active" ? "Ativo" : r.status}</Badge></TableCell><TableCell>{Number(r.discount_percent)}%</TableCell><TableCell>{formatBRL(r.wallet_cents)}</TableCell><TableCell>{formatBRL(r.total_sales_cents)}</TableCell><TableCell>{formatBRL(r.total_commission_cents)}</TableCell><TableCell>{formatDate(r.created_at)}</TableCell></TableRow>)}</TableBody></Table>}
        </CardContent>
      </Card>
    </div>
  </div>;
}
