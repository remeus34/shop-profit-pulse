DROP TRIGGER IF EXISTS trg_shipping_labels_automatch ON public.shipping_labels;
CREATE TRIGGER trg_shipping_labels_automatch
AFTER INSERT OR UPDATE ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.shipping_labels_automatch();