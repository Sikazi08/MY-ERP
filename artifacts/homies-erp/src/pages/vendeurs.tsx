import { useState } from "react";
import {
  useListSellers, useCreateSeller, useUpdateSeller, useDeleteSeller,
  getListSellersQueryKey,
} from "@workspace/api-client-react";
import type { Seller } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, UserCheck, UserX } from "lucide-react";

export default function Vendeurs() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editSeller, setEditSeller] = useState<Seller | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", notes: "", isActive: true });

  const { data: sellers = [], isLoading } = useListSellers();
  const createMutation = useCreateSeller();
  const updateMutation = useUpdateSeller();
  const deleteMutation = useDeleteSeller();

  const resetForm = () => setForm({ name: "", phone: "", address: "", notes: "" });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    createMutation.mutate({ data: { name: form.name, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined } }, {
      onSuccess: () => {
        toast.success("Vendeur ajouté");
        queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
        setIsAddOpen(false);
        resetForm();
      },
      onError: () => toast.error("Erreur lors de l'ajout"),
    });
  };

  const openEdit = (s: Seller) => {
    setEditSeller(s);
    setEditForm({ name: s.name, phone: s.phone ?? "", address: s.address ?? "", notes: s.notes ?? "", isActive: s.isActive });
  };

  const handleUpdate = () => {
    if (!editSeller) return;
    updateMutation.mutate({ id: editSeller.id, data: {
      name: editForm.name || undefined,
      phone: editForm.phone || undefined,
      address: editForm.address || undefined,
      notes: editForm.notes || undefined,
      isActive: editForm.isActive,
    }}, {
      onSuccess: () => {
        toast.success("Vendeur mis à jour");
        queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
        setEditSeller(null);
      },
      onError: () => toast.error("Erreur lors de la mise à jour"),
    });
  };

  const handleDelete = (s: Seller) => {
    if (!confirm(`Supprimer ${s.name} ?`)) return;
    deleteMutation.mutate({ id: s.id }, {
      onSuccess: () => {
        toast.success("Vendeur supprimé");
        queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
      },
      onError: () => toast.error("Ce vendeur a des ventes associées — désactivez-le plutôt"),
    });
  };

  const FormFields = ({ f, setF }: { f: typeof form; setF: (v: typeof form) => void }) => (
    <div className="space-y-4">
      <div>
        <Label>Nom *</Label>
        <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="mt-1" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Téléphone</Label>
          <Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Adresse</Label>
          <Input value={f.address} onChange={e => setF({ ...f, address: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="mt-1" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Vendeurs Externes</h1>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nouveau Vendeur</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
            <DialogHeader><DialogTitle>Ajouter un vendeur</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <FormFields f={form} setF={setForm} />
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Depuis</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              </TableCell></TableRow>
            ) : sellers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Aucun vendeur enregistré.
              </TableCell></TableRow>
            ) : (
              sellers.map(s => (
                <TableRow key={s.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.address || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{s.notes || "-"}</TableCell>
                  <TableCell>
                    {s.isActive
                      ? <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><UserCheck className="h-3 w-3 mr-1" /> Actif</Badge>
                      : <Badge className="bg-muted text-muted-foreground border-border"><UserX className="h-3 w-3 mr-1" /> Inactif</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDateFr(s.createdAt.toString().split("T")[0])}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(s)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editSeller} onOpenChange={(open) => !open && setEditSeller(null)}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>Modifier — {editSeller?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nom *</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Adresse</Label>
                <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editForm.isActive} onCheckedChange={v => setEditForm({ ...editForm, isActive: v })} />
              <Label>{editForm.isActive ? "Actif" : "Inactif"}</Label>
            </div>
            <Button className="w-full" onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
