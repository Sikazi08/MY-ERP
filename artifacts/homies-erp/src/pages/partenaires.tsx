import { useState } from "react";
import { useListPartners, useCreatePartner, useDeletePartner, useSendProductToPartner, useReturnProductFromPartner, useListPartnerMovements, useListProducts, getListPartnersQueryKey, getListPartnerMovementsQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import type { PartnerInput, PartnerSendInput, PartnerReturnInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, ArrowRight, ArrowLeft, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Partenaires() {
  const queryClient = useQueryClient();
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [movPage, setMovPage] = useState(1);
  const [movPageSize, setMovPageSize] = useState(25);

  const { data: partners = [], isLoading: loadingPartners } = useListPartners({ query: { queryKey: getListPartnersQueryKey() } });
  const { data: allMovements = [], isLoading: loadingMovements } = useListPartnerMovements({ query: { queryKey: getListPartnerMovementsQueryKey() } });
  const { data: enStockPage } = useListProducts({ status: "en_stock", limit: 500 }, { query: { queryKey: getListProductsQueryKey({ status: "en_stock", limit: 500 }) } });
  const enStockProducts = enStockPage?.data ?? [];
  const { data: atPartnerPage } = useListProducts({ status: "chez_partenaire", limit: 500 }, { query: { queryKey: getListProductsQueryKey({ status: "chez_partenaire", limit: 500 }) } });
  const atPartnerProducts = atPartnerPage?.data ?? [];

  const movTotal = allMovements.length;
  const movTotalPages = Math.ceil(movTotal / movPageSize);
  const movements = allMovements.slice((movPage - 1) * movPageSize, movPage * movPageSize);

  const createPartner = useCreatePartner();
  const deletePartner = useDeletePartner();
  const sendProduct = useSendProductToPartner();
  const returnProduct = useReturnProductFromPartner();

  const partnerForm = useForm<PartnerInput>({ defaultValues: { name: "", phone: "", address: "" } });
  const sendForm = useForm<PartnerSendInput>({ defaultValues: { movementDate: format(new Date(), "yyyy-MM-dd") } });
  const returnForm = useForm<PartnerReturnInput>({ defaultValues: { movementDate: format(new Date(), "yyyy-MM-dd") } });

  const onAddPartner = (data: PartnerInput) => {
    createPartner.mutate({ data }, {
      onSuccess: () => { toast.success("Partenaire ajouté"); queryClient.invalidateQueries({ queryKey: getListPartnersQueryKey() }); setIsAddPartnerOpen(false); partnerForm.reset(); }
    });
  };

  const onSendProduct = (data: PartnerSendInput) => {
    sendProduct.mutate({ data }, {
      onSuccess: () => { toast.success("Produit envoyé au partenaire"); queryClient.invalidateQueries({ queryKey: getListPartnerMovementsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setIsSendOpen(false); sendForm.reset({ movementDate: format(new Date(), "yyyy-MM-dd") }); }
    });
  };

  const onReturnProduct = (data: PartnerReturnInput) => {
    returnProduct.mutate({ data }, {
      onSuccess: () => { toast.success("Produit retourné en stock"); queryClient.invalidateQueries({ queryKey: getListPartnerMovementsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); setIsReturnOpen(false); returnForm.reset({ movementDate: format(new Date(), "yyyy-MM-dd") }); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Gestion des Partenaires</h1>
      </div>

      <Tabs defaultValue="produits">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="produits" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Produits chez partenaires</TabsTrigger>
          <TabsTrigger value="partenaires" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Liste des partenaires</TabsTrigger>
          <TabsTrigger value="mouvements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Historique Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="produits" className="space-y-4 pt-4">
          <div className="flex gap-2">
            <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white"><ArrowRight className="mr-2 h-4 w-4" /> Envoyer un produit</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Envoyer au partenaire</DialogTitle></DialogHeader>
                <Form {...sendForm}>
                  <form onSubmit={sendForm.handleSubmit(onSendProduct)} className="space-y-4">
                    <FormField control={sendForm.control} name="partnerId" render={({ field }) => (
                      <FormItem><FormLabel>Partenaire</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                          <SelectContent>{partners.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={sendForm.control} name="productId" render={({ field }) => (
                      <FormItem><FormLabel>Produit en stock</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                          <SelectContent>{enStockProducts.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.productId} - {p.product}</SelectItem>)}</SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={sendForm.control} name="movementDate" render={({ field }) => (
                      <FormItem><FormLabel>Date d'envoi</FormLabel><FormControl><Input type="date" {...field} required /></FormControl></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={sendProduct.isPending}>Confirmer l'envoi</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-border"><ArrowLeft className="mr-2 h-4 w-4" /> Retour en stock</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Retourner un produit</DialogTitle></DialogHeader>
                <Form {...returnForm}>
                  <form onSubmit={returnForm.handleSubmit(onReturnProduct)} className="space-y-4">
                    <FormField control={returnForm.control} name="productId" render={({ field }) => (
                      <FormItem><FormLabel>Produit chez le partenaire</FormLabel>
                        <Select onValueChange={(val) => field.onChange(Number(val))}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger></FormControl>
                          <SelectContent>{atPartnerProducts.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.productId} - {p.product}</SelectItem>)}</SelectContent>
                        </Select></FormItem>
                    )} />
                    <FormField control={returnForm.control} name="movementDate" render={({ field }) => (
                      <FormItem><FormLabel>Date de retour</FormLabel><FormControl><Input type="date" {...field} required /></FormControl></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={returnProduct.isPending}>Confirmer le retour</Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/50">
                  <TableHead>Produit</TableHead>
                  <TableHead>ID / IMEI</TableHead>
                  <TableHead>Marque</TableHead>
                  <TableHead>Prix Vente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atPartnerProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun produit chez partenaire.</TableCell></TableRow>
                ) : atPartnerProducts.map((p) => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="font-medium">{p.product}</TableCell>
                    <TableCell className="text-muted-foreground">{p.productId}<br /><span className="font-mono text-xs">{p.imei}</span></TableCell>
                    <TableCell>{p.brand}</TableCell>
                    <TableCell className="font-medium text-primary">{formatFCFA(p.sellingPrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="partenaires" className="space-y-4 pt-4">
          <Dialog open={isAddPartnerOpen} onOpenChange={setIsAddPartnerOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nouveau Partenaire</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Ajouter un partenaire</DialogTitle></DialogHeader>
              <Form {...partnerForm}>
                <form onSubmit={partnerForm.handleSubmit(onAddPartner)} className="space-y-4">
                  <FormField control={partnerForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} required /></FormControl></FormItem>
                  )} />
                  <FormField control={partnerForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={partnerForm.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>Adresse</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <Button type="submit" className="w-full">Enregistrer</Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <div className="rounded-lg border border-border bg-card overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/50">
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPartners ? (
                  <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
                ) : partners.map(p => (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="font-bold">{p.name}</TableCell>
                    <TableCell>{p.phone || "-"}</TableCell>
                    <TableCell>{p.address || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                        if (confirm("Supprimer ce partenaire ?")) deletePartner.mutate({ id: p.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPartnersQueryKey() }) })
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="mouvements" className="pt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Produit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovements ? (
                  <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
                ) : movements.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun mouvement.</TableCell></TableRow>
                ) : movements.map(m => (
                  <TableRow key={m.id} className="border-border">
                    <TableCell>{formatDateFr(m.movementDate)}</TableCell>
                    <TableCell>
                      {m.movementType === "sortie"
                        ? <Badge className="bg-blue-500/20 text-blue-500">Envoi</Badge>
                        : <Badge className="bg-green-500/20 text-green-500">Retour</Badge>}
                    </TableCell>
                    <TableCell>{m.partner?.name}</TableCell>
                    <TableCell>{m.product?.productId} — {m.product?.product}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {movTotal > 0 && (
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">{movTotal} mouvement{movTotal !== 1 ? "s" : ""} · page {movPage}/{movTotalPages}</p>
                <Select value={String(movPageSize)} onValueChange={v => { setMovPageSize(Number(v)); setMovPage(1); }}>
                  <SelectTrigger className="w-24 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={movPage <= 1} onClick={() => setMovPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={movPage >= movTotalPages} onClick={() => setMovPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
