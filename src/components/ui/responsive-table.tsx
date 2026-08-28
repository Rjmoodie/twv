import * as React from "react"
import { cn } from "@/lib/utils"
import { 
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table"

const ResponsiveTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    mobileCards?: boolean;
  }
>(({ className, mobileCards = false, children, ...props }, ref) => (
  <div className={cn(
    "relative w-full",
    mobileCards ? "block md:block" : "overflow-x-auto"
  )}>
    <div className={cn(
      mobileCards && "hidden md:block"
    )}>
      <Table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      >
        {children}
      </Table>
    </div>
    
    {mobileCards && (
      <div className="md:hidden space-y-3">
        {/* Mobile card view will be handled by the parent component */}
        {children}
      </div>
    )}
  </div>
))
ResponsiveTable.displayName = "ResponsiveTable"

// Mobile-friendly table row component
const ResponsiveTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    mobileCard?: React.ReactNode;
  }
>(({ className, mobileCard, children, ...props }, ref) => (
  <>
    {/* Desktop view */}
    <TableRow
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        "hidden md:table-row",
        className
      )}
      {...props}
    >
      {children}
    </TableRow>
    
    {/* Mobile card view */}
    {mobileCard && (
      <div className="md:hidden">
        {mobileCard}
      </div>
    )}
  </>
))
ResponsiveTableRow.displayName = "ResponsiveTableRow"

// Responsive table with built-in mobile cards
const ResponsiveTableWithCards = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    headers: string[];
    data: any[];
    renderRow: (item: any, index: number) => React.ReactNode;
    renderMobileCard: (item: any, index: number) => React.ReactNode;
  }
>(({ className, headers, data, renderRow, renderMobileCard, ...props }, ref) => (
  <div ref={ref} className={cn("w-full", className)} {...props}>
    {/* Desktop Table */}
    <div className="hidden md:block overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, index) => (
              <TableHead key={index} className="font-medium">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => renderRow(item, index))}
        </TableBody>
      </Table>
    </div>
    
    {/* Mobile Cards */}
    <div className="md:hidden space-y-3">
      {data.map((item, index) => renderMobileCard(item, index))}
    </div>
  </div>
))
ResponsiveTableWithCards.displayName = "ResponsiveTableWithCards"

export { 
  ResponsiveTable, 
  ResponsiveTableRow,
  ResponsiveTableWithCards,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}