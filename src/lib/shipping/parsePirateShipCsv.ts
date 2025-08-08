export type CleanedShippingLabel = {
  provider: "PirateShip" | "Shippo" | "EasyPost" | "Unknown";
  type: "Label";
  date: string; // Keep original string; parsing can be handled downstream
  description: string;
  total: number; // Numeric cost; preserves sign from source
  raw?: Record<string, unknown>; // Original row for diagnostics
};

export type CsvCleanResult = {
  cleaned: CleanedShippingLabel[];
  ignoredCount: number; // rows dropped (e.g., payments or malformed)
};

function isLabelType(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "label";
}

function isPaymentType(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === "payment";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function cleanPirateShipCsvRows(rows: Record<string, unknown>[]): CsvCleanResult {
  let ignored = 0;
  const cleaned: CleanedShippingLabel[] = [];

  for (const row of rows) {
    const type = row["Type"];

    // Ignore payments and any non-label types
    if (!isLabelType(type)) {
      ignored++;
      continue;
    }

    const date = String(row["Date"] ?? "").trim();
    const description = String(row["Description"] ?? "").trim();
    const totalNum = parseNumber(row["Total"]);

    if (!date || !description || totalNum === null) {
      // Malformed label row – drop it
      ignored++;
      continue;
    }

    cleaned.push({
      provider: "PirateShip",
      type: "Label",
      date,
      description,
      total: totalNum, // Keep sign as provided by source
      // Deliberately exclude Balance and other fields
    });
  }

  return { cleaned, ignoredCount: ignored };
}
