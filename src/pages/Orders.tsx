import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CsvImport from "@/components/orders/CsvImport";
import OrdersFilters, { OrdersFiltersState } from "@/components/orders/OrdersFilters";
import OrdersTable from "@/components/orders/OrdersTable";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Orders() {
  const [filters, setFilters] = useState<OrdersFiltersState>({});
  const [refreshToken, setRefreshToken] = useState(0);

  const { data: storeOptions = [] } = useQuery({
    queryKey: ["order-stores"],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return [] as string[];
      const { data, error } = await supabase
        .from("orders")
        .select("store_name")
        .order("store_name", { ascending: true });
      if (error) throw error;
      const names = (data || []).map((r: any) => r.store_name as string | null).filter(Boolean) as string[];
      return Array.from(new Set(names));
    },
  });
  useEffect(() => {
    const channel = supabase
      .channel("orders-cogs-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        () => setRefreshToken((n) => n + 1)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => setRefreshToken((n) => n + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <SEO title="Orders | Etsy Profit Radar" description="Order-level profit tracking with COGS, fees, taxes, and shipping." />
      <h1 className="text-2xl font-bold">Orders</h1>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-muted-foreground">
            Upload Etsy Orders CSV to get started or connect your shop for live sync. Duplicates are
            automatically detected by Order ID and skipped.
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <CsvImport onImported={() => setRefreshToken((n) => n + 1)} />
            <a href="/connect">
              <Button>Connect Etsy Shop</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <OrdersFilters filters={filters} setFilters={setFilters} storeOptions={storeOptions} />
        </CardContent>
      </Card>

      <OrdersTable filters={filters} refreshToken={refreshToken} />
    </div>
  );
}
