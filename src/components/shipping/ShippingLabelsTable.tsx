import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [orderIdInput, setOrderIdInput] = useState("");
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

  const allSelected = useMemo(() => rows.length > 0 && rows.every(r => selected[r.id]), [rows, selected]);
  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) rows.forEach(r => (next[r.id] = true));
    setSelected(next);
  };
  const linkSelected = async () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length) return toast({ title: "No labels selected" });
    if (!orderIdInput.trim()) return toast({ title: "Enter Order ID to link" });

    // Find the order by order_id
    const { data: order, error: orderErr } = await supabase.from("orders").select("id").eq("order_id", orderIdInput.trim()).single();
    if (orderErr || !order) {
      return toast({ title: "Order not found", description: `Order ID ${orderIdInput} not found` });
    }

    const { error } = await supabase.from("shipping_labels").update({ order_id: order.id }).in("id", ids);
    if (error) return toast({ title: "Failed to link", description: error.message });

    toast({ title: "Linked", description: `${ids.length} labels linked to order ${orderIdInput}` });
    setSelected({});
    setOrderIdInput("");
    load();
  };

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
          <div className="flex items-center gap-2">
            <Input placeholder="Order ID" value={orderIdInput} onChange={(e) => setOrderIdInput(e.target.value)} className="w-40" />
            <Button onClick={linkSelected} disabled={loading}>Link to Order</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{linkedCount} linked • {unlinkedCount} unlinked</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allSelected} onCheckedChange={(ch) => toggleAll(Boolean(ch))} aria-label="Select all" />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>ZIP</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox checked={!!selected[r.id]} onCheckedChange={(ch) => setSelected(s => ({ ...s, [r.id]: Boolean(ch) }))} aria-label="Select row" />
                  </TableCell>
                  <TableCell>{r.ship_date ? new Date(r.ship_date).toLocaleString() : "—"}</TableCell>
                  <TableCell>{r.to_name || "—"}</TableCell>
                  <TableCell>{r.postal || "—"}</TableCell>
                  <TableCell className="truncate max-w-[160px]" title={r.tracking || undefined}>{r.tracking || "—"}</TableCell>
                  <TableCell>
                    {r.order_id && orderNumberMap[r.order_id] ? (
                      <Link
                        to={`/orders?order=${encodeURIComponent(orderNumberMap[r.order_id])}`}
                        className="text-primary underline underline-offset-2"
                      >
                        {orderNumberMap[r.order_id]}
                      </Link>
                    ) : (
                      "—"
                    )}
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
