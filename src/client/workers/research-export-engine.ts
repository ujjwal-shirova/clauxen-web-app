import type { ResearchReport } from "@/lib/research-report";
import {
  researchExportBlocks,
  researchInline,
} from "@/lib/research-export-format";
export async function researchReportBlob(
  report: ResearchReport,
  format: "docx" | "pdf",
): Promise<Blob> {
  const blocks = researchExportBlocks(report.markdown);
  if (format === "docx") {
    const {
      Document,
      Packer,
      Paragraph,
      TextRun,
      HeadingLevel,
      Table,
      TableRow,
      TableCell,
      WidthType,
      ExternalHyperlink,
    } = await import("docx");
    const children = blocks.map((block) =>
      block.kind === "table"
        ? new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: block.rows!.map(
              (row, i) =>
                new TableRow({
                  children: row.map(
                    (text) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text, bold: i === 0 })],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          })
        : new Paragraph({
            heading:
              block.kind === "heading"
                ? [
                    HeadingLevel.HEADING_1,
                    HeadingLevel.HEADING_2,
                    HeadingLevel.HEADING_3,
                  ][Math.min(2, (block.depth ?? 1) - 1)]
                : undefined,
            spacing: { after: 160 },
            children: researchInline(
              block.markdown ?? block.text,
              block.kind === "code",
            ).map((segment) => {
              const run = new TextRun({
                text: segment.text,
                bold: segment.bold,
                italics: segment.italic,
                font: block.kind === "code" ? "Courier New" : "Calibri",
                size: block.kind === "heading" ? undefined : 22,
                style: segment.link ? "Hyperlink" : undefined,
              });
              return segment.link
                ? new ExternalHyperlink({ link: segment.link, children: [run] })
                : run;
            }),
          }),
    );
    return Packer.toBlob(
      new Document({ title: report.title, sections: [{ children }] }),
    );
  }
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const content = blocks.map((block) =>
    block.kind === "table"
      ? {
          table: {
            headerRows: 1,
            widths: block.rows![0].map(() => "*"),
            body: block.rows,
          },
          layout: "lightHorizontalLines",
          margin: [0, 6, 0, 12],
        }
      : {
          text: researchInline(
            block.markdown ?? block.text,
            block.kind === "code",
          ).map((segment) => ({
            text: segment.text,
            bold: segment.bold,
            italics: segment.italic,
            link: segment.link,
          })),
          fontSize:
            block.kind === "heading"
              ? Math.max(13, 23 - (block.depth ?? 1) * 3)
              : 11,
          bold: block.kind === "heading",
          italics: block.kind === "quote",
          margin: [0, 0, 0, 10],
          preserveLeadingSpaces: block.kind === "code",
        },
  );
  const bytes = await pdfMake
    .createPdf({
      info: { title: report.title },
      pageSize: "A4",
      pageMargins: [42, 42, 42, 42],
      defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.2 },
      content,
    } as Parameters<typeof pdfMake.createPdf>[0])
    .getBuffer();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
