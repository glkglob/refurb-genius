import { createFileRoute } from "@tanstack/react-router";
import { Calculator, FileText, Home, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/deal-copilot/new")({
  head: () => ({
    meta: [{ title: "New Deal Analysis — Deal Copilot" }],
  }),
  component: NewDealAnalysis,
});

function NewDealAnalysis() {
  return (
    <AppLayout
      title="New deal analysis"
      subtitle="Manual Deal Copilot intake. This is the first wedge before background agents and portal connectors."
    >
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Deal assumptions</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The first version captures assumptions only. Next step is wiring these fields into
                  the shared pricing and ROI engines.
                </p>
              </div>
              <Badge variant="secondary">MVP scaffold</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ReadonlyField label="Listing URL" value="Coming next" />
              <ReadonlyField label="Postcode / area" value="Coming next" />
              <ReadonlyField label="Property type" value="Coming next" />
              <ReadonlyField label="Bedrooms" value="Coming next" />
              <ReadonlyField label="Purchase price" value="Coming next" />
              <ReadonlyField label="Target GDV" value="Coming next" />
              <ReadonlyField label="Expected monthly rent" value="Coming next" />
              <ReadonlyField label="Refurb level" value="Coming next" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <SummaryCard
            icon={Home}
            title="1. Create opportunity"
            body="Capture a listing or manual property deal without creating a separate schema fork."
          />
          <SummaryCard
            icon={Calculator}
            title="2. Run deterministic numbers"
            body="Use existing Refurb Genius pricing and ROI engines for all financial output."
          />
          <SummaryCard
            icon={ShieldAlert}
            title="3. Add risk summary"
            body="AI can explain risks, but risk cost impact must come from deterministic assumptions."
          />
          <SummaryCard
            icon={FileText}
            title="4. Export investor report"
            body="Extend the shared report engine rather than building a separate Deal Copilot report system."
          />
        </div>
      </div>
    </AppLayout>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Home;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className="h-5 w-5 text-accent" />
        <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
