import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

import type { OrdersFiltersState } from "./OrdersFilters";

function currency(n?: number | null) {
  const num = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(num);
}

export default function OrdersTable({ filters, refreshToken }: { filters: OrdersFiltersState; refreshToken: number }) {
  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["orders-table", filters, refreshToken],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return [] as any[];

      let q = supabase
        .from("order_items")
        .select(
          "id, product_name, sku, size, quantity, price, fees, cogs, profit, orders(order_id, order_date, store_name, source)",
        )
        .order("order_date", { referencedTable: "orders", ascending: false });

      if (filters.product) {
        q = q.ilike("product_name", `%${filters.product}%`);
      }
      if (filters.store) {
        q = q.eq("orders.store_name", filters.store);
      }
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        q = q.gte("orders.order_date", start.toISOString());
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setDate(end.getDate() + 1); // exclusive upper bound
        q = q.lt("orders.order_date", end.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;

      // Flatten nested rows
      return (data || []).map((r: any) => ({
        id: r.id,
        order_id: r.orders?.order_id,
        order_date: r.orders?.order_date,
        store_name: r.orders?.store_name,
        product_name: r.product_name,
        sku: r.sku,
        size: r.size,
        quantity: r.quantity,
        price: r.price,
        fees: r.fees,
        cogs: r.cogs,
        profit: r.profit,
      }));
    },
  });

  useEffect(() => {
    // just to avoid lint warnings about refetch not used
    void refetch;
  }, [refetch]);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>COGS</TableHead>
                <TableHead>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10}>Loading…</TableCell>
                </TableRow>
              ) : rows && rows.length ? (
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.order_id}</TableCell>
                    <TableCell>
                      {r.order_date ? new Date(r.order_date).toLocaleDateString() : ""}
                    </TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell>{r.sku}</TableCell>
                    <TableCell>{r.size}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell>{currency(r.price)}</TableCell>
                    <TableCell>{currency(r.fees)}</TableCell>
                    <TableCell>{currency(r.cogs)}</TableCell>
                    <TableCell>{currency(r.profit)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10}>No orders found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
