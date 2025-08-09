-- 1) Schema changes: link order_items to variants and enable realtime
-- Safe: only add column + indexes; no destructive changes
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid;

CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_fk ON public.order_items(order_id_fk);

-- Enable richer row payloads for realtime
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Ensure tables are in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- 2) Helper: recalc order totals based on current items
CREATE OR REPLACE FUNCTION public.recalc_order_totals(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_cogs numeric := 0;
  v_total_profit numeric := NULL;
  v_total_price numeric := 0;
  v_total_fees numeric := 0;
  v_external_shipping numeric := 0;
  v_other_expenses numeric := 0;
BEGIN
  SELECT COALESCE(SUM(cogs), 0) INTO v_total_cogs
  FROM public.order_items
  WHERE order_id_fk = p_order_id;

  SELECT COALESCE(total_price,0), COALESCE(total_fees,0), COALESCE(external_shipping_cost,0), COALESCE(other_expenses,0)
    INTO v_total_price, v_total_fees, v_external_shipping, v_other_expenses
  FROM public.orders
  WHERE id = p_order_id;

  v_total_profit := v_total_price - v_total_cogs - v_total_fees - v_external_shipping - v_other_expenses;

  UPDATE public.orders
  SET total_cogs = v_total_cogs,
      total_profit = v_total_profit,
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

-- 3) When a variant cost changes, push costs to linked items, then recalc orders
CREATE OR REPLACE FUNCTION public.apply_variant_cost_to_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.cost_per_unit IS DISTINCT FROM OLD.cost_per_unit) THEN
    -- Update all linked order_items cogs
    UPDATE public.order_items oi
    SET cogs = COALESCE(NEW.cost_per_unit, 0) * COALESCE(oi.quantity,1),
        updated_at = NOW()
    WHERE oi.variant_id = NEW.id AND oi.user_id = NEW.user_id
    RETURNING oi.order_id_fk INTO r;

    -- Recalculate totals for all affected orders
    FOR r IN SELECT DISTINCT order_id_fk FROM public.order_items WHERE variant_id = NEW.id LOOP
      PERFORM public.recalc_order_totals(r.order_id_fk);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variant_cost_update ON public.expense_variants;
CREATE TRIGGER trg_variant_cost_update
AFTER UPDATE OF cost_per_unit ON public.expense_variants
FOR EACH ROW
EXECUTE FUNCTION public.apply_variant_cost_to_items();

-- 4) Keep orders totals consistent whenever order_items change
CREATE OR REPLACE FUNCTION public.recalc_on_order_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_order_id := NEW.order_id_fk;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_order_id := COALESCE(NEW.order_id_fk, OLD.order_id_fk);
  ELSE
    v_order_id := OLD.order_id_fk;
  END IF;

  IF v_order_id IS NOT NULL THEN
    PERFORM public.recalc_order_totals(v_order_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_on_order_item_change ON public.order_items;
CREATE TRIGGER trg_recalc_on_order_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.recalc_on_order_item_change();