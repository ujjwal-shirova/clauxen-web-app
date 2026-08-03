import {
  extractTableDataFromElement,
  tableDataToCSV,
  tableDataToMarkdown,
  type TableData,
} from "streamdown";

export type TableExportFormat = "markdown" | "csv" | "json" | "jsonl";

export const TABLE_EXPORT_FORMATS: {
  format: TableExportFormat;
  label: string;
}[] = [
  { format: "jsonl", label: "Download as JSONL" },
  { format: "json", label: "Download as JSON" },
  { format: "markdown", label: "Download as Markdown" },
  { format: "csv", label: "Download as CSV" },
];

export const TABLE_EXPORT_EXTENSION: Record<TableExportFormat, string> = {
  markdown: "md",
  csv: "csv",
  json: "json",
  jsonl: "jsonl",
};

export const TABLE_EXPORT_MIME: Record<TableExportFormat, string> = {
  markdown: "text/markdown;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
  jsonl: "application/jsonl;charset=utf-8",
};

function rowsAsRecords(data: TableData): Record<string, string>[] {
  return data.rows.map((row) => {
    const record: Record<string, string> = {};
    data.headers.forEach((header, index) => {
      record[header.trim() || `column_${index + 1}`] = row[index] ?? "";
    });
    return record;
  });
}

/** streamdown ships markdown/CSV table serializers; JSON/JSONL are the only ones we add. */
export function tableDataToJSON(data: TableData): string {
  return JSON.stringify(rowsAsRecords(data), null, 2);
}

export function tableDataToJSONL(data: TableData): string {
  return rowsAsRecords(data)
    .map((record) => JSON.stringify(record))
    .join("\n");
}

export function serializeTableData(
  data: TableData,
  format: TableExportFormat,
): string {
  switch (format) {
    case "csv":
      return tableDataToCSV(data);
    case "json":
      return tableDataToJSON(data);
    case "jsonl":
      return tableDataToJSONL(data);
    default:
      return tableDataToMarkdown(data);
  }
}

export function exportTableElement(
  tableEl: HTMLTableElement,
  format: TableExportFormat,
): string {
  return serializeTableData(extractTableDataFromElement(tableEl), format);
}
