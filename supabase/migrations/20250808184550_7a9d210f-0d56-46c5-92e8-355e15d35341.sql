-- Orders, Order Items, and Etsy Connections schema
-- 1) Orders table (one per Etsy order, regardless of source)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id text NOT NULL,
  order_date timestamptz,
  store_name text,
  shop_id text,
  source text NOT NULL CHECK (source IN ('csv','etsy')),
  total_price numeric,
  total_fees numeric,
  total_cogs numeric,
  total_profit numeric GENERATED ALWAYS AS (coalesce(total_price,0) - coalesce(total_fees,0) - coalesce(total_cogs,0)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique (user_id, order_id) for duplicate detection across CSV and API
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_order_id_uidx ON public.orders (user_id, order_id);

-- Enable RLS and policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Orders: Select own'
  ) THEN
    CREATE POLICY "Orders: Select own" ON public.orders
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Orders: Insert own'
  ) THEN
    CREATE POLICY "Orders: Insert own" ON public.orders
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Orders: Update own'
  ) THEN
    CREATE POLICY "Orders: Update own" ON public.orders
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Orders: Delete own'
  ) THEN
    CREATE POLICY "Orders: Delete own" ON public.orders
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Order items (line items per order)
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id_fk uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name text,
  sku text,
  size text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  fees numeric NOT NULL DEFAULT 0,
  cogs numeric NOT NULL DEFAULT 0,
  profit numeric GENERATED ALWAYS AS (coalesce(price,0) - coalesce(fees,0) - coalesce(cogs,0)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'Order Items: Select own'
  ) THEN
    CREATE POLICY "Order Items: Select own" ON public.order_items
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'Order Items: Insert own'
  ) THEN
    CREATE POLICY "Order Items: Insert own" ON public.order_items
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'Order Items: Update own'
  ) THEN
    CREATE POLICY "Order Items: Update own" ON public.order_items
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'Order Items: Delete own'
  ) THEN
    CREATE POLICY "Order Items: Delete own" ON public.order_items
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger function to set order_items.user_id from parent order to ensure ownership consistency
CREATE OR REPLACE FUNCTION public.set_order_item_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  SELECT user_id INTO NEW.user_id FROM public.orders WHERE id = NEW.order_id_fk;
  RETURN NEW;
END;
$$;

-- Apply triggers for user consistency on insert and when changing order_id_fk
DROP TRIGGER IF EXISTS set_order_item_user_id_insert ON public.order_items;
CREATE TRIGGER set_order_item_user_id_insert
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.set_order_item_user_id();

DROP TRIGGER IF EXISTS set_order_item_user_id_update ON public.order_items;
CREATE TRIGGER set_order_item_user_id_update
BEFORE UPDATE OF order_id_fk ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.set_order_item_user_id();

-- 3) Etsy connections for OAuth tokens per user/shop
CREATE TABLE IF NOT EXISTS public.etsy_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_id text NOT NULL,
  shop_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS etsy_connections_user_shop_uidx ON public.etsy_connections (user_id, shop_id);
ALTER TABLE public.etsy_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'etsy_connections' AND policyname = 'Etsy Connections: Select own'
  ) THEN
    CREATE POLICY "Etsy Connections: Select own" ON public.etsy_connections
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'etsy_connections' AND policyname = 'Etsy Connections: Insert own'
  ) THEN
    CREATE POLICY "Etsy Connections: Insert own" ON public.etsy_connections
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'etsy_connections' AND policyname = 'Etsy Connections: Update own'
  ) THEN
    CREATE POLICY "Etsy Connections: Update own" ON public.etsy_connections
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'etsy_connections' AND policyname = 'Etsy Connections: Delete own'
  ) THEN
    CREATE POLICY "Etsy Connections: Delete own" ON public.etsy_connections
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Update timestamp triggers
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_etsy_connections_updated_at ON public.etsy_connections;
CREATE TRIGGER update_etsy_connections_updated_at
BEFORE UPDATE ON public.etsy_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();