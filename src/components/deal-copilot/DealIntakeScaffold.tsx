import { Calculator, Home, LinkIcon, MapPin, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const fields = [
  {
    label: "Listing URL",
    value: "Paste Rightmove, Zoopla, agent, or auction listing URL",
    icon: LinkIcon,
  },
  {
    label: "Postcode / area",
    value: "Enter target postcode or investment area",
    icon: MapPin,
  },
  {
    label: "Property basics",
    value: "Type, bedrooms, size, and condition assumptions",
    icon: Home,
  },
  {
    label: "Deal assumptions",
    value: "Purchase price, GDV, expected rent, refurb budget",
    icon: Calculator,
  },
  {
    label: "Exit strategy",
    value: "Flip, buy-to-let, BRRR, HMO, Airbnb, or hold",
    icon: Target,
  },
];

export function DealIntakeScaffold() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Deal assumptions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              First capture the manual underwriting inputs. The next step is wiring these fields
              into the shared pricing and ROI engines.
            </p>
          </div>
          <Badge variant="secondary">MVP scaffold</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-xl border border-border bg-secondary/30 p-4">
              <field.icon className="h-4 w-4 text-accent" />
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {field.label}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{field.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
