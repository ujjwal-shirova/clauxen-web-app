import { researchReportBlob } from "./research-export-engine";
import type { ResearchReport } from "@/lib/research-report";
self.onmessage = async (
  event: MessageEvent<{ report: ResearchReport; format: "docx" | "pdf" }>,
) => {
  try {
    const blob = await researchReportBlob(event.data.report, event.data.format);
    const bytes = await blob.arrayBuffer();
    self.postMessage({ bytes }, { transfer: [bytes] });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Could not export the report.",
    });
  }
};
