import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { savePushToken } from "@/lib/push.functions";

const KEY = "achadao-push-ok";

export function PushButton({ label = "Ativar avisos no celular" }: { label?: string }) {
  const [done, setDone] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDone(typeof Notification !== "undefined" && Notification.permission === "granted" && localStorage.getItem(KEY) === "1");
  }, []);
  if (done) return null;
  async function go() {
    setBusy(true);
    try {
      const { enablePush } = await import("@/lib/push");
      const r = await enablePush();
      if (r.status === "registered") {
        await savePushToken({ data: { token: r.token } });
        localStorage.setItem(KEY, "1");
        setDone(true);
        toast.success("Pronto! Você vai receber avisos mesmo com o app fechado.");
      } else if (r.status === "open-in-new-tab") toast.error("Abra o AchouDelivery numa aba própria (ou no site achadao.life) para ativar os avisos.");
      else if (r.status === "denied") toast.error("Os avisos estão bloqueados. Libere as notificações nas configurações do site no navegador.");
      else if (r.status === "unsupported") toast.error("Este navegador não aceita avisos. No iPhone, instale o app na tela inicial primeiro.");
      else toast.error("Avisos ainda não configurados.");
    } catch (e) {
      toast.error("Não foi possível ativar os avisos.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }
  return <Button size="sm" variant="secondary" disabled={busy} onClick={go}><BellRing className="mr-1 h-4 w-4" />{label}</Button>;
}
