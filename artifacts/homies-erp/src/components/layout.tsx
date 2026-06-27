import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  ArrowRightLeft,
  UsersRound,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  UserCog,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
const logoImg = `${import.meta.env.BASE_URL}logo.png`;

const navItems = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: false },
  { href: "/stock", label: "Stock", icon: Package, adminOnly: false },
  { href: "/ventes", label: "Ventes", icon: ShoppingCart, adminOnly: false },
  { href: "/partenaires", label: "Partenaires", icon: Users, adminOnly: false },
  { href: "/depenses", label: "Flux financier", icon: Wallet, adminOnly: false },
  { href: "/mouvements", label: "Mouvements", icon: ArrowRightLeft, adminOnly: false },
  { href: "/clients", label: "Clients", icon: UsersRound, adminOnly: true },
  { href: "/vendeurs", label: "Vendeurs", icon: UserCog, adminOnly: true },
  { href: "/statistiques", label: "Statistiques", icon: BarChart3, adminOnly: true },
  { href: "/utilisateurs", label: "Utilisateurs", icon: Settings, adminOnly: true },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const logout = useLogout();
  const [location] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/login";
      },
    });
  };

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const LogoBlock = () => (
    <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
      <img src={logoImg} alt="The Homies" className="h-16 w-auto object-contain" />
    </div>
  );

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 px-2 py-4">
      {visibleNavItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                isActive
                  ? "bg-accent text-primary border-l-4 border-primary"
                  : "text-muted-foreground hover:bg-card hover:text-foreground border-l-4 border-transparent"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <LogoBlock />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
          <div className="flex items-center gap-4 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r border-sidebar-border">
                <LogoBlock />
                <NavLinks />
              </SheetContent>
            </Sheet>
            <img src={logoImg} alt="The Homies" className="h-8 w-auto object-contain md:hidden" />
          </div>

          <div className="hidden md:flex flex-1" />

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user?.fullName}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase text-muted-foreground border-border">
                {user?.role}
              </Badge>
            </div>
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center border border-border">
              <span className="text-sm font-bold text-foreground">
                {user?.fullName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
