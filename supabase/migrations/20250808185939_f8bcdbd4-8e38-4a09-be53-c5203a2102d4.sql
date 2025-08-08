-- Begin migration to add Etsy fee settings, fee columns, RLS policies, and triggers
BEGIN;

-- 1) Create etsy_fee_settings table (idempotent)
CREATE TABLE IF NOT EXISTS public.etsy_fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_name text,
  shop_id text,
  currency text DEFAULT 'USD',
  transaction_pct numeric NOT NULL DEFAULT 6.5,
  processing_pct numeric NOT NULL DEFAULT 3.0,
  processing_fixed numeric NOT NULL DEFAULT 0.25,
  listing_fee numeric NOT NULL DEFAULT 0.20,
  offsite_ads_enabled boolean NOT NULL DEFAULT false,
  offsite_ads_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and add policies for etsy_fee_settings (idempotent)
ALTER TABLE public.etsy_fee_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Fee Settings: Select own"
  ON public.etsy_fee_settings
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Fee Settings: Insert own"
  ON public.etsy_fee_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Fee Settings: Update own"
  ON public.etsy_fee_settings
  FOR UPDATE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Fee Settings: Delete own"
  ON public.etsy_fee_settings
  FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger for etsy_fee_settings
DO $$ BEGIN
  CREATE TRIGGER update_etsy_fee_settings_updated_at
  BEFORE UPDATE ON public.etsy_fee_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Ensure orders has fee-related columns (idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_price numeric,
  ADD COLUMN IF NOT EXISTS total_fees numeric,
  ADD COLUMN IF NOT EXISTS total_cogs numeric,
  ADD COLUMN IF NOT EXISTS total_profit numeric,
  ADD COLUMN IF NOT EXISTS transaction_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_label_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offsite_ads_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_expenses numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS external_shipping_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS source text;

-- updated_at trigger for orders
DO $$ BEGIN
  CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS and add policies for orders (idempotent)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Orders: Select own" ON public.orders FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Orders: Insert own" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Orders: Update own" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Orders: Delete own" ON public.orders FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Ensure order_items has needed columns (idempotent)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS profit numeric,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS order_id_fk uuid,
  ADD COLUMN IF NOT EXISTS cogs numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fees numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

-- updated_at trigger for order_items
DO $$ BEGIN
  CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Maintain user_id on order_items via trigger
DO $$ BEGIN
  CREATE TRIGGER set_user_id_on_order_items
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_item_user_id();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS and add policies for order_items (idempotent)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Order Items: Select own" ON public.order_items FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Order Items: Insert own" ON public.order_items FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Order Items: Update own" ON public.order_items FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Order Items: Delete own" ON public.order_items FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
-- End migration