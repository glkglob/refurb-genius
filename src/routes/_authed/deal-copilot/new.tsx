import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/AppLayout";
import { DealIntakeForm } from "@/components/deal-copilot";

export const Route = createFileRoute("/_authed/deal-copilot/new")({
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
      subtitle="Enter your deal assumptions and get an instant investment score."
    >
      <DealIntakeForm />
    </AppLayout>
  );
}
