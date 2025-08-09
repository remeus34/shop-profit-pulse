import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import ShippingCsvImport from "@/components/shipping/ShippingCsvImport";
import ShippingLabelsTable from "@/components/shipping/ShippingLabelsTable";

export default function Shipping() {
  return (
    <div className="space-y-6">
      <SEO title="Shipping | Etsy Profit Radar" description="Track shipping expenses and match costs to orders." />
      <h1 className="text-2xl font-bold">Shipping Expenses</h1>
      <Card>
        <CardContent className="pt-4">
          <p className="text-muted-foreground">Upload CSVs from services like PirateShip and monitor spend over time.</p>
          <ShippingCsvImport />
        </CardContent>
      </Card>
      <ShippingLabelsTable />
    </div>
  );
}
