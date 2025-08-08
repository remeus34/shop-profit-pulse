-- Retry migration with fix for unique expression using a unique index
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_unique_name_per_parent UNIQUE (user_id, name, parent_id),
  CONSTRAINT expense_categories_parent_fk FOREIGN KEY (parent_id) REFERENCES public.expense_categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS expense_categories_user_parent_idx ON public.expense_categories(user_id, parent_id);

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendors_user_name_unique UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS vendors_user_idx ON public.vendors(user_id);

CREATE TABLE IF NOT EXISTS public.expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT expense_items_user_category_name_unique UNIQUE (user_id, category_id, name)
);
CREATE INDEX IF NOT EXISTS expense_items_user_category_idx ON public.expense_items(user_id, category_id);

CREATE TABLE IF NOT EXISTS public.expense_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.expense_items(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  color TEXT,
  sku TEXT,
  cost_per_unit NUMERIC(12,4) NOT NULL CHECK (cost_per_unit >= 0),
  vendor_id UUID NULL REFERENCES public.vendors(id) ON DELETE SET NULL,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Unique index to treat NULLs as empty for color/sku
CREATE UNIQUE INDEX IF NOT EXISTS expense_variants_unique_idx
ON public.expense_variants (item_id, size, COALESCE(color, ''), COALESCE(sku, ''));
CREATE INDEX IF NOT EXISTS expense_variants_item_idx ON public.expense_variants(item_id);
CREATE INDEX IF NOT EXISTS expense_variants_user_idx ON public.expense_variants(user_id);

-- Triggers
DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER trg_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_expense_items_updated_at ON public.expense_items;
CREATE TRIGGER trg_expense_items_updated_at
BEFORE UPDATE ON public.expense_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_expense_variants_updated_at ON public.expense_variants;
CREATE TRIGGER trg_expense_variants_updated_at
BEFORE UPDATE ON public.expense_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_variants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_categories' AND policyname = 'Categories: Select own'
  ) THEN
    CREATE POLICY "Categories: Select own" ON public.expense_categories
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_categories' AND policyname = 'Categories: Insert own'
  ) THEN
    CREATE POLICY "Categories: Insert own" ON public.expense_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_categories' AND policyname = 'Categories: Update own'
  ) THEN
    CREATE POLICY "Categories: Update own" ON public.expense_categories
    FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_categories' AND policyname = 'Categories: Delete own'
  ) THEN
    CREATE POLICY "Categories: Delete own" ON public.expense_categories
    FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Vendors: Select own'
  ) THEN
    CREATE POLICY "Vendors: Select own" ON public.vendors
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Vendors: Insert own'
  ) THEN
    CREATE POLICY "Vendors: Insert own" ON public.vendors
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Vendors: Update own'
  ) THEN
    CREATE POLICY "Vendors: Update own" ON public.vendors
    FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendors' AND policyname = 'Vendors: Delete own'
  ) THEN
    CREATE POLICY "Vendors: Delete own" ON public.vendors
    FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_items' AND policyname = 'Items: Select own'
  ) THEN
    CREATE POLICY "Items: Select own" ON public.expense_items
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_items' AND policyname = 'Items: Insert own'
  ) THEN
    CREATE POLICY "Items: Insert own" ON public.expense_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_items' AND policyname = 'Items: Update own'
  ) THEN
    CREATE POLICY "Items: Update own" ON public.expense_items
    FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_items' AND policyname = 'Items: Delete own'
  ) THEN
    CREATE POLICY "Items: Delete own" ON public.expense_items
    FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_variants' AND policyname = 'Variants: Select own'
  ) THEN
    CREATE POLICY "Variants: Select own" ON public.expense_variants
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_variants' AND policyname = 'Variants: Insert own'
  ) THEN
    CREATE POLICY "Variants: Insert own" ON public.expense_variants
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_variants' AND policyname = 'Variants: Update own'
  ) THEN
    CREATE POLICY "Variants: Update own" ON public.expense_variants
    FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'expense_variants' AND policyname = 'Variants: Delete own'
  ) THEN
    CREATE POLICY "Variants: Delete own" ON public.expense_variants
    FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;