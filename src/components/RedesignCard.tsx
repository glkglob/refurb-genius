import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Palette, Sofa, Lightbulb, Layers } from "lucide-react";
import type { RedesignConcept } from "@/features/ai-design";
import { formatGBP } from "@/core/pricing";

export type RedesignCardProps = {
  concept: RedesignConcept;
  beforePhotoUrl?: string;
};

export function RedesignCard({ concept: c, beforePhotoUrl }: RedesignCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="relative aspect-[4/5] bg-muted">
          {beforePhotoUrl ? (
            <img
              src={beforePhotoUrl}
              alt={`${c.style} before`}
              className="h-full w-full object-cover"
            />
          ) : null}
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-background/85 backdrop-blur"
          >
            Before
          </Badge>
        </div>
        <div
          className="relative aspect-[4/5] overflow-hidden"
          style={c.afterImageUrl ? undefined : { background: c.afterGradient }}
        >
          {c.afterImageUrl ? (
            <img
              src={c.afterImageUrl}
              alt={`${c.style} AI render`}
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
          <Badge className="absolute left-2 top-2 bg-foreground/85 text-background backdrop-blur">
            <Sparkles className="mr-1 h-3 w-3" /> AI render
          </Badge>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-background/90 drop-shadow">
              {c.style}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">{c.style}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Palette className="h-3.5 w-3.5" /> Colour palette
          </p>
          <div className="flex gap-2">
            {c.palette.map((p) => (
              <div key={p.hex} className="flex flex-col items-center gap-1">
                <div
                  className="h-8 w-8 rounded-md border border-border shadow-sm"
                  style={{ backgroundColor: p.hex }}
                  title={`${p.name} ${p.hex}`}
                />
                <span className="text-[10px] text-muted-foreground">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <DetailRow icon={<Layers className="h-4 w-4" />} label="Flooring" value={c.flooring} />
          <DetailRow icon={<Lightbulb className="h-4 w-4" />} label="Lighting" value={c.lighting} />
          <DetailRow icon={<Sofa className="h-4 w-4" />} label="Furniture" value={c.furniture} />
        </div>

        {c.estimatedCostUplift && (
          <div className="pt-2 border-t text-xs text-muted-foreground">
            Est. cost uplift vs baseline: {formatGBP(c.estimatedCostUplift.low)}–
            {formatGBP(c.estimatedCostUplift.high)}
            {c.estimatedCostUplift.note ? ` · ${c.estimatedCostUplift.note}` : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <p className="text-foreground">
        <span className="text-muted-foreground">{label} — </span>
        {value}
      </p>
    </div>
  );
}
