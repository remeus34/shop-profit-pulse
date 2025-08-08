import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

export default function Research() {
  return (
    <div className="space-y-6">
      <SEO title="Product Research | Etsy Profit Radar" description="Discover trending products, keywords, and underserved niches." />
      <h1 className="text-2xl font-bold">Professional Product Research</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Analyze competitor pricing, keywords, and market saturation to find high ROI ideas.</p>
        </CardContent>
      </Card>
    </div>
  );
}
