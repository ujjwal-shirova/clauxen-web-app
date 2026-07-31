import React, { createContext, useContext, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadTextFile } from "@/lib/download-file";
import {
  exportTableElement,
  TABLE_EXPORT_EXTENSION,
  TABLE_EXPORT_FORMATS,
  TABLE_EXPORT_MIME,
  type TableExportFormat,
} from "@/lib/table-export";

const bodyTextClass =
  "font-sans text-[14px] leading-[1.58] tracking-[-0.004em] text-zinc-800";
const subtleTextClass =
  "font-sans text-[13px] leading-[1.55] tracking-[-0.003em] text-zinc-500";

export const StyledH1 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-3 mt-6">
    <h1 className="font-sans text-[24px] font-semibold leading-[1.22] tracking-[-0.025em] text-zinc-950 sm:text-[28px]">
      {children}

      {hasCursor && <Cursor />}
    </h1>
  </div>
);

export const StyledH2 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-2 mt-5">
    <h2 className="font-sans text-[20px] font-semibold leading-[1.28] tracking-[-0.018em] text-zinc-950 sm:text-[22px]">
      {children}

      {hasCursor && <Cursor />}
    </h2>
  </div>
);

export const StyledH3 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-2 mt-4">
    <h3 className="font-sans text-[16px] font-semibold leading-[1.35] tracking-[-0.01em] text-zinc-900 sm:text-[17px]">
      {children}

      {hasCursor && <Cursor />}
    </h3>
  </div>
);

export const StyledParagraph = ({ children, hasCursor, Cursor }: any) => (
  <div className={`${bodyTextClass} mb-3`}>
    {children}

    {hasCursor && <Cursor />}
  </div>
);

export const StyledBold = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-zinc-900">{children}</strong>
);

export const StyledItalic = ({ children }: { children: React.ReactNode }) => (
  <em className="italic text-zinc-600">{children}</em>
);

export const StyledInlineCode = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <code className="markdown-glass-inline-code mx-0.5 rounded-[5px] border border-zinc-200/80 bg-zinc-100/80 px-1.5 py-[1px] font-mono text-[12px] font-[500] text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
    {children}
  </code>
);

export const StyledHorizontalRule = () => (
  <hr className="my-5 border-0 border-t border-zinc-200/80" />
);

export const StyledDetails = ({ children }: { children: React.ReactNode }) => (
  <details className="my-3 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/80">
    {children}
  </details>
);

export const StyledSummary = ({ children }: { children: React.ReactNode }) => (
  <summary className="cursor-pointer list-none select-none px-3 py-2 text-[13px] font-medium text-zinc-800 transition-colors hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
    <span className="inline-flex items-center gap-2">{children}</span>
  </summary>
);

export const StyledBlockquote = ({ children, hasCursor, Cursor }: any) => (
  <blockquote className="my-4 rounded-r-xl border-l-[3px] border-zinc-300/90 bg-zinc-50/90 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
    <div className={`${subtleTextClass} italic`}>
      {children}

      {hasCursor && <Cursor />}
    </div>
  </blockquote>
);

export const StyledList = ({
  children,
  isOrdered,
  index,
  hasCursor,
  Cursor,
}: any) => {
  return (
    <div className="my-1.5 flex items-start pl-0.5">
      <span
        className={`mr-2.5 mt-[3px] flex shrink-0 items-center justify-center ${
          isOrdered
            ? "h-5 w-5 rounded-full border border-zinc-200 bg-zinc-100 text-[10px] font-semibold text-zinc-600"
            : "h-5 w-5"
        }`}
      >
        {isOrdered ? (
          index
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        )}
      </span>
      <span className={`${bodyTextClass} flex-1`}>
        {children}

        {hasCursor && <Cursor />}
      </span>
    </div>
  );
};

/**
 * Set by TitledMarkdownTable when a `<table_title>` tag preceded this table
 * in the assistant's raw markdown — lets StyledTableContainer (which owns the
 * actual <table> element and ref) render the title/download bar without
 * threading props through react-markdown's component tree.
 */
export const TableTitleContext = createContext<{ title: string } | null>(null);

function slugifyForFilename(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "table"
  );
}

export const StyledTableContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const titleCtx = useContext(TableTitleContext);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const tableTitle = titleCtx?.title || "Table";

  const handleDownload = (format: TableExportFormat) => {
    const table = tableRef.current;
    if (!table) return;
    const content = exportTableElement(table, format);
    const baseName = slugifyForFilename(tableTitle);
    downloadTextFile(
      `${baseName}.${TABLE_EXPORT_EXTENSION[format]}`,
      content,
      TABLE_EXPORT_MIME[format],
    );
  };

  const handleCopyMarkdown = async () => {
    const table = tableRef.current;
    if (!table) return;
    await navigator.clipboard.writeText(exportTableElement(table, "markdown"));
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1600);
  };

  // Do NOT add `overflow-hidden` to this outer wrapper. It's an ancestor of
  // the sticky toolbar below, and `overflow: hidden` makes an element the
  // sticky positioning/clipping container for its descendants — that broke
  // the toolbar's stickiness (it stuck relative to this static box instead of
  // the chat scroll viewport, rendering at the wrong offset once pinned).
  // Corner-clipping instead happens on the inner scroll wrapper, which is a
  // sibling of the toolbar, not an ancestor — same structure as
  // CodeBlockFrame's header/content split.
  return (
    <div
      className="composer-message-table my-4 w-full min-w-0 max-w-full rounded-[13px] border border-zinc-200/85 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.025)] sm:my-4"
      data-has-table-title={titleCtx ? "true" : undefined}
    >
      <div className="ui-table-title-header table-title-header-sticky sticky z-20 flex min-h-[42px] items-center justify-between gap-2 rounded-t-[12px] border-b border-zinc-200/80 bg-white px-4 py-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-zinc-900">
          {tableTitle}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label={isCopied ? "Copied table markdown" : "Copy table markdown"}
            onClick={handleCopyMarkdown}
            className="ui-table-copy inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
          >
            {isCopied ? (
              <Check size={14} className="text-emerald-600" />
            ) : (
              <Copy size={14} />
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Download table"
                className="ui-table-download inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
              >
                <Download size={14} />
                <ChevronDown size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TABLE_EXPORT_FORMATS.map(({ format, label }) => (
                <DropdownMenuItem
                  key={format}
                  onClick={() => handleDownload(format)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="markdown-table-scroll overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-b-[13px] [-webkit-overflow-scrolling:touch]">
        <table
          ref={tableRef}
          className="w-full min-w-[min(100%,460px)] border-collapse text-left font-sans text-[13px] text-zinc-800 sm:min-w-[500px]"
        >
          {children}
        </table>
      </div>
    </div>
  );
};

export const StyledTableHeader = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <thead className="ui-table-header bg-zinc-100/80">
    {children}
  </thead>
);

export const StyledTableHeadCell = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <th className="whitespace-nowrap border-b border-zinc-200/90 px-3 py-2 text-[12px] font-semibold tracking-[-0.002em] text-zinc-600">
    {children}
  </th>
);

export const StyledTableBody = ({
  children,
}: {
  children: React.ReactNode;
}) => <tbody className="bg-white">{children}</tbody>;

export const StyledTableRow = ({ children }: { children: React.ReactNode }) => (
  <tr className="transition-colors last:[&>td]:border-b-0 hover:bg-zinc-50/80">
    {children}
  </tr>
);

export const StyledTableCell = ({
  children,
  isLast,
  hasCursor,
  Cursor,
  isLastRow,
}: any) => (
  <td
    className={`border-b border-zinc-200/80 px-3 py-2 align-top text-[13px] leading-[1.5] text-zinc-700 ${
      isLastRow ? "border-b-0" : ""
    }`}
  >
    <div className="md-table-cell-content break-words [&>code]:text-[12px]">
      {children}
      {isLast && hasCursor && <Cursor />}
    </div>
  </td>
);

function sanitizeCodeBlockLanguage(language: string): string {
  const normalized = language.trim().slice(0, 32);
  if (!normalized || !/^[a-zA-Z0-9+#.-]+$/.test(normalized)) {
    return "plaintext";
  }
  return normalized;
}

interface CodeBlockFrameProps {
  language: string;
  children: React.ReactNode;
  onCopy: () => void;
  isCopied: boolean;
  /** Absent while the block is still streaming — download only makes sense once complete. */
  onDownload?: () => void;
  downloadExtension?: string;
}

export const CodeBlockFrame = ({
  language,
  children,
  onCopy,
  isCopied,
  onDownload,
  downloadExtension,
}: CodeBlockFrameProps) => {
  const safeLanguage = sanitizeCodeBlockLanguage(language);

  return (
    <div className="composer-message-codeblock relative my-2 w-full min-w-0 max-w-full rounded-[13px] border border-zinc-200/85 bg-zinc-50 shadow-[0_1px_2px_rgba(24,24,27,0.025)] sm:my-3">
      <div className="ui-code-block code-block-header-sticky sticky z-10 flex min-h-[38px] items-center justify-between rounded-t-[12px] border-b border-zinc-200/80 bg-white px-4 py-2 sm:px-4">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-zinc-500">
          {safeLanguage}
        </span>
        <div className="-mr-0.5 flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            className="ui-code-block-copy flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-all hover:bg-zinc-200/70 hover:text-zinc-800 active:bg-zinc-200"
          >
            {isCopied ? (
              <Check size={12} className="text-emerald-600" />
            ) : (
              <Copy size={12} />
            )}
            <span>{isCopied ? "Copied" : "Copy"}</span>
          </button>
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="ui-code-block-download flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-all hover:bg-zinc-200/70 hover:text-zinc-800 active:bg-zinc-200"
            >
              <Download size={12} />
              <span>Download as {(downloadExtension || "txt").toUpperCase()}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* overflow-y must be explicit: with only overflow-x set, CSS computes
          overflow-y to auto and paints a phantom vertical scrollbar. */}
      <div className="markdown-code-scroll code-scrollbars ui-code-block-content w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-b-[13px] bg-zinc-50 [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  );
};
