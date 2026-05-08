import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, type FormEvent } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  PROPERTY_TYPES,
  UK_REGIONS,
  projectStore,
  type PropertyType,
  type UKRegion,
} from "@/lib/projects";

export const Route = createFileRoute("/projects/new")({
  head: () => ({ meta: [{ title: "New project — Refurb Genius" }] }),
  component: NewProject,
});

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function NewProject() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [region, setRegion] = useState<UKRegion>("London");
  const [propertyType, setPropertyType] = useState<PropertyType>("Terraced");
  const [bedrooms, setBedrooms] = useState("3");
  const [bathrooms, setBathrooms] = useState("1");
  const [sizeSqm, setSizeSqm] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [estimatedGdv, setEstimatedGdv] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Project name is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!UK_POSTCODE.test(postcode.trim())) return setError("Enter a valid UK postcode.");

    const beds = Number(bedrooms);
    const baths = Number(bathrooms);
    const size = Number(sizeSqm);
    const price = Number(purchasePrice);
    const gdv = Number(estimatedGdv);

    if (!Number.isFinite(beds) || beds < 0 || beds > 50) return setError("Bedrooms must be 0–50.");
    if (!Number.isFinite(baths) || baths < 0 || baths > 50) return setError("Bathrooms must be 0–50.");
    if (!Number.isFinite(size) || size <= 0 || size > 10000) return setError("Enter a valid size in m².");
    if (!Number.isFinite(price) || price <= 0) return setError("Enter a valid purchase price.");
    if (!Number.isFinite(gdv) || gdv <= 0) return setError("Enter a valid estimated GDV.");

    setSubmitting(true);
    try {
      const project = await projectStore.create({
        name: name.trim(),
        address: address.trim(),
        postcode: postcode.trim().toUpperCase(),
        region,
        property_type: propertyType,
        bedrooms: beds,
        bathrooms: baths,
        size_sqm: size,
        purchase_price: price,
        estimated_gdv: gdv,
        notes: notes.trim(),
      });
      navigate({ to: "/projects/$id", params: { id: project.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="New project" subtitle="Create a new refurbishment project to analyse.">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
            <Field label="Project name" className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Victorian Terrace Refurb" required />
            </Field>

            <Field label="Address" className="sm:col-span-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Elm Street, London" required />
            </Field>

            <Field label="UK postcode">
              <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="E1 6AN" required />
            </Field>

            <Field label="Region">
              <Select value={region} onValueChange={(v) => setRegion(v as UKRegion)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UK_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Property type">
              <Select value={propertyType} onValueChange={(v) => setPropertyType(v as PropertyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Size (m²)">
              <Input type="number" inputMode="numeric" min={1} value={sizeSqm} onChange={(e) => setSizeSqm(e.target.value)} placeholder="95" required />
            </Field>

            <Field label="Bedrooms">
              <Input type="number" inputMode="numeric" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} required />
            </Field>

            <Field label="Bathrooms">
              <Input type="number" inputMode="numeric" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} required />
            </Field>

            <Field label="Purchase price (£)">
              <Input type="number" inputMode="numeric" min={1} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="285000" required />
            </Field>

            <Field label="Estimated GDV (£)">
              <Input type="number" inputMode="numeric" min={1} value={estimatedGdv} onChange={(e) => setEstimatedGdv(e.target.value)} placeholder="410000" required />
            </Field>

            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Any context about the property, goals, or scope." />
            </Field>

            {error && (
              <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="sm:col-span-2 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Creating…" : "Create & continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
