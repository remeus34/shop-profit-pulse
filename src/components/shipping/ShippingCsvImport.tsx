import { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cleanPirateShipCsvRows, type CleanedShippingLabel } from "@/lib/shipping/parsePirateShipCsv";
import { toast } from "@/hooks/use-toast";

export default function ShippingCsvImport() {
  const [cleaned, setCleaned] = useState<CleanedShippingLabel[] | null>(null);
  const [ignored, setIgnored] = useState<number>(0);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setParsing(true);
    setFileName(file.name);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const rows = (results.data || []).filter(Boolean);
        const { cleaned, ignoredCount } = cleanPirateShipCsvRows(rows);
        setCleaned(cleaned);
        setIgnored(ignoredCount);
        setParsing(false);
        toast({
          title: "CSV cleaned",
          description: `${cleaned.length} label rows ready • ${ignoredCount} rows ignored`,
        });
      },
      error: (error) => {
        setParsing(false);
        toast({
          title: "Failed to parse CSV",
          description: error.message,
        });
      },
    });
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const preview = useMemo(() => (cleaned ?? []).slice(0, 50), [cleaned]);

  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-muted-foreground">Upload your Etsy Orders or PirateShip CSV here</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileInput} aria-label="Upload CSV file" className="hidden" />
          <Button type="button" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
            {parsing ? "Parsing…" : "Upload CSV"}
          </Button>
          {fileName && <span className="text-sm text-muted-foreground truncate">{fileName}</span>}
        </div>

        {cleaned && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {cleaned.length} label rows ready • {ignored} non-label rows ignored (payments, balance, etc.). Balance column removed.
            </p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
