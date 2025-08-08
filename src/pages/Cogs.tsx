import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

export default function Cogs() {
  return (
    <div className="space-y-6">
      <SEO title="COGS | Etsy Profit Radar" description="Manage per-product costs used for live profit and pricing analysis." />
      <h1 className="text-2xl font-bold">Cost of Goods (COGS)</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Input material, labor, or POD fulfillment costs per SKU.</p>
        </CardContent>
      </Card>
    </div>
  );
}
