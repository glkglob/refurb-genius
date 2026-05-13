import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, type FormEvent } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { TRADES_JOB_CATEGORIES, type TradesJobCategory } from "@/core/trades";
import { createTradesJob } from "@/services/trades/tradesJobStore";

export const Route = createFileRoute("/trades/new")({
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
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      navigate({ to: "/trades" });
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
    >
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
            rows={5}
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
    </AppLayout>
  );
}
