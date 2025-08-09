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
  const orderItemsRef = useRef<HTMLInputElement | null>(null);
  const ordersRef = useRef<HTMLInputElement | null>(null);
  const paymentsSalesRef = useRef<HTMLInputElement | null>(null);
  const paymentsDepositsRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileNames, setFileNames] = useState({
    orderItems: "",
    orders: "",
    paymentsSales: "",
    paymentsDeposits: "",
  });
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
      const files: File[] = [];
      if (orderItemsRef.current?.files?.[0]) files.push(orderItemsRef.current.files[0]);
      if (ordersRef.current?.files?.[0]) files.push(ordersRef.current.files[0]);
      if (paymentsSalesRef.current?.files?.[0]) files.push(paymentsSalesRef.current.files[0]);
      if (paymentsDepositsRef.current?.files?.[0]) files.push(paymentsDepositsRef.current.files[0]);
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

      const isPaymentsSalesFile = (rows: any[]) => {
        if (!rows?.length) return false;
        const keys = Object.keys(rows[0] || {}).map((k) => normalize(k));
        const hasOrderId = keys.includes(normalize("Order ID")) || keys.includes(normalize("Receipt ID")) || keys.includes(normalize("Order Number"));
        const hasPaymentsHints =
          keys.includes(normalize("Gross amount")) ||
          keys.includes(normalize("Net amount")) ||
          keys.includes(normalize("Fees & Taxes")) ||
          keys.some((k) => /fee/i.test(k));
        return hasOrderId && hasPaymentsHints;
      };

      let itemRows: any[] = [];
      let summaryRows: any[] = [];
      let paymentsSalesRows: any[] = [];
      parsedFiles.forEach((rows) => {
        // Classify exclusively: summary files should not be treated as item files
        if (isSummaryFile(rows)) {
          summaryRows = summaryRows.concat(rows);
        } else if (isItemsFile(rows)) {
          itemRows = itemRows.concat(rows);
        }
        // Payments Sales can be detected in addition to summary/items
        if (isPaymentsSalesFile(rows)) paymentsSalesRows = paymentsSalesRows.concat(rows);
      });

      if (!itemRows.length && !summaryRows.length && !paymentsSalesRows.length) {
        toast({ title: "No valid Etsy CSV detected", description: "Please upload at least one Etsy CSV export." });
        setLoading(false);
        return;
      }

      if (!itemRows.length) {
        toast({ title: "Order Items CSV missing", description: "Importing without item-level details may reduce accuracy." });
      }
      if (!summaryRows.length) {
        toast({ title: "Orders CSV missing", description: "Totals may be derived from items or payments sales; fees may be incomplete." });
      }

      // Group rows by Order ID
      const orderIdsSet = new Set<string>();
      const itemsGrouped = new Map<string, any[]>();
      const summaryGrouped = new Map<string, any[]>();
      const paymentsSalesGrouped = new Map<string, any[]>();
      // Track which orders include item-level lines in this import
      const ordersWithItems = new Set<string>();
      // Count item-level duplicates skipped by composite key
      let itemDuplicateCount = 0;

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
      for (const r of paymentsSalesRows) {
        const orderId = extractOrderId(r);
        if (!orderId) continue;
        if (!paymentsSalesGrouped.has(orderId)) paymentsSalesGrouped.set(orderId, []);
        paymentsSalesGrouped.get(orderId)!.push(r);
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
        const psRows = paymentsSalesGrouped.get(orderId) || [];
        const first = sRows[0] || iRows[0] || psRows[0] || {};

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
            if (!val && psRows.length) {
              // Sum of Net amount from payments sales as last resort
              val = psRows.reduce((acc, row) => acc + parseNumber(getVal(row, ["Net amount", "Net"]) ?? 0), 0);
            }
            return val;
          }
          const fromItems = deriveRevenueFromItems(iRows);
          if (fromItems) return fromItems;
          if (psRows.length) return psRows.reduce((acc, row) => acc + parseNumber(getVal(row, ["Net amount", "Net"]) ?? 0), 0);
          return 0;
        })();

        // Fees
        const fees = (() => {
          const computeFeesFromPayments = (list: any[]) => {
            let sum = 0;
            for (const row of list) {
              for (const [k, v] of Object.entries(row)) {
                const nk = String(k).toLowerCase();
                if (nk.includes("fee")) sum += parseNumber(v as any);
                if (nk === normalize("Regulatory Operating Fee")) sum += parseNumber(v as any);
              }
            }
            return sum;
          };

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
            if (!sum && psRows.length) {
              sum = computeFeesFromPayments(psRows);
            }
            if (!sum && iRows.length) {
              sum = iRows.reduce(
                (acc, row) => acc + parseNumber(getVal(row, ["Fees", "Transaction Fee", "Processing Fee"]) ?? 0),
                0,
              );
            }
            if (!sum) sum = parseNumber(getVal(first, ["Adjusted Fees"]) ?? 0);
            return sum;
          }
          if (psRows.length) return computeFeesFromPayments(psRows);
          if (iRows.length)
            return iRows.reduce(
              (acc, row) => acc + parseNumber(getVal(row, ["Fees", "Transaction Fee", "Processing Fee"]) ?? 0),
              0,
            );
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

        // Build line items - only from item-level CSV; ignore summary lines for display
        if (iRows.length) {
          const dedupMap = new Map<string, any>();
          const makeKey = (li: any) => {
            const name = String(li.product_name || "").trim().toLowerCase();
            const sizeKey = String(li.size || "").trim().toLowerCase();
            const skuKey = String(li.sku || "").trim().toLowerCase();
            return `${name}|${sizeKey}|${skuKey}`;
          };

          for (const row of iRows) {
            const rawName = getVal(row, ["Item Name", "ItemName", "Title", "Product Title", "ProductTitle"]);
            const normalizeName = (n: any) => String(n ?? "").trim();
            const isPlaceholderName = (n: string) => {
              const s = normalizeName(n).toLowerCase();
              return !s || s === "item" || s === "product" || s === "title";
            };
            let productName = normalizeName(rawName);
            if (isPlaceholderName(productName)) {
              const fallbackName = iRows
                .map((r) => normalizeName(getVal(r, ["Item Name", "ItemName", "Title", "Product Title", "ProductTitle"]) || ""))
                .find((n) => !isPlaceholderName(n));
              if (fallbackName) productName = fallbackName;
            }
            if (!productName) productName = "Unknown item";
            const sku = getVal(row, ["SKU", "Sku", "Product SKU", "ProductSKU"]) ?? null;

            let size: string | null = null;
            const sizeCol = getVal(row, ["Size"]);
            if (sizeCol) size = String(sizeCol);
            const variations = getVal(row, ["Variations", "Variation", "Options", "Option"]) || "";
            if (!size && variations) {
              const m = String(variations).match(/size\s*[:\-]\s*([^,;|]+)/i);
              if (m) size = m[1].trim();
            }

            const qtyRaw = getVal(row, ["Quantity", "Qty"]) ?? 1;
            const quantity = parseInt(String(qtyRaw).replace(/[^0-9-]/g, "")) || 1;

            let price = parseNumber(getVal(row, ["Item Total", "Line Item Total", "Amount"]) ?? 0);
            if (!price) {
              const unit = parseNumber(getVal(row, ["Price", "Unit Price"]) ?? 0);
              price = unit * quantity;
            }

            const candidate = {
              product_name: productName,
              sku,
              size: size ?? null,
              quantity,
              price,
              fees: 0,
              cogs: 0,
            };

            const key = makeKey(candidate);
            if (!dedupMap.has(key)) {
              dedupMap.set(key, candidate);
            } else {
              // Prefer non-zero candidate over zero; otherwise keep the one with larger absolute price
              const existing = dedupMap.get(key);
              const existingIsZero = (!existing.price && !existing.quantity);
              const candidateIsZero = (!candidate.price && !candidate.quantity);
              const preferCandidate =
                (existingIsZero && !candidateIsZero) ||
                (Math.abs(candidate.price || 0) > Math.abs(existing.price || 0));

              if (preferCandidate) {
                dedupMap.set(key, candidate);
              }
              itemDuplicateCount++;
            }
          }

          ordersWithItems.add(orderId);
          orderItemsByOrderId[orderId] = Array.from(dedupMap.values());
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

      // Replace existing items only for orders that had item-level rows in this import
      const orderPksWithItems = Array.from(ordersWithItems)
        .map((oid) => insertedMap.get(oid))
        .filter(Boolean) as string[];
      if (orderPksWithItems.length) {
        const { error: delErr } = await supabase
          .from("order_items")
          .delete()
          .in("order_id_fk", orderPksWithItems);
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
        title: `${insertedCount} orders processed` + (dupes ? `, ${dupes} duplicates skipped` : ""),
        description: `${totalUnique} unique orders detected. ${itemRows.length ? "Imported item-level details." : ""}${summaryRows.length ? "" : " (no Orders CSV)"}${paymentsSalesRows.length ? " (+ Payments Sales)" : ""}${itemDuplicateCount ? ` — ${itemDuplicateCount} item duplicates skipped.` : ""}`,
      });

      if (orderItemsRef.current) orderItemsRef.current.value = "";
      if (ordersRef.current) ordersRef.current.value = "";
      if (paymentsSalesRef.current) paymentsSalesRef.current.value = "";
      if (paymentsDepositsRef.current) paymentsDepositsRef.current.value = "";
      setFileNames({ orderItems: "", orders: "", paymentsSales: "", paymentsDeposits: "" });
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
      {/* Hidden file inputs */}
      <Input
        ref={orderItemsRef}
        type="file"
        accept=".csv"
        onChange={() =>
          setFileNames((p) => ({ ...p, orderItems: orderItemsRef.current?.files?.[0]?.name || "" }))
        }
        aria-label="Upload Etsy Order Items CSV"
        className="sr-only"
      />
      <Input
        ref={ordersRef}
        type="file"
        accept=".csv"
        onChange={() => setFileNames((p) => ({ ...p, orders: ordersRef.current?.files?.[0]?.name || "" }))}
        aria-label="Upload Etsy Orders CSV"
        className="sr-only"
      />
      <Input
        ref={paymentsSalesRef}
        type="file"
        accept=".csv"
        onChange={() =>
          setFileNames((p) => ({ ...p, paymentsSales: paymentsSalesRef.current?.files?.[0]?.name || "" }))
        }
        aria-label="Upload Etsy Payments Sales CSV"
        className="sr-only"
      />
      <Input
        ref={paymentsDepositsRef}
        type="file"
        accept=".csv"
        onChange={() =>
          setFileNames((p) => ({ ...p, paymentsDeposits: paymentsDepositsRef.current?.files?.[0]?.name || "" }))
        }
        aria-label="Upload Etsy Payments Deposits CSV"
        className="sr-only"
      />

      {/* Visible buttons */}
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button type="button" onClick={() => orderItemsRef.current?.click()} variant="outline" className="flex-1">
          Upload “Order Items” CSV
        </Button>
        <Button type="button" onClick={() => ordersRef.current?.click()} variant="outline" className="flex-1">
          Upload “Orders” CSV
        </Button>
        <Button type="button" onClick={() => paymentsSalesRef.current?.click()} variant="outline" className="flex-1">
          Upload “Etsy Payments Sales” CSV
        </Button>
        <Button type="button" onClick={() => paymentsDepositsRef.current?.click()} variant="outline" className="flex-1">
          Upload “Etsy Payments Deposits” CSV
        </Button>
      </div>

      <Button onClick={handleImport} disabled={loading} variant="secondary" className="w-full sm:w-auto">
        {loading ? "Importing..." : "Import Selected CSVs"}
      </Button>

      <div className="flex flex-col text-sm text-muted-foreground">
        {fileNames.orderItems && <span aria-live="polite">Order Items: {fileNames.orderItems}</span>}
        {fileNames.orders && <span aria-live="polite">Orders: {fileNames.orders}</span>}
        {fileNames.paymentsSales && <span aria-live="polite">Payments Sales: {fileNames.paymentsSales}</span>}
        {fileNames.paymentsDeposits && (
          <span aria-live="polite">Payments Deposits: {fileNames.paymentsDeposits}</span>
        )}
      </div>

      {!authed && (
        <a href="/auth" className="text-sm underline text-primary">Sign in</a>
      )}
    </div>
  );
}
