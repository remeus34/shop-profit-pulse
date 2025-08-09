export type ShippingLabelInput = {
  label_id?: string | null;
  batch_id?: string | null;
  carrier?: string | null;
  service?: string | null;
  ship_date?: string | null; // ISO string
  to_name?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
  tracking?: string | null;
  reference?: string | null;
  notes?: string | null;
  weight?: string | null;
  dimensions?: string | null;
  amount: number; // parsed numeric
  currency?: string | null;
  store_id?: string | null;
  workspace_id?: string | null;
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getValueCI(obj: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(obj);
  for (const cand of candidates) {
    const found = keys.find(k => k.trim().toLowerCase() === cand.trim().toLowerCase());
    if (found) return obj[found];
  }
  // also try looser includes match
  for (const k of keys) {
    const lower = k.trim().toLowerCase();
    if (candidates.some(c => lower.includes(c.trim().toLowerCase()))) return obj[k];
  }
  return undefined;
}

export function parsePirateShipDetailed(rows: Record<string, unknown>[]): ShippingLabelInput[] {
  const out: ShippingLabelInput[] = [];

  for (const row of rows) {
    // Only keep label rows (Type === 'Label') if a Type column exists
    const typeVal = getValueCI(row, ["Type"]); 
    if (typeof typeVal === "string" && typeVal.trim().toLowerCase() !== "label") continue;

    const dateRaw = getValueCI(row, ["Ship Date", "Date"]);
    const ship_date = dateRaw ? String(dateRaw) : null;

    const totalNum = parseNumber(getValueCI(row, ["Total", "Amount"])) ?? 0;

    const entry: ShippingLabelInput = {
      label_id: (getValueCI(row, ["Label ID", "LabelID"]) ?? null) as any,
      batch_id: (getValueCI(row, ["Batch ID"]) ?? null) as any,
      carrier: (getValueCI(row, ["Carrier"]) ?? null) as any,
      service: (getValueCI(row, ["Service"]) ?? null) as any,
      ship_date,
      to_name: (getValueCI(row, ["Recipient Name", "To Name", "Ship To Name"]) ?? null) as any,
      address1: (getValueCI(row, ["Address 1", "Address1"]) ?? null) as any,
      city: (getValueCI(row, ["City"]) ?? null) as any,
      state: (getValueCI(row, ["State"]) ?? null) as any,
      postal: (getValueCI(row, ["Postal Code", "ZIP", "Zip"]) ?? null) as any,
      country: (getValueCI(row, ["Country"]) ?? null) as any,
      tracking: (getValueCI(row, ["Tracking Number", "Tracking"]) ?? null) as any,
      reference: (getValueCI(row, ["Reference", "Reference #"]) ?? null) as any,
      notes: (getValueCI(row, ["Notes"]) ?? null) as any,
      weight: (getValueCI(row, ["Weight"]) ?? null) as any,
      dimensions: (getValueCI(row, ["Dimensions"]) ?? null) as any,
      amount: totalNum,
      currency: (getValueCI(row, ["Currency"]) ?? "USD") as any,
      store_id: (getValueCI(row, ["Store ID", "Shop ID"]) ?? null) as any,
      workspace_id: "default",
    };

    out.push(entry);
  }

  return out;
}
