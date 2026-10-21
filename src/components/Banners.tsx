import { useEffect, useRef, useState } from "react";
import { Bike, Percent, Store } from "lucide-react";
import { FREE_KM_OWN } from "@/lib/market";

// Each slide has its own solid color so it doesn't blend into the orange hero above it.
const SLIDES = [
  { icon: Percent, title: "Promoções do dia", text: "Preços especiais em dias fixos da semana. Fique de olho nas etiquetas de desconto!", tone: "bg-primary text-primary-foreground" },
  { icon: Bike, title: `Entrega grátis até ${FREE_KM_OWN} km`, text: "Lojas com entregador próprio não cobram frete perto de você.", tone: "bg-success text-success-foreground" },
  { icon: Store, title: "Venda no AchouDelivery", text: "Tem uma loja em Sete Lagoas? Cadastre-se e comece a vender hoje.", tone: "bg-secondary text-secondary-foreground" },
];

/** Swipeable banner strip (scroll-snap) that also auto-advances every 5 s. */
export function Banners() {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);

  const go = (k: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const t = setInterval(() => go((i + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [i]);

  return (
    <div className="mb-6">
      <div
        ref={track}
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none]"
      >
        {SLIDES.map(({ icon: Icon, title, text, tone }) => (
          <div key={title} className={`flex w-full shrink-0 snap-center items-center gap-4 p-5 ${tone}`}>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-background/20"><Icon className="h-7 w-7" /></span>
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold leading-tight">{title}</p>
              <p className="mt-1 text-sm font-medium">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {SLIDES.map((s, k) => (
          <button key={s.title} aria-label={`Banner ${k + 1}`} onClick={() => go(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-primary" : "w-1.5 bg-primary/30"}`} />
        ))}
      </div>
    </div>
  );
}
