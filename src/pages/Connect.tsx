import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Connect() {
  return (
    <div className="space-y-6">
      <SEO title="Connect Etsy | Etsy Profit Radar" description="Connect multiple Etsy shops via OAuth or upload CSVs." />
      <h1 className="text-2xl font-bold">Connect Etsy or Upload CSV</h1>
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-muted-foreground">Choose how you want to bring data in. You can connect one or more Etsy shops, or continue with manual CSV uploads.</p>
          <div className="flex flex-wrap gap-3">
            <Button>Connect Etsy Shop</Button>
            <a href="/orders">
              <Button variant="secondary">Continue with CSVs</Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
