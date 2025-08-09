-- Ensure ship_date_date exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shipping_labels' AND column_name = 'ship_date_date'
  ) THEN
    ALTER TABLE public.shipping_labels ADD COLUMN ship_date_date date;
  END IF;
END $$;

-- Unique indexes for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipping_labels_user_labelid
  ON public.shipping_labels (user_id, label_id)
  WHERE label_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shipping_labels_user_track_date_amount
  ON public.shipping_labels (user_id, tracking, ship_date_date, amount)
  WHERE tracking IS NOT NULL AND ship_date_date IS NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_order
  ON public.shipping_labels (user_id, order_id);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_tracking
  ON public.shipping_labels (user_id, tracking);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_postal_date
  ON public.shipping_labels (user_id, postal, ship_date_date);

-- Triggers: derive date, auto-match, and sync orders
DROP TRIGGER IF EXISTS trg_shipping_labels_before_insupd ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_before_insupd
BEFORE INSERT OR UPDATE ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.set_shipping_labels_derived();

DROP TRIGGER IF EXISTS trg_shipping_labels_automatch ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_automatch
AFTER INSERT ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.shipping_labels_automatch();

DROP TRIGGER IF EXISTS trg_shipping_labels_sync ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_sync
AFTER INSERT OR UPDATE OR DELETE ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.shipping_labels_sync_orders();