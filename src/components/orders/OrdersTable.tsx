import { useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import OrdersColumnsCustomizer from "./OrdersColumnsCustomizer";
import { useOrdersColumns, OrdersColumnId } from "./useOrdersColumns";

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
          _product_names: [] as string[],
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
        if (it.product_name) (g._product_names as string[]).push(String(it.product_name));
        // Prefer explicit order-level totals if available
        if (typeof it.order_total_fees === 'number') g.fees = it.order_total_fees;
        if (typeof it.order_total_price === 'number') g._order_total_price = it.order_total_price;
        groupsMap.set(it.order_id, g);
      }

      const groups = Array.from(groupsMap.values()).map((g: any) => {
        const sizes = Array.from(g._sizes as Set<string>);
        const orderTotalPrice = Number(g._order_total_price ?? 0);
        g.size_display = sizes.length === 1 ? sizes[0] : (sizes.length > 1 ? "Multiple" : "");
        const productNames: string[] = (g._product_names as string[]) || [];
        const fullList = productNames.length
          ? productNames.map((p: string, i: number) => `${i + 1} - ${p}`).join('\n')
          : '';
        const shortList = productNames.length
          ? productNames.map((p: string, i: number) => `${i + 1} - ${shortenProductName(p, { delimiters: [","], maxLen: 40 })}`).join('\n')
          : '';
        g.product_display_full = fullList;
        g.product_display_short = shortList;
        g.product_display = shortList; // backward compat for existing render logic
        g.discounts = Math.max(0, g.price - (orderTotalPrice || g.price));
        g.profit = (g.price - g.discounts) - (g.fees || 0) - (g.cogs || 0);
        return g;
      });

      return groups;
    },
  });

  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const { columns, visibleColumns, toggleVisibility, reorder, resize, reset } = useOrdersColumns();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const columnDefs = useMemo(() => ({
    order_id: {
      label: "Order ID",
      render: (g: any) => g.order_id,
      getValue: (g: any) => g.order_id as string | undefined,
    },
    date: {
      label: "Date",
      render: (g: any) => (g.order_date ? new Date(g.order_date).toLocaleDateString() : ""),
      getValue: (g: any) => (g.order_date ? new Date(g.order_date).toLocaleDateString() : ""),
    },
    product_name: {
      label: "Product Name",
      render: (g: any) => (
        <div className="whitespace-pre-line" title={g.product_display_full || undefined}>
          {g.product_display_short}
        </div>
      ),
      getValue: (g: any) => (g.product_display_short as string) || "",
    },
    sku: {
      label: "SKU",
      render: (_g: any) => "",
      getValue: (_g: any) => "",
    },
    size: {
      label: "Size",
      render: (g: any) => g.size_display,
      getValue: (g: any) => g.size_display as string | undefined,
    },
    quantity: {
      label: "Qty",
      render: (g: any) => g.quantity,
      getValue: (g: any) => g.quantity as number | undefined,
    },
    price: {
      label: "Price",
      render: (g: any) => currency(g.price),
      getValue: (g: any) => g.price as number | undefined,
    },
    discounts: {
      label: "Discounts",
      render: (g: any) => currency(g.discounts),
      getValue: (g: any) => g.discounts as number | undefined,
    },
    fees: {
      label: "Fees",
      render: (g: any) => currency(g.fees),
      getValue: (g: any) => g.fees as number | undefined,
    },
    cogs: {
      label: "COGS",
      render: (g: any) => currency(g.cogs),
      getValue: (g: any) => g.cogs as number | undefined,
    },
    profit: {
      label: "Profit",
      render: (g: any) => currency(g.profit),
      getValue: (g: any) => g.profit as number | undefined,
    },
  } as Record<OrdersColumnId, { label: string; render: (g: any) => any; getValue: (g: any) => any }>), []);

  // Column resize handlers
  const resizingRef = useRef<null | { id: OrdersColumnId; startX: number; startWidth: number }>(null);
  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { id, startX, startWidth } = resizingRef.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(60, startWidth + delta);
    resize(id, newWidth);
  };
  const onMouseUp = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    resizingRef.current = null;
  };
  const handleResizeStart = (e: React.MouseEvent, id: OrdersColumnId) => {
    const col = columns.find((c) => c.id === id);
    const startWidth = col?.width ?? ((e.currentTarget.parentElement as HTMLElement)?.offsetWidth || 120);
    resizingRef.current = { id, startX: e.clientX, startWidth };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Suggest hiding columns that are completely empty across visible rows (non-blocking)
  useEffect(() => {
    if (!rows || !rows.length) return;
    const suggestedKey = "orders_columns_suggested_v1";
    let suggested: Record<string, boolean> = {};
    try { suggested = JSON.parse(localStorage.getItem(suggestedKey) || "{}"); } catch {}
    for (const col of visibleColumns) {
      const getter = columnDefs[col.id]?.getValue;
      if (!getter) continue;
      const allEmpty = rows.every((g: any) => {
        const v = getter(g);
        if (v === null || v === undefined) return true;
        const s = String(v);
        return s.trim() === "" || s === "0" && (col.id === "quantity" || col.id === "price" || col.id === "fees" || col.id === "cogs" || col.id === "profit");
      });
      if (allEmpty && !suggested[col.id]) {
        toast({
          title: `${columnDefs[col.id].label} is empty for all rows`,
          description: "You can hide it to declutter the table.",
          action: (
            <ToastAction altText="Hide column" onClick={() => toggleVisibility(col.id, false)}>
              Hide column
            </ToastAction>
          ),
        });
        suggested[col.id] = true;
        localStorage.setItem(suggestedKey, JSON.stringify(suggested));
        break;
      }
    }
  }, [rows, visibleColumns, columnDefs, toast, toggleVisibility]);

  useEffect(() => {
    // just to avoid lint warnings about refetch not used
    void refetch;
  }, [refetch]);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Customize columns
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead
                    key={col.id}
                    className="relative select-none"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {columnDefs[col.id].label}
                    <span
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                      onMouseDown={(e) => handleResizeStart(e, col.id)}
                    />
                  </TableHead>
                ))}
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
                      {visibleColumns.map((col) => (
                        <TableCell key={`${g.order_id}-${col.id}`} style={col.width ? { width: col.width } : undefined}>
                          {columnDefs[col.id].render(g)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ),
                  openRows[g.order_id] ? (
                    <TableRow key={`${g.order_id}-details`}>
                      <TableCell colSpan={visibleColumns.length}>
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

        <OrdersColumnsCustomizer
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          columns={columns}
          onToggle={toggleVisibility}
          onReorder={reorder}
          onReset={reset}
        />
      </CardContent>
    </Card>
  );
}
