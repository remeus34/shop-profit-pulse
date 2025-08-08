import { useRef, useState } from "react";
import Papa from "papaparse";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Minimal CSV import component with duplicate order detection (user_id, order_id)
// Assumes authentication is enabled (RLS). Will toast and abort if user is not logged in.
export default function CsvImport({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const getVal = (row: Record<string, any>, candidates: string[]) => {
    for (const key of Object.keys(row)) {
      const nk = normalize(key);
      if (candidates.some((c) => nk === normalize(c))) return row[key];
    }
    return undefined;
  };

  const parseNumber = (v: any) => {
    if (v == null) return 0;
    const s = String(v).replace(/[^0-9.-]/g, "");
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  const handleImport = async () => {
    try {
      if (!fileRef.current?.files?.[0]) {
        toast({ title: "No file selected", description: "Please choose a CSV file to import." });
        return;
      }

      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Sign in required",
          description: "You need to be logged in to import orders.",
          variant: "destructive" as any,
        });
        setLoading(false);
        return;
      }

      const file = fileRef.current.files[0];

      const rows: any[] = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          worker: true,
          complete: (res) => resolve(res.data as any[]),
          error: (err) => reject(err),
        });
      });

      if (!rows.length) {
        toast({ title: "No rows found", description: "The CSV appears to be empty." });
        setLoading(false);
        return;
      }

      // Group by Order ID
      const grouped = new Map<string, any[]>();
      for (const r of rows) {
        const oid = getVal(r, ["Order ID", "OrderID", "Receipt ID", "ReceiptID", "Order Number"]) || "";
        const orderId = String(oid || "").trim();
        if (!orderId) continue;
        if (!grouped.has(orderId)) grouped.set(orderId, []);
        grouped.get(orderId)!.push(r);
      }

      if (!grouped.size) {
        toast({ title: "No Order IDs detected", description: "Ensure the CSV includes an 'Order ID' column." });
        setLoading(false);
        return;
      }

      // Build orders payload
      const ordersPayload: any[] = [];
      const orderItemsByOrderId: Record<string, any[]> = {};

      for (const [orderId, items] of grouped.entries()) {
        let totalPrice = 0;
        let totalFees = 0;
        let totalCogs = 0; // unknown in CSV; keep 0 by default

        const first = items[0];
        const dateStr =
          getVal(first, ["Sale Date", "Order Date", "Created At", "CreatedAt"]) ||
          getVal(first, ["SaleDate", "OrderDate"]) ||
          undefined;
        const orderDate = dateStr ? new Date(dateStr) : undefined;
        const storeName = getVal(first, ["Shop Name", "Store", "Store Name"]) || "CSV Import";

        const lineItems: any[] = [];
        for (const row of items) {
          const product =
            getVal(row, ["Title", "Item Name", "Listing Title", "Product Name"]) || "Unknown";
          const sku = getVal(row, ["SKU", "Sku"]) || null;
          const size = getVal(row, ["Size", "Variation", "Variations"]) || null;
          const qtyRaw = getVal(row, ["Quantity", "Qty"]) ?? 1;
          const quantity = parseInt(String(qtyRaw).replace(/[^0-9-]/g, "")) || 1;
          const price = parseNumber(
            getVal(row, ["Item Total", "Price", "Unit Price", "ItemPrice"]) ?? 0
          );
          const fees = parseNumber(
            getVal(row, ["Fees", "Transaction Fee", "Processing Fee"]) ?? 0
          );
          const cogs = 0; // not available from Etsy CSV typically

          totalPrice += price;
          totalFees += fees;
          totalCogs += cogs;

          lineItems.push({ product_name: product, sku, size, quantity, price, fees, cogs });
        }

        ordersPayload.push({
          user_id: session.user.id,
          order_id: orderId,
          order_date: orderDate ? orderDate.toISOString() : null,
          store_name: storeName ?? null,
          shop_id: null,
          source: "csv",
          total_price: totalPrice,
          total_fees: totalFees,
          total_cogs: totalCogs,
        });
        orderItemsByOrderId[orderId] = lineItems;
      }

      // Upsert orders (dedupe by user_id, order_id)
      const { data: insertedOrders, error: upsertErr } = await supabase
        .from("orders")
        .upsert(ordersPayload, { onConflict: "user_id,order_id" })
        .select("id, order_id");

      if (upsertErr) throw upsertErr;

      const insertedMap = new Map<string, string>();
      (insertedOrders || []).forEach((o) => insertedMap.set(o.order_id, o.id));

      // Insert items for only the newly inserted orders
      const itemsToInsert: any[] = [];
      for (const [orderId, lines] of Object.entries(orderItemsByOrderId)) {
        const orderPk = insertedMap.get(orderId);
        if (!orderPk) continue; // skip duplicates
        for (const li of lines) {
          itemsToInsert.push({ order_id_fk: orderPk, ...li });
        }
      }

      if (itemsToInsert.length) {
        const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      const totalUnique = grouped.size;
      const insertedCount = insertedMap.size;
      const dupes = totalUnique - insertedCount;

      toast({
        title: `${insertedCount} new orders imported` + (dupes ? `, ${dupes} duplicates skipped` : ""),
        description: `${totalUnique} unique orders detected in CSV.`,
      });

      onImported?.();
      fileRef.current.value = "";
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Import failed",
        description: e?.message || "Please verify your CSV format and try again.",
        variant: "destructive" as any,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        ref={fileRef}
        type="file"
        accept=".csv"
        onChange={() => setFileName(fileRef.current?.files?.[0]?.name ?? "")}
        aria-label="Upload orders CSV file"
        className="sr-only"
      />
      <Button type="button" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
        Upload CSV
      </Button>
      <Button onClick={handleImport} disabled={loading} variant="secondary" className="w-full sm:w-auto">
        {loading ? "Importing..." : "Import CSV"}
      </Button>
      {fileName && <span className="text-sm text-muted-foreground truncate">{fileName}</span>}
    </div>
  );
}
