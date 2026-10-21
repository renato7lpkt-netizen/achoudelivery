import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { courierDocUrl, pendingCourierPayouts, pendingPayouts, sendCourierPayout, sendPayout } from "@/lib/payouts.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl } from "@/lib/market";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — AchouDelivery" }, { name: "description", content: "Aprovação de entregadores do AchouDelivery." }, { property: "og:title", content: "Administração — AchouDelivery" }, { property: "og:description", content: "Área administrativa." }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

const LABEL: Record<string, string> = { em_analise: "Em análise", aprovado: "Aprovado", recusado: "Recusado" };

function Admin() {
  const { user } = Route.useRouteContext();
  const { data: roles, isLoading } = useRoles(user.id);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-couriers"],
    enabled: !!roles?.isAdmin,
    queryFn: async () => (await supabase.from("couriers").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  if (isLoading) return <main className="p-16 text-center text-muted-foreground">Carregando…</main>;
  if (!roles?.isAdmin) return <main className="p-16 text-center text-muted-foreground">Acesso restrito.</main>;

  async function decide(id: string, status: "aprovado" | "recusado") {
    const reason = status === "recusado" ? window.prompt("Motivo da recusa:") : null;
    if (status === "recusado" && !reason) return;
    const { error } = await supabase.from("couriers").update({ approval_status: status, reject_reason: reason }).eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    qc.invalidateQueries({ queryKey: ["admin-couriers"] }); toast.success(status === "aprovado" ? "Entregador aprovado" : "Entregador recusado");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">Administração</h1>
      <Tabs defaultValue="entregadores" className="mt-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="entregadores">Entregadores</TabsTrigger>
          <TabsTrigger value="repasse-lojas">Repasse lojas</TabsTrigger>
          <TabsTrigger value="repasse-entregadores">Repasse entregadores</TabsTrigger>
        </TabsList>
        <TabsContent value="entregadores">
      <p className="mt-2 text-muted-foreground">Confira nome, CPF e placa antes de aprovar.</p>
      <div className="mt-4 space-y-3">
        {data?.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <div className="flex-1">
              <p className="font-bold">{c.name}</p>
              <p className="text-sm text-muted-foreground">CPF {c.cpf} · {c.phone} · {c.vehicle}{c.plate ? ` · ${c.plate}` : ""}</p>
              {c.doc_path ? <DocLink path={c.doc_path} /> : <p className="text-xs text-muted-foreground">Sem documento enviado</p>}
              {c.reject_reason && <p className="text-xs text-destructive">Motivo: {c.reject_reason}</p>}
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">{LABEL[c.approval_status] ?? c.approval_status}</span>
            {c.approval_status !== "aprovado" && <Button size="sm" onClick={() => decide(c.id, "aprovado")}>Aprovar</Button>}
            {c.approval_status !== "recusado" && <Button size="sm" variant="outline" onClick={() => decide(c.id, "recusado")}>Recusar</Button>}
          </div>
        ))}
        {data?.length === 0 && <p className="text-muted-foreground">Nenhum entregador cadastrado.</p>}
      </div>
        </TabsContent>
        <TabsContent value="repasse-lojas"><Payouts /></TabsContent>
        <TabsContent value="repasse-entregadores"><CourierPayouts /></TabsContent>
      </Tabs>
    </main>
  );
}

function DocLink({ path }: { path: string }) {
  const get = useServerFn(courierDocUrl);
  return <button className="text-xs font-semibold text-primary underline" onClick={async () => {
    try { const { url } = await get({ data: { path } }); window.open(url, "_blank"); } catch { toast.error("Não foi possível abrir"); }
  }}>Ver documento</button>;
}

function Payouts() {
  const list = useServerFn(pendingPayouts);
  const send = useServerFn(sendPayout);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pending-payouts"], queryFn: () => list() });
  async function pay(storeId: string, name: string, amount: number) {
    if (!window.confirm(`Enviar Pix de ${brl(amount)} para ${name}?`)) return;
    try { await send({ data: { storeId } }); toast.success("Pix enviado"); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no Pix"); }
    qc.invalidateQueries({ queryKey: ["pending-payouts"] });
  }
  return (
    <section className="mt-4">
      <h2 className="text-2xl font-extrabold">Repasses às lojas</h2>
      <p className="text-muted-foreground">Vendas entregues e pagas ainda não repassadas (já descontadas a comissão, a taxa do Asaas e a entrega feita por entregador da plataforma).</p>
      <div className="mt-4 space-y-3">
        {data?.length === 0 && <p className="text-muted-foreground">Nada pendente.</p>}
        {data?.map((p) => (
          <div key={p.storeId} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <div className="flex-1"><p className="font-bold">{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.count} pedidos · Pix: {p.pixKey ? `${p.pixType} ${p.pixKey}` : "não cadastrado"}</p></div>
            <span className="text-lg font-bold">{brl(p.amount)}</span>
            <Button size="sm" disabled={!p.pixKey} onClick={() => pay(p.storeId, p.name, p.amount)}>Pagar via Pix</Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CourierPayouts() {
  const list = useServerFn(pendingCourierPayouts);
  const send = useServerFn(sendCourierPayout);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pending-courier-payouts"], queryFn: () => list() });
  const total = (data ?? []).reduce((t, c) => t + c.amount, 0);
  async function pay(courierId: string, name: string, amount: number) {
    if (!window.confirm(`Enviar Pix de ${brl(amount)} para ${name}?`)) return;
    try { await send({ data: { courierId } }); toast.success("Pix enviado"); } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no Pix"); }
    qc.invalidateQueries({ queryKey: ["pending-courier-payouts"] });
  }
  return (
    <section className="mt-4">
      <h2 className="text-2xl font-extrabold">Repasse aos entregadores</h2>
      <p className="text-muted-foreground">Taxas de entrega de pedidos concluídos (com PIN) e pagos, feitos por entregadores da plataforma. Juntar a semana num Pix só economiza tarifa do Asaas.</p>
      {data && data.length > 0 && <p className="mt-3 font-semibold">Total a pagar: {brl(total)}</p>}
      <div className="mt-4 space-y-3">
        {data?.length === 0 && <p className="text-muted-foreground">Nada pendente.</p>}
        {data?.map((c) => (
          <div key={c.courierId} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <div className="flex-1"><p className="font-bold">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.count} entrega{c.count > 1 ? "s" : ""} · {c.phone} · Pix: {c.pixKey ? `${c.pixType ?? "tipo não informado"} ${c.pixKey}` : "não cadastrado"}</p></div>
            <span className="text-lg font-bold">{brl(c.amount)}</span>
            <Button size="sm" disabled={!c.pixKey || !c.pixType} onClick={() => pay(c.courierId, c.name, c.amount)}>Pagar via Pix</Button>
          </div>
        ))}
      </div>
    </section>
  );
}
