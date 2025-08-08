import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

export default function ProductInsights() {
  return (
    <div className="space-y-6">
      <SEO title="Product Insights | Etsy Profit Radar" description="Visualize bestsellers, trending products, and low performers." />
      <h1 className="text-2xl font-bold">Product Insights</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Track sales velocity and profitability by SKU and variation.</p>
        </CardContent>
      </Card>
    </div>
  );
}
