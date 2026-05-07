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
import { UK_REGIONS } from "@/lib/mockData";

export const Route = createFileRoute("/projects/new")({
  head: () => ({ meta: [{ title: "New project — Refurb Genius" }] }),
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  return (
    <AppLayout title="New project" subtitle="Create a new refurbishment project to analyse.">
      <Card>
        <CardContent className="p-6">
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/projects/$id/upload", params: { id: "1" } });
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Project name</Label>
              <Input id="name" placeholder="Victorian Terrace Refurb" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Property address</Label>
              <Input id="address" placeholder="12 Elm Street, London, E1 6AN" required />
            </div>
            <div className="space-y-1.5">
              <Label>Region</Label>
              <Select defaultValue="London">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UK_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Property type</Label>
              <Select defaultValue="Terraced House">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Terraced House", "Semi-Detached", "Detached", "Flat", "Bungalow", "Maisonette"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Any context about the property, goals, or scope." rows={4} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                Cancel
              </Button>
              <Button type="submit">Create & continue</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
