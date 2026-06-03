import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DashboardSection } from "@/components/DashboardSection";

import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import {
  Briefcase,
  FolderPlus,
  HardHat,
  Loader2,
  Eye,
  Pencil,
  XCircle,
  Calculator,
  TrendingUp,
  BookMarked,
  Lock,
  HandshakeIcon,
  DollarSign,
} from "lucide-react";
import type { TradesJob, TradesJobStatus } from "@/core/trades";
import {
  formatCategoryLabel,
  formatBudgetRange,
  formatShortDate,
} from "@/core/trades/tradesJob.selectors";
import { listCurrentUserTradesJobs, updateTradesJob } from "@/services/trades/tradesJobStore";

import {
  listCurrentUserInterestsWithJobs,
  type TradesJobInterestWithJob,
} from "@/services/trades/tradesJobInterestStore";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Refurb Genius" }] }),
  component: Dashboard,
});

// ---------------------------------------------------------------------------
// Data hook
// ---------------------------------------------------------------------------

type JobsState =
  | { status: "loading" }
  | { status: "ready"; jobs: TradesJob[] }
  | { status: "error"; message: string };

function useMyTradesJobs(): [JobsState, (updatedJob: TradesJob) => void] {
  const [state, setState] = useState<JobsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listCurrentUserTradesJobs()
      .then((jobs) => {
        if (!cancelled) setState({ status: "ready", jobs });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load jobs.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyUpdate(updatedJob: TradesJob) {
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", jobs: prev.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)) }
        : prev,
    );
  }

  return [state, applyUpdate];
}

// ---------------------------------------------------------------------------
// Interests hook
// ---------------------------------------------------------------------------

type InterestsState =
  | { status: "loading" }
  | { status: "ready"; interests: TradesJobInterestWithJob[] }
  | { status: "error"; message: string };

function useMyInterests(): InterestsState {
  const [state, setState] = useState<InterestsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listCurrentUserInterestsWithJobs()
      .then((interests) => {
        if (!cancelled) setState({ status: "ready", interests });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load interests.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: TradesJobStatus): string {
  if (status === "posted") return "Posted";
  if (status === "closed") return "Closed";
  return "Draft";
}

function formatBudgetTotal(total: number | null, loading: boolean): string {
  if (loading) return "…";
  if (total === null || total === 0) return "—";
  if (total >= 1_000_000) return `£${(total / 1_000_000).toFixed(1)}m`;
  if (total >= 1_000) return `£${Math.round(total / 1_000)}k`;
  return `£${total.toLocaleString()}`;
}

function JobStatusBadge({ status }: { status: TradesJobStatus }) {
  const toneMap: Record<TradesJobStatus, "accent" | "muted" | "destructive"> = {
    posted: "accent",
    closed: "muted",
    draft: "destructive", // or we can add a "warning" tone later
  };

  return <StatusBadge tone={toneMap[status] ?? "muted"}>{statusLabel(status)}</StatusBadge>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function Dashboard() {
  return <DashboardContent />;
}

function DashboardContent() {
  const { user: _user } = useAuth();
  const [jobsState, applyUpdate] = useMyTradesJobs();
  const interestsState = useMyInterests();

  const jobCount =
    jobsState.status === "ready" ? jobsState.jobs.filter((j) => j.status !== "closed").length : 0;
  const interestCount = interestsState.status === "ready" ? interestsState.interests.length : 0;
  const totalBudgetPosted =
    jobsState.status === "ready"
      ? jobsState.jobs.reduce((sum, j) => sum + (j.budgetMax ?? j.budgetMin ?? 0), 0)
      : null;
  return (
    <AppLayout
      title="Dashboard"
      subtitle="Manage your refurbishment projects, trades jobs, and feasibility work."
    >
      {/* Section 1 — Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active trades jobs"
          value={jobsState.status === "loading" ? "…" : String(jobCount)}
          icon={Briefcase}
          subLabel="open listings"
        />
        <StatCard
          label="Saved opportunities"
          value={interestsState.status === "loading" ? "…" : String(interestCount)}
          icon={HandshakeIcon}
          subLabel="interests expressed"
        />
        <StatCard
          label="Total budget posted"
          value={formatBudgetTotal(totalBudgetPosted, jobsState.status === "loading")}
          icon={DollarSign}
          subLabel="across all jobs"
        />
        <StatCard label="Projects" value="0" icon={FolderPlus} subLabel="coming soon" />
      </div>

      {/* Section 2 — Quick actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard icon={Calculator} label="Start Deal Analysis" to="/deal-copilot/new" />
          <QuickActionCard icon={Briefcase} label="Post a Trades Job" to="/trades/new" />
          <QuickActionCard icon={HardHat} label="Browse Marketplace" to="/trades" />
          <QuickActionCard icon={FolderPlus} label="Create Project" to="/projects/new" />
        </div>
      </div>

      {/* Section 3 — My Trades Jobs */}
      <DashboardSection
        title="My trades jobs"
        icon={<Briefcase className="h-5 w-5" />}
        action={
          <Link to="/trades/new" className="text-sm font-medium text-accent hover:underline">
            + Post new job
          </Link>
        }
      >
        <TradesJobsTable state={jobsState} onUpdate={applyUpdate} />
      </DashboardSection>

      {/* Section 4 — My Interests */}
      <DashboardSection title="My interests" icon={<HandshakeIcon className="h-5 w-5" />}>
        <MyInterestsTable state={interestsState} />
      </DashboardSection>

      {/* Section 5 — Roadmap placeholders */}
      <section>
        <Card className="bg-muted/40 p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Coming soon
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <RoadmapCard
              icon={Calculator}
              title="Refurb Estimates"
              description="AI-generated line-item cost estimates across all UK regions, attached to your properties."
            />
            <RoadmapCard
              icon={TrendingUp}
              title="ROI Reports"
              description="Full deal analysis with GDV, yield, ROI and investor-ready PDF export."
            />
            <RoadmapCard
              icon={BookMarked}
              title="Saved Feasibility Studies"
              description="Store and revisit your feasibility studies. Share with lenders or JV partners."
            />
          </div>
        </Card>
      </section>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TradesJobsTable({
  state,
  onUpdate,
}: {
  state: JobsState;
  onUpdate: (job: TradesJob) => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (state.status === "error") {
    return <EmptyState icon={Briefcase} title="Could not load jobs" description={state.message} />;
  }

  if (state.jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No trades jobs yet"
        description="Post your first refurbishment job to connect with trusted local trades."
        action={
          <Button asChild>
            <Link to="/trades/new">
              <Briefcase className="h-4 w-4" /> Post a job
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="divide-y divide-border sm:hidden">
        {state.jobs.map((job) => (
          <TradesJobCard key={job.id} job={job} onUpdate={onUpdate} />
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Budget</th>
              <th className="px-4 py-3 text-left">Posted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {state.jobs.map((job) => (
              <TradesJobRow key={job.id} job={job} onUpdate={onUpdate} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TradesJobRow({ job, onUpdate }: { job: TradesJob; onUpdate: (job: TradesJob) => void }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      const updated = await updateTradesJob(job.id, { status: "closed" });
      onUpdate(updated);
    } finally {
      setClosing(false);
    }
  }

  return (
    <tr className="transition-colors hover:bg-secondary/50">
      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">{job.title}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatCategoryLabel(job.jobCategory)}</td>
      <td className="px-4 py-3">
        <JobStatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatBudgetRange(job)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatShortDate(job.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm" title="View">
            <Link to="/trades/$jobId" params={{ jobId: job.id }}>
              <Eye className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" title="Edit" disabled={job.status === "closed"}>
            <Link to="/trades/$jobId/edit" params={{ jobId: job.id }}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Close job"
            disabled={job.status === "closed" || closing}
            onClick={handleClose}
            className="text-destructive hover:text-destructive"
          >
            {closing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TradesJobCard({ job, onUpdate }: { job: TradesJob; onUpdate: (job: TradesJob) => void }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      const updated = await updateTradesJob(job.id, { status: "closed" });
      onUpdate(updated);
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-foreground">{job.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatCategoryLabel(job.jobCategory)} · {formatShortDate(job.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          <span className="text-xs text-muted-foreground">{formatBudgetRange(job)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link to="/trades/$jobId" params={{ jobId: job.id }}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" disabled={job.status === "closed"}>
          <Link to="/trades/$jobId/edit" params={{ jobId: job.id }}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={job.status === "closed" || closing}
          onClick={handleClose}
          className="text-destructive hover:text-destructive"
        >
          {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MyInterestsTable({ state }: { state: InterestsState }) {
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon={HandshakeIcon}
        title="Could not load interests"
        description={state.message}
      />
    );
  }

  if (state.interests.length === 0) {
    return (
      <EmptyState
        icon={HandshakeIcon}
        title="No interests yet"
        description="You have not registered interest in any jobs yet."
        action={
          <Button asChild>
            <Link to="/trades">
              <HardHat className="h-4 w-4" /> Start exploring jobs near you
            </Link>
          </Button>
        }
      />
    );
  }

  const interestStatusBadge: Record<string, "accent" | "muted" | "destructive"> = {
    pending: "muted",
    accepted: "accent",
    rejected: "destructive",
  };

  return (
    <>
      {/* Mobile card list */}
      <div className="divide-y divide-border sm:hidden">
        {state.interests.map((interest) => (
          <div key={interest.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-medium text-foreground">{interest.jobTitle}</p>
              <p className="text-xs text-muted-foreground">
                {formatCategoryLabel(interest.jobCategory)} · {interest.jobPostcode ?? "—"} ·{" "}
                {formatShortDate(interest.createdAt)}
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge tone={interestStatusBadge[interest.status] ?? "muted"}>
                  {interest.status}
                </StatusBadge>
                {interest.message && (
                  <span className="max-w-[160px] truncate text-xs text-muted-foreground">
                    {interest.message}
                  </span>
                )}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/trades/$jobId" params={{ jobId: interest.jobId }}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Job title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Postcode</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {state.interests.map((interest) => (
              <tr key={interest.id} className="transition-colors hover:bg-secondary/30">
                <td className="max-w-[200px] truncate px-4 py-3 font-medium text-foreground">
                  {interest.jobTitle}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatCategoryLabel(interest.jobCategory)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{interest.jobPostcode ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={interestStatusBadge[interest.status] ?? "muted"}>
                    {interest.status}
                  </StatusBadge>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                  {interest.message ?? <span className="italic">No message</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatShortDate(interest.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="ghost" size="sm" title="View job">
                    <Link to="/trades/$jobId" params={{ jobId: interest.jobId }}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View job</span>
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon?: typeof Calculator;
}) {
  return (
    <Card className="border-l-4 border-l-accent p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-accent" />}
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {subLabel && <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>}
    </Card>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof Calculator;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex min-h-[96px] flex-col justify-between rounded-xl border bg-card p-5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-accent" />
      <span className="mt-3">{label}</span>
    </Link>
  );
}

function RoadmapCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Calculator;
  title: string;
  description: string;
}) {
  return (
    <Card className="relative overflow-hidden bg-muted/50 opacity-60">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <span className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Coming soon
          </span>
        </div>
        <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
