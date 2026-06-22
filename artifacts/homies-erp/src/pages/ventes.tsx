import { useState, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Search, Download, Ban, Upload, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Tecno", "Infinix", "itel", "Huawei", "Oppo", "Vivo", "Realme", "Nokia", "Autre"];
const CAPACITIES = ["16 Go", "32 Go", "64 Go", "128 Go", "256 Go", "512 Go", "1 To"];
const COLORS = ["Noir", "Blanc", "Bleu", "Rouge", "Or", "Argent", "Vert", "Gris", "Rose", "Violet", "Autre"];

export default function Ventes() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [trocHasInvoice, setTrocHasInvoice] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const { data: sales = [], isLoading } = useListSales(
    { search: search || undefined },
    { query: { queryKey: getListSalesQueryKey({ search: search || undefined }) } }
  );

  // Load all non-vendu products (en_stock + chez_partenaire)
  const { data: allProductsPage } = useListProducts(
    { limit: 1000 },
    { query: { queryKey: getListProductsQueryKey({ limit: 1000 }) } }
  );
  const availableProducts = (allProductsPage?.data ?? []).filter(
    p => p.status === "en_stock" || p.status === "chez_partenaire"
  );

  const { data: sellers = [] } = useListSellers({ activeOnly: "true" });

  const createMutation = useCreateSale();
  const cancelMutation = useCancelSale();

  const form = useForm<SaleInput>({
    defaultValues: {
      saleType: "normal",
      paymentMode: "Cash",
      amount: 0,
      clientName: "",
      clientPhone: "",
    },
  });

  const watchSaleType = form.watch("saleType");
  const watchProductId = form.watch("productId");
  const watchAmount = form.watch("amount");

  const selectedProductData = availableProducts.find(p => p.id === Number(watchProductId));

  // Troc: calculated purchase price = product selling price - amount paid
  const trocPurchasePrice = watchSaleType === "troc" && selectedProductData?.sellingPrice && watchAmount
    ? Math.max(0, Number(selectedProductData.sellingPrice) - Number(watchAmount))
    : null;

  const onSubmit = (data: SaleInput) => {
    if (!data.productId) {
      form.setError("productId", { message: "Veuillez sélectionner un produit" });
      return;
    }
    if (!data.amount || data.amount <= 0) {
      form.setError("amount", { message: "Le montant doit être supérieur à 0" });
      return;
    }
    if (data.saleType === "troc" && !data.trocProduct) {
      form.setError("trocProduct", { message: "Le nom de l'appareil reçu en troc est obligatoire" });
      return;
    }
    if (data.saleType === "troc" && !data.trocBrand) {
      form.setError("trocBrand", { message: "La marque de l'appareil troc est obligatoire" });
      return;
    }

    const payload = { ...data, trocHasInvoice: trocHasInvoice ? true : undefined };

    createMutation.mutate({ data: payload as SaleInput }, {
      onSuccess: () => {
        toast.success("Vente enregistrée avec succès");
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsAddOpen(false);
        setTrocHasInvoice(false);
        setInvoiceFile(null);
        form.reset({
          saleType: "normal",
          paymentMode: "Cash",
          amount: 0,
          clientName: "",
          clientPhone: "",
        });
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
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              form.reset({ saleType: "normal", paymentMode: "Cash", amount: 0, clientName: "", clientPhone: "" });
              setTrocHasInvoice(false);
              setInvoiceFile(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Nouvelle Vente</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
              <DialogHeader><DialogTitle>Enregistrer une vente</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                  <FormField
                    control={form.control}
                    name="productId"
                    rules={{ required: "Veuillez sélectionner un produit" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produit vendu *</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(Number(val));
                            const p = availableProducts.find(x => x.id === Number(val));
                            if (p?.sellingPrice) form.setValue("amount", p.sellingPrice);
                            // Auto-fill vendor name if product is at a partner
                            if (p?.status === "chez_partenaire" && (p as any).partnerName) {
                              form.setValue("vendorName", (p as any).partnerName);
                            }
                          }}
                          value={field.value?.toString() ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableProducts.map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.status === "chez_partenaire" && "🤝 "}
                                {p.productId} — {p.product}{p.brand ? ` ${p.brand}` : ""}{p.capacity ? ` ${p.capacity}` : ""} — {formatFCFA(p.sellingPrice)}
                                {p.status === "chez_partenaire" && (p as any).partnerName ? ` (${(p as any).partnerName})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedProductData && (
                    <div className={`text-xs bg-muted/30 rounded px-3 py-2 border ${selectedProductData.status === "chez_partenaire" ? "border-blue-500/40 text-blue-400" : "border-border text-muted-foreground"}`}>
                      {selectedProductData.status === "chez_partenaire" && (
                        <span className="font-semibold">🤝 Chez partenaire{(selectedProductData as any).partnerName ? ` : ${(selectedProductData as any).partnerName}` : ""} · </span>
                      )}
                      IMEI : {selectedProductData.imei || "—"} · Couleur : {selectedProductData.color || "—"}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="saleType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de vente</FormLabel>
                        <Select onValueChange={(val) => { field.onChange(val); if (val !== "troc") { setTrocHasInvoice(false); setInvoiceFile(null); }}} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Vente normale</SelectItem>
                            <SelectItem value="troc">Troc</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="paymentMode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mode de paiement</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="OM">Orange Money</SelectItem>
                            <SelectItem value="MOMO">Mobile Money</SelectItem>
                            <SelectItem value="Cash">Cash</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      rules={{
                        required: "Le montant est obligatoire",
                        min: { value: 1, message: "Le montant doit être supérieur à 0" },
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant final *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              {...field}
                              onChange={e => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="vendorId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendeur externe (Optionnel)</FormLabel>
                        <Select onValueChange={(val) => {
                          const id = Number(val);
                          field.onChange(id || undefined);
                          if (id) {
                            const s = sellers.find(x => x.id === id);
                            if (s) form.setValue("vendorName", s.name);
                          }
                        }} value={field.value?.toString() ?? ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="0">Aucun</SelectItem>
                            {sellers.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Show auto-filled partner as vendor name (read-only info) */}
                  {selectedProductData?.status === "chez_partenaire" && (selectedProductData as any).partnerName && (
                    <div className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded px-3 py-2">
                      ✓ Vendeur auto-rempli : <strong>{(selectedProductData as any).partnerName}</strong> (partenaire)
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du client (Optionnel)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="clientPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone (Optionnel)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {watchSaleType === "troc" && (
                    <div className="border border-primary/30 bg-primary/5 p-4 rounded-lg space-y-4">
                      <h4 className="font-semibold text-primary">Appareil reçu en Troc</h4>

                      {trocPurchasePrice !== null && (
                        <div className="text-sm bg-green-500/10 border border-green-500/20 text-green-400 rounded px-3 py-2">
                          💡 Prix d'achat calculé automatiquement : <strong>{formatFCFA(trocPurchasePrice)}</strong>
                          <span className="text-xs block text-green-500/70 mt-0.5">
                            PV ({formatFCFA(selectedProductData?.sellingPrice)}) − Somme reçue ({formatFCFA(watchAmount)})
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="trocProduct"
                          rules={{ required: watchSaleType === "troc" ? "Le nom de l'appareil est obligatoire" : false }}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom de l'appareil *</FormLabel>
                              <FormControl><Input {...field} placeholder="Ex: iPhone 12" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="trocBrand"
                          rules={{ required: watchSaleType === "troc" ? "La marque est obligatoire" : false }}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Marque *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="trocImei"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IMEI (Optionnel)</FormLabel>
                              <FormControl><Input {...field} placeholder="15 chiffres" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="trocCapacity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Capacité (Optionnel)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {CAPACITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={"trocColor" as keyof SaleInput}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Couleur (Optionnel)</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={(field.value as string) ?? ""}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Invoice checkbox */}
                      <div className="border-t border-primary/20 pt-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="troc-invoice"
                            checked={trocHasInvoice}
                            onCheckedChange={(v) => {
                              setTrocHasInvoice(!!v);
                              if (!v) setInvoiceFile(null);
                            }}
                          />
                          <Label htmlFor="troc-invoice" className="cursor-pointer text-sm">
                            Le client a remis sa facture ?
                          </Label>
                        </div>
                        {trocHasInvoice && (
                          <div className="flex items-center gap-3">
                            <input
                              ref={invoiceInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) { setInvoiceFile(f); toast.success(`Facture importée : ${f.name}`); }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => invoiceInputRef.current?.click()}
                              className="text-sm"
                            >
                              <Upload className="h-4 w-4 mr-2" /> Importer la facture
                            </Button>
                            {invoiceFile && (
                              <div className="flex items-center gap-1 text-xs text-green-400">
                                <FileText className="h-3.5 w-3.5" />
                                {invoiceFile.name}
                              </div>
                            )}
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

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Recherche (Client, Produit, IMEI...)" className="pl-9 bg-background border-border"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
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
              <TableRow><TableCell colSpan={8} className="h-24 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              </TableCell></TableRow>
            ) : sales.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Aucune vente trouvée.</TableCell></TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id} className={`border-border ${sale.cancelled ? "opacity-50" : ""}`}>
                  <TableCell className="text-sm">
                    {formatDateFr(sale.saleDate)}<br />
                    <span className="text-muted-foreground text-xs">{sale.saleTime.substring(0, 5)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{sale.product?.product || "-"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{sale.product?.productId} {sale.product?.imei ? `· ${sale.product.imei}` : ""}</div>
                  </TableCell>
                  <TableCell>
                    <div>{sale.clientName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{sale.clientPhone}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sale.vendorName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-background">{sale.paymentMode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={sale.saleType === "troc" ? "bg-primary/20 text-primary border-primary/20" : ""}>
                      {sale.saleType === "normal" ? "Normal" : "Troc"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatFCFA(sale.amount)}</TableCell>
                  <TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
