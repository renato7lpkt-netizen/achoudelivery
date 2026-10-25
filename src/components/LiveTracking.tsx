import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
