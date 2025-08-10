import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Cogs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  // Fetch size data from orders - ONLY SIZE COLUMN
  const sizeVariantsQuery = useQuery({
    queryKey: ["size-variants-from-orders"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("size")
        .eq("user_id", user.id)
        .not("size", "is", null);

      if (error) throw error;
      
      // Get unique sizes ONLY - no color, no count
      const uniqueSizes = [...new Set(orderItems?.map(item => item.size).filter(Boolean))];
      return uniqueSizes.sort();
    },
  });

  // Save size cost
  const saveSizeCost = async (size: string, cost: string) => {
    if (!cost || isNaN(parseFloat(cost))) {
      toast({ title: "Error", description: "Please enter a valid cost", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get or create Raw Materials category
      let { data: category } = await supabase
        .from("expense_categories")
        .select("id")
        .eq("name", "Raw Materials")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!category) {
        const { data: newCategory } = await supabase
          .from("expense_categories")
          .insert({ name: "Raw Materials", user_id: user.id, parent_id: null, sort_order: 1 })
          .select("id")
          .single();
        category = newCategory;
      }

      // Create expense_item for this size
      let { data: item } = await supabase
        .from("expense_items")
        .select("id")
        .eq("name", size)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!item) {
        const { data: newItem } = await supabase
          .from("expense_items")
          .insert({ name: size, user_id: user.id, category_id: category.id, parent_category_id: category.id })
          .select("id")
          .single();
        item = newItem;
      }

      // Save cost
      await supabase
        .from("expense_variants")
        .upsert({
          item_id: item.id,
          user_id: user.id,
          size: size,
          cost_per_unit: parseFloat(cost),
          sku: null,
        }, { onConflict: 'item_id,size,user_id' });

      toast({ title: "Success", description: "Cost saved successfully" });
      setEdits({});
      qc.invalidateQueries({ queryKey: ["size-variants-from-orders"] });

    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to save cost", variant: "destructive" });
    }
  };

  return (
    <>
      <SEO title="COGS" description="Cost of Goods Sold" />
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-3xl font-bold">COGS</h1>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Size Variants from Orders</h2>
            {sizeVariantsQuery.isLoading ? (
              <div>Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Raw Material Cost</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizeVariantsQuery.data?.map((size, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {size}
                      </TableCell>
                      <TableCell>
                        {edits[size] !== undefined ? (
                          <Input
                            value={edits[size]}
                            onChange={(e) => setEdits({ ...edits, [size]: e.target.value })}
                            placeholder="Enter cost"
                            className="w-24"
                            type="number"
                            step="0.01"
                          />
                        ) : (
                          "Not set"
                        )}
                      </TableCell>
                      <TableCell>
                        {edits[size] !== undefined ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveSizeCost(size, edits[size])}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEdits({ ...edits, [size]: undefined })}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setEdits({ ...edits, [size]: "" })}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
