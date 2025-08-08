-- Add parent_category_id to link items to their parent category
ALTER TABLE public.expense_items
ADD COLUMN IF NOT EXISTS parent_category_id uuid;

-- Backfill: if the item's category is a child, use its parent; if it's already a parent, use itself
UPDATE public.expense_items ei
SET parent_category_id = COALESCE(ec.parent_id, ei.category_id)
FROM public.expense_categories ec
WHERE ec.id = ei.category_id
  AND ei.parent_category_id IS NULL;

-- Make it required
ALTER TABLE public.expense_items
ALTER COLUMN parent_category_id SET NOT NULL;

-- Index for faster filtering by parent
CREATE INDEX IF NOT EXISTS idx_expense_items_parent_category_id ON public.expense_items (parent_category_id);
