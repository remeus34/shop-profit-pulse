import SEO from "@/components/SEO";
import heroImage from "@/assets/hero-etsy-profit-radar.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const data = [
  { name: "Mon", revenue: 1200, profit: 320 },
  { name: "Tue", revenue: 1800, profit: 540 },
  { name: "Wed", revenue: 1500, profit: 420 },
  { name: "Thu", revenue: 2100, profit: 650 },
  { name: "Fri", revenue: 2400, profit: 760 },
  { name: "Sat", revenue: 2000, profit: 590 },
  { name: "Sun", revenue: 1700, profit: 480 },
];

const Index = () => {
  return (
    <div className="space-y-6">
      <SEO
        title="Etsy Profit Radar | Real-time Profit Tracking"
        description="Track profits, orders, ads, shipping, and COGS across multiple Etsy shops. Live sync or CSV uploads."
        canonical="/"
      />

      <section className="grid gap-6">
        <div className="flex flex-col lg:flex-row items-center gap-6 rounded-lg border bg-card p-6 shadow-sm">
          <img
            src={heroImage}
            alt="Analytics dashboard hero for Etsy Profit Radar"
            loading="lazy"
            className="w-full lg:w-1/2 rounded-md"
          />
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
              Real-time Profit Intelligence for Etsy Sellers
            </h1>
            <p className="mt-3 text-muted-foreground">
              Automated profit estimates, orders, ads, shipping, and research—without spreadsheets.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/connect">
                <Button>Connect Etsy</Button>
              </a>
              <a href="/orders">
                <Button variant="secondary">Upload CSV</Button>
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Revenue (7d)</div>
              <div className="mt-1 text-2xl font-semibold">$12,340</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Expenses (7d)</div>
              <div className="mt-1 text-2xl font-semibold">$8,920</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Net Profit (7d)</div>
              <div className="mt-1 text-2xl font-semibold">$3,420</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="mb-2 font-medium">Profit Trend (7 days)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Index;
