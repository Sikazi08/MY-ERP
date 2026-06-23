import { useAuth } from "@/lib/auth-context";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { Loader2, Smartphone, Package, ShoppingCart, TrendingDown, TrendingUp, Users, Wallet, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = stats as any;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>

      {/* Sales & Finance */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventes du jour</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.salesToday}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recettes du jour</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(stats.revenuToday)}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses du jour</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatFCFA(stats.expensesToday)}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solde journalier</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.cashBalanceToday < 0 ? "text-destructive" : "text-green-500"}`}>
              {formatFCFA(stats.cashBalanceToday)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phones Section */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />Téléphones</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Stock Actuel</CardTitle>
              <Smartphone className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.phonesInStock ?? stats.productsInStock}</div>
              <p className="text-xs text-muted-foreground mt-1">Téléphones en magasin</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Chez Partenaires</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.phonesAtPartner ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Téléphones en dépôt</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendus</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.phonesSold ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Historique téléphones</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accessories Section */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package className="h-5 w-5 text-blue-400" />Appareils / Accessoires</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En Stock</CardTitle>
              <Package className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.accessoriesInStock ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Références en magasin</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Chez Partenaires</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.accessoriesAtPartner ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Accessoires en dépôt</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendus</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.accessoriesSold ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Historique accessoires</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin stats */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bénéfice du jour</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{formatFCFA(s.profitToday)}</div></CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bénéfice du mois</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{formatFCFA(s.profitMonth)}</div></CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Nouveaux Clients</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{s.newClientsToday}</div>
              <p className="text-xs text-muted-foreground mt-1">Aujourd'hui</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-foreground">{s.totalClients}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Low stock alert (accessories only) */}
      {s.lowStockProducts && s.lowStockProducts.length > 0 && (
        <Card className="bg-card border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alertes Stock Faible — Accessoires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Produit</TableHead>
                    <TableHead>Marque</TableHead>
                    <TableHead className="text-center">Qté restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.lowStockProducts.map((p: any) => (
                    <TableRow key={p.id} className="border-border border-b last:border-0 hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{p.product}</TableCell>
                      <TableCell className="text-muted-foreground">{p.brand || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-destructive border-destructive/50 bg-destructive/10">{p.quantity ?? 0} restant{(p.quantity ?? 0) !== 1 ? "s" : ""}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
