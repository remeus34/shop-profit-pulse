import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Orders() {
  return (
    <div className="space-y-6">
      <SEO title="Orders | Etsy Profit Radar" description="Order-level profit tracking with COGS, fees, taxes, and shipping." />
      <h1 className="text-2xl font-bold">Orders</h1>
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-muted-foreground">Upload Etsy orders CSV to get started or connect your shop for live sync.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept=".csv" />
            <Button variant="secondary">Import CSV</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
