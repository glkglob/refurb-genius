import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { NewProjectEntry } from "@/features/projects";

/**
 * Compatibility alias for the canonical New Analysis entry (`/analyze`).
 *
 * Same durable project-create → Photos flow. Prefer linking to /analyze from
 * global navigation; deep links to /projects/new remain valid.
 */
export const Route = createFileRoute("/_authed/projects/new")({
  head: () => ({ meta: [{ title: "New project — Refurb Genius" }] }),
  component: NewProject,
});

function NewProject() {
  return (
    <AppLayout
      title="New project"
      subtitle="Only a name is required. You can add property details later and start with Photos straight away."
    >
      <NewProjectEntry />
    </AppLayout>
  );
}
