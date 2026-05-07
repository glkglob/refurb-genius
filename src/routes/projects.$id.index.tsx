import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProject } from "@/lib/mockData";
import { Camera, Sparkles, Calculator, FileText, MapPin } from "lucide-react";

export const Route = createFileRoute("/projects/$id/")({
  head: () => ({ meta: [{ title: "Project — Refurb Genius" }] }),
  component: ProjectDetail,
  loader: ({ params }) => {
    const project = getProject(params.id);
    if (!project) throw notFound();
    return project;
  },
});

function ProjectDetail() {
  const project = Route.useLoaderData();
  const { id } = Route.useParams();

  const steps = [
    { to: "/projects/$id/upload", label: "Upload photos", desc: "Add property photos for AI analysis.", icon: Camera },
    { to: "/projects/$id/analysis", label: "AI analysis", desc: "Room-by-room condition & redesigns.", icon: Sparkles },
    { to: "/projects/$id/estimate", label: "Cost estimate", desc: "Detailed regional refurb estimate.", icon: Calculator },
    { to: "/projects/$id/report", label: "Investor report", desc: "GDV, ROI, yield, full report.", icon: FileText },
  ] as const;

  return (
    <AppLayout
      title={project.name}
      subtitle={project.address}
      actions={
        <Button asChild>
          <Link to="/projects/$id/upload" params={{ id }}>Continue</Link>
        </Button>
      }
    >
      <Card className="mb-8">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-4">
          <Detail label="Region" value={project.region} icon={MapPin} />
          <Detail label="Type" value={project.propertyType} />
          <Detail label="Beds" value={String(project.beds)} />
          <Detail label="Status" value={project.status} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((s) => (
          <Link key={s.to} to={s.to} params={{ id }}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{s.label}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}
