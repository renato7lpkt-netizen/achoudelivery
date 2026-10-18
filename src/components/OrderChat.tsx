import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WHO: Record<string, string> = { cliente: "Cliente", loja: "Loja", entregador: "Entregador" };

export function OrderChat({ orderId, role, defaultOpen = false }: { orderId: string; role: "cliente" | "loja" | "entregador"; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const key = ["chat", orderId];
  const end = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: key, enabled: open,
    queryFn: async () => (await supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at")).data ?? [],
  });
  useEffect(() => {
    if (!open) return;
    const ch = supabase.channel(`chat-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` }, () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim(); if (!body) return;
    const { error } = await supabase.from("order_messages").insert({ order_id: orderId, sender_role: role, body });
    if (error) { toast.error("Não foi possível enviar"); return; }
    setText(""); qc.invalidateQueries({ queryKey: key });
  }

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><MessageCircle className="mr-1 h-4 w-4" />Chat</Button>;
  return (
    <div className="mt-3 w-full rounded-2xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-1 font-bold"><MessageCircle className="h-4 w-4 text-primary" />Chat do pedido</p>
        {!defaultOpen && <button className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>Fechar</button>}</div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
        {data?.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.sender_role === role ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
            <p className="text-[10px] font-semibold opacity-80">{WHO[m.sender_role]} · {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            {m.body}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="mt-2 flex gap-2">
        <Input value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem…" />
        <Button type="submit" size="icon" aria-label="Enviar"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
