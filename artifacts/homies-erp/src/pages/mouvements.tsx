import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListMovements, getListMovementsQueryKey } from "@workspace/api-client-react";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Mouvements() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const movementsQueryParams = {
    search: search || undefined,
    type: statusFilter !== "tous" ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const { data: allMovements = [], isLoading } = useListMovements(movementsQueryParams, { query: { queryKey: getListMovementsQueryKey(movementsQueryParams) } });
  const total = allMovements.length;
  const totalPages = Math.ceil(total / pageSize);
  const movements = allMovements.slice((page - 1) * pageSize, page * pageSize);

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'achat': return <Badge className="bg-blue-500/20 text-blue-500">Achat Stock</Badge>;
      case 'vente': return <Badge className="bg-green-500/20 text-green-500">Vente</Badge>;
      case 'entree_troc': return <Badge className="bg-purple-500/20 text-purple-500">Entrée Troc</Badge>;
      case 'depense': return <Badge className="bg-destructive/20 text-destructive">Dépense</Badge>;
      case 'retrait_membre': return <Badge className="bg-destructive/20 text-destructive">Retrait Membre</Badge>;
      case 'entree_caisse': return <Badge className="bg-green-500/20 text-green-500">Entrée Caisse</Badge>;
      case 'sortie_partenaire': return <Badge className="bg-orange-500/20 text-orange-500">Sortie Partenaire</Badge>;
      case 'retour_partenaire': return <Badge className="bg-teal-500/20 text-teal-500">Retour Partenaire</Badge>;
      case 'modification_produit': return <Badge className="bg-yellow-500/20 text-yellow-500">Modification</Badge>;
      case 'suppression_produit': return <Badge variant="outline">Suppression</Badge>;
      case 'annulation': return <Badge variant="destructive">Annulation</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Journal des Mouvements</h1>
        {isAdmin && (
          <Button variant="outline" onClick={() => window.open('/api/exports/movements', '_blank')} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-3 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher..." 
            className="pl-9 bg-background border-border"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-52 bg-background border-border">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous statuts</SelectItem>
            <SelectItem value="achat">Achat stock</SelectItem>
            <SelectItem value="vente">Vente</SelectItem>
            <SelectItem value="entree_troc">Entrée troc</SelectItem>
            <SelectItem value="depense">Dépense</SelectItem>
            <SelectItem value="retrait_membre">Retrait membre</SelectItem>
            <SelectItem value="entree_caisse">Entrée caisse</SelectItem>
            <SelectItem value="sortie_partenaire">Sortie partenaire</SelectItem>
            <SelectItem value="retour_partenaire">Retour partenaire</SelectItem>
            <SelectItem value="modification_produit">Modification</SelectItem>
            <SelectItem value="suppression_produit">Suppression</SelectItem>
            <SelectItem value="annulation">Annulation</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="bg-background border-border w-full sm:w-36" />
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="bg-background border-border w-full sm:w-36" />
        </div>
        {(dateFrom || dateTo || statusFilter !== "tous") && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("tous"); setPage(1); }}>
            Effacer
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Date & Heure</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Utilisateur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : movements.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Aucun mouvement trouvé.</TableCell></TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id} className="border-border">
                  <TableCell className="text-sm">
                    {formatDateFr(m.movementDate)} <br/><span className="text-muted-foreground text-xs">{m.movementTime.substring(0,5)}</span>
                  </TableCell>
                  <TableCell>{getMovementTypeBadge(m.movementType)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{m.description}</span>
                    {(m.productRef || m.imei) && (
                      <div className="text-xs text-muted-foreground mt-1">Ref: {m.productRef} | IMEI: {m.imei}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.user?.fullName || "Système"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{total} mouvement{total !== 1 ? "s" : ""} · page {page}/{totalPages}</p>
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
    </div>
  );
}
