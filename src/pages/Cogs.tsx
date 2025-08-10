import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

export default function Cogs() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    product_name: "",
    size_variant: "",
    raw_material_cost: ""
  });
  const [uploadedData, setUploadedData] = useState<any[]>([]);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing variants query
  const variantsQuery = useQuery({
    queryKey: ["cogs-missing"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [] as Array<any>;

      const { data: variants, error: vErr } = await supabase
        .from("expense_variants")
        .select("id,item_id,sku,size,cost_per_unit,user_id")
        .eq("user_id", user.id)
        .is("cost_per_unit", null)
        .order("created_at", { ascending: false });

      if (vErr) throw vErr;
      return variants || [];
    },
  });

  // New: Size variants from orders query
  const sizeVariantsQuery = useQuery({
    queryKey: ["size-variants-from-orders"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [] as Array<any>;

      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select("product_name, size, sku")
        .eq("user_id", user.id)
        .not("size", "is", null);

      if (error) throw error;
      
      // Get unique combinations
      const uniqueVariants = new Map();
      orderItems?.forEach(item => {
        const key = `${item.product_name} - ${item.size}`;
        if (!uniqueVariants.has(key)) {
          uniqueVariants.set(key, {
            product_name: item.product_name,
            size: item.size,
            sku: item.sku,
            size_variant: key
          });
        }
      });
      
      return Array.from(uniqueVariants.values());
    },
  });

  // Add new product function
  const addNewProduct = async () => {
    if (!newProduct.product_name || !newProduct.size_variant || !newProduct.raw_material_cost) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get or create expense_item
      let { data: expenseItem, error: itemError } = await supabase
        .from("expense_items")
        .select("id")
        .eq("name", newProduct.product_name)
        .eq("user_id", user.id)
        .maybeSingle();

      if (itemError) throw itemError;

      let itemId: string;
      if (!expenseItem) {
        // Create new expense item - need to get category_id first
        const { data: rawMaterialsCategory, error: catError } = await supabase
          .from("expense_categories")
          .select("id")
          .eq("name", "Raw Materials")
          .eq("user_id", user.id)
          .maybeSingle();

        if (catError) throw catError;

        let categoryId: string;
        if (!rawMaterialsCategory) {
          // Create raw materials category if it doesn't exist
          const { data: newCategory, error: createCatError } = await supabase
            .from("expense_categories")
            .insert({
              name: "Raw Materials",
              user_id: user.id,
              parent_id: null,
              sort_order: 1,
            })
            .select("id")
            .single();

          if (createCatError) throw createCatError;
          categoryId = newCategory.id;
        } else {
          categoryId = rawMaterialsCategory.id;
        }

        const { data: newItem, error: createError } = await supabase
          .from("expense_items")
          .insert({
            name: newProduct.product_name,
            user_id: user.id,
            category_id: categoryId,
            parent_category_id: categoryId,
            description: "Raw material for product manufacturing",
          })
          .select("id")
          .single();

        if (createError) throw createError;
        itemId = newItem.id;
      } else {
        itemId = expenseItem.id;
      }

      // Create expense variant
      const { error: variantError } = await supabase
        .from("expense_variants")
        .insert({
          item_id: itemId,
          user_id: user.id,
          size: newProduct.size_variant,
          cost_per_unit: parseFloat(newProduct.raw_material_cost),
          sku: null,
        });

      if (variantError) throw variantError;

      toast({
        title: "Success",
        description: "Product added successfully",
      });

      setNewProduct({ product_name: "", size_variant: "", raw_material_cost: "" });
      setShowAddForm(false);
      qc.invalidateQueries({ queryKey: ["cogs-missing"] });
      qc.invalidateQueries({ queryKey: ["size-variants-from-orders"] });

    } catch (error) {
      console.error("Error adding product:", error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
    }
  };

  // Download template function
  const downloadTemplate = () => {
    const template = [
      { size_variant: "Sweatshirt - M", raw_material_cost: "15.50" },
      { size_variant: "Sweatshirt - L", raw_material_cost: "16.00" },
      { size_variant: "Hoodie - S", raw_material_cost: "18.00" },
      { size_variant: "T-Shirt - XL", raw_material_cost: "12.50" },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "cogs_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate data
        const validData = jsonData.map((row: any, index) => {
          const hasRequiredFields = row.size_variant && row.raw_material_cost;
          return {
            ...row,
            row: index + 1,
            valid: hasRequiredFields,
            error: hasRequiredFields ? null : "Missing required fields"
          };
        });

        setUploadedData(validData);
        setShowUploadPreview(true);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to read file",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Import uploaded data
  const importUploadedData = async () => {
    const validData = uploadedData.filter(item => item.valid);
    if (validData.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      for (const item of validData) {
        try {
          const [productName, size] = item.size_variant.split(" - ");

          // Create or get expense_item
          let { data: expenseItem, error: itemError } = await supabase
            .from("expense_items")
            .select("id")
            .eq("name", productName)
            .eq("user_id", user.id)
            .maybeSingle();

          if (itemError) throw itemError;

          let itemId: string;
          if (!expenseItem) {
            // Get or create raw materials category
            let { data: rawMaterialsCategory, error: catError } = await supabase
              .from("expense_categories")
              .select("id")
              .eq("name", "Raw Materials")
              .eq("user_id", user.id)
              .maybeSingle();

            if (catError) throw catError;

            let categoryId: string;
            if (!rawMaterialsCategory) {
              const { data: newCategory, error: createCatError } = await supabase
                .from("expense_categories")
                .insert({
                  name: "Raw Materials",
                  user_id: user.id,
                  parent_id: null,
                  sort_order: 1,
                })
                .select("id")
                .single();

              if (createCatError) throw createCatError;
              categoryId = newCategory.id;
            } else {
              categoryId = rawMaterialsCategory.id;
            }

            const { data: newItem, error: createError } = await supabase
              .from("expense_items")
              .insert({
                name: productName,
                user_id: user.id,
                category_id: categoryId,
                parent_category_id: categoryId,
                description: "Raw material for product manufacturing",
              })
              .select("id")
              .single();

            if (createError) throw createError;
            itemId = newItem.id;
          } else {
            itemId = expenseItem.id;
          }

          // Create expense variant
          const { error: variantError } = await supabase
            .from("expense_variants")
            .insert({
              item_id: itemId,
              user_id: user.id,
              size: size || item.size_variant,
              cost_per_unit: parseFloat(item.raw_material_cost),
              sku: null,
            });

          if (variantError) throw variantError;
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Error importing row ${item.row}:`, error);
        }
      }

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} items. ${errorCount} errors.`,
      });

      setUploadedData([]);
      setShowUploadPreview(false);
      qc.invalidateQueries({ queryKey: ["cogs-missing"] });
      qc.invalidateQueries({ queryKey: ["size-variants-from-orders"] });

    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Error",
        description: "Failed to import data",
        variant: "destructive",
      });
    }
  };

  // Clear upload preview
  const clearUpload = () => {
    setUploadedData([]);
    setShowUploadPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Existing save function
  const saveEdit = async (variantId: string, cost: string) => {
    if (!cost || isNaN(parseFloat(cost))) {
      toast({
        title: "Error",
        description: "Please enter a valid cost",
        variant: "destructive",
      });
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("expense_variants")
        .update({ cost_per_unit: parseFloat(cost) })
        .eq("id", variantId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Cost updated successfully",
      });

      setEdits({});
      qc.invalidateQueries({ queryKey: ["cogs-missing"] });
    } catch (error) {
      console.error("Error updating cost:", error);
      toast({
        title: "Error",
        description: "Failed to update cost",
        variant: "destructive",
      });
    }
  };

  if (variantsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (variantsQuery.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>Error loading data: {variantsQuery.error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="COGS" description="Cost of Goods Sold" />
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">COGS</h1>
        </div>

        {/* Add New Product Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add New Product</h2>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant="outline"
                size="sm"
              >
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showAddForm ? "Cancel" : "Add New Product"}
              </Button>
            </div>
            
            {showAddForm && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder="Product Name (e.g., Sweatshirt)"
                    value={newProduct.product_name}
                    onChange={(e) => setNewProduct({...newProduct, product_name: e.target.value})}
                  />
                  <Input
                    placeholder="Size Variant (e.g., M, L, XL)"
                    value={newProduct.size_variant}
                    onChange={(e) => setNewProduct({...newProduct, size_variant: e.target.value})}
                  />
                  <Input
                    placeholder="Raw Material Cost"
                    type="number"
                    step="0.01"
                    value={newProduct.raw_material_cost}
                    onChange={(e) => setNewProduct({...newProduct, raw_material_cost: e.target.value})}
                  />
                </div>
                <Button onClick={addNewProduct} className="w-full md:w-auto">
                  Add Product
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Operations Section */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Bulk Operations</h2>
            <div className="flex flex-wrap gap-4">
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* Upload Preview Section */}
        {showUploadPreview && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Upload Preview</h2>
                <div className="flex gap-2">
                  <Button onClick={importUploadedData} variant="default">
                    Import Valid Data
                  </Button>
                  <Button onClick={clearUpload} variant="outline">
                    Clear
                  </Button>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Size Variant</TableHead>
                    <TableHead>Raw Material Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadedData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.row}</TableCell>
                      <TableCell>{item.size_variant}</TableCell>
                      <TableCell>{item.raw_material_cost}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.valid 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {item.valid ? "Valid" : "Error"}
                        </span>
                      </TableCell>
                      <TableCell className="text-red-600">
                        {item.error || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Existing Variants Table */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Existing Variants</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Cost per Unit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantsQuery.data?.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>{variant.sku || "N/A"}</TableCell>
                    <TableCell>{variant.size || "N/A"}</TableCell>
                    <TableCell>
                      {edits[variant.id] !== undefined ? (
                        <Input
                          value={edits[variant.id]}
                          onChange={(e) =>
                            setEdits({ ...edits, [variant.id]: e.target.value })
                          }
                          className="w-20"
                        />
                      ) : (
                        variant.cost_per_unit || "Not set"
                      )}
                    </TableCell>
                    <TableCell>
                      {edits[variant.id] !== undefined ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(variant.id, edits[variant.id])}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEdits({ ...edits, [variant.id]: undefined })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEdits({ ...edits, [variant.id]: "" })
                          }
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Size Variants from Orders Table */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Size Variants from Orders</h2>
            {sizeVariantsQuery.isLoading ? (
              <div className="text-center py-4">Loading size variants...</div>
            ) : sizeVariantsQuery.error ? (
              <div className="div className="text-center py-4 text-red-600">
                Error loading size variants: {sizeVariantsQuery.error.message}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Size Variant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizeVariantsQuery.data?.map((variant, index) => (
                    <TableRow key={index}>
                      <TableCell>{variant.product_name}</TableCell>
                      <TableCell>{variant.size}</TableCell>
                      <TableCell>{variant.sku || "N/A"}</TableCell>
                      <TableCell className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {variant.size_variant}
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
