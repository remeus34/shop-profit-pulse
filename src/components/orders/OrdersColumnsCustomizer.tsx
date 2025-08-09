import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { OrdersColumnConfig, OrdersColumnId } from "./useOrdersColumns";

export default function OrdersColumnsCustomizer({
  open,
  onOpenChange,
  columns,
  onToggle,
  onReorder,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: OrdersColumnConfig[];
  onToggle: (id: OrdersColumnId, next?: boolean) => void;
  onReorder: (orderedIds: OrdersColumnId[]) => void;
  onReset: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => e.preventDefault();
  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const ids = [...columns].map((c) => c.id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(index, 0, moved);
    onReorder(ids);
    setDragIndex(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize columns</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <ul className="divide-y rounded-md border">
            {columns.map((col, i) => (
              <li
                key={col.id}
                className="flex items-center justify-between gap-3 p-2 select-none"
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(i)}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Checkbox
                    id={`col-${col.id}`}
                    checked={col.visible}
                    onCheckedChange={(v) => onToggle(col.id, Boolean(v))}
                  />
                  <label htmlFor={`col-${col.id}`} className="text-sm cursor-pointer">
                    {col.label}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {col.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
