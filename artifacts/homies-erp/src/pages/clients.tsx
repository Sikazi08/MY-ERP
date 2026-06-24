import { useState, useRef } from "react";
import {
  useListClients, getListClientsQueryKey,
  useGetClient, getGetClientQueryKey,
  useImportClients,
} from "@workspace/api-client-react";
import type { Client } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Search, History, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Clients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [], isLoading } = useListClients(
    { search: search || undefined },
    { query: { queryKey: getListClientsQueryKey({ search: search || undefined }) } }
  );

  const { data: clientDetail, isLoading: isLoadingDetail } = useGetClient(
    selectedClientId as number,
    { query: { queryKey: getGetClientQueryKey(selectedClientId as number), enabled: !!selectedClientId } }
  );

  const importMutation = useImportClients();

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importMutation.mutate({ data: { file } }, {
      onSuccess: (result) => {
        const msg = `${result.imported} importé(s)${result.duplicates > 0 ? `, ${result.duplicates} doublon(s) ignoré(s)` : ""}${result.errors > 0 ? `, ${result.errors} erreur(s)` : ""}`;
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: () => {
        toast.error("Erreur lors de l'import. Vérifiez le format du fichier (.xlsx ou .csv)");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Annuaire Clients</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Upload className="mr-2 h-4 w-4" />}
            Importer Excel
          </Button>
          <Button variant="outline" onClick={() => window.open('/api/exports/clients', '_blank')} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Exporter Excel
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou téléphone..."
            className="pl-9 bg-background border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Nom du client</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Inscrit le</TableHead>
              <TableHead className="text-center">Nb Achats</TableHead>
              <TableHead className="text-right">Total Dépensé</TableHead>
              <TableHead>Dernier achat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              </TableCell></TableRow>
            ) : clients.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Aucun client trouvé.
              </TableCell></TableRow>
            ) : (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <TableCell className="font-bold text-primary">{client.fullName}</TableCell>
                  <TableCell>{client.phone || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateFr(client.createdAt)}</TableCell>
                  <TableCell className="text-center font-medium">{client.purchaseCount}</TableCell>
                  <TableCell className="text-right font-bold">{formatFCFA(client.totalPurchases)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateFr(client.lastPurchaseDate) || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedClientId} onOpenChange={(open) => !open && setSelectedClientId(null)}>
        <SheetContent className="bg-card border-border sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6 border-b border-border pb-4">
            <SheetTitle className="text-2xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Fiche Client
            </SheetTitle>
          </SheetHeader>
          {isLoadingDetail ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : clientDetail && (
            <div className="space-y-6">
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <h3 className="text-2xl font-black text-foreground">{clientDetail.fullName}</h3>
                <p className="text-muted-foreground">{clientDetail.phone || "Pas de numéro"}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider block">Total dépensé</span>
                    <span className="text-xl font-bold text-primary">{formatFCFA(clientDetail.totalPurchases)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider block">Volume d'achats</span>
                    <span className="text-xl font-bold">{clientDetail.purchaseCount} articles</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-bold mb-4 uppercase text-sm tracking-wider text-muted-foreground">Historique des achats</h4>
                <div className="space-y-3">
                  {clientDetail.purchases && clientDetail.purchases.length > 0 ? (
                    clientDetail.purchases.map(sale => (
                      <div key={sale.id} className="p-3 border border-border rounded-lg bg-background flex justify-between items-center">
                        <div>
                          <div className="font-medium">{sale.product?.product}</div>
                          <div className="text-xs text-muted-foreground">{formatDateFr(sale.saleDate)} à {sale.saleTime.substring(0, 5)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatFCFA(sale.amount)}</div>
                          <Badge variant="outline" className="text-[10px] mt-1">{sale.paymentMode}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Aucun achat disponible.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
