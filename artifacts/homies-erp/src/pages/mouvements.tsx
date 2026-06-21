import { useState } from "react";
import { useListMovements, getListMovementsQueryKey } from "@workspace/api-client-react";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Mouvements() {
  const [search, setSearch] = useState("");
  const { data: movements = [], isLoading } = useListMovements({ search: search || undefined }, { query: { queryKey: getListMovementsQueryKey({ search: search || undefined }) } });

  const handleExport = () => {
    window.open('/api/exports/movements', '_blank');
  };

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'achat': return <Badge className="bg-blue-500/20 text-blue-500">Achat Stock</Badge>;
      case 'vente': return <Badge className="bg-green-500/20 text-green-500">Vente</Badge>;
      case 'entree_troc': return <Badge className="bg-purple-500/20 text-purple-500">Entrée Troc</Badge>;
      case 'depense': return <Badge className="bg-destructive/20 text-destructive">Dépense</Badge>;
      case 'sortie_partenaire': return <Badge className="bg-orange-500/20 text-orange-500">Sortie Partenaire</Badge>;
      case 'retour_partenaire': return <Badge className="bg-teal-500/20 text-teal-500">Retour Partenaire</Badge>;
      case 'annulation': return <Badge variant="destructive">Annulation</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Journal des Mouvements</h1>
        <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Exporter
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher..." 
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
    </div>
  );
}
