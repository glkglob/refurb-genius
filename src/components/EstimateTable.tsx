import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGBP, type LineItem } from "@/core/pricing";

export type EstimateTableProps = {
  items: LineItem[];
  labour_total: number;
  materials_total: number;
  subtotal: number;
  contingency: number;
  vat: number;
  mid_total: number;
  /** Show the per-category weeks column. Defaults to true. */
  showWeeks?: boolean;
  emptyLabel?: string;
};

export function EstimateTable({
  items,
  labour_total,
  materials_total,
  subtotal,
  contingency,
  vat,
  mid_total,
  showWeeks = true,
  emptyLabel = "Select at least one category to generate an estimate.",
}: EstimateTableProps) {
  if (items.length === 0) {
    return <div className="p-10 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  const totalsColspan = showWeeks ? 4 : 3;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Labour</TableHead>
          <TableHead className="text-right">Materials</TableHead>
          {showWeeks && <TableHead className="text-right">Weeks</TableHead>}
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.category}>
            <TableCell className="font-medium text-foreground">{i.category}</TableCell>
            <TableCell className="text-right">{formatGBP(i.labour)}</TableCell>
            <TableCell className="text-right">{formatGBP(i.materials)}</TableCell>
            {showWeeks && (
              <TableCell className="text-right text-muted-foreground">{i.weeks}</TableCell>
            )}
            <TableCell className="text-right font-semibold">{formatGBP(i.total)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-medium">Subtotal</TableCell>
          <TableCell className="text-right">{formatGBP(labour_total)}</TableCell>
          <TableCell className="text-right">{formatGBP(materials_total)}</TableCell>
          {showWeeks && <TableCell />}
          <TableCell className="text-right font-semibold">{formatGBP(subtotal)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={totalsColspan} className="text-muted-foreground">
            Contingency (10%)
          </TableCell>
          <TableCell className="text-right">{formatGBP(contingency)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={totalsColspan} className="text-muted-foreground">
            VAT (20%)
          </TableCell>
          <TableCell className="text-right">{formatGBP(vat)}</TableCell>
        </TableRow>
        <TableRow className="bg-muted/40">
          <TableCell colSpan={totalsColspan} className="font-semibold text-foreground">
            Mid total
          </TableCell>
          <TableCell className="text-right text-base font-semibold text-foreground">
            {formatGBP(mid_total)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
