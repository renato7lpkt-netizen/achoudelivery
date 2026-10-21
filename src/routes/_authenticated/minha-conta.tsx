import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LocateFixed, Loader2, Receipt, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { geocode } from "@/lib/market";
import { locateMe } from "@/lib/locate";
import { isValidCpf, maskCpf, maskPhone } from "@/lib/br";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({ meta: [{ title: "Minha conta — AchouDelivery" }, { name: "description", content: "Seus dados e endereço de entrega." }, { property: "og:title", content: "Minha conta — AchouDelivery" }, { property: "og:description", content: "Gerencie seus dados no AchouDelivery." }] }),
  component: MyAccount,
});

function MyAccount() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: p } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("address, lat, lng, full_name, phone, cpf").eq("id", user.id).maybeSingle()).data,
  });
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p) return;
    setAddress(p.address ?? "");
    setName(p.full_name ?? ""); setPhone(p.phone ?? ""); setCpf(maskCpf(p.cpf ?? ""));
    if (p.lat != null && p.lng != null) setPos({ lat: p.lat, lng: p.lng });
  }, [p]);

  async function locateGps() {
    setLocating(true);
    try {
      const here = await locateMe();
      setPos({ lat: here.lat, lng: here.lng });
      if (here.address) setAddress(here.address);
      toast.success(here.address ? "Localização encontrada. Confira o número e salve." : "Localização encontrada. Digite rua e número e salve.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não conseguimos sua localização.", { duration: 9000 });
    } finally { setLocating(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (cpf && !isValidCpf(cpf)) { toast.error("CPF inválido. Confira os 11 números."); return; }
    setBusy(true);
    try {
      let geo = pos;
      if (address && !geo) geo = await geocode(address).catch(() => null);
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: name.trim() || null,
        phone: phone || null,
        cpf: cpf.replace(/\D/g, "") || null,
        address: address || null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
      toast.success("Dados salvos! Eles já valem para o próximo pedido.");
    } catch {
      toast.error("Não foi possível salvar. Tente de novo.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Minha conta</h1>
      <p className="mt-1 text-muted-foreground">{user.email}</p>

      <Button asChild variant="outline" className="mt-4">
        <Link to="/meus-pedidos"><Receipt className="mr-1 h-4 w-4" />Ver meus pedidos</Link>
      </Button>

      <form onSubmit={save} className="mt-8 space-y-5 rounded-2xl border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Celular</Label><Input inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(31) 9…" /></div>
          <div><Label>CPF</Label><Input inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" /></div>
        </div>
        <div className="space-y-2">
          <Label>Endereço de entrega</Label>
          <Input value={address} onChange={(e) => { setAddress(e.target.value); setPos(null); }} placeholder="Rua, número, bairro ou CEP" />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={locateGps} disabled={locating}>
              <LocateFixed className="mr-1 h-4 w-4" />Usar minha localização
            </Button>
            {locating && <Loader2 className="h-5 w-5 animate-spin" />}
            {pos && <span className="text-xs text-muted-foreground">Localização salva para cálculo do frete</span>}
          </div>
          <p className="text-xs text-muted-foreground">Com o endereço salvo, o frete é calculado automaticamente no checkout.</p>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Salvar
        </Button>
      </form>
    </main>
  );
}
