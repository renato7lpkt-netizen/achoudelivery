import { useEffect, useState } from "react";
import { Bike, Percent, Store } from "lucide-react";

const SLIDES = [
  { icon: Percent, title: "Promoções do dia", text: "Lojas com preços especiais em dias fixos da semana. Fique de olho nas etiquetas de desconto!" },
  { icon: Bike, title: "Entrega grátis até 3 km", text: "Lojas com entregador próprio não cobram frete perto de você." },
  { icon: Store, title: "Venda no AchouDelivery", text: "Tem uma loja em Sete Lagoas? Cadastre-se e comece a vender hoje." },
];

export function Banners() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const s = SLIDES[i]!;
  const Icon = s.icon;
  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-hero p-5 text-primary-foreground shadow-pop">
      <div key={i} className="flex animate-in fade-in items-center gap-4 duration-500">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-background/15"><Icon className="h-6 w-6" /></span>
        <div><p className="font-display text-xl font-extrabold">{s.title}</p><p className="text-sm opacity-90">{s.text}</p></div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {SLIDES.map((_, k) => (
          <button key={k} aria-label={`Banner ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-primary-foreground" : "w-1.5 bg-primary-foreground/40"}`} />
        ))}
      </div>
    </div>
  );
}
