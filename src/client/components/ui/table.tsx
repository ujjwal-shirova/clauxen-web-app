import * as React from "react"; // React forwardRef for table primitives

import { cn } from "@/lib/utils"; // className merge

// Table — scrollable wrapper + native <table>
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    {" "}
    {/* horizontal scroll on narrow viewports */}
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)} // full-width table, caption below
      {...props}
    />
  </div>
));
Table.displayName = "Table";

// TableHeader — <thead> section
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} /> // header rows bottom border
));
TableHeader.displayName = "TableHeader";

// TableBody — <tbody> section
const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)} // last row no bottom border
    {...props}
  />
));
TableBody.displayName = "TableBody";

// TableFooter — <tfoot> section (totals, summary rows)
const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", // footer top border + muted bg
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

// TableRow — <tr> row with hover/selected states
const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", // row hover + selection
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

// TableHead — <th> header cell
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", // column header styling
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

// TableCell — <td> data cell
const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} // cell padding + checkbox column tweak
    {...props}
  />
));
TableCell.displayName = "TableCell";

// TableCaption — <caption> accessible table title
const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
