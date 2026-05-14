import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { PlatformNavButtons } from "@/components/PlatformNavButtons";
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
import { Loader2, AlertCircle, Lock, CheckCircle2, ArrowLeft } from "lucide-react";
import { TRADES_JOB_CATEGORIES } from "@/core/trades";
import type { InsuranceStatus } from "@/core/trades";
import {
  getCurrentUserTradeProfile,
  upsertCurrentUserTradeProfile,
} from "@/services/trades/tradeProfileStore";
import { useAuth } from "@/hooks/useAuth";
import { BuilderOnlyGuard } from "@/components/BuilderOnlyGuard";

export const Route = createFileRoute("/trades/profile")({
  head: () => ({ meta: [{ title: "Trade Profile — Refurb Genius" }] }),
  component: TradeProfilePage,
});

function TradeProfilePage() {
  // TODO: Remove builder-only guard before beta launch
  return (
    <BuilderOnlyGuard>
      <TradeProfilePageContent />
    </BuilderOnlyGuard>
  );
}

function TradeProfilePageContent() {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <AppLayout title="Trade Profile">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout title="Trade Profile">
        <EmptyState
          icon={Lock}
          title="Sign in required"
          description="You need to be signed in to manage your trade profile."
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

  return <TradeProfileForm />;
}

function TradeProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // form state
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>("unknown");

  useEffect(() => {
    let cancelled = false;
    getCurrentUserTradeProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        setBusinessName(profile.businessName);
        setContactName(profile.contactName);
        setPhone(profile.phone ?? "");
        setPostcode(profile.postcode ?? "");
        setSelectedCategories(profile.tradeCategories);
        setBio(profile.bio ?? "");
        setInsuranceStatus(profile.insuranceStatus);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!businessName.trim()) return setError("Business name is required.");
    if (!contactName.trim()) return setError("Contact name is required.");

    setSaving(true);
    try {
      await upsertCurrentUserTradeProfile({
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim() || undefined,
        postcode: postcode.trim() || undefined,
        tradeCategories: selectedCategories,
        bio: bio.trim() || undefined,
        insuranceStatus,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Trade Profile"
      subtitle="Create or update your tradesperson profile so clients can see who you are."
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/trades">Trades</Link>
          </Button>
        </>
      }
    >
      <PlatformNavButtons exclude={["/trades/profile"]} className="mb-8" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Profile saved successfully.</span>
            </div>
          )}

          {/* Business name */}
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name *</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Smith Builders Ltd"
              required
            />
          </div>

          {/* Contact name */}
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact name *</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. John Smith"
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 07700 900000"
            />
          </div>

          {/* Postcode */}
          <div className="space-y-2">
            <Label htmlFor="postcode">Base postcode</Label>
            <Input
              id="postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. SW1A 1AA"
            />
          </div>

          {/* Trade categories */}
          <div className="space-y-2">
            <Label>Trade categories</Label>
            <p className="text-xs text-muted-foreground">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {TRADES_JOB_CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat.value);
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => toggleCategory(cat.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-background text-muted-foreground hover:border-accent/50 hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Insurance status */}
          <div className="space-y-2">
            <Label htmlFor="insuranceStatus">Insurance status</Label>
            <Select
              value={insuranceStatus}
              onValueChange={(v) => setInsuranceStatus(v as InsuranceStatus)}
            >
              <SelectTrigger id="insuranceStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Not specified</SelectItem>
                <SelectItem value="insured">Insured</SelectItem>
                <SelectItem value="not_insured">Not insured</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">About your business</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Briefly describe your experience, specialisms, and working area..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      )}
    </AppLayout>
  );
}
