import React from "react";
import { Check, Copy } from "lucide-react";

const bodyTextClass = "font-sans text-[14px] leading-[1.8] text-zinc-800";
const subtleTextClass = "font-sans text-[13px] leading-[1.7] text-zinc-500";

export const StyledH1 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-5 mt-8">
    <h1 className="font-serif text-[30px] font-semibold leading-[1.2] tracking-[-0.02em] text-zinc-900 sm:text-[34px]">
      {children}

      {hasCursor && <Cursor />}
    </h1>
  </div>
);

export const StyledH2 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-4 mt-7">
    <h2 className="font-serif text-[24px] font-semibold leading-[1.25] tracking-[-0.015em] text-zinc-900 sm:text-[28px]">
      {children}

      {hasCursor && <Cursor />}
    </h2>
  </div>
);

export const StyledH3 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-3 mt-6">
    <h3 className="font-sans text-[18px] font-semibold leading-[1.35] text-[#2b2a28] sm:text-[20px]">
      {children}

      {hasCursor && <Cursor />}
    </h3>
  </div>
);

export const StyledParagraph = ({ children, hasCursor, Cursor }: any) => (
  <div className={`${bodyTextClass} mb-4`}>
    {children}

    {hasCursor && <Cursor />}
  </div>
);

export const StyledBold = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-zinc-900">{children}</strong>
);

export const StyledItalic = ({ children }: { children: React.ReactNode }) => (
  <em className="italic text-[#5e5c57]">{children}</em>
);

export const StyledInlineCode = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <code className="mx-0.5 rounded-md border border-zinc-200/80 bg-zinc-100 px-1.5 py-0.5 font-mono text-[12.5px] text-[#3f6f9f]">
    {children}
  </code>
);

export const StyledHorizontalRule = () => (
  <hr className="my-7 border-0 border-t border-zinc-200" />
);

export const StyledDetails = ({ children }: { children: React.ReactNode }) => (
  <details className="my-4 overflow-hidden rounded-xl border border-[#1f1e1d]/12 bg-[#fcfbf8]">
    {children}
  </details>
);

export const StyledSummary = ({ children }: { children: React.ReactNode }) => (
  <summary className="cursor-pointer list-none select-none px-4 py-3 text-[14px] font-medium text-[#2f2e2b] transition-colors hover:bg-[#f3f1ea] [&::-webkit-details-marker]:hidden">
    <span className="inline-flex items-center gap-2">{children}</span>
  </summary>
);

export const StyledBlockquote = ({ children, hasCursor, Cursor }: any) => (
  <blockquote className="my-5 rounded-r-2xl border-l-[3px] border-[#b7aa8b] bg-[#f6f3eb] px-4 py-3">
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
    <div className="my-2.5 flex items-start pl-1">
      <span
        className={`mr-3 mt-[5px] flex shrink-0 items-center justify-center ${
          isOrdered
            ? "h-6 w-6 rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-[#5e5c57]"
            : "h-6 w-6"
        }`}
      >
        {isOrdered ? (
          index
        ) : (
          <div className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[#8a857a]" />
        )}
      </span>
      <span className={`${bodyTextClass} flex-1 pt-[1px]`}>
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
  <div className="my-4 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-white sm:my-5">
    <div className="markdown-table-scroll overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[min(100%,480px)] border-collapse text-left font-sans text-[13px] text-zinc-800 sm:min-w-[520px] sm:text-[14px]">
        {children}
      </table>
    </div>
  </div>
);

export const StyledTableHeader = ({
  children,
}: {
  children: React.ReactNode;
}) => <thead className="bg-[#e9e9ec]">{children}</thead>;

export const StyledTableHeadCell = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <th className="border-b border-zinc-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
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
    className={`border-b border-zinc-200 px-4 py-3 align-top text-[13px] leading-[1.65] text-zinc-700 sm:text-[14px] ${
      isLastRow ? "border-b-0" : ""
    }`}
  >
    <div className="break-words [&>code]:text-[12.5px]">
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
    <div className="relative my-4 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 sm:my-5">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2 sm:px-4">
        <span className="font-sans text-[11px] font-medium uppercase tracking-[0.06em] text-zinc-500">
          {safeLanguage}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800"
        >
          {isCopied ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} />
          )}
          <span>{isCopied ? "Copied" : "Copy"}</span>
        </button>
      </div>

      <div className="markdown-code-scroll code-scrollbars max-h-[min(20rem,58vh)] w-full max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain bg-[#fafafa] [-webkit-overflow-scrolling:touch] rounded-b-xl sm:max-h-[min(28rem,70vh)]">
        {children}
      </div>
    </div>
  );
};
