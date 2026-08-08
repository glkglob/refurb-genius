import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { PROPERTY_TYPES, UK_REGIONS } from "@/core/constants";
import { type PropertyType, type UKRegion } from "@/core/projects";
import { useCreateProject } from "@/hooks/useProjects";
import { trackEvent } from "@/lib/analytics";

/**
 * IA-0 / IA-1 / IA-7-R1 canonical project-entry form.
 *
 * - Name is the only required field.
 * - Address, postcode, property type, notes, and financials are optional.
 * - Successful durable creation navigates to Photos (`/projects/$id/upload`).
 *
 * Shared by `/analyze` (canonical New Analysis) and `/projects/new` (alias).
 * Routes own AppLayout chrome; this component owns only the form surface.
 */
export function NewProjectEntry() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [region, setRegion] = useState<UKRegion | "">("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [sizeSqm, setSizeSqm] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [estimatedGdv, setEstimatedGdv] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Project name is required.");

    const beds = bedrooms.trim() === "" ? 0 : Number(bedrooms);
    const baths = bathrooms.trim() === "" ? 0 : Number(bathrooms);
    const size = sizeSqm.trim() === "" ? 0 : Number(sizeSqm);
    const price = purchasePrice.trim() === "" ? 0 : Number(purchasePrice);
    const gdv = estimatedGdv.trim() === "" ? 0 : Number(estimatedGdv);

    if (!Number.isFinite(beds) || beds < 0 || beds > 50) return setError("Bedrooms must be 0–50.");
    if (!Number.isFinite(baths) || baths < 0 || baths > 50)
      return setError("Bathrooms must be 0–50.");
    if (!Number.isFinite(size) || size < 0 || size > 10000)
      return setError("Enter a valid size in m² (or leave blank).");
    if (!Number.isFinite(price) || price < 0) return setError("Enter a valid purchase price.");
    if (!Number.isFinite(gdv) || gdv < 0) return setError("Enter a valid estimated GDV.");

    createProject.mutate(
      {
        name: name.trim(),
        address: address.trim(),
        postcode: postcode.trim().toUpperCase(),
        // Server defaults apply when optional fields are omitted; send safe values for typed path.
        region: (region || "London") as UKRegion,
        property_type: (propertyType || "Terraced") as PropertyType,
        bedrooms: beds,
        bathrooms: baths,
        size_sqm: size,
        purchase_price: price,
        estimated_gdv: gdv,
        notes: notes.trim(),
      },
      {
        onSuccess: (project) => {
          trackEvent("project_created", {
            region: region || "unspecified",
            property_type: propertyType || "unspecified",
          });
          // Preferred IA-0 continuation: durable ID → Photos immediately available.
          navigate({
            to: "/projects/$id/upload",
            params: { id: project.id },
          });
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Could not create project.");
        },
      },
    );
  };

  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <form
          className="space-y-6"
          onSubmit={handleSubmit}
          noValidate
          data-testid="new-analysis-entry-form"
        >
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Required
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Project name" className="sm:col-span-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Victorian Terrace Refurb"
                  required
                  autoFocus
                  aria-required="true"
                  data-testid="new-analysis-project-name"
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Optional property details
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Address" className="sm:col-span-2">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="12 Elm Street, London"
                />
              </Field>

              <Field label="UK postcode">
                <Input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="E1 6AN"
                />
              </Field>

              <Field label="Region">
                <Select value={region || undefined} onValueChange={(v) => setRegion(v as UKRegion)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {UK_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Property type">
                <Select
                  value={propertyType || undefined}
                  onValueChange={(v) => setPropertyType(v as PropertyType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Size (m²)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={sizeSqm}
                  onChange={(e) => setSizeSqm(e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Bedrooms">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Bathrooms">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Optional financials
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Purchase price (£)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Estimated GDV (£)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={estimatedGdv}
                  onChange={(e) => setEstimatedGdv(e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Any context about the property, goals, or scope."
                />
              </Field>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/dashboard" })}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProject.isPending}
              data-testid="new-analysis-submit"
            >
              {createProject.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createProject.isPending ? "Creating…" : "Create & open Photos"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}
