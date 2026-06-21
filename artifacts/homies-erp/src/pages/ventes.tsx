import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListSales, useCreateSale, useCancelSale, getListSalesQueryKey, useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import type { SaleInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Search, Download, Ban } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";

export default function Ventes() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: sales = [], isLoading } = useListSales({ search: search || undefined }, { query: { queryKey: getListSalesQueryKey({ search: search || undefined }) } });
  
  const { data: enStockProducts = [] } = useListProducts({ status: "en_stock" }, { query: { queryKey: getListProductsQueryKey({ status: "en_stock" }) } });

  const createMutation = useCreateSale();
  const cancelMutation = useCancelSale();

  const form = useForm<SaleInput>({
    defaultValues: {
      saleType: "normal",
      paymentMode: "Cash",
      amount: 0,
      clientName: "",
      clientPhone: "",
    }
  });

  const watchSaleType = form.watch("saleType");
  const watchProductId = form.watch("productId");

  const onSubmit = (data: SaleInput) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast.success("Votre vente a été enregistrée avec succès.");
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsAddOpen(false);
        form.reset();
      },
      onError: () => toast.error("Erreur lors de l'enregistrement de la vente")
    });
  };

  const handleCancelSale = (id: number) => {
    const reason = prompt("Motif de l'annulation ?");
    if (reason) {
      cancelMutation.mutate({ id, data: { reason } }, {
        onSuccess: () => {
          toast.success("Vente annulée avec succès");
          queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        }
      });
    }
  };

  const handleExport = () => {
    window.open('/api/exports/sales', '_blank');
  };

  const selectedProductData = enStockProducts.find(p => p.id === Number(watchProductId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Historique des Ventes</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle Vente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Enregistrer une vente</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  
                  <FormField control={form.control} name="productId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produit vendu</FormLabel>
                      <Select onValueChange={(val) => {
                        field.onChange(Number(val));
                        const p = enStockProducts.find(x => x.id === Number(val));
                        if(p && p.sellingPrice) form.setValue("amount", p.sellingPrice);
                      }}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un produit en stock" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {enStockProducts.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.productId} - {p.product} - {formatFCFA(p.sellingPrice)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="saleType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type de vente</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Vente normale</SelectItem>
                            <SelectItem value="troc">Troc</SelectItem>
                          </SelectContent>
                        </Select>
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
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant final</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} required /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="clientName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du client (Optionnel)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="clientPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone (Optionnel)</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>

                  {watchSaleType === "troc" && (
                    <div className="border border-primary/30 bg-primary/5 p-4 rounded-lg space-y-4">
                      <h4 className="font-semibold text-primary">Informations de l'appareil reçu en Troc</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="trocProduct" render={({ field }) => (
                          <FormItem><FormLabel>Produit</FormLabel><FormControl><Input {...field} required={watchSaleType === "troc"} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="trocBrand" render={({ field }) => (
                          <FormItem><FormLabel>Marque</FormLabel><FormControl><Input {...field} required={watchSaleType === "troc"} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="trocImei" render={({ field }) => (
                          <FormItem><FormLabel>IMEI</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="trocCapacity" render={({ field }) => (
                          <FormItem><FormLabel>Capacité</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )} />
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
          <Input 
            placeholder="Recherche (Client, Produit, IMEI...)" 
            className="pl-9 bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Date & Heure</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Mode Paiement</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : sales.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Aucune vente trouvée.</TableCell></TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id} className={`border-border ${sale.cancelled ? "opacity-50" : ""}`}>
                  <TableCell className="text-sm">
                    {formatDateFr(sale.saleDate)} <br/><span className="text-muted-foreground text-xs">{sale.saleTime.substring(0,5)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{sale.product?.product || "-"}</div>
                    <div className="text-xs text-muted-foreground">{sale.product?.productId} | {sale.product?.imei}</div>
                  </TableCell>
                  <TableCell>
                    <div>{sale.clientName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{sale.clientPhone}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-background">{sale.paymentMode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={sale.saleType === "troc" ? "bg-primary/20 text-primary border-primary/20" : ""}>
                      {sale.saleType === "normal" ? "Normal" : "Troc"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground">
                    {formatFCFA(sale.amount)}
                  </TableCell>
                  <TableCell>
                    {!sale.cancelled ? (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleCancelSale(sale.id)}>
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
