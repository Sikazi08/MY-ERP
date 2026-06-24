import { useState, useRef, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Search, Download, Trash2, Edit2, ChevronLeft, ChevronRight, Smartphone, Package, Upload, FileText, Paperclip } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

interface TrocAttachment { id: number; type: string; filename: string; mime_type: string; created_at: string; }

function AttachmentsSection({ productId }: { productId: number }) {
  const [attachments, setAttachments] = useState<TrocAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<"facture" | "declaration" | "cni">("facture");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attachments/products/${productId}`, { credentials: "include" });
      if (res.ok) setAttachments(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [productId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", uploadType);
      const res = await fetch(`/api/attachments/products/${productId}`, { method: "POST", credentials: "include", body: fd });
      if (res.ok) { toast.success("Pièce jointe ajoutée"); await load(); }
      else { const e = await res.json(); toast.error(e.error || "Erreur upload"); }
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette pièce jointe ?")) return;
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { toast.success("Supprimé"); await load(); }
    else toast.error("Erreur lors de la suppression");
  };

  const typeLabel: Record<string, string> = { facture: "Facture", declaration: "Déclaration sur l'honneur", cni: "CNI" };
  const typeColor: Record<string, string> = { facture: "text-green-400 border-green-400/30 bg-green-400/10", declaration: "text-blue-400 border-blue-400/30 bg-blue-400/10", cni: "text-orange-400 border-orange-400/30 bg-orange-400/10" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2"><Paperclip className="h-4 w-4" /> Pièces jointes troc</h4>
        <div className="flex gap-2 items-center">
          <Select value={uploadType} onValueChange={(v: any) => setUploadType(v)}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="facture">Facture</SelectItem>
              <SelectItem value="declaration">Déclaration</SelectItem>
              <SelectItem value="cni">CNI</SelectItem>
            </SelectContent>
          </Select>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={uploading}
            onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Upload className="h-3 w-3 mr-1" />Ajouter</>}
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-3"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">Aucune pièce jointe</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(a => (
            <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeColor[a.type] || ""}`}>{typeLabel[a.type] || a.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">{a.filename}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => window.open(`/api/attachments/${a.id}/download`, "_blank")}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Tecno", "Infinix", "itel", "Huawei", "Oppo", "Vivo", "Realme", "Nokia", "Autre"];
const CAPACITIES = ["16 Go", "32 Go", "64 Go", "128 Go", "256 Go", "512 Go", "1 To"];
const COLORS = ["Noir", "Blanc", "Bleu", "Rouge", "Or", "Argent", "Vert", "Gris", "Rose", "Violet", "Autre"];
const PAGE_SIZE = 25;

type ProductFormData = ProductInput & { productType?: string; quantity?: number; entryMethod?: string };

function PhoneFormFields({ f, isAdmin }: { f: ReturnType<typeof useForm<ProductFormData>>; isAdmin: boolean }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={f.control} name="product" rules={{ required: "Le nom est obligatoire" }} render={({ field }) => (
          <FormItem><FormLabel>Nom du produit *</FormLabel><FormControl><Input {...field} placeholder="Ex: iPhone 14 Pro" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={f.control} name="brand" render={({ field }) => (
          <FormItem><FormLabel>Marque</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
              <SelectContent>{BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={f.control} name="imei" render={({ field }) => (
          <FormItem><FormLabel>IMEI</FormLabel><FormControl><Input {...field} placeholder="15 chiffres" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={f.control} name="supplier" render={({ field }) => (
          <FormItem><FormLabel>Fournisseur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={f.control} name="capacity" render={({ field }) => (
          <FormItem><FormLabel>Capacité</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
              <SelectContent>{CAPACITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <FormField control={f.control} name="color" render={({ field }) => (
          <FormItem><FormLabel>Couleur</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
              <SelectContent>{COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={f.control} name={"entryMethod" as keyof ProductFormData} render={({ field }) => (
          <FormItem><FormLabel>Méthode d'entrée</FormLabel>
            <Select onValueChange={field.onChange} value={(field.value as string) ?? "achat"}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="achat">Achat</SelectItem>
                <SelectItem value="troc">Entré en Troc</SelectItem>
              </SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <div className="space-y-1">
          <Label className="text-sm">Quantité</Label>
          <Input value="1" disabled className="bg-muted/40" />
          <p className="text-xs text-muted-foreground">Toujours 1 par téléphone</p>
        </div>
      </div>
    </>
  );
}

function AccessoireFormFields({ f, isAdmin }: { f: ReturnType<typeof useForm<ProductFormData>>; isAdmin: boolean }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={f.control} name="product" rules={{ required: "Le nom est obligatoire" }} render={({ field }) => (
          <FormItem><FormLabel>Nom du produit *</FormLabel><FormControl><Input {...field} placeholder="Ex: Chargeur USB-C 65W" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={f.control} name="brand" render={({ field }) => (
          <FormItem><FormLabel>Marque (Optionnel)</FormLabel><FormControl><Input {...field} placeholder="Ex: Anker" /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField control={f.control} name={"quantity" as keyof ProductFormData} rules={{ required: "La quantité est obligatoire", min: { value: 1, message: "Minimum 1" } }} render={({ field }) => (
          <FormItem><FormLabel>Quantité *</FormLabel>
            <FormControl><Input type="number" min={1} {...field} value={field.value as number ?? 1} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
            <FormMessage /></FormItem>
        )} />
        <FormField control={f.control} name="supplier" render={({ field }) => (
          <FormItem><FormLabel>Fournisseur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      </div>
    </>
  );
}

function CommonPriceFields({ f, isAdmin }: { f: ReturnType<typeof useForm<ProductFormData>>; isAdmin: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {isAdmin && (
        <FormField control={f.control} name="purchasePrice" render={({ field }) => (
          <FormItem><FormLabel>Prix d'achat</FormLabel>
            <FormControl><Input type="number" min={0} {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
            <FormMessage /></FormItem>
        )} />
      )}
      <FormField control={f.control} name="sellingPrice" rules={{ required: "Le prix de vente est obligatoire" }} render={({ field }) => (
        <FormItem><FormLabel>Prix de vente *</FormLabel>
          <FormControl><Input type="number" min={0} {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl>
          <FormMessage /></FormItem>
      )} />
    </div>
  );
}

function CommonStatusDateFields({ f, forAdd }: { f: ReturnType<typeof useForm<ProductFormData>>; forAdd?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField control={f.control} name="status" render={({ field }) => (
        <FormItem><FormLabel>Statut</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="en_stock">En Stock</SelectItem>
              <SelectItem value="chez_partenaire">Chez Partenaire</SelectItem>
              {!forAdd && <SelectItem value="vendu">Vendu</SelectItem>}
            </SelectContent>
          </Select><FormMessage /></FormItem>
      )} />
      <FormField control={f.control} name="entryDate" rules={{ required: "La date est obligatoire" }} render={({ field }) => (
        <FormItem><FormLabel>Date d'entrée *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
    </div>
  );
}

export default function Stock() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("tous");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addProductType, setAddProductType] = useState<"téléphone" | "accessoire">("téléphone");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const params = {
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    productType: productTypeFilter !== "tous" ? productTypeFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit: pageSize,
  };

  const { data: productsPage, isLoading } = useListProducts(params, {
    query: { queryKey: getListProductsQueryKey(params) },
  });

  const products = productsPage?.data ?? [];
  const total = productsPage?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const defaultPhoneValues = { product: "", brand: "", status: "en_stock" as const, entryDate: format(new Date(), "yyyy-MM-dd"), productType: "téléphone", quantity: 1, entryMethod: "achat" };
  const defaultAccValues = { product: "", brand: "", status: "en_stock" as const, entryDate: format(new Date(), "yyyy-MM-dd"), productType: "accessoire", quantity: 1, entryMethod: undefined };

  const form = useForm<ProductFormData>({ defaultValues: defaultPhoneValues });
  const editForm = useForm<ProductFormData>({ defaultValues: { product: "", brand: "", status: "en_stock", entryDate: "" } });

  const resetAddForm = (type: "téléphone" | "accessoire") => {
    if (type === "téléphone") form.reset(defaultPhoneValues);
    else form.reset(defaultAccValues);
    setAddProductType(type);
  };

  const onSubmit = async (data: ProductFormData) => {
    createMutation.mutate({ data: { ...data, productType: addProductType } as ProductInput }, {
      onSuccess: () => {
        toast.success("Produit ajouté avec succès");
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsAddOpen(false);
        resetAddForm("téléphone");
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || "Erreur lors de l'ajout");
      },
    });
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/products/import", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Import réussi : ${data.imported}/${data.total} produits importés`);
        if (data.errors?.length) toast.warning(`${data.errors.length} erreur(s) : ${data.errors[0]}`);
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setIsImportOpen(false);
        setImportFile(null);
      } else {
        toast.error(data.error || "Erreur lors de l'import");
      }
    } finally {
      setImportLoading(false);
    }
  };

  const onEditSubmit = (data: ProductFormData) => {
    if (!selectedProduct) return;
    updateMutation.mutate({ id: selectedProduct.id, data: data as ProductInput }, {
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
    const p = product as any;
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
      productType: p.productType ?? "téléphone",
      quantity: p.quantity ?? 1,
      entryMethod: p.entryMethod ?? "achat",
    });
    setIsEditOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "en_stock": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">En Stock</Badge>;
      case "chez_partenaire": return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Chez Partenaire</Badge>;
      case "vendu": return <Badge className="bg-muted text-muted-foreground border-border">Vendu</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const editProductType = (editForm.watch("productType" as any) as string) || (selectedProduct as any)?.productType || "téléphone";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Stock</h1>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {isAdmin && <Button variant="outline" onClick={() => window.open('/api/exports/stock', '_blank')} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>}
          {isAdmin && (
            <Button variant="outline" className="w-full sm:w-auto border-blue-500/40 text-blue-400 hover:bg-blue-500/10" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Importer Stock
            </Button>
          )}
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetAddForm("téléphone"); }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Nouveau Produit</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto bg-card border-border text-foreground">
              <DialogHeader><DialogTitle>Ajouter un produit</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Product type selector */}
                  <div className="flex gap-2 p-1 bg-muted/50 rounded-lg border border-border">
                    <button type="button"
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${addProductType === "téléphone" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => resetAddForm("téléphone")}>
                      <Smartphone className="h-4 w-4" /> Téléphone
                    </button>
                    <button type="button"
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${addProductType === "accessoire" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                      onClick={() => resetAddForm("accessoire")}>
                      <Package className="h-4 w-4" /> Appareils/Accessoires
                    </button>
                  </div>

                  {addProductType === "téléphone" ? (
                    <PhoneFormFields f={form} isAdmin={isAdmin} />
                  ) : (
                    <AccessoireFormFields f={form} isAdmin={isAdmin} />
                  )}

                  <CommonStatusDateFields f={form} forAdd />
                  <CommonPriceFields f={form} isAdmin={isAdmin} />

                  <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par ID, IMEI, produit, marque..." className="pl-9 w-full bg-background border-border"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[170px] bg-background"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="en_stock">En Stock</SelectItem>
              <SelectItem value="chez_partenaire">Chez Partenaire</SelectItem>
              <SelectItem value="vendu">Vendu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <Tabs value={productTypeFilter} onValueChange={(v) => { setProductTypeFilter(v); setPage(1); }} className="w-full sm:w-auto">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="tous">Tous</TabsTrigger>
              <TabsTrigger value="téléphone"><Smartphone className="h-3.5 w-3.5 mr-1" />Téléphones</TabsTrigger>
              <TabsTrigger value="accessoire"><Package className="h-3.5 w-3.5 mr-1" />Accessoires</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 items-center w-full sm:w-auto ml-auto">
            <Label className="text-muted-foreground text-sm whitespace-nowrap">Période :</Label>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="bg-background border-border w-36" />
            <span className="text-muted-foreground">→</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="bg-background border-border w-36" />
            {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}>✕</Button>}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/50">
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>IMEI / Qté</TableHead>
                <TableHead>Marque</TableHead>
                <TableHead>Cap / Couleur</TableHead>
                {isAdmin && <TableHead>PA</TableHead>}
                <TableHead>PV</TableHead>
                {isAdmin && <TableHead>Bénéfice</TableHead>}
                <TableHead>Statut</TableHead>
                <TableHead>Entrée</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 12 : 10} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 12 : 10} className="h-24 text-center text-muted-foreground">
                  Aucun produit trouvé.
                </TableCell></TableRow>
              ) : (
                products.map((product) => {
                  const p = product as any;
                  const isPhone = !p.productType || p.productType === "téléphone";
                  const canEdit = isAdmin || p.createdByUserId === user?.id;
                  return (
                    <TableRow key={product.id} className="border-border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedProduct(product)}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{product.productId}</TableCell>
                      <TableCell>
                        {isPhone
                          ? <Badge variant="outline" className="gap-1 text-xs"><Smartphone className="h-3 w-3" />Tél.</Badge>
                          : <Badge variant="outline" className="gap-1 text-xs text-blue-400 border-blue-400/30"><Package className="h-3 w-3" />Acc.</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.product}
                        {isPhone && p.entryMethod === "troc" && <Badge className="ml-1 text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/20">Troc</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">
                        {isPhone ? (product.imei || "-") : <span className="font-semibold text-foreground">Qté: {p.quantity ?? 1}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.brand || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{product.capacity || "-"} / {product.color || "-"}</TableCell>
                      {isAdmin && <TableCell>{formatFCFA(product.purchasePrice)}</TableCell>}
                      <TableCell className="font-medium">{formatFCFA(product.sellingPrice)}</TableCell>
                      {isAdmin && (
                        <TableCell className={(product as any).profit && (product as any).profit > 0 ? "text-green-500 font-medium" : ""}>
                          {formatFCFA((product as any).profit)}
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

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{total} produit{total !== 1 ? "s" : ""} · page {page}/{totalPages}</p>
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Modifier — {selectedProduct?.productId}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {editProductType === "téléphone" ? (
                <PhoneFormFields f={editForm} isAdmin={isAdmin} />
              ) : (
                <AccessoireFormFields f={editForm} isAdmin={isAdmin} />
              )}
              <CommonStatusDateFields f={editForm} />
              <CommonPriceFields f={editForm} isAdmin={isAdmin} />
              <Button type="submit" className="w-full mt-4" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={!!selectedProduct && !isEditOpen} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <SheetContent className="bg-card border-border text-foreground w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6 border-b border-border pb-4">
            <SheetTitle className="text-2xl font-bold flex items-center justify-between">
              Détails du Produit
              <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-1 rounded">{selectedProduct?.productId}</span>
            </SheetTitle>
          </SheetHeader>
          {selectedProduct && (() => {
            const p = selectedProduct as any;
            const isPhone = !p.productType || p.productType === "téléphone";
            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold">{selectedProduct.product}</h3>
                      {isPhone
                        ? <Badge variant="outline" className="gap-1"><Smartphone className="h-3 w-3" />Téléphone</Badge>
                        : <Badge variant="outline" className="gap-1 text-blue-400 border-blue-400/30"><Package className="h-3 w-3" />Accessoire</Badge>}
                    </div>
                    <p className="text-muted-foreground">{selectedProduct.brand || "-"}</p>
                  </div>
                  {getStatusBadge(selectedProduct.status)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border border-border">
                  {isPhone ? (
                    <>
                      <div><Label className="text-xs text-muted-foreground">IMEI</Label><p className="font-medium font-mono text-sm">{selectedProduct.imei || "-"}</p></div>
                      <div><Label className="text-xs text-muted-foreground">Capacité / Couleur</Label><p className="font-medium">{selectedProduct.capacity || "-"} / {selectedProduct.color || "-"}</p></div>
                      <div><Label className="text-xs text-muted-foreground">Méthode d'entrée</Label>
                        <p className="font-medium">{p.entryMethod === "troc" ? "🔄 Troc" : "🛒 Achat"}</p>
                      </div>
                    </>
                  ) : (
                    <div><Label className="text-xs text-muted-foreground">Quantité en stock</Label>
                      <p className="text-2xl font-bold text-primary">{p.quantity ?? 1}</p>
                    </div>
                  )}
                  <div><Label className="text-xs text-muted-foreground">Fournisseur</Label><p className="font-medium">{selectedProduct.supplier || "-"}</p></div>
                  <div><Label className="text-xs text-muted-foreground">Date d'entrée</Label><p className="font-medium">{formatDateFr(selectedProduct.entryDate)}</p></div>
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
                      <span className="font-medium text-green-500">{formatFCFA(p.profit)}</span>
                    </div>
                  )}
                </div>
                {isPhone && p.entryMethod === "troc" && (
                  <div className="border-t border-primary/20 pt-4">
                    <AttachmentsSection productId={selectedProduct.id} />
                  </div>
                )}

                {(isAdmin || p.createdByUserId === user?.id) && (
                  <div className="pt-4 flex gap-3 border-t border-border">
                    <Button variant="outline" className="flex-1" onClick={() => openEdit(selectedProduct)}>
                      <Edit2 className="h-4 w-4 mr-2" /> Modifier
                    </Button>
                    {isAdmin && (
                      <Button variant="destructive" className="flex-1" onClick={() => {
                        if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
                          deleteMutation.mutate({ id: selectedProduct.id }, {
                            onSuccess: () => { toast.success("Produit supprimé"); setSelectedProduct(null); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
                            onError: (e: unknown) => { const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error; toast.error(msg || "Erreur lors de la suppression"); },
                          });
                        }
                      }}>
                        <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Stock Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={v => { setIsImportOpen(v); if (!v) setImportFile(null); }}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importer du stock (Excel / CSV)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center space-y-3">
              <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f); e.target.value = ""; }} />
              {importFile ? (
                <div className="space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-green-400" />
                  <p className="text-sm font-medium text-green-400">{importFile.name}</p>
                  <Button size="sm" variant="ghost" onClick={() => setImportFile(null)} className="text-muted-foreground">
                    Changer de fichier
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Glissez un fichier ou cliquez pour sélectionner</p>
                  <Button size="sm" variant="outline" onClick={() => importFileRef.current?.click()}>
                    Sélectionner un fichier .xlsx ou .csv
                  </Button>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1 bg-muted/20 rounded-lg p-3 border border-border">
              <p className="font-semibold text-foreground mb-2">Colonnes supportées :</p>
              <div className="grid grid-cols-2 gap-1">
                <span><code className="bg-background px-1 rounded">Produit</code> — Nom (obligatoire)</span>
                <span><code className="bg-background px-1 rounded">Type</code> — téléphone/accessoire</span>
                <span><code className="bg-background px-1 rounded">Marque</code> — Marque</span>
                <span><code className="bg-background px-1 rounded">IMEI</code> — IMEI</span>
                <span><code className="bg-background px-1 rounded">Capacité</code> — Ex: 128 Go</span>
                <span><code className="bg-background px-1 rounded">Couleur</code> — Couleur</span>
                <span><code className="bg-background px-1 rounded">Fournisseur</code> — Fournisseur</span>
                <span><code className="bg-background px-1 rounded">Quantité</code> — Qté (accessoire)</span>
                <span><code className="bg-background px-1 rounded">PV</code> — Prix de vente</span>
                <span><code className="bg-background px-1 rounded">PA</code> — Prix d'achat</span>
                <span><code className="bg-background px-1 rounded">Date</code> — Date d'entrée</span>
                <span><code className="bg-background px-1 rounded">Méthode</code> — achat/troc</span>
              </div>
            </div>

            <Button className="w-full" disabled={!importFile || importLoading} onClick={handleImport}>
              {importLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Import en cours...</> : <><Upload className="h-4 w-4 mr-2" /> Lancer l'import</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
