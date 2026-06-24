import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useListSales, useCreateSale, useCancelSale,
  getListSalesQueryKey, useListProducts, getListProductsQueryKey,
  useListSellers,
} from "@workspace/api-client-react";
import type { SaleInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Search, Download, Ban, Upload, FileText, ChevronLeft, ChevronRight, Smartphone, Package, Eye, Printer, Paperclip } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ProductSearchCombobox } from "@/components/product-combobox";

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Tecno", "Infinix", "itel", "Huawei", "Oppo", "Vivo", "Realme", "Nokia", "Autre"];
const CAPACITIES = ["16 Go", "32 Go", "64 Go", "128 Go", "256 Go", "512 Go", "1 To"];
const COLORS = ["Noir", "Blanc", "Bleu", "Rouge", "Or", "Argent", "Vert", "Gris", "Rose", "Violet", "Autre"];
const PAGE_SIZE = 25;

interface ClientSuggestion { id: number; fullName: string; phone: string | null; }

function useClientAutocomplete() {
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q || q.length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sales/client-search?q=${encodeURIComponent(q)}`, { credentials: "include" });
        if (res.ok) setSuggestions(await res.json());
      } finally { setLoading(false); }
    }, 250);
  }, []);

  return { suggestions, loading, search, clear: () => setSuggestions([]) };
}

export default function Ventes() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [trocHasInvoice, setTrocHasInvoice] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [declFile, setDeclFile] = useState<File | null>(null);
  const [cniFile, setCniFile] = useState<File | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const declInputRef = useRef<HTMLInputElement>(null);
  const cniInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [trocAttachments, setTrocAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    const s = selectedSale as any;
    if (s && s.saleType === "troc" && s.trocProductId) {
      setLoadingAttachments(true);
      fetch(`/api/attachments/products/${s.trocProductId}`, { credentials: "include" })
        .then(r => (r.ok ? r.json() : []))
        .then((rows) => setTrocAttachments(Array.isArray(rows) ? rows : []))
        .catch(() => setTrocAttachments([]))
        .finally(() => setLoadingAttachments(false));
    } else {
      setTrocAttachments([]);
    }
  }, [selectedSale]);

  // Client autocomplete
  const nameAutocomplete = useClientAutocomplete();
  const phoneAutocomplete = useClientAutocomplete();
  const [showNameSugg, setShowNameSugg] = useState(false);
  const [showPhoneSugg, setShowPhoneSugg] = useState(false);

  const salesQueryParams = { search: search || undefined, productType: typeFilter !== "tous" ? typeFilter : undefined };
  const { data: allSales = [], isLoading } = useListSales(salesQueryParams, {
    query: { queryKey: getListSalesQueryKey(salesQueryParams) }
  });

  // Client-side pagination
  const total = allSales.length;
  const totalPages = Math.ceil(total / pageSize);
  const sales = allSales.slice((page - 1) * pageSize, page * pageSize);

  // Load all available products (en_stock + chez_partenaire)
  const { data: allProductsPage } = useListProducts({ limit: 1000 }, { query: { queryKey: getListProductsQueryKey({ limit: 1000 }) } });
  const availableProducts = (allProductsPage?.data ?? []).filter(p => p.status === "en_stock" || p.status === "chez_partenaire");

  const { data: sellers = [] } = useListSellers({ activeOnly: "true" });

  const createMutation = useCreateSale();
  const cancelMutation = useCancelSale();

  const form = useForm<SaleInput & { quantitySold?: number }>({
    defaultValues: { saleType: "normal", paymentMode: "Cash", amount: 0, clientName: "", clientPhone: "" },
  });

  const watchSaleType = form.watch("saleType");
  const watchProductId = form.watch("productId");
  const watchAmount = form.watch("amount");

  const selectedProductData = availableProducts.find(p => p.id === Number(watchProductId)) as any;
  const isAccessoire = selectedProductData?.productType === "accessoire";

  const trocPurchasePrice = watchSaleType === "troc" && selectedProductData?.sellingPrice && watchAmount
    ? Math.max(0, Number(selectedProductData.sellingPrice) - Number(watchAmount))
    : null;

  const handleSelectProduct = (p: any) => {
    if (!p) { form.setValue("productId", undefined as any); return; }
    form.setValue("productId", p.id);
    if (p.sellingPrice) form.setValue("amount", p.sellingPrice);
    // Auto-fill vendor name if product is at a partner
    if (p.status === "chez_partenaire" && p.partnerName) {
      form.setValue("vendorName", p.partnerName);
    }
    // Lock sale type to normal for accessories
    if (p.productType === "accessoire") {
      form.setValue("saleType", "normal");
    }
  };

  const resetForm = () => {
    form.reset({ saleType: "normal", paymentMode: "Cash", amount: 0, clientName: "", clientPhone: "" });
    setTrocHasInvoice(false);
    setInvoiceFile(null);
    setDeclFile(null);
    setCniFile(null);
    nameAutocomplete.clear();
    phoneAutocomplete.clear();
  };

  const uploadAttachment = async (productId: number, file: File, type: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    await fetch(`/api/attachments/products/${productId}`, { method: "POST", credentials: "include", body: fd });
  };

  const onSubmit = (data: SaleInput & { quantitySold?: number }) => {
    if (!data.productId) { form.setError("productId" as any, { message: "Veuillez sélectionner un produit" }); return; }
    if (!data.amount || data.amount <= 0) { form.setError("amount", { message: "Le montant doit être supérieur à 0" }); return; }
    if (data.saleType === "troc" && !data.trocProduct) { form.setError("trocProduct", { message: "Le nom de l'appareil est obligatoire" }); return; }
    if (data.saleType === "troc" && !data.trocBrand) { form.setError("trocBrand", { message: "La marque est obligatoire" }); return; }

    const payload = { ...data, trocHasInvoice: trocHasInvoice ? true : undefined };

    createMutation.mutate({ data: payload as SaleInput }, {
      onSuccess: async (saleData: any) => {
        // Upload troc attachments if any files selected
        if (data.saleType === "troc" && saleData?.trocProductId) {
          const uploads: Promise<void>[] = [];
          if (trocHasInvoice && invoiceFile) uploads.push(uploadAttachment(saleData.trocProductId, invoiceFile, "facture"));
          if (!trocHasInvoice && declFile) uploads.push(uploadAttachment(saleData.trocProductId, declFile, "declaration"));
          if (!trocHasInvoice && cniFile) uploads.push(uploadAttachment(saleData.trocProductId, cniFile, "cni"));
          if (uploads.length) await Promise.all(uploads);
        }
        toast.success("Vente enregistrée avec succès ✓");
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsAddOpen(false);
        resetForm();
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || "Erreur lors de l'enregistrement de la vente");
      },
    });
  };

  const handleCancelSale = (id: number) => {
    const reason = prompt("Motif de l'annulation ?");
    if (reason) {
      cancelMutation.mutate({ id, data: { reason } }, {
        onSuccess: () => {
          toast.success("Vente annulée avec succès");
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg || "Erreur lors de l'annulation");
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Historique des Ventes</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          {isAdmin && <Button variant="outline" onClick={() => window.open('/api/exports/sales', '_blank')} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>}
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Nouvelle Vente</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto bg-card border-border text-foreground">
              <DialogHeader><DialogTitle>Enregistrer une vente</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Product search */}
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium">Produit vendu *</Label>
                    <ProductSearchCombobox
                      products={availableProducts as any[]}
                      selectedId={watchProductId as number}
                      onSelect={handleSelectProduct}
                    />
                    {selectedProductData && (
                      <div className={`text-xs mt-1.5 rounded px-3 py-2 border ${selectedProductData.status === "chez_partenaire" ? "border-blue-500/40 bg-blue-500/5 text-blue-400" : "border-border bg-muted/30 text-muted-foreground"}`}>
                        {selectedProductData.status === "chez_partenaire" && <span className="font-semibold">🤝 Chez partenaire{selectedProductData.partnerName ? `: ${selectedProductData.partnerName}` : ""} · </span>}
                        {isAccessoire
                          ? <span><Package className="inline h-3 w-3 mr-1" />Accessoire · Qté disponible: <strong>{selectedProductData.quantity}</strong></span>
                          : `IMEI: ${selectedProductData.imei || "—"} · Couleur: ${selectedProductData.color || "—"}`}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="saleType" render={({ field }) => (
                      <FormItem><FormLabel>Type de vente</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); if (v !== "troc") { setTrocHasInvoice(false); setInvoiceFile(null); } }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Vente normale</SelectItem>
                            {!isAccessoire && <SelectItem value="troc">Troc</SelectItem>}
                          </SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="paymentMode" render={({ field }) => (
                      <FormItem><FormLabel>Mode de paiement</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="OM">Orange Money</SelectItem>
                            <SelectItem value="MOMO">Mobile Money</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                          </SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="amount"
                      rules={{ required: "Le montant est obligatoire", min: { value: 1, message: "Supérieur à 0" } }}
                      render={({ field }) => (
                        <FormItem><FormLabel>Montant final *</FormLabel>
                          <FormControl><Input type="number" min={0} {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                          <FormMessage /></FormItem>
                      )} />
                    {isAccessoire ? (
                      <FormField control={form.control} name={"quantitySold" as any}
                        rules={{ required: "La quantité est obligatoire", min: { value: 1, message: "Min 1" } }}
                        render={({ field }) => (
                          <FormItem><FormLabel>Quantité vendue *</FormLabel>
                            <FormControl><Input type="number" min={1} max={selectedProductData?.quantity ?? 1} {...field} value={field.value ?? 1} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                    ) : (
                      <FormField control={form.control} name="vendorId" render={({ field }) => (
                        <FormItem><FormLabel>Vendeur externe (Optionnel)</FormLabel>
                          <Select onValueChange={(val) => {
                            const id = Number(val);
                            field.onChange(id || undefined);
                            if (id) { const s = sellers.find(x => x.id === id); if (s) form.setValue("vendorName", s.name); }
                          }} value={field.value?.toString() ?? ""}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="0">Aucun</SelectItem>
                              {sellers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select><FormMessage /></FormItem>
                      )} />
                    )}
                  </div>

                  {isAccessoire && (
                    <FormField control={form.control} name="vendorId" render={({ field }) => (
                      <FormItem><FormLabel>Vendeur externe (Optionnel)</FormLabel>
                        <Select onValueChange={(val) => {
                          const id = Number(val);
                          field.onChange(id || undefined);
                          if (id) { const s = sellers.find(x => x.id === id); if (s) form.setValue("vendorName", s.name); }
                          else { form.setValue("vendorName", undefined as any); }
                        }} value={field.value?.toString() ?? ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="0">Aucun</SelectItem>
                            {sellers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                  )}

                  {selectedProductData?.status === "chez_partenaire" && selectedProductData?.partnerName && (
                    <div className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded px-3 py-2">
                      ✓ Vendeur auto-rempli : <strong>{selectedProductData.partnerName}</strong>
                    </div>
                  )}

                  {/* Client autocomplete */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <FormField control={form.control} name="clientName" render={({ field }) => (
                        <FormItem><FormLabel>Nom du client (Optionnel)</FormLabel>
                          <FormControl>
                            <Input {...field}
                              autoComplete="off"
                              onChange={e => { field.onChange(e); nameAutocomplete.search(e.target.value); setShowNameSugg(true); }}
                              onBlur={() => setTimeout(() => setShowNameSugg(false), 200)}
                              onFocus={() => { if (field.value && field.value.length >= 2) setShowNameSugg(true); }}
                            />
                          </FormControl><FormMessage /></FormItem>
                      )} />
                      {showNameSugg && nameAutocomplete.suggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-card shadow-xl">
                          {nameAutocomplete.suggestions.map(c => (
                            <div key={c.id} className="px-3 py-2 cursor-pointer hover:bg-muted/60 text-sm"
                              onMouseDown={() => {
                                form.setValue("clientName", c.fullName);
                                form.setValue("clientPhone", c.phone ?? "");
                                setShowNameSugg(false);
                                nameAutocomplete.clear();
                              }}>
                              <div className="font-medium">{c.fullName}</div>
                              {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <FormField control={form.control} name="clientPhone" render={({ field }) => (
                        <FormItem><FormLabel>Téléphone (Optionnel)</FormLabel>
                          <FormControl>
                            <Input {...field}
                              autoComplete="off"
                              onChange={e => { field.onChange(e); phoneAutocomplete.search(e.target.value); setShowPhoneSugg(true); }}
                              onBlur={() => setTimeout(() => setShowPhoneSugg(false), 200)}
                            />
                          </FormControl><FormMessage /></FormItem>
                      )} />
                      {showPhoneSugg && phoneAutocomplete.suggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-card shadow-xl">
                          {phoneAutocomplete.suggestions.map(c => (
                            <div key={c.id} className="px-3 py-2 cursor-pointer hover:bg-muted/60 text-sm"
                              onMouseDown={() => {
                                form.setValue("clientName", c.fullName);
                                form.setValue("clientPhone", c.phone ?? "");
                                setShowPhoneSugg(false);
                                phoneAutocomplete.clear();
                              }}>
                              <div className="font-medium">{c.fullName}</div>
                              {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Troc section (phones only) */}
                  {watchSaleType === "troc" && !isAccessoire && (
                    <div className="border border-primary/30 bg-primary/5 p-4 rounded-lg space-y-4">
                      <h4 className="font-semibold text-primary">Appareil reçu en Troc</h4>
                      {trocPurchasePrice !== null && (
                        <div className="text-sm bg-green-500/10 border border-green-500/20 text-green-400 rounded px-3 py-2">
                          💡 Prix d'achat calculé : <strong>{formatFCFA(trocPurchasePrice)}</strong>
                          <span className="text-xs block text-green-500/70 mt-0.5">PV ({formatFCFA(selectedProductData?.sellingPrice)}) − Somme reçue ({formatFCFA(watchAmount)})</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="trocProduct"
                          rules={{ required: watchSaleType === "troc" ? "Obligatoire" : false }}
                          render={({ field }) => (
                            <FormItem><FormLabel>Nom de l'appareil *</FormLabel><FormControl><Input {...field} placeholder="Ex: iPhone 12" /></FormControl><FormMessage /></FormItem>
                          )} />
                        <FormField control={form.control} name="trocBrand"
                          rules={{ required: watchSaleType === "troc" ? "Obligatoire" : false }}
                          render={({ field }) => (
                            <FormItem><FormLabel>Marque *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                                <SelectContent>{BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                        <FormField control={form.control} name="trocImei" render={({ field }) => (
                          <FormItem><FormLabel>IMEI (Optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="trocCapacity" render={({ field }) => (
                          <FormItem><FormLabel>Capacité</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                              <SelectContent>{CAPACITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name={"trocColor" as keyof SaleInput} render={({ field }) => (
                          <FormItem><FormLabel>Couleur</FormLabel>
                            <Select onValueChange={field.onChange} value={(field.value as string) ?? ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                              <SelectContent>{COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                      </div>

                      {/* Invoice */}
                      <div className="border-t border-primary/20 pt-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox id="troc-invoice" checked={trocHasInvoice}
                            onCheckedChange={(v) => { setTrocHasInvoice(!!v); if (!v) setInvoiceFile(null); }} />
                          <Label htmlFor="troc-invoice" className="cursor-pointer text-sm">Le client a remis sa facture ?</Label>
                        </div>
                        {trocHasInvoice ? (
                          <div className="space-y-2">
                            <input ref={invoiceInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) { setInvoiceFile(f); toast.success(`Facture sélectionnée : ${f.name}`); } }} />
                            <Button type="button" variant="outline" size="sm" onClick={() => invoiceInputRef.current?.click()}>
                              <Upload className="h-4 w-4 mr-2" /> Sélectionner la facture
                            </Button>
                            {invoiceFile && <div className="flex items-center gap-1 text-xs text-green-400"><FileText className="h-3.5 w-3.5" />{invoiceFile.name}</div>}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Documents alternatifs (facultatif) :</p>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input ref={declInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) { setDeclFile(f); toast.success(`Déclaration sélectionnée : ${f.name}`); } }} />
                                <Button type="button" variant="outline" size="sm" onClick={() => declInputRef.current?.click()}>
                                  <Upload className="h-4 w-4 mr-1" /> Déclaration sur l'honneur
                                </Button>
                                {declFile && <span className="text-xs text-green-400 truncate max-w-[120px]"><FileText className="h-3 w-3 inline mr-0.5" />{declFile.name}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <input ref={cniInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) { setCniFile(f); toast.success(`CNI sélectionnée : ${f.name}`); } }} />
                                <Button type="button" variant="outline" size="sm" onClick={() => cniInputRef.current?.click()}>
                                  <Upload className="h-4 w-4 mr-1" /> CNI
                                </Button>
                                {cniFile && <span className="text-xs text-green-400 truncate max-w-[120px]"><FileText className="h-3 w-3 inline mr-0.5" />{cniFile.name}</span>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full mt-6" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Valider la Vente"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Recherche (Client, Produit, IMEI...)" className="pl-9 bg-background border-border"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Tabs value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }} className="shrink-0">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="tous">Tous</TabsTrigger>
            <TabsTrigger value="téléphone"><Smartphone className="h-3.5 w-3.5 mr-1" />Tél.</TabsTrigger>
            <TabsTrigger value="accessoire"><Package className="h-3.5 w-3.5 mr-1" />Acc.</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sales table */}
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Date & Heure</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Vendeur</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : sales.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Aucune vente trouvée.</TableCell></TableRow>
            ) : (
              sales.map((sale) => {
                const s = sale as any;
                const isPhone = !s.product?.productType || s.product?.productType === "téléphone";
                return (
                  <TableRow key={sale.id}
                    className={`border-border cursor-pointer hover:bg-muted/40 ${sale.cancelled ? "opacity-50" : ""}`}
                    onClick={() => setSelectedSale(sale)}>
                    <TableCell className="text-sm">
                      {formatDateFr(sale.saleDate)}<br />
                      <span className="text-muted-foreground text-xs">{sale.saleTime.substring(0, 5)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isPhone ? <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Package className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                        <div>
                          <div className="font-medium">{sale.product?.product || "-"}{!isPhone && s.quantitySold > 1 && <span className="text-muted-foreground text-xs ml-1">x{s.quantitySold}</span>}</div>
                          <div className="text-xs text-muted-foreground font-mono">{sale.product?.productId} {sale.product?.imei ? `· ${sale.product.imei}` : ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{sale.clientName || "-"}</div>
                      <div className="text-xs text-muted-foreground">{sale.clientPhone}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sale.vendorName || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className="bg-background">{sale.paymentMode}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={sale.saleType === "troc" ? "bg-primary/20 text-primary border-primary/20" : ""}>
                        {sale.saleType === "normal" ? "Normal" : "Troc"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatFCFA(sale.amount)}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {!sale.cancelled ? (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleCancelSale(sale.id)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Annulée</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{total} vente{total !== 1 ? "s" : ""} · page {page}/{totalPages}</p>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-24 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Sale Detail Sheet */}
      <Sheet open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <SheetContent className="bg-card border-border text-foreground w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6 border-b border-border pb-4">
            <SheetTitle className="text-xl font-bold flex items-center justify-between">
              Détail de la vente
              <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-1 rounded">#{String(selectedSale?.id ?? "").padStart(5, "0")}</span>
            </SheetTitle>
          </SheetHeader>
          {selectedSale && (() => {
            const s = selectedSale as any;
            const paymentLabel: Record<string, string> = { OM: "Orange Money", MOMO: "Mobile Money", Cash: "Cash / Espèces" };
            const isPhone = !s.product?.productType || s.product?.productType === "téléphone";
            return (
              <div className="space-y-5">
                {s.cancelled && <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-2 text-sm font-medium">❌ Cette vente a été annulée</div>}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="font-semibold text-sm">{formatDateFr(s.saleDate)}</p>
                    <p className="text-xs text-muted-foreground">{(s.saleTime || "").substring(0, 5)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Montant</p>
                    <p className="font-bold text-primary text-lg">{formatFCFA(s.amount)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Mode de paiement</p>
                    <p className="font-semibold text-sm">{paymentLabel[s.paymentMode] || s.paymentMode}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Type</p>
                    <Badge className={s.saleType === "troc" ? "bg-primary/20 text-primary" : "bg-green-500/20 text-green-400"}>
                      {s.saleType === "troc" ? "🔄 Troc" : "✅ Normal"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Produit</h4>
                  <div className="bg-muted/30 rounded-lg p-3 border border-border space-y-1">
                    <div className="flex items-center gap-2">
                      {isPhone ? <Smartphone className="h-4 w-4 text-muted-foreground" /> : <Package className="h-4 w-4 text-blue-400" />}
                      <span className="font-bold">{s.product?.product || "—"}</span>
                      {s.product?.brand && <span className="text-muted-foreground text-sm">{s.product.brand}</span>}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{s.product?.productId}{s.product?.imei ? ` · IMEI: ${s.product.imei}` : ""}</p>
                    {s.product?.capacity && <p className="text-xs text-muted-foreground">{s.product.capacity}{s.product?.color ? ` · ${s.product.color}` : ""}</p>}
                    {s.quantitySold > 1 && <p className="text-xs text-muted-foreground">Quantité vendue : <strong>{s.quantitySold}</strong></p>}
                  </div>
                </div>

                {(s.clientName || s.clientPhone) && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Client</h4>
                    <div className="bg-muted/30 rounded-lg p-3 border border-border">
                      {s.clientName && <p className="font-medium">{s.clientName}</p>}
                      {s.clientPhone && <p className="text-sm text-muted-foreground">{s.clientPhone}</p>}
                    </div>
                  </div>
                )}

                {s.vendorName && (
                  <div className="bg-muted/30 rounded-lg p-3 border border-border">
                    <p className="text-xs text-muted-foreground mb-1">Vendeur</p>
                    <p className="font-medium text-sm">{s.vendorName}</p>
                  </div>
                )}

                {s.saleType === "troc" && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Appareil reçu en troc</h4>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
                      <p className="font-medium">{s.trocProduct} {s.trocBrand ? `(${s.trocBrand})` : ""}</p>
                      {s.trocImei && <p className="text-xs font-mono text-muted-foreground">IMEI: {s.trocImei}</p>}
                      {s.trocCapacity && <p className="text-xs text-muted-foreground">{s.trocCapacity}{s.trocColor ? ` · ${s.trocColor}` : ""}</p>}
                    </div>
                  </div>
                )}

                {s.saleType === "troc" && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pièces jointes</h4>
                    {loadingAttachments ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>
                    ) : trocAttachments.length === 0 ? (
                      <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-3">Aucune pièce jointe pour ce troc.</p>
                    ) : (
                      <div className="space-y-2">
                        {trocAttachments.map((a: any) => {
                          const typeLabel: Record<string, string> = { facture: "Facture", declaration: "Déclaration sur l'honneur", cni: "CNI" };
                          return (
                            <div key={a.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg p-3 border border-border">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{typeLabel[a.type] || a.type}</p>
                                  <p className="text-xs text-muted-foreground truncate">{a.filename}</p>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button variant="outline" size="sm" title="Visualiser"
                                  onClick={() => window.open(`/api/attachments/${a.id}/download?inline=1`, "_blank")}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" title="Télécharger"
                                  onClick={() => window.open(`/api/attachments/${a.id}/download`, "_blank")}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-border space-y-3">
                  <Button className="w-full" variant="outline"
                    onClick={() => window.open(`/api/sales/${s.id}/invoice`, "_blank")}>
                    <Printer className="h-4 w-4 mr-2" /> Voir & Télécharger la facture
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
