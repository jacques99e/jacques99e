export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = rowsToCsv(rows);
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}

export async function downloadSimplePdf(title: string, lines: string[], filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 15, 15);
  doc.setFontSize(10);
  let y = 25;
  for (const line of lines) {
    const chunks = doc.splitTextToSize(line, 180);
    for (const chunk of chunks) {
      if (y >= 285) {
        doc.addPage();
        y = 15;
      }
      doc.text(chunk, 15, y);
      y += 6;
    }
  }
  doc.save(filename);
}
