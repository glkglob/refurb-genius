import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { useState, type FormEvent } from "react";
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { TRADES_JOB_CATEGORIES, type TradesJobCategory } from "@/core/trades";
import { createTradesJob } from "@/services/trades/tradesJobStore";
import { trackEvent } from "@/lib/analytics";
import { LabourRateGuide } from "@/components/marketplace/LabourRateGuide";

export const Route = createFileRoute("/_authed/trades_/new")({
  head: () => ({ meta: [{ title: "Post a job — Trades Marketplace" }] }),
  component: TradesNewPage,
});

const PROPERTY_TYPE_OPTIONS = [
  "Terraced",
  "Semi-detached",
  "Detached",
  "Flat / Apartment",
  "Bungalow",
  "Other",
];

function TradesNewPage() {
  return <TradesNewPageContent />;
}

function TradesNewPageContent() {
  // NOTE: user/hydrated guards removed. _authed beforeLoad + the RequireAuth
  // passthrough (post-mount only) guarantee we render the real form in the
  // initial SSR HTML and first client render. This avoids hydration mismatch
  // and the "Checking session" flash for this protected route.
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [title, setTitle] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [jobCategory, setJobCategory] = useState<TradesJobCategory | "">("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [desiredStartDate, setDesiredStartDate] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Job title is required.");
    if (!jobCategory) return setError("Please select a job category.");
    if (!description.trim()) return setError("Description is required.");

    setSubmitting(true);
    try {
      await createTradesJob({
        title: title.trim(),
        propertyAddress: propertyAddress.trim() || undefined,
        postcode: postcode.trim() || undefined,
        propertyType: propertyType || undefined,
        jobCategory: jobCategory as TradesJobCategory,
        description: description.trim(),
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        desiredStartDate: desiredStartDate || undefined,
      });
      trackEvent("trades_job_posted", { job_category: jobCategory });
      setPosted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Post a refurbishment job"
      subtitle="Fill in the details below and we'll connect you with trusted local trades."
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/trades">
            <ArrowLeft className="h-4 w-4" /> Trades Marketplace
          </Link>
        </Button>
      }
    >
      {posted ? (
        <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-success/30 bg-success/10 p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h2 className="text-xl font-semibold text-success">Job posted!</h2>
          <p className="text-sm text-success/80">Your job is now live on the Trades Marketplace.</p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild variant="outline">
              <Link to="/trades/new" onClick={() => setPosted(false)}>
                Post another
              </Link>
            </Button>
            <Button asChild>
              <Link to="/trades">View marketplace</Link>
            </Button>
          </div>
        </div>
      ) : (
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
            <Select
              value={jobCategory}
              onValueChange={(v) => setJobCategory(v as TradesJobCategory)}
            >
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
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-right text-xs text-gray-400">{description.length} characters</p>
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

          {jobCategory ? (
            <LabourRateGuide
              jobCategory={jobCategory}
              postcode={postcode}
              days={jobCategory === "bathroom" || jobCategory === "kitchen" ? 7 : 5}
            />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="desiredStartDate">Desired start date</Label>
            <Input
              id="desiredStartDate"
              type="date"
              value={desiredStartDate}
              onChange={(e) => setDesiredStartDate(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting…
              </>
            ) : (
              "Post job"
            )}
          </Button>
        </form>
      )}
    </AppLayout>
  );
}
