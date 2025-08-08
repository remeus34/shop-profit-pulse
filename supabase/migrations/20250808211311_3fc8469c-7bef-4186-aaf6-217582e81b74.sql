-- Ensure user-level deduplication for orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_id_order_id_unique
ON public.orders (user_id, order_id);

-- Make sure order_items automatically inherit user_id from parent order (needed for RLS and safe deletes)
DROP TRIGGER IF EXISTS trg_order_items_set_user ON public.order_items;
CREATE TRIGGER trg_order_items_set_user
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.set_order_item_user_id();