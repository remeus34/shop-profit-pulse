import { useRef, useState, useEffect } from "react";
import Papa from "papaparse";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

// Minimal CSV import component with duplicate order detection (user_id, order_id)
// Assumes authentication is enabled (RLS). Will toast and abort if user is not logged in.
export default function CsvImport({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [authed, setAuthed] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const getVal = (row: Record<string, any>, candidates: string[]) => {
    for (const key of Object.keys(row)) {
      const nk = normalize(key);
      if (candidates.some((c) => nk === normalize(c))) return row[key];
    }
    return undefined;
  };

  const parseNumber = (v: any) => {
    if (v == null || v === "") return 0;
    const raw = String(v).trim();
    const isParenNegative = /^\(.*\)$/.test(raw);
    const cleaned = raw.replace(/[^0-9.-]/g, "");
    let num = parseFloat(cleaned);
    if (isNaN(num)) num = 0;
    if (isParenNegative && num > 0) num = -num; // Handle (1.23) style negatives
    return num;
  };

  useEffect(() => {
    let active = true;
    // Listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthed(!!session?.user);
    });
    // Then get existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setAuthed(!!session?.user);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleImport = async () => {
    try {
      if (!fileRef.current?.files?.[0]) {
        toast({ title: "No file selected", description: "Please choose a CSV file to import." });
        return;
      }

      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Your session may have expired. Please log in to import orders.",
          variant: "destructive" as any,
        });
        setLoading(false);
        navigate("/auth");
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
        let totalCogs = 0; // COGS not present in Etsy CSV by default

        const first = items[0];
        const dateStr =
          getVal(first, ["Sale Date", "Order Date", "Created At", "CreatedAt"]) ||
          getVal(first, ["SaleDate", "OrderDate"]) ||
          undefined;
        const orderDate = dateStr ? new Date(dateStr) : undefined;
        const storeName = getVal(first, ["Shop Name", "Store", "Store Name"]) || "CSV Import";

        // Prefer default Etsy fields and avoid Adjusted values unless we must fall back
        const revenue = (() => {
          // Primary: default fields
          let val = 0;
          const primary =
            getVal(first, ["Order Net", "Order Net Amount", "OrderNet", "Net Amount", "Net"]); // default net
          val = parseNumber(primary);
          // Secondary: totals/gross
          if (!val) {
            const secondary = getVal(first, ["Order Total", "Order Value", "Total", "Amount"]);
            val = parseNumber(secondary);
          }
          // Fallback: sum of item totals if present
          if (!val) {
            val = items.reduce(
              (sum, row) => sum + parseNumber(getVal(row, ["Item Total", "Price", "Unit Price", "ItemPrice"]) ?? 0),
              0,
            );
          }
          // Last resort: adjusted
          if (!val) {
            const adjusted = getVal(first, ["Adjusted Order Net", "Adjusted Net Amount", "Adjusted Order Total"]);
            val = parseNumber(adjusted);
          }
          return val;
        })();

        const fees = (() => {
          // Sum of common fee columns (default ones first)
          const feeCols = [
            "Card Processing Fees",
            "Payment Processing Fee",
            "Processing Fee",
            "Transaction Fee",
            "Listing Fees",
            "Order Fees",
            "Etsy Fees",
            "Regulatory Operating fee",
            "Regulatory Operating Fee",
          ];
          let sum = 0;
          for (const col of feeCols) sum += parseNumber(getVal(first, [col]) ?? 0);

          // If still zero, try row-wise generic fees
          if (!sum) {
            sum = items.reduce(
              (acc, row) => acc + parseNumber(getVal(row, ["Fees", "Transaction Fee", "Processing Fee"]) ?? 0),
              0,
            );
          }
          // Last resort: adjusted fees
          if (!sum) sum = parseNumber(getVal(first, ["Adjusted Fees"]) ?? 0);
          return sum;
        })();

        // Quantity (sum across rows if available)
        const quantityTotal = items.reduce((acc, row) => {
          const qtyRaw = getVal(row, ["Quantity", "Qty"]) ?? 1;
          const q = parseInt(String(qtyRaw).replace(/[^0-9-]/g, "")) || 1;
          return acc + q;
        }, 0) || 1;

        // Single summary line per order to ensure financials show up in the table
        const lineItems = [
          {
            product_name: "Order Summary",
            sku: null,
            size: null,
            quantity: quantityTotal,
            price: revenue,
            fees,
            cogs: totalCogs,
            // Do not insert profit directly; DB may compute it or we compute client-side
          },
        ];

        ordersPayload.push({
          user_id: user.id,
          order_id: orderId,
          order_date: orderDate ? orderDate.toISOString() : null,
          store_name: storeName ?? null,
          shop_id: null,
          source: "csv",
          total_price: revenue,
          total_fees: fees,
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
      {fileName && <span className="text-sm text-muted-foreground truncate" aria-live="polite">{fileName}</span>}
      {!authed && (
        <a href="/auth" className="text-sm underline text-primary">Sign in</a>
      )}
    </div>
  );
}
