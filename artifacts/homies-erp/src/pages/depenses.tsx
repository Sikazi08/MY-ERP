import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListExpenses, useCreateExpense, useDeleteExpense, getListExpensesQueryKey } from "@workspace/api-client-react";
import type { ExpenseInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { format } from "date-fns";

export default function Depenses() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: allExpenses = [], isLoading } = useListExpenses({}, { query: { queryKey: getListExpensesQueryKey() } });
  const total = allExpenses.length;
  const totalPages = Math.ceil(total / pageSize);
  const expenses = allExpenses.slice((page - 1) * pageSize, page * pageSize);

  const createMutation = useCreateExpense();
  const deleteMutation = useDeleteExpense();

  const form = useForm<ExpenseInput>({
    defaultValues: {
      label: "",
      amount: 0,
      expenseDate: format(new Date(), "yyyy-MM-dd"),
    }
  });

  const onSubmit = (data: ExpenseInput) => {
    createMutation.mutate({ data }, {
      onSuccess: () => {
        toast.success("Dépense enregistrée");
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        setIsAddOpen(false);
        form.reset();
      }
    });
  };

  const handleExport = () => {
    window.open('/api/exports/expenses', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dépenses</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Exporter
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle Dépense
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>Enregistrer une dépense</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="label" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Libellé / Motif</FormLabel>
                      <FormControl><Input {...field} required /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} required /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="expenseDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} required /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/50">
              <TableHead>Date & Heure</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              {isAdmin && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Aucune dépense trouvée.</TableCell></TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense.id} className="border-border hover:bg-muted/50">
                  <TableCell className="text-sm">
                    {formatDateFr(expense.expenseDate)} <br/><span className="text-muted-foreground text-xs">{expense.expenseTime.substring(0,5)}</span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{expense.label}</TableCell>
                  <TableCell className="text-muted-foreground">{expense.user?.fullName || "-"}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">
                    {formatFCFA(expense.amount)}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/20" onClick={() => {
                        if (confirm("Supprimer cette dépense ?")) {
                          deleteMutation.mutate({ id: expense.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() })
                          });
                        }
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
            <p className="text-sm text-muted-foreground">{total} dépense{total !== 1 ? "s" : ""} · page {page}/{totalPages}</p>
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
