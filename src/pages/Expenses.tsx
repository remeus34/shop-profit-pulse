import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";

export default function Expenses() {
  return (
    <div className="space-y-6">
      <SEO title="Operating Expenses | Etsy Profit Radar" description="Track non-product overhead and analyze trends." />
      <h1 className="text-2xl font-bold">Operating Expenses</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Tag, filter, and analyze your overhead costs like packaging and tools.</p>
        </CardContent>
      </Card>
    </div>
  );
}
