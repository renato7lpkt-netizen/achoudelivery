import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { suggestAddress, type AddressSuggestion } from "@/lib/places.functions";
import type { SearchArea } from "@/lib/address";

/**
 * Address field with TomTom suggestions as the customer types (server fn, free monthly tier).
 * Suggestions are only shown, never stored; picking one hands its text to `onPick`, which places the pin.
 * Without a TomTom key the list stays empty and the field works as a plain input.
 */
export function AddressInput({ id, value, onChange, onPick, onBlur, area = {}, placeholder = "Rua, número e bairro", required }: {
  id?: string; value: string; onChange: (v: string) => void; onPick: (label: string) => void; onBlur?: () => void; area?: SearchArea; placeholder?: string; required?: boolean;
}) {
  const areaRef = useRef(area);
  areaRef.current = area;
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const typed = useRef(false); // prefilled values (saved address, GPS) must not pop the list
  const seq = useRef(0);
  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 4) { setItems([]); setOpen(false); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await suggestAddress({ data: { q, ...areaRef.current } }).catch(() => []);
      if (n !== seq.current) return; // a newer keystroke already asked
      setItems(r); setOpen(r.length > 0);
    }, 350);
    return () => clearTimeout(t);
  }, [value]);
  function pick(s: AddressSuggestion) {
    typed.current = false; seq.current++;
    setOpen(false); setItems([]);
    onChange(s.label); onPick(s.label);
  }
  return (
    <div className="relative">
      <Input id={id} required={required} value={value} placeholder={placeholder} autoComplete="street-address"
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => { setOpen(false); onBlur?.(); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      {open && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border bg-card shadow-lg">
          {items.map((s) => (
            <li key={s.label}>
              {/* mousedown keeps the input focused, so its blur doesn't search the half-typed text first */}
              <button type="button" role="option" aria-selected={false} className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{s.label}
              </button>
            </li>
          ))}
          <li className="border-t px-3 py-1 text-right text-[10px] text-muted-foreground">Sugestões © TomTom</li>
        </ul>
      )}
    </div>
  );
}
