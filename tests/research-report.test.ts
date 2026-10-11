import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reportMarkdown,
  reportCitations,
  researchReportTitle,
} from "../src/shared/lib/research-report";
import { researchExportBlocks } from "../src/shared/lib/research-export-format";
const sources = [
  {
    url: "https://example.test/a",
    title: "Official evidence",
    snippet: "Verified specification",
  },
  { url: "https://example.test/unused", title: "Retrieved but not cited" },
];
test("portable research Markdown preserves the full report and resolves legacy citations", () => {
  const markdown = reportMarkdown(
    "```markdown\n# Complete report\n\nFull findings [Official evidence][1].\n\nFinal conclusion.\n```",
    sources,
  );
  assert(markdown.endsWith("Final conclusion."));
  assert(markdown.includes("[Official evidence](https://example.test/a)"));
  assert.equal(researchReportTitle(markdown, "Fallback"), "Complete report");
});
test("citations count only unique linked pages, excluding uncited retrievals and code examples", () => {
  const markdown =
    "# Report\n[Evidence](https://example.test/a#one) and [again](https://example.test/a#two).\n\n```md\n[Example](https://example.test/code)\n```";
  assert.deepEqual(reportCitations(markdown, sources), sources.slice(0, 1));
});
test("exports retain headings, lists, table cells, code and citation URLs", () => {
  const blocks = researchExportBlocks(
    "# Research\n\nEvidence [link](https://example.test/a).\n\n- Finding one\n- Finding two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```py\nprint('done')\n```",
  );
  assert(blocks.some((b) => b.kind === "heading" && b.depth === 1));
  assert.equal(blocks.filter((b) => b.kind === "list").length, 2);
  assert.deepEqual(blocks.find((b) => b.kind === "table")?.rows, [
    ["A", "B"],
    ["1", "2"],
  ]);
  assert(blocks.some((b) => b.text.includes("https://example.test/a")));
  assert.equal(blocks.find((b) => b.kind === "code")?.text, "print('done')");
});

test("real Word and PDF exports contain the complete report with table and working citations", async () => {
  const { researchReportBlob } =
    await import("../src/client/workers/research-export-engine");
  const { default: JSZip } = await import("jszip");
  const { extractText } = await import("unpdf");
  const report = {
    title: "Verification report",
    markdown:
      "# Verification report\n\n**Verified finding** with [evidence](https://example.test/a).\n\n| Metric | Value |\n| --- | --- |\n| Accuracy | 95% |\n\nFinal conclusion retained.",
    citations: sources.slice(0, 1),
    elapsedSeconds: 65,
    fileName: "Verification report.md",
    fileId: "fixture",
  };
  const word = await researchReportBlob(report, "docx");
  const zip = await JSZip.loadAsync(await word.arrayBuffer());
  const xml = await zip.file("word/document.xml")!.async("string");
  assert(xml.includes("Final conclusion retained."));
  assert(xml.includes("Accuracy"));
  assert(xml.includes("w:tbl"));
  assert(xml.includes("w:hyperlink"));
  assert(xml.includes("w:b"));
  const pdf = await researchReportBlob(report, "pdf");
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const result = await extractText(bytes, { mergePages: true });
  assert(result.text.includes("Final conclusion retained."));
  assert(result.text.includes("Accuracy"));
});
