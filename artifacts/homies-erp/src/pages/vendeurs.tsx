import { useState } from "react";
import {
  useListSellers, useCreateSeller, useUpdateSeller, useDeleteSeller,
  getListSellersQueryKey,
} from "@workspace/api-client-react";
import type { Seller } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateFr } from "@/lib/format";
import { Loader2, Plus, Edit2, Trash2, UserCheck, UserX, Phone, User, ShoppingCart, Calendar } from "lucide-react";

type SellerWithStats = Seller & { salesCount?: number; lastSaleDate?: string | null };
type SellerForm = { name: string; phone: string };
type EditSellerForm = { name: string; phone: string; isActive: boolean };

const EMPTY_FORM: SellerForm = { name: "", phone: "" };

function SellerFormFields({
  name,
  phone,
  onNameChange,
  onPhoneChange,
}: {
  name: string;
  phone: string;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="seller-name" className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" /> Nom *
        </Label>
        <Input
          id="seller-name"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Ex: Moussa Diallo"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="seller-phone" className="flex items-center gap-1">
          <Phone className="h-3.5 w-3.5" /> Numéro de téléphone
        </Label>
        <Input
          id="seller-phone"
          type="tel"
          value={phone}
          onChange={e => onPhoneChange(e.target.value)}
          placeholder="Ex: +224 620 00 00 00"
          autoComplete="off"
        />
      </div>
    </div>
  );
}

export default function Vendeurs() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editSeller, setEditSeller] = useState<SellerWithStats | null>(null);

  const [form, setForm] = useState<SellerForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<EditSellerForm>({ name: "", phone: "", isActive: true });

  const { data: sellers = [], isLoading } = useListSellers() as { data: SellerWithStats[]; isLoading: boolean };
  const createMutation = useCreateSeller();
  const updateMutation = useUpdateSeller();
  const deleteMutation = useDeleteSeller();

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Le nom du vendeur est obligatoire.");
      return;
    }
    createMutation.mutate(
      { data: { name: form.name.trim(), phone: form.phone.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success(`Vendeur "${form.name.trim()}" ajouté avec succès.`);
          queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
          setIsAddOpen(false);
          setForm(EMPTY_FORM);
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg || "Erreur lors de l'ajout du vendeur.");
        },
      }
    );
  };

  const openEdit = (s: SellerWithStats) => {
    setEditSeller(s);
    setEditForm({ name: s.name, phone: s.phone ?? "", isActive: s.isActive });
  };

  const handleUpdate = () => {
    if (!editSeller) return;
    if (!editForm.name.trim()) {
      toast.error("Le nom du vendeur est obligatoire.");
      return;
    }
    updateMutation.mutate(
      {
        id: editSeller.id,
        data: {
          name: editForm.name.trim(),
          phone: editForm.phone.trim() || undefined,
          isActive: editForm.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success("Vendeur mis à jour avec succès.");
          queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
          setEditSeller(null);
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg || "Erreur lors de la mise à jour du vendeur.");
        },
      }
    );
  };

  const handleDelete = (s: SellerWithStats) => {
    if (!confirm(`Supprimer définitivement "${s.name}" ?`)) return;
    deleteMutation.mutate(
      { id: s.id },
      {
        onSuccess: () => {
          toast.success(`Vendeur "${s.name}" supprimé.`);
          queryClient.invalidateQueries({ queryKey: getListSellersQueryKey() });
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg || "Ce vendeur ne peut pas être supprimé (il a des ventes associées). Désactivez-le plutôt.");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendeurs Externes</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gérez les vendeurs associés aux ventes.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setForm(EMPTY_FORM); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nouveau Vendeur</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle>Ajouter un vendeur</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <SellerFormFields
                name={form.name}
                phone={form.phone}
                onNameChange={v => setForm(f => ({ ...f, name: v }))}
                onPhoneChange={v => setForm(f => ({ ...f, phone: v }))}
              />
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center gap-1 justify-center"><ShoppingCart className="h-3.5 w-3.5" /> Nb Ventes</div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Dernière Vente</div>
              </TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                </TableCell>
              </TableRow>
            ) : sellers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Aucun vendeur enregistré.
                </TableCell>
              </TableRow>
            ) : (
              sellers.map(s => (
                <TableRow key={s.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="hover:text-foreground transition-colors flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> {s.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {s.salesCount ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.lastSaleDate ? formatDateFr(s.lastSaleDate) : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell>
                    {s.isActive
                      ? <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><UserCheck className="h-3 w-3 mr-1" /> Actif</Badge>
                      : <Badge className="bg-muted text-muted-foreground border-border"><UserX className="h-3 w-3 mr-1" /> Inactif</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(s)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(s)}
                      >
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
        <DialogContent className="sm:max-w-[420px] bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Modifier — {editSeller?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <SellerFormFields
              name={editForm.name}
              phone={editForm.phone}
              onNameChange={v => setEditForm(f => ({ ...f, name: v }))}
              onPhoneChange={v => setEditForm(f => ({ ...f, phone: v }))}
            />
            <div className="flex items-center gap-3 py-1 px-1 rounded-md border border-border bg-muted/30">
              <Switch
                id="edit-active"
                checked={editForm.isActive}
                onCheckedChange={v => setEditForm(f => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="edit-active" className="cursor-pointer select-none">
                {editForm.isActive ? "Vendeur actif" : "Vendeur inactif"}
              </Label>
            </div>
            <Button
              className="w-full"
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer les modifications"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
