import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetFinancialStats, getGetFinancialStatsQueryKey, useGetTopProducts, getGetTopProductsQueryKey } from "@workspace/api-client-react";
import type { GetFinancialStatsPeriod } from "@workspace/api-client-react";
import { formatFCFA } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Medal } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface TopSeller {
  vendorName: string;
  salesCount: number;
  revenue: number;
}

async function fetchTopSellers(limit: number): Promise<TopSeller[]> {
  const res = await fetch(`/api/stats/top-sellers?limit=${limit}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

const MEDAL_COLORS = ["#f97316", "#94a3b8", "#b45309"];
const MEDAL_LABELS = ["🥇", "🥈", "🥉"];

export default function Statistiques() {
  const [period, setPeriod] = useState<"day"|"week"|"month">("week");

  const { data: finStats, isLoading: finLoading } = useGetFinancialStats({ period }, { query: { queryKey: getGetFinancialStatsQueryKey({ period }) } });
  const { data: topProducts, isLoading: topLoading } = useGetTopProducts({ limit: 10 }, { query: { queryKey: getGetTopProductsQueryKey({ limit: 10 }) } });
  const { data: topSellers = [], isLoading: sellersLoading } = useQuery<TopSeller[]>({
    queryKey: ["top-sellers"],
    queryFn: () => fetchTopSellers(3),
  });

  const isLoading = finLoading || topLoading || sellersLoading;

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

      {isLoading ? (
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
                <CardTitle>Top 10 Produits Vendus</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center font-bold text-sm text-primary">{i+1}</div>
                        <div>
                          <p className="font-medium leading-none">{p.product}</p>
                          <p className="text-xs text-muted-foreground">{p.brand} — {p.count} vendus</p>
                        </div>
                      </div>
                      <div className="font-bold text-sm">{formatFCFA(p.revenue)}</div>
                    </div>
                  ))}
                  {(!topProducts || topProducts.length === 0) && <p className="text-muted-foreground text-center py-4">Pas assez de données.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Top 3 Meilleurs Vendeurs</CardTitle>
                <Medal className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                {topSellers.length > 0 ? (
                  <div className="space-y-4">
                    {topSellers.map((s, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                          style={{ backgroundColor: MEDAL_COLORS[i] + "22", color: MEDAL_COLORS[i] }}
                        >
                          {MEDAL_LABELS[i]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{s.vendorName}</p>
                          <p className="text-xs text-muted-foreground">{s.salesCount} vente{s.salesCount !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{formatFCFA(s.revenue)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="h-[120px] mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topSellers} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                          <XAxis dataKey="vendorName" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333' }} formatter={(v: number) => [formatFCFA(v), "Chiffre d'affaires"]} />
                          <Bar dataKey="revenue" radius={[4,4,0,0]}>
                            {topSellers.map((_, index) => (
                              <Cell key={index} fill={MEDAL_COLORS[index]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Medal className="h-10 w-10 mb-2 opacity-30" />
                    <p className="text-sm">Aucune vente avec vendeur pour l'instant.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
