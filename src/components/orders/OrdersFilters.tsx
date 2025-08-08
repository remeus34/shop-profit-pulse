import { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OrdersFiltersState = {
  startDate?: string;
  endDate?: string;
  store?: string;
  product?: string;
};

export default function OrdersFilters({
  filters,
  setFilters,
  storeOptions,
}: {
  filters: OrdersFiltersState;
  setFilters: Dispatch<SetStateAction<OrdersFiltersState>>;
  storeOptions: string[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-1">
        <Label htmlFor="start">Start date</Label>
        <Input
          id="start"
          type="date"
          value={filters.startDate || ""}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="end">End date</Label>
        <Input
          id="end"
          type="date"
          value={filters.endDate || ""}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
        />
      </div>
      <div className="space-y-1">
        <Label>Store</Label>
        <Select
          value={filters.store || ""}
          onValueChange={(v) => setFilters((f) => ({ ...f, store: v || undefined }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="All stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All stores</SelectItem>
            {storeOptions.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="product">Product name</Label>
        <Input
          id="product"
          placeholder="Search by product name"
          value={filters.product || ""}
          onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value || undefined }))}
        />
      </div>
    </div>
  );
}
