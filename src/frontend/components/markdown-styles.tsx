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
  <code className="mx-0.5 rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-[#2f5f8f]">
    
    
    {children}
  
  </code>
);

export const StyledHorizontalRule = () => (
  <hr className="my-7 border-0 border-t border-zinc-200"   />
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
          <div className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[#8a857a]"   />
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
  <div className="my-4 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-[#fcfbf8] shadow-[0_10px_30px_rgba(31,30,29,0.04)] sm:my-6">
    
    <div className="markdown-table-scroll overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
      
      
      <table
        
        className="w-full min-w-[min(100%,480px)] border-separate text-left font-sans text-[13px] text-zinc-800 sm:min-w-[520px] sm:text-[14px]"
        
        style={{ borderSpacing: 0 }}
      
      >
        
        {children}
      
      </table>
    
    </div>
  
  </div>
);

export const StyledTableHeader = ({
  children,
}: {
  children: React.ReactNode;
}) => <thead className="bg-zinc-100">{children}</thead>;

export const StyledTableHeadCell = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <th className="border-b border-zinc-200 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 first:rounded-tl-2xl last:rounded-tr-2xl sm:px-4 sm:py-3 sm:text-[11px]">
    
    
    {children}
  
  </th>
);

export const StyledTableBody = ({
  children,
}: {
  children: React.ReactNode;
}) => <tbody className="bg-[#fcfbf8]">{children}</tbody>;

export const StyledTableRow = ({ children }: { children: React.ReactNode }) => (
  <tr className="transition-colors hover:bg-[#f6f3eb]">{children}</tr>
    
);

export const StyledTableCell = ({
  children,
  isLast,
  hasCursor,
  Cursor,
  isLastRow,
}: any) => (
  
  <td
    
    className={`border-b border-zinc-200 px-3 py-2.5 align-top text-[13px] leading-[1.7] text-[#4a4945] sm:px-4 sm:py-3 sm:text-[14px] ${
      isLastRow ? "border-b-0 first:rounded-bl-2xl last:rounded-br-2xl" : ""
    }`}
  
  >
    <div className="break-words">
      
      
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
  <div className="my-4 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-zinc-200 bg-[#f7f5ef] shadow-[0_12px_32px_rgba(31,30,29,0.05)] sm:my-6">
    
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-zinc-100/95 px-3 py-2.5 backdrop-blur-sm sm:px-4 sm:py-3">
      
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 sm:text-[11px]">
        
        
        {safeLanguage}
      
      </span>
      
      <button
        
        onClick={onCopy}
        
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-[#e9e5da] hover:text-zinc-800 sm:px-2.5 sm:text-[11px]"
      
      >
        
        {isCopied ? (
          <Check size={12} className="text-[#5b7f56]"   />
        ) : (
          <Copy size={12}   />
        )}
        <span>{isCopied ? "Copied" : "Copy"}</span>
          
      
      </button>
    
    </div>

    <div className="markdown-code-scroll code-scrollbars max-h-[min(28rem,70vh)] w-full max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain bg-[#fcfbf8] [-webkit-overflow-scrolling:touch] [&_pre]:!bg-transparent [&_pre]:text-[13px] [&_pre]:leading-[1.7] sm:[&_pre]:text-[14px] sm:[&_pre]:leading-[1.75]">
      
      
      {children}
    
    </div>
  
  </div>
  );
};
