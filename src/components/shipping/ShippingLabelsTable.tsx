import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

export type LabelRow = {
  id: string;
  ship_date: string | null;
  to_name: string | null;
  postal: string | null;
  tracking: string | null;
  amount: number;
  order_id: string | null;
  reference: string | null;
  notes: string | null;
};

function extractEtsyOrderId(ref?: string | null, notes?: string | null): string | null {
  const sources = [ref ?? "", notes ?? ""]; 
  for (const s of sources) {
    const text = String(s || "");
    if (!text) continue;
    // Common patterns: "Order ID: 1234567890", "Receipt ID 1234567890", or plain 9-12 digit sequence
    const mLabeled = text.match(/(order|receipt)\s*id\s*[:#-]?\s*(\d{9,12})/i);
    if (mLabeled?.[2]) return mLabeled[2];
    const mDigits = text.match(/\b(\d{9,12})\b/);
    if (mDigits?.[1]) return mDigits[1];
  }
  return null;
}

async function fetchLabels(filter: "all" | "unlinked" | "linked"): Promise<LabelRow[]> {
  let q = supabase.from("shipping_labels").select("id, ship_date, to_name, postal, tracking, amount, order_id, reference, notes").order("ship_date", { ascending: false }).limit(500);
  if (filter === "unlinked") q = q.is("order_id", null);
  if (filter === "linked") q = q.not("order_id", "is", null);
  const { data, error } = await q;
  if (error) throw error;
  return data as LabelRow[];
}

export default function ShippingLabelsTable() {
  const [tab, setTab] = useState<"all" | "unlinked" | "linked">("unlinked");
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderNumberMap, setOrderNumberMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchLabels(tab);
      setRows(data);
    } catch (e: any) {
      toast({ title: "Failed to load labels", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const ids = Array.from(new Set(rows.map(r => r.order_id).filter(Boolean))) as string[];
    if (!ids.length) {
      setOrderNumberMap({});
      return;
    }
    supabase.from("orders").select("id, order_id").in("id", ids).then(({ data, error }) => {
      if (!error && data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach((o) => { if (o?.id && o?.order_id) map[o.id] = o.order_id; });
        setOrderNumberMap(map);
      }
    });
  }, [rows]);


  const linkedCount = rows.filter(r => r.order_id).length;
  const unlinkedCount = rows.filter(r => !r.order_id).length;

  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unlinked">Unlinked</TabsTrigger>
              <TabsTrigger value="linked">Linked</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-sm text-muted-foreground">{linkedCount} linked • {unlinkedCount} unlinked</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>ZIP</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Order / Ref</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.ship_date ? new Date(r.ship_date).toLocaleString() : "—"}</TableCell>
                  <TableCell>{r.to_name || "—"}</TableCell>
                  <TableCell>{r.postal || "—"}</TableCell>
                  <TableCell className="truncate max-w-[160px]" title={r.tracking || undefined}>{r.tracking || "—"}</TableCell>
                  <TableCell>
                    {(() => {
                      const linked = r.order_id && orderNumberMap[r.order_id];
                      const refId = extractEtsyOrderId(r.reference, r.notes);
                      if (linked) {
                        return (
                          <Link
                            to={`/orders?order=${encodeURIComponent(orderNumberMap[r.order_id])}`}
                            className="text-primary underline underline-offset-2"
                          >
                            {orderNumberMap[r.order_id]}
                          </Link>
                        );
                      }
                      return refId ? <span title="From label reference/notes">{refId}</span> : "—";
                    })()}

                  </TableCell>
                  <TableCell className="text-right">{r.amount?.toFixed(2)}</TableCell>
                  <TableCell>{r.order_id ? "Linked" : "Unlinked"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
