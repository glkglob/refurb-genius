import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { Loader2, AlertCircle, Briefcase, Lock, ArrowLeft } from "lucide-react";
import { TRADES_JOB_CATEGORIES, type TradesJobCategory, type TradesJobStatus } from "@/core/trades";
import type { TradesJob } from "@/core/trades";
import { getTradesJobById, updateTradesJob } from "@/services/trades/tradesJobStore";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authed/trades_/$jobId_/edit")({
  head: () => ({ meta: [{ title: "Edit job — Trades Marketplace" }] }),
  component: TradesJobEditPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "error"; message: string }
  | { status: "ready"; job: TradesJob };

const PROPERTY_TYPE_OPTIONS = [
  "Terraced",
  "Semi-detached",
  "Detached",
  "Flat / Apartment",
  "Bungalow",
  "Other",
];

const STATUS_OPTIONS: { value: TradesJobStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "closed", label: "Closed" },
];

// ---------------------------------------------------------------------------
// Data hook
// ---------------------------------------------------------------------------

function useJobForEdit(jobId: string, userId: string | null, hydrated: boolean): PageState {
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!hydrated) return;

    if (!userId) {
      setState({ status: "unauthenticated" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    getTradesJobById(jobId)
      .then((job) => {
        if (cancelled) return;
        if (!job) {
          setState({ status: "not_found" });
          return;
        }
        if (job.userId !== userId) {
          setState({ status: "forbidden" });
          return;
        }
        setState({ status: "ready", job });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load job.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [jobId, userId, hydrated]);

  return state;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function TradesJobEditPage() {
  return <TradesJobEditPageContent />;
}

function TradesJobEditPageContent() {
  const { jobId } = Route.useParams();
  const { user, hydrated } = useAuth();
  const state = useJobForEdit(jobId, user?.id ?? null, hydrated);
  const navigate = useNavigate();

  if (state.status === "loading") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <AppLayout>
        <EmptyState
          icon={Lock}
          title="Sign in required"
          description="You need to be signed in to edit a job."
          action={
            <Button asChild>
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  if (state.status === "forbidden") {
    return (
      <AppLayout>
        <EmptyState
          icon={Lock}
          title="Access denied"
          description="You don't have permission to edit this job."
          action={
            <Button asChild variant="outline">
              <Link to="/trades">Back to Trades</Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  if (state.status === "not_found") {
    return (
      <AppLayout>
        <EmptyState
          icon={Briefcase}
          title="Job not found"
          description="This job posting doesn't exist or may have been removed."
          action={
            <Button asChild variant="outline">
              <Link to="/trades">Back to Trades</Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  if (state.status === "error") {
    return (
      <AppLayout>
        <EmptyState
          icon={Briefcase}
          title="Something went wrong"
          description={state.message}
          action={
            <Button asChild variant="outline">
              <Link to="/trades/$jobId" params={{ jobId }}>
                Back to job
              </Link>
            </Button>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Edit job"
      subtitle="Update the details of your refurbishment job posting."
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to="/trades/$jobId" params={{ jobId }}>
              <ArrowLeft className="h-4 w-4" /> Back to job
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/trades">Trades</Link>
          </Button>
        </>
      }
    >
      <EditForm
        job={state.job}
        onSaved={() => navigate({ to: "/trades/$jobId", params: { jobId } })}
        jobId={jobId}
      />
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Form component
// ---------------------------------------------------------------------------

function EditForm({ job, onSaved, jobId }: { job: TradesJob; onSaved: () => void; jobId: string }) {
  const [title, setTitle] = useState(job.title);
  const [propertyAddress, setPropertyAddress] = useState(job.propertyAddress ?? "");
  const [postcode, setPostcode] = useState(job.postcode ?? "");
  const [propertyType, setPropertyType] = useState(job.propertyType ?? "");
  const [jobCategory, setJobCategory] = useState<TradesJobCategory>(job.jobCategory);
  const [description, setDescription] = useState(job.description);
  const [budgetMin, setBudgetMin] = useState(job.budgetMin != null ? String(job.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState(job.budgetMax != null ? String(job.budgetMax) : "");
  const [desiredStartDate, setDesiredStartDate] = useState(job.desiredStartDate ?? "");
  const [status, setStatus] = useState<TradesJobStatus>(job.status);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Job title is required.");
    if (!description.trim()) return setError("Description is required.");

    setSubmitting(true);
    try {
      await updateTradesJob(jobId, {
        title: title.trim(),
        propertyAddress: propertyAddress.trim() || undefined,
        postcode: postcode.trim() || undefined,
        propertyType: propertyType || undefined,
        jobCategory,
        description: description.trim(),
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        desiredStartDate: desiredStartDate || undefined,
        status,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Job title *</Label>
        <Input
          id="title"
          placeholder="e.g. Full bathroom refurbishment"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobCategory">Job category *</Label>
        <Select value={jobCategory} onValueChange={(v) => setJobCategory(v as TradesJobCategory)}>
          <SelectTrigger id="jobCategory">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {TRADES_JOB_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Describe the work needed, current condition, access, any special requirements…"
          rows={7}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="propertyAddress">Property address</Label>
        <Input
          id="propertyAddress"
          placeholder="e.g. 12 High Street"
          value={propertyAddress}
          onChange={(e) => setPropertyAddress(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            placeholder="e.g. SW1A 1AA"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="propertyType">Property type</Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger id="propertyType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="budgetMin">Min budget (£)</Label>
          <Input
            id="budgetMin"
            type="number"
            min={0}
            placeholder="e.g. 2000"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budgetMax">Max budget (£)</Label>
          <Input
            id="budgetMax"
            type="number"
            min={0}
            placeholder="e.g. 5000"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desiredStartDate">Desired start date</Label>
        <Input
          id="desiredStartDate"
          type="date"
          value={desiredStartDate}
          onChange={(e) => setDesiredStartDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as TradesJobStatus)}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/trades/$jobId" params={{ jobId }}>
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
