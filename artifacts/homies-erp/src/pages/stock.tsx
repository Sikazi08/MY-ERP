import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product, ProductInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Search, Download, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Tecno", "Infinix", "itel", "Huawei", "Oppo", "Vivo", "Realme", "Nokia", "Autre"];
const CAPACITIES = ["16 Go", "32 Go", "64 Go", "128 Go", "256 Go", "512 Go", "1 To"];
const COLORS = ["Noir", "Blanc", "Bleu", "Rouge", "Or", "Argent", "Vert", "Gris", "Rose", "Violet", "Autre"];
const PAGE_SIZE = 20;

type ProductFormData = ProductInput & { quantity?: number };

function ProductFormFields({
  f,
  isAdmin,
  showQuantity = false,
}: {
  f: ReturnType<typeof useForm<ProductFormData>>;
  isAdmin: boolean;
  showQuantity?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="product" rules={{ required: "Le nom du produit est obligatoire" }} render={({ field }) => (
          <FormItem>
            <FormLabel>Nom du produit *</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="brand" render={({ field }) => (
          <FormItem>
            <FormLabel>Marque</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
              <SelectContent>{BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="imei" render={({ field }) => (
          <FormItem>
            <FormLabel>IMEI (Optionnel)</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="supplier" render={({ field }) => (
          <FormItem>
            <FormLabel>Fournisseur</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="capacity" render={({ field }) => (
          <FormItem>
            <FormLabel>Capacité</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
              <SelectContent>{CAPACITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="color" render={({ field }) => (
          <FormItem>
            <FormLabel>Couleur</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
              <SelectContent>{COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {isAdmin && (
          <FormField control={f.control} name="purchasePrice" render={({ field }) => (
            <FormItem>
              <FormLabel>Prix d'achat</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  value={field.value ?? ""}
                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
        <FormField control={f.control} name="sellingPrice" rules={{ required: "Le prix de vente est obligatoire" }} render={({ field }) => (
          <FormItem>
            <FormLabel>Prix de vente *</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                {...field}
                value={field.value ?? ""}
                onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Statut</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="en_stock">En Stock</SelectItem>
                <SelectItem value="chez_partenaire">Chez Partenaire</SelectItem>
                <SelectItem value="vendu">Vendu</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="entryDate" rules={{ required: "La date d'entrée est obligatoire" }} render={({ field }) => (
          <FormItem>
            <FormLabel>Date d'entrée *</FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      {showQuantity && (
        <FormField
          control={f.control}
          name="quantity"
          rules={{
            required: "La quantité est obligatoire",
            min: { value: 1, message: "La quantité doit être au moins 1" },
            max: { value: 50, message: "La quantité ne peut pas dépasser 50" },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quantité *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  {...field}
                  value={field.value ?? 1}
                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : 1)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}

export default function Stock() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const params = {
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: PAGE_SIZE,
  };

  const { data: productsPage, isLoading } = useListProducts(params, {
    query: { queryKey: getListProductsQueryKey(params) },
  });

  const products = productsPage?.data ?? [];
  const total = productsPage?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const form = useForm<ProductFormData>({
    defaultValues: {
      product: "",
      brand: "",
      status: "en_stock",
      entryDate: format(new Date(), "yyyy-MM-dd"),
      quantity: 1,
    },
  });

  const editForm = useForm<ProductFormData>({
    defaultValues: { product: "", brand: "", status: "en_stock", entryDate: "" },
  });

  const onSubmit = async (data: ProductFormData) => {
    const { quantity = 1, ...productData } = data;
    let successCount = 0;
    let lastError: string | undefined;

    for (let i = 0; i < quantity; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          createMutation.mutate({ data: productData }, {
            onSuccess: () => { successCount++; resolve(); },
            onError: (e: unknown) => {
              lastError = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
              reject(e);
            },
          });
        });
      } catch {
        break;
      }
    }

    if (successCount > 0) {
      toast.success(
        quantity === 1
          ? "Produit ajouté avec succès"
          : `${successCount} produit(s) ajouté(s) avec succès`
      );
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setIsAddOpen(false);
      form.reset({
        product: "",
        brand: "",
        status: "en_stock",
        entryDate: format(new Date(), "yyyy-MM-dd"),
        quantity: 1,
      });
    }
    if (lastError) {
      toast.error(lastError || "Erreur lors de l'ajout");
    }
  };

  const onEditSubmit = (data: ProductFormData) => {
    if (!selectedProduct) return;
    const { quantity: _q, ...productData } = data;
    updateMutation.mutate({ id: selectedProduct.id, data: productData }, {
      onSuccess: () => {
        toast.success("Produit modifié avec succès");
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsEditOpen(false);
        setSelectedProduct(null);
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || "Erreur lors de la modification");
      },
    });
  };

  const openEdit = (product: Product) => {
    setSelectedProduct(product);
    editForm.reset({
      product: product.product,
      brand: product.brand ?? "",
      imei: product.imei ?? "",
      capacity: product.capacity ?? "",
      color: product.color ?? "",
      supplier: product.supplier ?? "",
      purchasePrice: product.purchasePrice ?? undefined,
      sellingPrice: product.sellingPrice ?? undefined,
      status: product.status,
      entryDate: product.entryDate,
    });
    setIsEditOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "en_stock": return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">En Stock</Badge>;
      case "chez_partenaire": return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">Chez Partenaire</Badge>;
      case "vendu": return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 border-border">Vendu</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => window.open('/api/exports/stock', '_blank')} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) form.reset({ product: "", brand: "", status: "en_stock", entryDate: format(new Date(), "yyyy-MM-dd"), quantity: 1 });
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Nouveau Produit</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
              <DialogHeader><DialogTitle>Ajouter un produit</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <ProductFormFields f={form} isAdmin={isAdmin} showQuantity />
                  <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par ID, IMEI, produit, marque..." className="pl-9 w-full bg-background border-border"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="en_stock">En Stock</SelectItem>
              <SelectItem value="chez_partenaire">Chez Partenaire</SelectItem>
              <SelectItem value="vendu">Vendu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <Label className="text-muted-foreground text-sm whitespace-nowrap">Période :</Label>
          <div className="flex gap-2 items-center w-full">
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="bg-background border-border flex-1" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="bg-background border-border flex-1" />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}>✕</Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/50">
                <TableHead>ID</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Capacité / Couleur</TableHead>
                {isAdmin && <TableHead>Prix Achat</TableHead>}
                <TableHead>Prix Vente</TableHead>
                {isAdmin && <TableHead>Bénéfice</TableHead>}
                <TableHead>Statut</TableHead>
                <TableHead>Entrée</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 11 : 9} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 11 : 9} className="h-24 text-center text-muted-foreground">
                  Aucun produit trouvé.
                </TableCell></TableRow>
              ) : (
                products.map((product) => {
                  const canEdit = isAdmin || (product as unknown as { createdByUserId?: number }).createdByUserId === user?.id;
                  return (
                    <TableRow key={product.id} className="border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedProduct(product)}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{product.productId}</TableCell>
                      <TableCell className="font-medium">{product.product}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{product.imei || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{product.brand || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{product.capacity || "-"} / {product.color || "-"}</TableCell>
                      {isAdmin && <TableCell>{formatFCFA(product.purchasePrice)}</TableCell>}
                      <TableCell className="font-medium">{formatFCFA(product.sellingPrice)}</TableCell>
                      {isAdmin && (
                        <TableCell className={product.profit && product.profit > 0 ? "text-green-500 font-medium" : ""}>
                          {formatFCFA(product.profit)}
                        </TableCell>
                      )}
                      <TableCell>{getStatusBadge(product.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDateFr(product.entryDate)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(product)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">{total} produit{total !== 1 ? "s" : ""} · page {page}/{totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Modifier le produit — {selectedProduct?.productId}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <ProductFormFields f={editForm} isAdmin={isAdmin} showQuantity={false} />
              <Button type="submit" className="w-full mt-4" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedProduct && !isEditOpen} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent className="bg-card border-border text-foreground w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6 border-b border-border pb-4">
            <SheetTitle className="text-2xl font-bold flex items-center justify-between">
              Détails du Produit
              <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-1 rounded">{selectedProduct?.productId}</span>
            </SheetTitle>
          </SheetHeader>
          {selectedProduct && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{selectedProduct.product}</h3>
                  <p className="text-muted-foreground">{selectedProduct.brand || "-"}</p>
                </div>
                {getStatusBadge(selectedProduct.status)}
              </div>
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border">
                <div><Label className="text-xs text-muted-foreground">IMEI</Label>
                  <p className="font-medium font-mono text-sm">{selectedProduct.imei || "-"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Capacité / Couleur</Label>
                  <p className="font-medium">{selectedProduct.capacity || "-"} / {selectedProduct.color || "-"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Fournisseur</Label>
                  <p className="font-medium">{selectedProduct.supplier || "-"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Date d'entrée</Label>
                  <p className="font-medium">{formatDateFr(selectedProduct.entryDate)}</p></div>
              </div>
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-border">
                {isAdmin && (
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Prix d'achat</span>
                    <span className="font-medium">{formatFCFA(selectedProduct.purchasePrice)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Prix de vente</span>
                  <span className="font-medium text-primary text-lg">{formatFCFA(selectedProduct.sellingPrice)}</span>
                </div>
                {isAdmin && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Bénéfice estimé</span>
                    <span className="font-medium text-green-500">{formatFCFA(selectedProduct.profit)}</span>
                  </div>
                )}
              </div>
              {(isAdmin || (selectedProduct as unknown as { createdByUserId?: number })?.createdByUserId === user?.id) && (
                <div className="pt-4 flex gap-3 border-t border-border">
                  <Button variant="outline" className="flex-1" onClick={() => { openEdit(selectedProduct); }}>
                    <Edit2 className="h-4 w-4 mr-2" /> Modifier
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" className="flex-1" onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
                        deleteMutation.mutate({ id: selectedProduct.id }, {
                          onSuccess: () => {
                            toast.success("Produit supprimé");
                            setSelectedProduct(null);
                            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
                          },
                          onError: (e: unknown) => {
                            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
                            toast.error(msg || "Erreur lors de la suppression");
                          },
                        });
                      }
                    }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
