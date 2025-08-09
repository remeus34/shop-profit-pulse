import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OrdersColumnId =
  | "order_id"
  | "date"
  | "product_name"
  | "sku"
  | "size"
  | "quantity"
  | "price"
  | "discounts"
  | "fees"
  | "cogs"
  | "profit";

export type OrdersColumnConfig = {
  id: OrdersColumnId;
  label: string;
  visible: boolean;
  width?: number; // px
  minWidth?: number; // px
};

export const DEFAULT_ORDERS_COLUMNS: OrdersColumnConfig[] = [
  { id: "order_id", label: "Order ID", visible: true, width: 140, minWidth: 120 },
  { id: "date", label: "Date", visible: true, width: 120, minWidth: 110 },
  { id: "product_name", label: "Product Name", visible: true, width: 360, minWidth: 200 },
  { id: "sku", label: "SKU", visible: true, width: 140, minWidth: 100 },
  { id: "size", label: "Size", visible: true, width: 140, minWidth: 110 },
  { id: "quantity", label: "Qty", visible: true, width: 80, minWidth: 70 },
  { id: "price", label: "Price", visible: true, width: 120, minWidth: 100 },
  { id: "discounts", label: "Discounts", visible: true, width: 120, minWidth: 100 },
  { id: "fees", label: "Fees", visible: true, width: 120, minWidth: 100 },
  { id: "cogs", label: "COGS", visible: true, width: 120, minWidth: 100 },
  { id: "profit", label: "Profit", visible: true, width: 120, minWidth: 100 },
];

const STORAGE_KEY = "orders_table_columns_v1";
const SUPABASE_KEY = STORAGE_KEY;

function normalize(cols: OrdersColumnConfig[] | undefined | null): OrdersColumnConfig[] {
  const byId = new Map((cols || []).map((c) => [c.id, c] as const));
  return DEFAULT_ORDERS_COLUMNS.map((d) => ({ ...d, ...(byId.get(d.id) || {}) }));
}

export function useOrdersColumns(workspaceId: string = "default") {
  const [columns, setColumns] = useState<OrdersColumnConfig[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_ORDERS_COLUMNS;
      return normalize(JSON.parse(raw));
    } catch {
      return DEFAULT_ORDERS_COLUMNS;
    }
  });

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const persist = useCallback(async (cols: OrdersColumnConfig[]) => {
    // Local persistence
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));

    // Supabase persistence (per user + workspace)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: userId,
            workspace_id: workspaceId,
            key: SUPABASE_KEY,
            value: { columns: cols },
          },
          { onConflict: "user_id,workspace_id,key" }
        );
    } catch (e) {
      // ignore persistence errors silently
      console.warn("Failed to persist column prefs", e);
    }
  }, [workspaceId]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        const { data, error } = await supabase
          .from("user_settings")
          .select("value")
          .eq("user_id", userId)
          .eq("workspace_id", workspaceId)
          .eq("key", SUPABASE_KEY)
          .maybeSingle();
        if (!error) {
          const raw = data?.value as unknown;
          let serverCols: unknown = null;

          if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            const obj = raw as Record<string, unknown>;
            const cols = (obj as any).columns;
            if (Array.isArray(cols)) serverCols = cols;
          } else if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              if (
                parsed &&
                typeof parsed === "object" &&
                Array.isArray((parsed as any).columns)
              ) {
                serverCols = (parsed as any).columns;
              }
            } catch {
              // ignore JSON parse errors
            }
          }

          if (serverCols && Array.isArray(serverCols)) {
            setColumns(normalize(serverCols as OrdersColumnConfig[]));
          }
        }
      } catch (e) {
        console.warn("Failed to load column prefs", e);
      }
    })();
  }, [workspaceId]);

  const toggleVisibility = useCallback((id: OrdersColumnId, next?: boolean) => {
    setColumns((prev) => {
      const cols = prev.map((c) => (c.id === id ? { ...c, visible: next ?? !c.visible } : c));
      void persist(cols);
      return cols;
    });
  }, [persist]);

  const reorder = useCallback((orderedIds: OrdersColumnId[]) => {
    setColumns((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c] as const));
      const cols = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
      // append any missing ids at the end (safety)
      for (const d of prev) if (!cols.find((c) => c.id === d.id)) cols.push(d);
      void persist(cols);
      return cols;
    });
  }, [persist]);

  const resize = useCallback((id: OrdersColumnId, width: number) => {
    setColumns((prev) => {
      const cols = prev.map((c) => (c.id === id ? { ...c, width: Math.max(c.minWidth ?? 60, Math.round(width)) } : c));
      void persist(cols);
      return cols;
    });
  }, [persist]);

  const reset = useCallback(() => {
    setColumns(() => {
      const cols = [...DEFAULT_ORDERS_COLUMNS];
      void persist(cols);
      return cols;
    });
  }, [persist]);

  return {
    columns,
    visibleColumns,
    setColumns,
    toggleVisibility,
    reorder,
    resize,
    reset,
  } as const;
}
