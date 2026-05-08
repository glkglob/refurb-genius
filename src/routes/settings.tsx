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
import { UK_REGIONS } from "@/core/constants";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { UKRegion } from "@/core/projects";

const DEFAULT_REGION_KEY = "refurbgenius:default-region";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Refurb Genius" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [defaultRegion, setDefaultRegion] = useState<UKRegion>("London");

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DEFAULT_REGION_KEY);
    if (stored && (UK_REGIONS as readonly string[]).includes(stored)) {
      setDefaultRegion(stored as UKRegion);
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEFAULT_REGION_KEY, defaultRegion);
    }
    toast.success("Preferences saved");
  };

  return (
    <AppLayout title="Settings" subtitle="Manage your account and default preferences.">
      <Card>
        <CardContent className="p-6">
          <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} readOnly disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Default region</Label>
              <Select value={defaultRegion} onValueChange={(v) => setDefaultRegion(v as UKRegion)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UK_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used as the default region for new projects and estimates.
              </p>
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
