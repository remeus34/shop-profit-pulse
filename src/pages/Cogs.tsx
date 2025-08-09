import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Cogs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const variantsQuery = useQuery({
    queryKey: ["cogs-missing"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [] as Array<any>;

      // Fetch variants needing cost
      const { data: variants, error: vErr } = await supabase
        .from("expense_variants")
        .select("id,item_id,sku,size,cost_per_unit,user_id")
        .eq("user_id", user.id)
        .is("cost_per_unit", null)
        .order("created_at", { ascending: false });
      if (vErr) throw vErr;
      const itemIds = Array.from(new Set((variants || []).map((v) => v.item_id))).filter(Boolean) as string[];
      let itemsById: Record<string, any> = {};
      if (itemIds.length) {
        const { data: items, error: iErr } = await supabase
          .from("expense_items")
          .select("id,name")
          .in("id", itemIds);
        if (iErr) throw iErr;
        itemsById = Object.fromEntries((items || []).map((i) => [i.id, i]));
      }
      return (variants || []).map((v) => ({
        ...v,
        product_name: itemsById[v.item_id]?.name || "(Unknown)"
      }));
    },
  });

  const rows = variantsQuery.data || [];
  const hasChanges = useMemo(() => Object.keys(edits).length > 0, [edits]);

  const onChange = (id: string, value: string) => {
    setEdits((prev) => ({ ...prev, [id]: value }));
  };

  const saveAll = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in");
      const entries = Object.entries(edits)
        .map(([id, v]) => ({ id, value: v === "" ? null : Number(v) }))
        .filter((u) => u.value !== null && !Number.isNaN(u.value as number));
      if (!entries.length) return;
      // Update each row individually to satisfy types
      await Promise.all(
        entries.map(({ id, value }) =>
          supabase
            .from("expense_variants")
            .update({ cost_per_unit: value as number })
            .eq("id", id)
        )
      );
      setEdits({});
      toast({ title: "Costs saved", description: "COGS applied to linked orders." });
      await qc.invalidateQueries({ queryKey: ["cogs-missing"] });
      // Also nudge Orders page to refetch through realtime handled there
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "", variant: "destructive" as any });
    }
  };

  useEffect(() => {
    // Canonical tag is handled globally; keep SEO up to date
  }, []);

  return (
    <div className="space-y-6">
      <SEO title="COGS | Etsy Profit Radar" description="Manage per-product costs used for live profit and pricing analysis." />
      <h1 className="text-2xl font-bold">Cost of Goods (COGS)</h1>
      <Card>
        <CardContent className="pt-4 space-y-4">
          <p className="text-muted-foreground">Enter unit costs for variants seeded from your Orders. Saving will update Orders instantly.</p>
          <div className="flex justify-end gap-2">
            <Button onClick={saveAll} disabled={!hasChanges}>Save all</Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Unit Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">All set! No variants need costs.</TableCell>
                  </TableRow>
                ) : (
                  rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.product_name}</TableCell>
                      <TableCell>{r.sku || "—"}</TableCell>
                      <TableCell>{r.size || "—"}</TableCell>
                      <TableCell className="max-w-[160px]">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          defaultValue={edits[r.id] ?? ""}
                          onChange={(e) => onChange(r.id, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
