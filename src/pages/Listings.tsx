import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

export default function Listings() {
  return (
    <div className="space-y-6">
      <SEO title="Listings | Etsy Profit Radar" description="Explore profit margins and cost breakdowns per listing." />
      <h1 className="text-2xl font-bold">Listing Statistics</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Compare margins and performance across your listings. Filters coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
