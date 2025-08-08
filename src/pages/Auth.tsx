import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if already signed in
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) navigate("/orders");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/orders");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Signed in", description: "Welcome back!" });
        navigate("/orders");
      } else {
        const redirectUrl = `${window.location.origin}/orders`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirm your sign-up to continue." });
      }
    } catch (err: any) {
      toast({ title: "Authentication error", description: err?.message || "Try again.", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <SEO title="Sign in | Etsy Profit Radar" description="Sign in or create an account to import orders and manage your data." />
      <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : "Create an account"}</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}</Button>
              <Button type="button" variant="secondary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}> 
                {mode === "signin" ? "Create account" : "Have an account? Sign in"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
