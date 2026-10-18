import { useEffect, useRef, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Mapa simples (OpenStreetMap) com a posição atual do entregador. */
export function LiveMap({ lat, lng, at }: { lat: number; lng: number; at: string | null }) {
  const d = 0.008;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
      <p className="flex items-center gap-2 p-3 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" />Onde está sua entrega
        {at && <span className="ml-auto text-xs font-normal text-muted-foreground">atualizado {new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}</p>
      <iframe title="Mapa da entrega" src={src} className="h-64 w-full border-0" loading="lazy" />
    </div>
  );
}

/** Envia a localização do aparelho a cada ~12 s enquanto ligado. */
export function ShareLocation({ orderId }: { orderId: string }) {
  const [on, setOn] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    if (!on) return;
    if (!navigator.geolocation) { toast.error("Seu aparelho não permite localização"); setOn(false); return; }
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - last.current < 12000) return;
        last.current = Date.now();
        await supabase.rpc("update_courier_location", { _order: orderId, _lat: p.coords.latitude, _lng: p.coords.longitude });
      },
      () => { toast.error("Permita o acesso à localização"); setOn(false); },
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on, orderId]);
  return (
    <Button size="sm" variant={on ? "default" : "outline"} onClick={() => setOn(!on)}>
      <Radio className="mr-1 h-4 w-4" />{on ? "Enviando localização…" : "Compartilhar localização"}
    </Button>
  );
}
