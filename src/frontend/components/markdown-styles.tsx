import React from 'react';
import { Check, Copy } from 'lucide-react';


// --- TYPOGRAPHY COMPONENTS ---

export const StyledH1 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mt-8 mb-5">
    <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight source-code-pro font-mono">
      {children}
      {hasCursor && <Cursor />}
    </h1>
  </div>
);

export const StyledH2 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mt-6 mb-4">
    <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight source-code-pro font-mono">
      {children}
      {hasCursor && <Cursor />}
    </h2>
  </div>
);

export const StyledH3 = ({ children, hasCursor, Cursor }: any) => (
  <div className="mt-5 mb-3">
    <h3 className="text-base sm:text-lg font-medium text-foreground source-code-pro font-mono">
      {children}
      {hasCursor && <Cursor />}
    </h3>
  </div>
);

export const StyledParagraph = ({ children, hasCursor, Cursor }: any) => (
  <div className="mb-3 leading-7 text-muted-foreground text-[15px] sm:text-[16px] source-code-pro font-mono">
    {children}
    {hasCursor && <Cursor />}
  </div>
);

// --- INLINE STYLES ---

export const StyledBold = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-semibold text-foreground source-code-pro font-mono">{children}</strong>
);

export const StyledItalic = ({ children }: { children: React.ReactNode }) => (
  <em className="italic text-muted-foreground source-code-pro font-mono">{children}</em>
);

export const StyledInlineCode = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 mx-0.5 rounded-md text-[13px] sm:text-sm bg-accent text-foreground font-mono source-code-pro border border-border/60">
    {children}
  </code>
);

// --- COMPLEX BLOCK COMPONENTS ---

export const StyledHorizontalRule = () => (
  <hr className="my-6 sm:my-8 border-border" />
);

export const StyledBlockquote = ({ children, hasCursor, Cursor }: any) => (
  <blockquote className="my-4 px-4 sm:px-5 py-3 sm:py-4 border-l-4 border-primary/30 bg-accent/50 rounded-r-xl source-code-pro font-mono">
    <div className="text-muted-foreground italic text-[14px] sm:text-[15px]">
      {children}
      {hasCursor && <Cursor />}
    </div>
  </blockquote>
);

export const StyledList = ({ children, isOrdered, index, hasCursor, Cursor }: any) => {
  return (
    <div className="ml-0 pl-1 my-2 sm:my-3 flex items-start">
      <span
        className={`flex items-center justify-center shrink-0 mr-2 sm:mr-3 mt-[3px] ${isOrdered
          ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent text-[10px] sm:text-[11px] font-semibold text-muted-foreground border border-border'
          : 'w-5 h-5 sm:w-6 sm:h-6'
          }`}
      >
        {isOrdered ? (
          index
        ) : (
          <div className="w-1.5 h-1.5 rounded-sm bg-muted-foreground/60 rotate-45" />
        )}
      </span>
      <span className="text-muted-foreground flex-1 pt-[1px] leading-7 text-[14px] sm:text-[15px] source-code-pro font-mono">
        {children}
        {hasCursor && <Cursor />}
      </span>
    </div>
  );
};

// --- TABLE COMPONENTS (Improved with proper overflow handling) ---

export const StyledTableContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="table-block-container my-4 sm:my-6">
    <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="table-scroll-area">
        <table className="text-[13px] sm:text-sm text-left source-code-pro font-mono w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          {children}
        </table>
      </div>
    </div>
  </div>
);

export const StyledTableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="bg-accent/60">{children}</thead>
);

export const StyledTableHeadCell = ({ children }: { children: React.ReactNode }) => (
  <th className="px-3 sm:px-5 py-3 font-semibold text-foreground text-[11px] sm:text-xs uppercase tracking-wider sticky top-0 bg-accent/60 z-10 whitespace-nowrap min-w-[100px] first:rounded-tl-xl first:sm:rounded-tl-2xl last:rounded-tr-xl last:sm:rounded-tr-2xl">
    {children}
  </th>
);

export const StyledTableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="bg-card divide-y divide-border">{children}</tbody>
);

export const StyledTableRow = ({ children }: { children: React.ReactNode }) => (
  <tr className="hover:bg-accent/30 transition-colors">{children}</tr>
);

export const StyledTableCell = ({ children, isLast, hasCursor, Cursor, isLastRow }: any) => (
  <td className={`px-3 sm:px-5 py-3 text-muted-foreground text-[13px] sm:text-sm min-w-[100px] max-w-[300px] ${isLastRow ? 'first:rounded-bl-xl first:sm:rounded-bl-2xl last:rounded-br-xl last:sm:rounded-br-2xl' : ''}`}>
    <div className="break-words">
      {children}
      {isLast && hasCursor && <Cursor />}
    </div>
  </td>
);

// --- CODE BLOCK FRAME (Updated to Light Theme / Vercel-like Design) ---

interface CodeBlockFrameProps {
  language: string;
  children: React.ReactNode;
  onCopy: () => void;
  isCopied: boolean;
}

export const CodeBlockFrame = ({ language, children, onCopy, isCopied }: CodeBlockFrameProps) => (
  <div className="code-block-container my-6">
    {/* Updated Container: 
       - White background (bg-white)
       - Subtle gray border (border-gray-200) for that clean Vercel/Apple look
    */}
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">

      {/* Updated Header:
         - Light gray background (bg-gray-50/50)
         - Subtle separator
         - Darker text for contrast on light theme
      */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider font-mono">
          {language || 'plaintext'}
        </span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-700 transition-all hover:bg-gray-100 px-2 py-1 rounded-md"
        >
          {isCopied ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Copy size={12} />
          )}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Content Area: 
         - Explicitly white background to cover the whole area
         - No padding adjustments to keep "lines like vs code" alignment
      */}
      <div className="code-scroll-area bg-white">
        {children}
      </div>
    </div>
  </div>
);