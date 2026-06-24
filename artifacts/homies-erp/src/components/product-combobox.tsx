import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Smartphone, Package } from "lucide-react";
import { formatFCFA } from "@/lib/format";

export function ProductSearchCombobox({
  products,
  selectedId,
  onSelect,
  placeholder = "Chercher un produit (ID, nom, IMEI...)",
}: {
  products: any[];
  selectedId?: number;
  onSelect: (p: any) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = products.find(p => p.id === selectedId);

  const filtered = products.filter(p => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.product?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.productId?.toLowerCase().includes(q) ||
      p.imei?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder={selected ? `${selected.productId} — ${selected.product} ${selected.brand || ""}`.trim() : placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {selected && !query && (
          <button type="button" className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground text-xs"
            onClick={() => { onSelect(null); setQuery(""); }}>✕</button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground text-center">Aucun produit trouvé</div>
          ) : (
            filtered.map(p => {
              const isPhone = !p.productType || p.productType === "téléphone";
              return (
                <div key={p.id}
                  className="px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
                  onMouseDown={(e) => { e.preventDefault(); onSelect(p); setQuery(""); setOpen(false); }}>
                  <div className="flex items-center gap-2">
                    {isPhone ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Package className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                    <span className="font-mono text-xs text-muted-foreground">{p.productId}</span>
                    <span className="font-medium text-sm">{p.product}</span>
                    {p.brand && <span className="text-muted-foreground text-xs">{p.brand}</span>}
                    {!isPhone && p.quantity > 0 && <Badge variant="outline" className="text-[10px] ml-auto">Qté: {p.quantity}</Badge>}
                    {p.status === "chez_partenaire" && <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-400/30 ml-auto">🤝 Partenaire</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-5">
                    <span className="text-primary font-semibold text-xs">{formatFCFA(p.sellingPrice)}</span>
                    {p.imei && <span className="text-muted-foreground text-xs font-mono">IMEI: {p.imei}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
