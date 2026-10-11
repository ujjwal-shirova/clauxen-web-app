import { RESEARCH_EXPORT_WORKER_URL } from "../generated/research-export-manifest";
import type { ResearchReport } from "@/lib/research-report";
import { downloadTextFile } from "@/lib/download-file";
export {
  researchExportBlocks,
  researchInline,
} from "@/lib/research-export-format";
export async function exportResearchReport(
  report: ResearchReport,
  format: "md" | "docx" | "pdf",
) {
  if (format === "md") {
    downloadTextFile(
      report.fileName,
      report.markdown,
      "text/markdown;charset=utf-8",
    );
    return;
  }
  const worker = new Worker(RESEARCH_EXPORT_WORKER_URL);
  try {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("Report export took too long. Please try again.")),
        120000,
      );
      worker.onmessage = (event) => {
        clearTimeout(timer);
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.bytes);
      };
      worker.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error("Could not load the report converter. Please try again."),
        );
      };
      worker.postMessage({ report, format });
    });
    const url = URL.createObjectURL(
      new Blob([bytes], {
        type:
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = report.fileName.replace(/\.md$/i, `.${format}`);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } finally {
    worker.terminate();
  }
}
