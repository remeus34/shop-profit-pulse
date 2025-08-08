import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

export default function Ads() {
  return (
    <div className="space-y-6">
      <SEO title="Advertising Insights | Etsy Profit Radar" description="ROAS, TACoS, BEROAS, and per-product ad profitability." />
      <h1 className="text-2xl font-bold">Advertising Insights</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Detailed Etsy Ads reporting coming soon, including per-listing performance.</p>
        </CardContent>
      </Card>
    </div>
  );
}
