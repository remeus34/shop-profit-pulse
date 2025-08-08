import React, { useEffect, useMemo, useState } from "react";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Plus, Upload, Pencil, Trash2, FolderPlus, PackagePlus, Tag, Factory, Layers } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Types for local usage (DB types are not generated yet in this project)
type UUID = string;
type Category = { id: UUID; user_id: UUID; name: string; parent_id: UUID | null };
type Item = { id: UUID; user_id: UUID; category_id: UUID; name: string };
type Vendor = { id: UUID; user_id: UUID; name: string };
type VariantDraft = { size: string; color?: string; sku?: string; cost: string; vendor?: string; tags?: string; notes?: string };

const SUGGESTED_TYPES = ["T-Shirt", "Hoodie", "Sweatshirt", "Mug", "Poster", "Sticker"];
const SUGGESTED_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];


class ExpensesErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) { console.error('Expenses boundary caught', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">Please refresh the page. If it happens again, share this message with support.</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted p-2 rounded">{String(this.state.error)}</pre>
          <div className="mt-3"><Button variant="outline" onClick={() => this.setState({ error: null })}>Reset</Button></div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export default function Expenses() {
  const [userId, setUserId] = useState<UUID | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<UUID | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<UUID | null>(null);

  const [openAddCategory, setOpenAddCategory] = useState(true);
  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState<string>("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Fetch auth user id
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
    });
  }, []);

  // Load reference data
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data: cats } = await supabase
        .from("expense_categories")
        .select("id, user_id, name, parent_id")
        .eq("user_id", userId)
        .order("parent_id", { ascending: true, nullsFirst: true })
        .order("name", { ascending: true });
      setCategories(cats || []);

      const { data: vends } = await supabase
        .from("vendors")
        .select("id, user_id, name")
        .eq("user_id", userId)
        .order("name");
      setVendors(vends || []);
    };
    load();
  }, [userId]);

  // Load items for selected parent/child selection
  useEffect(() => {
    if (!userId || (!selectedChildId && !selectedParentId)) { setItems([]); return; }
    const load = async () => {
      let query = supabase
        .from("expense_items")
        .select("id, user_id, category_id, name")
        .eq("user_id", userId);

      if (selectedChildId) {
        query = query.eq("category_id", selectedChildId);
      } else if (selectedParentId) {
        const childIds = categories.filter(c => c.parent_id === selectedParentId).map(c => c.id);
        const ids = [selectedParentId, ...childIds];
        query = query.in("category_id", ids);
      }

      const { data } = await query.order("name");
      setItems(data || []);
    };
    load();
  }, [userId, selectedChildId, selectedParentId, categories]);

  const parentCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const childCategories = useMemo(() => categories.filter(c => !!c.parent_id), [categories]);
  const childrenOfSelectedParent = useMemo(() => childCategories.filter(c => c.parent_id === selectedParentId), [childCategories, selectedParentId]);

  // Category form
  const categoryForm = useForm<{ name: string; parent_id: string | "" }>({ defaultValues: { name: "", parent_id: "" } });
  const onAddCategory = async (values: { name: string; parent_id: string | "" }) => {
    if (!userId) return toast({ title: "Sign in required", description: "Please sign in to save categories." });
    try {
      setSavingCategory(true);
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({
          user_id: userId,
          name: values.name.trim(),
          parent_id: values.parent_id ? values.parent_id : null,
        })
        .select("id, user_id, name, parent_id")
        .single();
      if (error) throw error;
      if (data) setCategories(prev => [...prev, data as any]);
      setOpenAddCategory(false);
      categoryForm.reset({ name: "", parent_id: "" });
      toast({ title: "Category added" });
    } catch (err: any) {
      toast({ title: "Could not create category", description: err?.message || "Try again" });
    } finally {
      setSavingCategory(false);
    }
  };

  const renameCategory = async (cat: Category) => {
    const name = window.prompt("Rename category", cat.name)?.trim();
    if (!name || !userId) return;
    const { error } = await supabase.from("expense_categories").update({ name }).eq("id", cat.id).eq("user_id", userId);
    if (error) return toast({ title: "Rename failed", description: error.message });
    setCategories(prev => prev.map(c => (c.id === cat.id ? { ...c, name } : c)));
    toast({ title: "Category renamed" });
  };

  const deleteCategory = async (cat: Category) => {
    if (!userId) return;
    if (!confirm("Delete this category and its children/products?")) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", cat.id).eq("user_id", userId);
    if (error) return toast({ title: "Delete failed", description: error.message });
    setCategories(prev => prev.filter(c => c.id !== cat.id && c.parent_id !== cat.id));
    if (selectedParentId === cat.id) setSelectedParentId(null);
    if (selectedChildId && childCategories.find(cc => cc.id === selectedChildId && cc.parent_id === cat.id)) setSelectedChildId(null);
    toast({ title: "Category deleted" });
  };

  // Product form with variants
  const [productName, setProductName] = useState("");
  const [productParentId, setProductParentId] = useState<string>("");
  const [productChildId, setProductChildId] = useState<string>("");
  const [newChildName, setNewChildName] = useState("");
  const [savingChild, setSavingChild] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([{ size: "S", cost: "" }]);

  const childrenOfProductParent = useMemo(
    () => childCategories.filter(c => c.parent_id === (productParentId as any)),
    [childCategories, productParentId]
  );

  const addVariantRow = (preset?: Partial<VariantDraft>) => setVariants(v => [...v, { size: "", cost: "", ...preset }]);
  const removeVariantRow = (idx: number) => setVariants(v => v.filter((_, i) => i !== idx));
  const updateVariant = (idx: number, patch: Partial<VariantDraft>) => setVariants(v => v.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const quickAddSXL = () => {
    setVariants([
      { size: "S", cost: "" },
      { size: "M", cost: "" },
      { size: "L", cost: "" },
      { size: "XL", cost: "" },
      { size: "2XL", cost: "" },
      { size: "3XL", cost: "" },
    ]);
  };

  // Initialize modal selections when opened
  useEffect(() => {
    if (openAddProduct) {
      setProductParentId(selectedParentId || "");
      setProductChildId(selectedChildId || "");
    }
  }, [openAddProduct, selectedParentId, selectedChildId]);

  const onSaveProduct = async () => {
    if (!userId) return toast({ title: "Sign in required", description: "Please sign in to save products." });
    const parentId = (productParentId || selectedParentId) as UUID | null;
    if (!parentId) return toast({ title: "Select a parent category" });
    const childId = (productChildId || selectedChildId) as UUID | null;
    if (!productName.trim()) return toast({ title: "Product name required" });
    const cleanVariants = variants.filter(v => v.size && v.cost !== "");
    if (cleanVariants.length === 0) return toast({ title: "Add at least one variant with cost" });

    const targetCategoryId = (childId || parentId) as UUID;
    const { data: itemRes, error: itemErr } = await supabase
      .from("expense_items")
      .insert({ user_id: userId, category_id: targetCategoryId, parent_category_id: parentId, name: productName.trim() })
      .select("id")
      .single();
    if (itemErr || !itemRes) return toast({ title: "Could not create product", description: itemErr?.message });

    // Ensure vendors exist and map by name
    const vendorNameSet = new Set(cleanVariants.map(v => v.vendor?.trim()).filter(Boolean) as string[]);
    const vendorMap: Record<string, UUID> = {};
    if (vendorNameSet.size) {
      for (const name of vendorNameSet) {
        const existing = vendors.find(v => v.name.toLowerCase() === name.toLowerCase());
        if (existing) { vendorMap[name] = existing.id; continue; }
        const { data: ins, error: vErr } = await supabase
          .from("vendors")
          .insert({ user_id: userId, name })
          .select("id, name")
          .single();
        if (vErr || !ins) { toast({ title: "Vendor error", description: vErr?.message }); continue; }
        vendorMap[ins.name] = ins.id;
        setVendors(prev => [...prev, { id: ins.id, user_id: userId, name: ins.name }]);
      }
    }

    const toInsert = cleanVariants.map(v => ({
      user_id: userId,
      item_id: itemRes.id,
      size: v.size.trim(),
      color: v.color?.trim() || null,
      sku: v.sku?.trim() || null,
      cost_per_unit: Number(v.cost),
      vendor_id: v.vendor ? vendorMap[v.vendor.trim()] ?? null : null,
      tags: v.tags ? v.tags.split(",").map(s => s.trim()).filter(Boolean) : null,
      notes: v.notes?.trim() || null,
    }));

    const { error: varErr } = await supabase.from("expense_variants").insert(toInsert);
    if (varErr) return toast({ title: "Failed to save variants", description: varErr.message });

    setOpenAddProduct(false);
    setProductName("");
    setProductParentId("");
    setProductChildId("");
    setVariants([{ size: "S", cost: "" }]);
    // Refresh items list for current selection (parent or child)
    if (selectedChildId || selectedParentId) {
      let query = supabase
        .from("expense_items")
        .select("id, user_id, category_id, name")
        .eq("user_id", userId);
      if (selectedChildId) {
        query = query.eq("category_id", selectedChildId);
      } else if (selectedParentId) {
        const childIds = categories.filter(c => c.parent_id === selectedParentId).map(c => c.id);
        const ids = [selectedParentId, ...childIds];
        query = query.in("category_id", ids);
      }
      const { data } = await query.order("name");
      setItems(data || []);
    }
    toast({ title: "Product saved with variants" });
  };

  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const handleCsvImport = async () => {
    if (!userId || !csvFile) return;
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        let success = 0;
        for (const row of rows) {
          try {
            const parentName = (row.parent_category || row.category || "").trim();
            const childName = (row.child_category || row.subcategory || "").trim();
            const productName = (row.product || row.item || "").trim();
            const size = (row.size || "").trim();
            const color = (row.color || "").trim();
            const cost = Number(row.cost ?? row.cost_per_unit ?? 0);
            const sku = (row.sku || "").trim();
            const vendorName = (row.vendor || row.vendor_name || "").trim();
            const tags = (row.tags || "").split(",").map((s: string) => s.trim()).filter(Boolean);
            const notes = (row.notes || "").trim();
            if (!productName || !size || !cost) continue;

            // ensure parent
            let parentId: UUID | null = null;
            if (parentName) {
              let parent = categories.find(c => !c.parent_id && c.name.toLowerCase() === parentName.toLowerCase());
              if (!parent) {
                const { data: pIns } = await supabase
                  .from("expense_categories").insert({ user_id: userId, name: parentName, parent_id: null })
                  .select("id, user_id, name, parent_id").single();
                if (pIns) { parent = pIns as Category; setCategories(prev => [...prev, pIns as any]); }
              }
              parentId = parent?.id ?? null;
            }

            // ensure child
            let childId: UUID | null = null;
            if (childName) {
              let child = categories.find(c => !!c.parent_id && c.name.toLowerCase() === childName.toLowerCase() && c.parent_id === parentId);
              if (!child) {
                const { data: cIns } = await supabase
                  .from("expense_categories").insert({ user_id: userId, name: childName, parent_id: parentId })
                  .select("id, user_id, name, parent_id").single();
                if (cIns) { child = cIns as Category; setCategories(prev => [...prev, cIns as any]); }
              }
              childId = child?.id ?? null;
            }
            const useChildId = childId || selectedChildId;
            const finalParentId = (parentId as UUID | null) || (useChildId ? (categories.find(c => c.id === useChildId)?.parent_id as UUID | null) : null) || (selectedParentId as UUID | null);
            if (!useChildId && !finalParentId) continue;

            // ensure item
            let itemId: UUID | null = null;
            const { data: iSel } = await supabase
              .from("expense_items")
              .select("id")
              .eq("user_id", userId)
              .eq("category_id", (useChildId || finalParentId) as UUID)
              .eq("name", productName)
              .maybeSingle();
            if (iSel?.id) itemId = iSel.id;
            if (!itemId) {
              const { data: iIns } = await supabase
                .from("expense_items").insert({ user_id: userId, category_id: (useChildId || finalParentId) as UUID, parent_category_id: finalParentId as UUID, name: productName })
                .select("id").single();
              itemId = iIns?.id ?? null;
            }
            if (!itemId) continue;

            // ensure vendor
            let vendor_id: UUID | null = null;
            if (vendorName) {
              const existing = vendors.find(v => v.name.toLowerCase() === vendorName.toLowerCase());
              if (existing) vendor_id = existing.id;
              else {
                const { data: vIns } = await supabase
                  .from("vendors").insert({ user_id: userId, name: vendorName })
                  .select("id, name").single();
                if (vIns) { vendor_id = vIns.id; setVendors(prev => [...prev, { id: vIns.id, user_id: userId as UUID, name: vIns.name } as any]); }
              }
            }

            await supabase.from("expense_variants").insert({
              user_id: userId,
              item_id: itemId,
              size,
              color: color || null,
              sku: sku || null,
              cost_per_unit: cost,
              vendor_id,
              tags: tags.length ? tags : null,
              notes: notes || null,
            });
            success++;
          } catch (e) {
            // continue on per-row errors
          }
        }
        setOpenImport(false);
        setCsvFile(null);
        toast({ title: `Imported ${success} rows` });
      },
      error: (err) => toast({ title: "CSV parse error", description: String(err) }),
    });
  };

  return (
    <ExpensesErrorBoundary>
      <main className="space-y-6 animate-fade-in">
      <SEO title="Operating Expenses | Etsy Profit Radar" description="Track non-product overhead and analyze trends." />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Operating Expenses</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="hover-scale" onClick={() => setOpenAddCategory(true)}>
            <FolderPlus className="h-4 w-4" /> Add Category
          </Button>

          <Dialog open={openAddProduct} onOpenChange={setOpenAddProduct}>
            <DialogTrigger asChild>
              <Button className="hover-scale"><PackagePlus className="h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Add product with variants</DialogTitle>
                <DialogDescription>Attach sizes, colors, SKUs, costs, vendors, tags and notes.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Parent category</Label>
                    <Select value={productParentId || ""} onValueChange={(v) => { setProductParentId(v); setProductChildId(""); }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select parent category" /></SelectTrigger>
                      <SelectContent>
                        {parentCategories.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Child category (optional)</Label>
                    <Select value={productChildId || ""} onValueChange={setProductChildId} disabled={!productParentId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={productParentId ? "Select child (optional)" : "Select parent first"} /></SelectTrigger>
                      <SelectContent>
                        {childrenOfProductParent.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {productParentId && childrenOfProductParent.length === 0 && (
                      <div className="mt-2 flex gap-2">
                        <Input placeholder="New child name" value={newChildName} onChange={(e) => setNewChildName(e.target.value)} />
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!userId || !newChildName.trim()) return;
                            try {
                              setSavingChild(true);
                              const { data, error } = await supabase
                                .from("expense_categories")
                                .insert({ user_id: userId, name: newChildName.trim(), parent_id: productParentId as any })
                                .select("id, user_id, name, parent_id")
                                .single();
                              if (error) throw error;
                              if (data) {
                                setCategories(prev => [...prev, data as any]);
                                setProductChildId(data.id as any);
                                setNewChildName("");
                                toast({ title: "Child category created" });
                              }
                            } catch (err: any) {
                              toast({ title: "Could not create child", description: err?.message || "Try again" });
                            } finally {
                              setSavingChild(false);
                            }
                          }}
                          disabled={!newChildName.trim() || savingChild}
                        >
                          {savingChild ? "Adding…" : "Create"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Product name</Label>
                    <Input className="mt-1" placeholder="e.g. Heavyweight Hoodie" value={productName} onChange={(e) => setProductName(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <Button type="button" variant="outline" size="sm" onClick={quickAddSXL}><Layers className="h-4 w-4" /> Quick sizes S–3XL</Button>
                  {SUGGESTED_SIZES.map(s => (
                    <Button key={s} type="button" variant="outline" size="sm" onClick={() => addVariantRow({ size: s })}>{s}</Button>
                  ))}
                </div>

                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[80px]">Size</TableHead>
                        <TableHead className="min-w-[120px]">Color (optional)</TableHead>
                        <TableHead className="min-w-[120px]">SKU</TableHead>
                        <TableHead className="min-w-[120px]">Cost / unit</TableHead>
                        <TableHead className="min-w-[160px]">Vendor</TableHead>
                        <TableHead className="min-w-[160px]">Tags</TableHead>
                        <TableHead className="min-w-[200px]">Notes</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((v, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} placeholder="e.g. S" />
                          </TableCell>
                          <TableCell>
                            <Input value={v.color || ""} onChange={(e) => updateVariant(i, { color: e.target.value })} placeholder="e.g. Black" />
                          </TableCell>
                          <TableCell>
                            <Input value={v.sku || ""} onChange={(e) => updateVariant(i, { sku: e.target.value })} placeholder="Optional SKU" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={v.cost} onChange={(e) => updateVariant(i, { cost: e.target.value })} placeholder="0.00" />
                          </TableCell>
                          <TableCell>
                            <Input list="vendor-list" value={v.vendor || ""} onChange={(e) => updateVariant(i, { vendor: e.target.value })} placeholder="Vendor name" />
                          </TableCell>
                          <TableCell>
                            <Input value={v.tags || ""} onChange={(e) => updateVariant(i, { tags: e.target.value })} placeholder="tag1, tag2" />
                          </TableCell>
                          <TableCell>
                            <Textarea value={v.notes || ""} onChange={(e) => updateVariant(i, { notes: e.target.value })} placeholder="Optional notes" />
                          </TableCell>
                          <TableCell>
                            <Button aria-label="Remove" variant="ghost" size="icon" onClick={() => removeVariantRow(i)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <datalist id="vendor-list">
                    {vendors.map(v => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                  <div className="pt-2">
                    <Button type="button" variant="outline" onClick={() => addVariantRow()}><Plus className="h-4 w-4" /> Add row</Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={onSaveProduct}>Save product</Button>
                  <Button variant="outline" onClick={() => setOpenAddProduct(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={openImport} onOpenChange={setOpenImport}>
            <DialogTrigger asChild>
              <Button variant="outline" className="hover-scale"><Upload className="h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Bulk import product costs</DialogTitle>
                <DialogDescription>Columns: parent_category, child_category, product, size, color, cost, sku, vendor, tags, notes.</DialogDescription>
              </DialogHeader>
              <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
              <div className="flex gap-2">
                <Button onClick={handleCsvImport} disabled={!csvFile}><Upload className="h-4 w-4" /> Import</Button>
                <Button variant="outline" onClick={() => setOpenImport(false)}>Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {openAddCategory && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Add category</h2>
              <Button variant="ghost" onClick={() => setOpenAddCategory(false)}>Close</Button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onAddCategory({ name: newCatName, parent_id: newCatParent });
                setNewCatName("");
                setNewCatParent("");
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Products, Packaging, Software"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Parent (optional)</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={newCatParent}
                  onChange={(e) => setNewCatParent(e.target.value)}
                >
                  <option value="">None</option>
                  {parentCategories.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingCategory}>{savingCategory ? "Saving…" : (<><Plus className="h-4 w-4" /> Save</>)}</Button>
                <Button type="button" variant="outline" onClick={() => setOpenAddCategory(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!userId && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground">Authentication is required to save and view your expense structure. Please add auth to your app to enable this feature.</p>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 xl:col-span-3">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Categories</h2>
                  <p className="text-sm text-muted-foreground">Create parent categories and child categories.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setOpenAddCategory(true)}><FolderPlus className="h-4 w-4" /> Add Category</Button>
              </div>
              <div className="space-y-2">
                {parentCategories.map(p => (
                  <div key={p.id} className="rounded-md border">
                    <div className={`flex items-center justify-between px-3 py-2 ${selectedParentId === p.id ? "bg-accent" : ""}`}>
                      <button className="text-left font-medium flex-1" onClick={() => setSelectedParentId(p.id)}>{p.name}</button>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => renameCategory(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => deleteCategory(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {childCategories.filter(c => c.parent_id === p.id).map(c => (
                        <div key={c.id} className={`flex items-center justify-between rounded px-2 py-1 ${selectedChildId === c.id ? "bg-muted" : "hover:bg-muted/50"}`}>
                          <button className="text-left text-sm" onClick={() => { setSelectedParentId(p.id); setSelectedChildId(c.id); }}>{c.name}</button>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => renameCategory(c)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => deleteCategory(c)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {!parentCategories.length && (
                  <p className="text-sm text-muted-foreground">No categories yet. Click “Add Category” to get started.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="lg:col-span-8 xl:col-span-9">
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Variants</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpenAddProduct(true)}><Plus className="h-4 w-4" /> Add Product</Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Select a parent or child category to view products and variant costs. SKU links to Etsy order data later.</p>

              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* We show latest variants for current items (summary-level); query variants per item */}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground">No products yet.</TableCell>
                      </TableRow>
                    )}
                    {items.map((it) => (
                      <React.Fragment key={it.id}>
                        {/* fetch variants for each item lazily using a child component substitute */}
                        <ItemVariantsRow item={it} categoryName={categories.find(c => c.id === it.category_id)?.name || ""} />
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </section>
      </main>
    </ExpensesErrorBoundary>
  );
}

// Inline helper component to reduce file creation
function ItemVariantsRow({ item, categoryName }: { item: Item; categoryName: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("expense_variants")
        .select("id, size, color, sku, cost_per_unit")
        .eq("item_id", item.id)
        .order("size");
      setRows(data || []);
    };
    load();
  }, [item.id]);

  if (!rows.length) return (
    <TableRow>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>{categoryName}</TableCell>
      <TableCell colSpan={4} className="text-muted-foreground">No variants yet</TableCell>
    </TableRow>
  );

  return (
    <>
      {rows.map(v => (
        <TableRow key={v.id}>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>{categoryName}</TableCell>
          <TableCell>{v.size}</TableCell>
          <TableCell>{v.color || "—"}</TableCell>
          <TableCell>{v.sku || "—"}</TableCell>
          <TableCell>${Number(v.cost_per_unit).toFixed(2)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
