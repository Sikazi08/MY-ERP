import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Download, Trash2, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";

type FlowType = "depense" | "retrait_membre" | "entree";

interface FlowItem {
  id: number;
  label: string;
  amount: number;
  flowType: FlowType;
  direction: "in" | "out";
  memberId: number | null;
  memberName: string | null;
  note: string | null;
  expenseDate: string;
  expenseTime: string;
  user?: { fullName: string } | null;
}

interface Member { id: number; fullName: string; role: string }

const FLOW_LABELS: Record<FlowType, string> = {
  depense: "Dépense",
  retrait_membre: "Retrait membre",
  entree: "Entrée d'argent",
};

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Erreur de chargement");
  return res.json();
}

export default function FluxFinancier() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [flowType, setFlowType] = useState<FlowType>("depense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [memberId, setMemberId] = useState<string>("");
  const [note, setNote] = useState("");

  const { data: allFlows = [], isLoading } = useQuery<FlowItem[]>({
    queryKey: ["flux"],
    queryFn: () => apiGet<FlowItem[]>("/api/expenses"),
  });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["flux-members"],
    queryFn: () => apiGet<Member[]>("/api/expenses/members"),
  });

  const total = allFlows.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const flows = allFlows.slice((page - 1) * pageSize, page * pageSize);

  const totalIn = allFlows.filter(f => f.direction === "in").reduce((s, f) => s + f.amount, 0);
  const totalOut = allFlows.filter(f => f.direction === "out").reduce((s, f) => s + f.amount, 0);

  const resetForm = () => {
    setFlowType("depense");
    setLabel("");
    setAmount(0);
    setExpenseDate(format(new Date(), "yyyy-MM-dd"));
    setMemberId("");
    setNote("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { flowType, label, amount, expenseDate, note: note || undefined };
      if (flowType === "retrait_membre") body.memberId = memberId ? Number(memberId) : undefined;
      const res = await fetch("/api/expenses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'enregistrement");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Opération enregistrée");
      queryClient.invalidateQueries({ queryKey: ["flux"] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flux"] }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !amount || !expenseDate) {
      toast.error("Libellé, montant et date sont requis");
      return;
    }
    if (flowType === "retrait_membre" && !memberId) {
      toast.error("Veuillez choisir le membre");
      return;
    }
    createMutation.mutate();
  };

  const handleExport = () => window.open("/api/exports/expenses", "_blank");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Flux financier</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle Opération
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Enregistrer une opération</DialogTitle>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type d'opération</label>
                  <Select value={flowType} onValueChange={(v) => setFlowType(v as FlowType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="depense">Dépense (sortie)</SelectItem>
                      <SelectItem value="retrait_membre">Retrait par un membre (sortie)</SelectItem>
                      <SelectItem value="entree">Entrée d'argent / apport</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {flowType === "retrait_membre" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Membre</label>
                    <Select value={memberId} onValueChange={setMemberId}>
                      <SelectTrigger><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Libellé / Motif</label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Montant (FCFA)</label>
                  <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Note (optionnel)</label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><ArrowDownCircle className="h-4 w-4 text-green-500" /> Entrées</div>
          <p className="mt-1 text-2xl font-bold text-green-500">{formatFCFA(totalIn)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><ArrowUpCircle className="h-4 w-4 text-destructive" /> Sorties</div>
          <p className="mt-1 text-2xl font-bold text-destructive">{formatFCFA(totalOut)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-muted-foreground text-sm">Solde net</div>
          <p className={`mt-1 text-2xl font-bold ${totalIn - totalOut >= 0 ? "text-green-500" : "text-destructive"}`}>{formatFCFA(totalIn - totalOut)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Date & Heure</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Membre / Note</TableHead>
              <TableHead>Enregistré par</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : flows.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="h-24 text-center text-muted-foreground">Aucune opération trouvée.</TableCell></TableRow>
            ) : (
              flows.map((f) => (
                <TableRow key={f.id} className="border-border hover:bg-muted/50">
                  <TableCell className="text-sm">
                    {formatDateFr(f.expenseDate)} <br/><span className="text-muted-foreground text-xs">{f.expenseTime.substring(0, 5)}</span>
                  </TableCell>
                  <TableCell>
                    {f.direction === "in" ? (
                      <Badge className="bg-green-500/20 text-green-500">{FLOW_LABELS[f.flowType]}</Badge>
                    ) : (
                      <Badge className="bg-destructive/20 text-destructive">{FLOW_LABELS[f.flowType]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{f.label}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {f.memberName && <div className="font-medium text-foreground">{f.memberName}</div>}
                    {f.note && <div className="text-xs">{f.note}</div>}
                    {!f.memberName && !f.note && "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.user?.fullName || "-"}</TableCell>
                  <TableCell className={`text-right font-bold ${f.direction === "in" ? "text-green-500" : "text-destructive"}`}>
                    {f.direction === "in" ? "+" : "−"}{formatFCFA(f.amount)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/20" onClick={() => {
                        if (confirm("Supprimer cette opération ?")) deleteMutation.mutate(f.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{total} opération{total !== 1 ? "s" : ""} · page {page}/{totalPages}</p>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
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
