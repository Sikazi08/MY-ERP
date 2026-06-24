import { useState } from "react";
import { useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import type { UserInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

export default function Utilisateurs() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: users = [], isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();

  const form = useForm<UserInput>({
    defaultValues: {
      username: "",
      password: "",
      fullName: "",
      role: "secretary"
    }
  });

  const onSubmit = (data: UserInput) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast.success("Utilisateur créé avec succès");
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsAddOpen(false);
        form.reset();
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg || "Erreur lors de la création. Le nom d'utilisateur est peut-être déjà utilisé.");
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Attention, cela supprimera l'accès de cet utilisateur. Continuer ?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast.success("Utilisateur supprimé");
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestion des Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les accès administrateurs et secrétaires au système.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel Utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle>Créer un compte accès</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="fullName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom Complet</FormLabel>
                    <FormControl><Input {...field} required /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identifiant de connexion</FormLabel>
                    <FormControl><Input {...field} required /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl><Input type="password" {...field} required /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle / Permissions</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="secretary">Secrétaire (Accès limité)</SelectItem>
                        <SelectItem value="admin">Administrateur (Accès total)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Créer le compte"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Nom Complet</TableHead>
              <TableHead>Identifiant</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Date création</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className="border-border">
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{u.username}</TableCell>
                  <TableCell>
                    {u.role === 'admin' ? (
                      <Badge className="bg-primary/20 text-primary border-primary/20"><ShieldAlert className="w-3 h-3 mr-1"/> Admin</Badge>
                    ) : (
                      <Badge variant="outline" className="border-border">Secrétaire</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDateFr(u.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
