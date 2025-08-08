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
      const files = Array.from(fileRef.current?.files || []);
      if (!files.length) {
        toast({ title: "No files selected", description: "Please choose one or two Etsy CSV files to import." });
        return;
      }

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      // Parse all CSVs
      const parseCsv = (file: File) =>
        new Promise<any[]>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            worker: true,
            complete: (res) => resolve((res.data as any[]) || []),
            error: (err) => reject(err),
          });
        });

      const parsedFiles = await Promise.all(files.map(parseCsv));

      // Heuristics to detect Items vs Summary CSVs
      const isItemsFile = (rows: any[]) => {
        if (!rows?.length) return false;
        const keys = Object.keys(rows[0] || {}).map((k) => normalize(k));
        const hasItemName = keys.includes(normalize("Item Name")) || keys.includes(normalize("Title"));
        const hasSku = keys.includes(normalize("SKU")) || keys.includes(normalize("Product SKU"));
        const hasVariations = keys.includes(normalize("Variations")) || keys.includes(normalize("Variation")) || keys.includes(normalize("Options"));
        return hasItemName || hasSku || hasVariations;
      };

      const isSummaryFile = (rows: any[]) => {
        if (!rows?.length) return false;
        const keys = Object.keys(rows[0] || {}).map((k) => normalize(k));
        const netHints = ["Order Net", "Order Net Amount", "OrderNet", "Net Amount", "Net", "Order Total", "Total", "Amount"]; 
        const feeHints = [
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
        const hasNet = netHints.map(normalize).some((h) => keys.includes(h));
        const hasFees = feeHints.map(normalize).some((h) => keys.includes(h));
        return hasNet || hasFees;
      };

      let itemRows: any[] = [];
      let summaryRows: any[] = [];
      parsedFiles.forEach((rows) => {
        if (isItemsFile(rows)) itemRows = itemRows.concat(rows);
        if (isSummaryFile(rows)) summaryRows = summaryRows.concat(rows);
      });

      if (!itemRows.length && !summaryRows.length) {
        toast({ title: "No valid Etsy CSV detected", description: "Please upload Sold Orders and/or Sold Order Items CSVs." });
        setLoading(false);
        return;
      }

      if (!itemRows.length) {
        toast({ title: "Items CSV missing", description: "Importing summary-only rows. Item details (name/size/SKU) will be missing." });
      }
      if (!summaryRows.length) {
        toast({ title: "Orders summary CSV missing", description: "Totals derived from items; fees will be set to 0." });
      }

      // Group rows by Order ID
      const orderIdsSet = new Set<string>();
      const itemsGrouped = new Map<string, any[]>();
      const summaryGrouped = new Map<string, any[]>();

      const extractOrderId = (r: Record<string, any>) =>
        String(
          getVal(r, ["Order ID", "OrderID", "Receipt ID", "ReceiptID", "Order Number"]) || ""
        ).trim();

      for (const r of itemRows) {
        const orderId = extractOrderId(r);
        if (!orderId) continue;
        if (!itemsGrouped.has(orderId)) itemsGrouped.set(orderId, []);
        itemsGrouped.get(orderId)!.push(r);
        orderIdsSet.add(orderId);
      }
      for (const r of summaryRows) {
        const orderId = extractOrderId(r);
        if (!orderId) continue;
        if (!summaryGrouped.has(orderId)) summaryGrouped.set(orderId, []);
        summaryGrouped.get(orderId)!.push(r);
        orderIdsSet.add(orderId);
      }

      if (!orderIdsSet.size) {
        toast({ title: "No Order IDs detected", description: "Ensure your CSVs include an 'Order ID' column." });
        setLoading(false);
        return;
      }

      const ordersPayload: any[] = [];
      const orderItemsByOrderId: Record<string, any[]> = {};

      const deriveRevenueFromItems = (list: any[]) =>
        list.reduce((acc, row) => {
          const qtyRaw = getVal(row, ["Quantity", "Qty"]) ?? 1;
          const q = parseInt(String(qtyRaw).replace(/[^0-9-]/g, "")) || 1;
          let val = parseNumber(getVal(row, ["Item Total", "Line Item Total", "Amount"]) ?? 0);
          if (!val) {
            const unit = parseNumber(getVal(row, ["Price", "Unit Price"]) ?? 0);
            val = unit * q;
          }
          return acc + (isNaN(val) ? 0 : val);
        }, 0);

      for (const orderId of Array.from(orderIdsSet)) {
        const sRows = summaryGrouped.get(orderId) || [];
        const iRows = itemsGrouped.get(orderId) || [];
        const first = sRows[0] || iRows[0] || {};

        // Date and store
        const dateStr =
          getVal(first, ["Sale Date", "Order Date", "Created At", "CreatedAt"]) ||
          getVal(first, ["SaleDate", "OrderDate"]) ||
          undefined;
        const orderDate = dateStr ? new Date(dateStr) : undefined;
        const storeName = getVal(first, ["Shop Name", "Store", "Store Name"]) || "CSV Import";

        // Revenue
        const revenue = (() => {
          if (sRows.length) {
            let val = 0;
            const primary = getVal(first, ["Order Net", "Order Net Amount", "OrderNet", "Net Amount", "Net"]);
            val = parseNumber(primary);
            if (!val) {
              const secondary = getVal(first, ["Order Total", "Order Value", "Total", "Amount"]);
              val = parseNumber(secondary);
            }
            if (!val && iRows.length) {
              val = deriveRevenueFromItems(iRows);
            }
            if (!val) {
              const adjusted = getVal(first, ["Adjusted Order Net", "Adjusted Net Amount", "Adjusted Order Total"]);
              val = parseNumber(adjusted);
            }
            return val;
          }
          return deriveRevenueFromItems(iRows);
        })();

        // Fees
        const fees = (() => {
          if (sRows.length) {
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
            if (!sum && iRows.length) {
              sum = iRows.reduce(
                (acc, row) => acc + parseNumber(getVal(row, ["Fees", "Transaction Fee", "Processing Fee"]) ?? 0),
                0,
              );
            }
            if (!sum) sum = parseNumber(getVal(first, ["Adjusted Fees"]) ?? 0);
            return sum;
          }
          return 0;
        })();

        const totalCogs = 0;

        // Build order record
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

        // Build line items
        if (iRows.length) {
          const lines: any[] = [];
          for (const row of iRows) {
            const productName =
              getVal(row, ["Item Name", "ItemName", "Title", "Product Title", "ProductTitle"]) || "Item";
            const sku = getVal(row, ["SKU", "Sku", "Product SKU", "ProductSKU"]) ?? null;

            let size: string | null = null;
            const sizeCol = getVal(row, ["Size"]);
            if (sizeCol) size = String(sizeCol);
            const variations = getVal(row, ["Variations", "Variation", "Options", "Option"]) || "";
            if (!size && variations) {
              const m = String(variations).match(/size\s*:\s*([^,;|]+)/i);
              if (m) size = m[1].trim();
            }

            const qtyRaw = getVal(row, ["Quantity", "Qty"]) ?? 1;
            const quantity = parseInt(String(qtyRaw).replace(/[^0-9-]/g, "")) || 1;

            let price = parseNumber(getVal(row, ["Item Total", "Line Item Total", "Amount"]) ?? 0);
            if (!price) {
              const unit = parseNumber(getVal(row, ["Price", "Unit Price"]) ?? 0);
              price = unit * quantity;
            }

            lines.push({
              product_name: productName,
              sku,
              size: size ?? null,
              quantity,
              price,
              fees: 0,
              cogs: 0,
            });
          }
          orderItemsByOrderId[orderId] = lines;
        } else {
          // Fallback: summary line if items are missing
          const quantityTotal = sRows.reduce((acc, row) => {
            const qtyRaw = getVal(row, ["Quantity", "Qty"]) ?? 1;
            const q = parseInt(String(qtyRaw).replace(/[^0-9-]/g, "")) || 1;
            return acc + q;
          }, 0) || 1;

          orderItemsByOrderId[orderId] = [
            {
              product_name: "Order Summary",
              sku: null,
              size: null,
              quantity: quantityTotal,
              price: revenue,
              fees,
              cogs: totalCogs,
            },
          ];
        }
      }

      // Upsert orders (dedupe by user_id, order_id)
      const { data: insertedOrders, error: upsertErr } = await supabase
        .from("orders")
        .upsert(ordersPayload, { onConflict: "user_id,order_id" })
        .select("id, order_id");

      if (upsertErr) throw upsertErr;

      const insertedMap = new Map<string, string>();
      (insertedOrders || []).forEach((o) => insertedMap.set(o.order_id, o.id));

      // Replace existing items for these orders to prevent duplicates
      const orderPks = Array.from(insertedMap.values());
      if (orderPks.length) {
        const { error: delErr } = await supabase
          .from("order_items")
          .delete()
          .in("order_id_fk", orderPks);
        if (delErr) throw delErr;
      }

      // Insert fresh items for each affected order
      const itemsToInsert: any[] = [];
      for (const [orderId, lines] of Object.entries(orderItemsByOrderId)) {
        const orderPk = insertedMap.get(orderId);
        if (!orderPk) continue;
        for (const li of lines) {
          itemsToInsert.push({ order_id_fk: orderPk, ...li });
        }
      }

      if (itemsToInsert.length) {
        const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      const totalUnique = orderIdsSet.size;
      const insertedCount = insertedMap.size;
      const dupes = totalUnique - insertedCount;

      toast({
        title:
          `${insertedCount} orders processed` + (dupes ? `, ${dupes} duplicates skipped` : ""),
        description: `${totalUnique} unique orders detected. ${itemRows.length ? "Imported item-level details." : "Imported summary only."}`,
      });

      onImported?.();
      if (fileRef.current) fileRef.current.value = "";
      setFileName("");
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
        multiple
        onChange={() => {
          const list = Array.from(fileRef.current?.files || []);
          setFileName(list.length ? list.map((f) => f.name).join(", ") : "");
        }}
        aria-label="Upload Etsy Sold Orders and Sold Order Items CSV files"
        className="sr-only"
      />
      <Button type="button" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
        Upload CSV(s)
      </Button>
      <Button onClick={handleImport} disabled={loading} variant="secondary" className="w-full sm:w-auto">
        {loading ? "Importing..." : "Import CSVs"}
      </Button>
      {fileName && (
        <span className="text-sm text-muted-foreground truncate" aria-live="polite">
          {fileName}
        </span>
      )}
      {!authed && (
        <a href="/auth" className="text-sm underline text-primary">Sign in</a>
      )}
    </div>
  );
}
