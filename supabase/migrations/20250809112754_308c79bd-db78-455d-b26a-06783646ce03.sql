-- Retry: Create shipping_labels table without non-immutable functions in generated column
CREATE TABLE IF NOT EXISTS public.shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  label_id text NULL,
  batch_id text NULL,
  carrier text NULL,
  service text NULL,
  ship_date timestamptz NULL,
  ship_date_date date GENERATED ALWAYS AS (ship_date::date) STORED,
  to_name text NULL,
  address1 text NULL,
  city text NULL,
  state text NULL,
  postal text NULL,
  country text NULL,
  tracking text NULL,
  reference text NULL,
  notes text NULL,
  weight text NULL,
  dimensions text NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NULL DEFAULT 'USD',
  store_id text NULL,
  workspace_id text NULL DEFAULT 'default',
  created_by uuid NULL,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL
);

ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_labels' AND policyname = 'Shipping Labels: Select own'
  ) THEN
    CREATE POLICY "Shipping Labels: Select own" ON public.shipping_labels FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_labels' AND policyname = 'Shipping Labels: Insert own'
  ) THEN
    CREATE POLICY "Shipping Labels: Insert own" ON public.shipping_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_labels' AND policyname = 'Shipping Labels: Update own'
  ) THEN
    CREATE POLICY "Shipping Labels: Update own" ON public.shipping_labels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shipping_labels' AND policyname = 'Shipping Labels: Delete own'
  ) THEN
    CREATE POLICY "Shipping Labels: Delete own" ON public.shipping_labels FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shipping_labels_workspace_store ON public.shipping_labels (workspace_id, store_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking ON public.shipping_labels (tracking);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_postal ON public.shipping_labels (postal);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_ship_date ON public.shipping_labels (ship_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipping_labels_user_label 
  ON public.shipping_labels (user_id, label_id)
  WHERE label_id IS NOT NULL AND btrim(label_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipping_labels_fallback 
  ON public.shipping_labels (user_id, tracking, ship_date_date, amount)
  WHERE (label_id IS NULL OR btrim(label_id) = '');

CREATE OR REPLACE FUNCTION public.set_updated_at_shipping_labels()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

DROP TRIGGER IF EXISTS trg_shipping_labels_set_updated_at ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_set_updated_at
BEFORE UPDATE ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_shipping_labels();

CREATE OR REPLACE FUNCTION public.update_order_shipping_from_labels(p_order_id uuid)
RETURNS void AS $$
BEGIN
  IF p_order_id IS NULL THEN RETURN; END IF;

  UPDATE public.orders o
  SET external_shipping_cost = COALESCE((
      SELECT SUM(amount) FROM public.shipping_labels sl WHERE sl.order_id = o.id
    ), 0),
      updated_at = now()
  WHERE o.id = p_order_id;

  PERFORM public.recalc_order_totals(p_order_id);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

CREATE OR REPLACE FUNCTION public.shipping_labels_sync_orders()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_order_shipping_from_labels(NEW.order_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
      PERFORM public.update_order_shipping_from_labels(OLD.order_id);
      PERFORM public.update_order_shipping_from_labels(NEW.order_id);
    ELSE
      PERFORM public.update_order_shipping_from_labels(NEW.order_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.update_order_shipping_from_labels(OLD.order_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

DROP TRIGGER IF EXISTS trg_shipping_labels_sync_orders ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_sync_orders
AFTER INSERT OR UPDATE OR DELETE ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.shipping_labels_sync_orders();

CREATE OR REPLACE FUNCTION public.try_match_shipping_label(p_label uuid)
RETURNS void AS $$
DECLARE
  lbl public.shipping_labels%ROWTYPE;
  m_order uuid;
BEGIN
  SELECT * INTO lbl FROM public.shipping_labels WHERE id = p_label;
  IF NOT FOUND OR lbl.order_id IS NOT NULL THEN RETURN; END IF;

  SELECT o.id INTO m_order
  FROM public.orders o
  WHERE o.user_id = lbl.user_id
    AND (
      (lbl.reference IS NOT NULL AND lbl.reference ILIKE '%' || o.order_id || '%') OR
      (lbl.notes IS NOT NULL AND lbl.notes ILIKE '%' || o.order_id || '%')
    )
    AND (
      lbl.ship_date IS NULL OR o.order_date BETWEEN lbl.ship_date - interval '7 days' AND lbl.ship_date + interval '7 days'
    )
  ORDER BY ABS(EXTRACT(epoch FROM (COALESCE(lbl.ship_date, now()) - COALESCE(o.order_date, now())))) ASC
  LIMIT 1;

  IF m_order IS NOT NULL THEN
    UPDATE public.shipping_labels SET order_id = m_order WHERE id = p_label;
  END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

CREATE OR REPLACE FUNCTION public.shipping_labels_automatch()
RETURNS trigger AS $$
BEGIN
  PERFORM public.try_match_shipping_label(NEW.id);
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

DROP TRIGGER IF EXISTS trg_shipping_labels_automatch ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_automatch
AFTER INSERT ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.shipping_labels_automatch();
