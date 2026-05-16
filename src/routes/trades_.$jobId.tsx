import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Briefcase,
  ArrowLeft,
  HandshakeIcon,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Users,
  Check,
  X,
  Pencil,
} from "lucide-react";
import type { TradesJob, TradesJobInterest, TradeProfile } from "@/core/trades";
import {
  formatCategoryLabel,
  formatStatus,
  formatBudgetRange,
  formatShortDate,
} from "@/core/trades/tradesJob.selectors";
import { getTradesJobById } from "@/services/trades/tradesJobStore";
import {
  createTradesJobInterest,
  getCurrentUserInterestForJob,
  listJobInterests,
  updateTradesJobInterestStatus,
} from "@/services/trades/tradesJobInterestStore";
import { getTradeProfileByUserId } from "@/services/trades/tradeProfileStore";
import { useAuth } from "@/hooks/useAuth";
import { PlatformNavButtons } from "@/components/PlatformNavButtons";

export const Route = createFileRoute("/trades_/$jobId")({
  head: () => ({ meta: [{ title: "Job detail — Trades Marketplace" }] }),
  component: TradesJobDetailPage,
});

// ---------------------------------------------------------------------------
// Job fetch hook
// ---------------------------------------------------------------------------

type LoadState =
  | { status: "loading" }
  | { status: "found"; job: TradesJob }
  | { status: "not_found" }
  | { status: "error"; message: string };

function useTradesJob(jobId: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getTradesJobById(jobId)
      .then((job) => {
        if (cancelled) return;
        if (!job) setState({ status: "not_found" });
        else setState({ status: "found", job });
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
  }, [jobId]);

  return state;
}

// ---------------------------------------------------------------------------
// Interest state hook
// ---------------------------------------------------------------------------

type InterestState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "exists"; interest: TradesJobInterest };

function useExistingInterest(jobId: string, isAuthenticated: boolean): InterestState {
  const [state, setState] = useState<InterestState>({ status: "loading" });

  useEffect(() => {
    if (!isAuthenticated) {
      setState({ status: "none" });
      return;
    }
    let cancelled = false;
    getCurrentUserInterestForJob(jobId)
      .then((interest) => {
        if (cancelled) return;
        setState(interest ? { status: "exists", interest } : { status: "none" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, isAuthenticated]);

  return state;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function TradesJobDetailPage() {
  const { jobId } = Route.useParams();
  const state = useTradesJob(jobId);
  const { user } = useAuth();

  if (state.status === "loading") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
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

  const { job } = state;
  const isOwner = !!user && user.id === job.userId;

  return (
    <AppLayout
      title={job.title}
      subtitle={`${formatCategoryLabel(job.jobCategory)} · ${job.postcode ?? "Location not specified"}`}
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to="/trades">
              <ArrowLeft className="h-4 w-4" /> Trades
            </Link>
          </Button>
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link to="/trades/$jobId/edit" params={{ jobId }}>
                <Pencil className="h-4 w-4" /> Edit Job
              </Link>
            </Button>
          )}
        </>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <PlatformNavButtons exclude={["/trades"]} className="mb-2" />
        <JobDetailCard job={job} />
        <JobInteractionSection job={job} />
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Decides which section to render based on ownership
// ---------------------------------------------------------------------------

function JobInteractionSection({ job }: { job: TradesJob }) {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isOwner = !!user && user.id === job.userId;
  if (isOwner) return <OwnerInterestsSection jobId={job.id} />;
  return <RegisterInterestSection jobId={job.id} />;
}

// ---------------------------------------------------------------------------
// Job detail card
// ---------------------------------------------------------------------------

function JobDetailCard({ job }: { job: TradesJob }) {
  const fields: { label: string; value: string }[] = [
    { label: "Property address", value: job.propertyAddress ?? "Not specified" },
    { label: "Postcode", value: job.postcode ?? "Not specified" },
    { label: "Property type", value: job.propertyType ?? "Not specified" },
    { label: "Job category", value: formatCategoryLabel(job.jobCategory) },
    { label: "Budget range", value: formatBudgetRange(job) },
    { label: "Desired start date", value: formatShortDate(job.desiredStartDate) },
    { label: "Posted on", value: formatShortDate(job.createdAt) },
    { label: "Status", value: formatStatus(job.status) },
  ];

  return (
    <Card>
      <CardContent className="divide-y divide-border p-0">
        <div className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{job.description}</p>
        </div>
        <div className="grid gap-0 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
          {fields.map((f, i) => (
            <div
              key={f.label}
              className={`px-6 py-4 ${i < fields.length - 1 ? "border-b border-border sm:border-b-0 sm:border-r" : ""}`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.label}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{f.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Owner: Trade Interest management section
// ---------------------------------------------------------------------------

type InterestsListState =
  | { status: "loading" }
  | { status: "loaded"; interests: TradesJobInterest[] }
  | { status: "error"; message: string };

function useJobInterests(jobId: string): {
  state: InterestsListState;
  updateStatus: (interestId: string, status: "accepted" | "rejected") => Promise<void>;
} {
  const [state, setState] = useState<InterestsListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listJobInterests(jobId)
      .then((interests) => {
        if (!cancelled) setState({ status: "loaded", interests });
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
  }, [jobId]);

  async function updateStatus(interestId: string, status: "accepted" | "rejected") {
    const updated = await updateTradesJobInterestStatus(interestId, status);
    setState((prev) => {
      if (prev.status !== "loaded") return prev;
      return {
        status: "loaded",
        interests: prev.interests.map((i) => (i.id === updated.id ? updated : i)),
      };
    });
  }

  return { state, updateStatus };
}

const statusBadgeClass: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

function OwnerInterestsSection({ jobId }: { jobId: string }) {
  const { state, updateStatus } = useJobInterests(jobId);
  const [actioning, setActioning] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Map<string, TradeProfile | null>>(new Map());

  useEffect(() => {
    if (state.status !== "loaded") return;
    const uniqueIds = [...new Set(state.interests.map((i) => i.userId))];
    Promise.all(
      uniqueIds.map((uid) =>
        getTradeProfileByUserId(uid).then((p) => [uid, p] as [string, TradeProfile | null]),
      ),
    ).then((entries) => {
      setProfiles(new Map(entries));
    });
  }, [state]);

  async function handleAction(interestId: string, status: "accepted" | "rejected") {
    setActioning(interestId);
    try {
      await updateStatus(interestId, status);
    } finally {
      setActioning(null);
    }
  }

  const insuranceBadge: Record<string, string> = {
    insured: "bg-emerald-100 text-emerald-800",
    not_insured: "bg-red-100 text-red-800",
    unknown: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Trade Interest</h3>
        </div>

        {state.status === "loading" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.status === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}

        {state.status === "loaded" && state.interests.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No tradespeople have registered interest yet.
          </p>
        )}

        {state.status === "loaded" && state.interests.length > 0 && (
          <ul className="divide-y divide-border">
            {state.interests.map((interest) => {
              const profile = profiles.get(interest.userId);
              return (
                <li key={interest.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 min-w-0">
                      {profile ? (
                        <>
                          <p className="font-medium text-foreground text-sm">
                            {profile.businessName}
                          </p>
                          <p className="text-xs text-muted-foreground">{profile.contactName}</p>
                          {profile.postcode && (
                            <p className="text-xs text-muted-foreground">📍 {profile.postcode}</p>
                          )}
                          {profile.tradeCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {profile.tradeCategories.map((cat) => (
                                <span
                                  key={cat}
                                  className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${insuranceBadge[profile.insuranceStatus] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {profile.insuranceStatus === "insured"
                              ? "✓ Insured"
                              : profile.insuranceStatus === "not_insured"
                                ? "Not insured"
                                : "Insurance unknown"}
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Applicant:
                          </span>
                          <span className="truncate text-xs text-foreground font-mono">
                            {interest.userId}
                          </span>
                        </div>
                      )}
                      {interest.message && (
                        <p className="text-sm text-foreground whitespace-pre-wrap mt-1">
                          {interest.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[interest.status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {interest.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatShortDate(interest.createdAt)}
                        </span>
                      </div>
                    </div>

                    {interest.status === "pending" && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                          disabled={actioning === interest.id}
                          onClick={() => handleAction(interest.id, "accepted")}
                        >
                          {actioning === interest.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-400 text-red-700 hover:bg-red-50"
                          disabled={actioning === interest.id}
                          onClick={() => handleAction(interest.id, "rejected")}
                        >
                          {actioning === interest.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Register Interest section
// ---------------------------------------------------------------------------

function RegisterInterestSection({ jobId }: { jobId: string }) {
  const { user, hydrated } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = hydrated && !!user;

  const interestState = useExistingInterest(jobId, isAuthenticated);

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<TradesJobInterest | null>(null);

  // Redirect unauthenticated users when they click the button
  function handleUnauthenticated() {
    navigate({ to: "/auth", search: { mode: "signup" } });
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const interest = await createTradesJobInterest({
        jobId,
        message: message.trim() || undefined,
      });
      setSubmitted(interest);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      // Supabase unique violation code
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
        setSubmitError("You have already registered interest in this job.");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Loading auth / existing interest check
  if (!hydrated || interestState.status === "loading") {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Already submitted this session
  if (submitted || interestState.status === "exists") {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-start gap-4 p-6">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <h3 className="font-semibold text-foreground">Interest registered</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              You've registered your interest in this job. The client will be in touch if they'd
              like to proceed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Unauthenticated
  if (!isAuthenticated) {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Interested in this job?</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Create a free account or sign in to register your interest.
            </p>
          </div>
          <Button className="shrink-0" onClick={handleUnauthenticated}>
            <LogIn className="h-4 w-4" />
            Sign up to register interest
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Authenticated — show form
  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <HandshakeIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Register your interest</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Send a short message to the client explaining why you're a good fit.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="interest-message">
              Message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="interest-message"
              placeholder="Briefly describe your experience, availability and approach…"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
            />
          </div>

          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <HandshakeIcon className="h-4 w-4" />
                Register Interest
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
