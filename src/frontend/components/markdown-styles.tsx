import React from "react";
import { Check, Copy } from "lucide-react";

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

export const StyledTableContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="composer-message-table my-4 w-full min-w-0 max-w-full overflow-hidden rounded-[13px] border border-zinc-200/85 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.025)] sm:my-4">
    <div className="markdown-table-scroll overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[min(100%,460px)] border-collapse text-left font-sans text-[13px] text-zinc-800 sm:min-w-[500px]">
        {children}
      </table>
    </div>
  </div>
);

export const StyledTableHeader = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <thead className="ui-table-header table-header-sticky sticky top-0 z-10 bg-zinc-100/80">
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
}

export const CodeBlockFrame = ({
  language,
  children,
  onCopy,
  isCopied,
}: CodeBlockFrameProps) => {
  const safeLanguage = sanitizeCodeBlockLanguage(language);

  return (
    <div className="composer-message-codeblock relative my-2 w-full min-w-0 max-w-full rounded-[13px] border border-zinc-200/85 bg-zinc-50 shadow-[0_1px_2px_rgba(24,24,27,0.025)] sm:my-3">
      <div className="ui-code-block code-block-header-sticky sticky top-0 z-10 flex min-h-[38px] items-center justify-between rounded-t-[12px] border-b border-zinc-200/80 bg-white/95 px-4 py-2 backdrop-blur-sm sm:px-4">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-zinc-500">
          {safeLanguage}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="ui-code-block-copy -mr-0.5 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-zinc-500 transition-all hover:bg-zinc-200/70 hover:text-zinc-800 active:bg-zinc-200"
        >
          {isCopied ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} />
          )}
          <span>{isCopied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      <div className="markdown-code-scroll code-scrollbars ui-code-block-content w-full max-w-full overflow-x-auto overscroll-x-contain rounded-b-[13px] bg-zinc-50 [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  );
};
