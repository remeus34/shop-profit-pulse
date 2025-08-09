import { useEffect, useState } from "react";
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

// Shorten long product names for display only (keeps stored values intact)
function shortenProductName(name?: string | null, opts?: { delimiters?: string[]; maxLen?: number }) {
  const s = (name ?? "").trim();
  if (!s) return "";
  const delimiters = opts?.delimiters ?? [",", " | ", " - ", "|", "-"];
  let cutIndex = -1;
  for (const d of delimiters) {
    const idx = s.indexOf(d);
    if (idx > 0) cutIndex = cutIndex === -1 ? idx : Math.min(cutIndex, idx);
  }
  let base = cutIndex > 0 ? s.slice(0, cutIndex).trim() : s;
  const maxLen = opts?.maxLen ?? 50;
  if (base.length > maxLen) {
    return base.slice(0, maxLen - 3).trimEnd() + "...";
  }
  return base;
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
          "id, product_name, sku, size, quantity, price, fees, cogs, profit, orders(order_id, order_date, store_name, source, total_price, total_fees, total_cogs)",
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

      // Group by order_id with aggregated totals and item details
      const items = (data || []).map((r: any) => {
        const price = Number(r.price ?? 0);
        const fees = Number(r.fees ?? 0);
        const cogs = Number(r.cogs ?? 0);
        const profit = r.profit ?? (price - fees - cogs);
        return {
          id: r.id,
          order_id: r.orders?.order_id as string,
          order_date: r.orders?.order_date as string | null,
          store_name: r.orders?.store_name as string | null,
          order_total_price: Number(r.orders?.total_price ?? 0),
          order_total_fees: Number(r.orders?.total_fees ?? 0),
          order_total_cogs: Number(r.orders?.total_cogs ?? 0),
          product_name: r.product_name as string | null,
          sku: r.sku as string | null,
          size: r.size as string | null,
          quantity: Number(r.quantity ?? 0),
          price,
          fees,
          cogs,
          profit,
        };
      });

      const groupsMap = new Map<string, any>();
      for (const it of items) {
        if (!it.order_id) continue;
        const g = groupsMap.get(it.order_id) ?? {
          order_id: it.order_id,
          order_date: it.order_date,
          store_name: it.store_name,
          quantity: 0,
          price: 0,
          fees: it.order_total_fees ?? 0, // take from order once
          cogs: 0,
          discounts: 0,
          items: [] as any[],
          _sizes: new Set<string>(),
          _products: new Set<string>(),
          _order_total_price: it.order_total_price ?? 0,
          _order_total_fees: it.order_total_fees ?? 0,
        };
        g.quantity += it.quantity || 0;
        g.price += it.price || 0;
        g.cogs += it.cogs || 0;
        g.items.push({
          id: it.id,
          product_name: it.product_name,
          sku: it.sku,
          size: it.size,
          quantity: it.quantity,
          price: it.price,
          fees: it.fees,
          cogs: it.cogs,
          profit: it.profit,
        });
        if (it.size) {
          const s = String(it.size);
          // Use base size for grouping (ignore appended color like "| Color: White")
          const base = (s.split('|')[0] || s).replace(/,?\s*color:.*/i, '').trim();
          g._sizes.add(base || s);
        }
        if (it.product_name) g._products.add(String(it.product_name));
        // Prefer explicit order-level totals if available
        if (typeof it.order_total_fees === 'number') g.fees = it.order_total_fees;
        if (typeof it.order_total_price === 'number') g._order_total_price = it.order_total_price;
        groupsMap.set(it.order_id, g);
      }

      const groups = Array.from(groupsMap.values()).map((g: any) => {
        const sizes = Array.from(g._sizes as Set<string>);
        const products = Array.from(g._products as Set<string>);
        const orderTotalPrice = Number(g._order_total_price ?? 0);
        g.size_display = sizes.length === 1 ? sizes[0] : (sizes.length > 1 ? "Multiple" : "");
        g.product_display = products.length === 1 ? products[0] : "Multiple items";
        g.discounts = Math.max(0, g.price - (orderTotalPrice || g.price));
        g.profit = (g.price - g.discounts) - (g.fees || 0) - (g.cogs || 0);
        return g;
      });

      return groups;
    },
  });

  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

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
                <TableHead>Discounts</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>COGS</TableHead>
                <TableHead>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11}>Loading…</TableCell>
                </TableRow>
              ) : rows && rows.length ? (
                rows.flatMap((g: any) => [
                  (
                    <TableRow
                      key={g.order_id}
                      className="cursor-pointer"
                      onClick={() => setOpenRows((p) => ({ ...p, [g.order_id]: !p[g.order_id] }))}
                    >
                      <TableCell>{g.order_id}</TableCell>
                      <TableCell>{g.order_date ? new Date(g.order_date).toLocaleDateString() : ""}</TableCell>
                      <TableCell title={g.product_display || undefined}>{shortenProductName(g.product_display)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell>{g.size_display}</TableCell>
                      <TableCell>{g.quantity}</TableCell>
                      <TableCell>{currency(g.price)}</TableCell>
                      <TableCell>{currency(g.discounts)}</TableCell>
                      <TableCell>{currency(g.fees)}</TableCell>
                      <TableCell>{currency(g.cogs)}</TableCell>
                      <TableCell>{currency(g.profit)}</TableCell>
                    </TableRow>
                  ),
                  openRows[g.order_id] ? (
                    <TableRow key={`${g.order_id}-details`}>
                      <TableCell colSpan={11}>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Price</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {g.items.map((it: any) => (
                                <TableRow key={it.id}>
                                  <TableCell>{it.product_name}</TableCell>
                                  <TableCell>{it.sku}</TableCell>
                                  <TableCell>{it.size}</TableCell>
                                  <TableCell>{it.quantity}</TableCell>
                                  <TableCell>{currency(it.price)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null,
                ])
              ) : (
                <TableRow>
                  <TableCell colSpan={11}>No orders found.</TableCell>
                </TableRow>
              )}

            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
