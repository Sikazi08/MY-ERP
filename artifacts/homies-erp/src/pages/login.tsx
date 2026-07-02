import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
const logoImg = `${import.meta.env.BASE_URL}logo.png`;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Veuillez saisir votre nom d'utilisateur.");
      return;
    }
    if (!password) {
      toast.error("Veuillez saisir votre mot de passe.");
      return;
    }
    loginMutation.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetMeQueryKey(), data.user);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast.success("Connexion réussie.");
          setLocation("/");
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast.error(msg || "Identifiants incorrects. Vérifiez votre nom d'utilisateur et mot de passe.");
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl">
        <CardHeader className="p-6 space-y-4 flex flex-col items-center pt-[20px] pb-[20px]">
          <img src={logoImg} alt="The Homies" className="h-44 w-auto object-contain" />
          <p className="text-muted-foreground text-sm mt-[2px] mb-[2px]" style={{ marginTop: '-1.5cm' }}>
            Connectez-vous pour accéder à votre espace
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-0 pr-[24px] pb-[55px]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ex: admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loginMutation.isPending}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loginMutation.isPending}
                className="bg-background"
              />
            </div>
            <Button
              type="submit"
              className="w-full font-bold uppercase tracking-wider"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
