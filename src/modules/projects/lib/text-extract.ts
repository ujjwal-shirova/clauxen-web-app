import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import Papa from "papaparse";
import { getFileExtension } from "@/projects/lib/storage";

export async function extractTextFromFile(
  storagePath: string,
  filename: string,
): Promise<string> {
  const ext = getFileExtension(filename);
  const buffer = await readFile(storagePath);

  switch (ext) {
    case "pdf": {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text ?? "";
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value ?? "";
    }
    case "csv": {
      const text = buffer.toString("utf-8");
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      return (parsed.data as string[][])
        .map((row) => row.join(", "))
        .join("\n");
    }
    case "txt":
    case "md":
    case "html":
    case "htm":
    case "epub":
    case "rtf":
    case "json":
      return buffer.toString("utf-8");
    default:
      return buffer.toString("utf-8");
  }
}
