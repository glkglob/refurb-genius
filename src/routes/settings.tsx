import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UK_REGIONS } from "@/core/reports";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Refurb Genius" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppLayout title="Settings" subtitle="Manage your account and default preferences.">
      <Card>
        <CardContent className="p-6">
          <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" defaultValue="Demo User" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="demo@refurbgenius.co.uk" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" defaultValue="Refurb Genius Ltd" />
            </div>
            <div className="space-y-1.5">
              <Label>Default region</Label>
              <Select defaultValue="London">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UK_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
