import { createFileRoute } from "@tanstack/react-router";
import { Calculator, FileText, Home, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { DealIntakeForm } from "@/components/deal-copilot";
import { Card, CardContent } from "@/components/ui/card";


export const Route = createFileRoute("/deal-copilot/new")({
  head: () => ({
    meta: [{ title: "New Deal Analysis — Deal Copilot" }],
  }),
  component: NewDealAnalysis,
});

function NewDealAnalysis() {
  return <NewDealAnalysisContent />;
}

function NewDealAnalysisContent() {
  return (
    <AppLayout
      title="New deal analysis"
      subtitle="Manual Deal Copilot intake. This is the first wedge before background agents and portal connectors."
    >
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <DealIntakeForm />

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
