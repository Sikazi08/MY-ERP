import { useState } from "react";
import { useGetFinancialStats, getGetFinancialStatsQueryKey, useGetTopProducts, getGetTopProductsQueryKey, useGetPaymentBreakdown, getGetPaymentBreakdownQueryKey } from "@workspace/api-client-react";
import type { GetFinancialStatsPeriod, GetPaymentBreakdownPeriod } from "@workspace/api-client-react";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

export default function Statistiques() {
  const [period, setPeriod] = useState<"day"|"week"|"month">("week");

  const { data: finStats, isLoading: finLoading } = useGetFinancialStats({ period }, { query: { queryKey: getGetFinancialStatsQueryKey({ period }) } });
  const { data: topProducts, isLoading: topLoading } = useGetTopProducts({ limit: 5 }, { query: { queryKey: getGetTopProductsQueryKey({ limit: 5 }) } });
  const { data: paymentStats, isLoading: payLoading } = useGetPaymentBreakdown({ period }, { query: { queryKey: getGetPaymentBreakdownQueryKey({ period }) } });

  const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981'];

  const paymentChartData = paymentStats ? [
    { name: 'Orange Money', value: paymentStats.om },
    { name: 'Mobile Money', value: paymentStats.momo },
    { name: 'Cash', value: paymentStats.cash },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Rapports Financiers</h1>
        <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Aujourd'hui</SelectItem>
            <SelectItem value="week">7 derniers jours</SelectItem>
            <SelectItem value="month">Ce mois-ci</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {finLoading || topLoading || payLoading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Chiffre d'Affaires</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-foreground">{formatFCFA(finStats?.revenue)}</div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses Totales</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-destructive">{formatFCFA(finStats?.expenses)}</div>
              </CardContent>
            </Card>

            <Card className="bg-primary border-primary text-primary-foreground">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium opacity-90">Bénéfice Net</CardTitle>
                <DollarSign className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">{formatFCFA(finStats?.profit)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card border-border col-span-2">
              <CardHeader>
                <CardTitle>Évolution Recettes vs Dépenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={finStats?.revenueByDay || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333' }} formatter={(value: number) => [formatFCFA(value), ""]} />
                      <Legend />
                      <Area type="monotone" name="Recettes" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" name="Dépenses" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Top 5 Produits Vendus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center font-bold text-sm text-primary">{i+1}</div>
                        <div>
                          <p className="font-medium leading-none">{p.product}</p>
                          <p className="text-xs text-muted-foreground">{p.brand} — {p.count} vendus</p>
                        </div>
                      </div>
                      <div className="font-bold">{formatFCFA(p.revenue)}</div>
                    </div>
                  ))}
                  {(!topProducts || topProducts.length === 0) && <p className="text-muted-foreground text-center py-4">Pas assez de données.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Répartition des Paiements</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentChartData.length > 0 ? (
                  <div className="h-[250px] w-full flex items-center">
                     <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {paymentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333' }} formatter={(value: number) => formatFCFA(value)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Aucune donnée de paiement pour cette période.</p>
                )}
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}
