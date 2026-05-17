import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [defaultRegion, setDefaultRegion] = useState<UKRegion>("London");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    if (!user?.id) {
      toast.error("Unable to delete account");
      return;
    }

    setIsDeleting(true);
    try {
      // Call delete account endpoint
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to request account deletion");
      }

      toast.success("Account deletion requested. We'll process it within 7 business days.");

      // Sign out and redirect to home
      await signOut();
      navigate({ to: "/" });
    } catch (error) {
      console.error("Delete account error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to request account deletion");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <AppLayout title="Settings" subtitle="Manage your account and default preferences.">
      <div className="space-y-6">
        {/* Account Settings */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Account Preferences</h2>
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
                <Select
                  value={defaultRegion}
                  onValueChange={(v) => setDefaultRegion(v as UKRegion)}
                >
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

        {/* Data & Privacy */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Data & Privacy</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-foreground/80">
                  View our{" "}
                  <a href="/privacy" className="text-primary hover:underline">
                    privacy policy
                  </a>{" "}
                  and{" "}
                  <a href="/terms" className="text-primary hover:underline">
                    terms of service
                  </a>
                  .
                </p>
              </div>
              <div className="pt-2 border-t border-border">
                <Button variant="outline" asChild>
                  <a href="/support">Get help</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm text-red-900">Delete Account</h3>
                <p className="text-sm text-red-800 mt-1">
                  Permanently delete your account, all projects, properties, and analysis history.
                  This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                {isDeleting ? "Processing..." : "Delete Account"}
              </Button>
              <p className="text-xs text-red-800">
                Deletion will be processed within 7 business days. Your data will be permanently
                removed from our servers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-900">Delete Account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to permanently delete your account? This action cannot be
                undone.
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                <p className="text-sm font-medium text-red-900">This will delete:</p>
                <ul className="text-sm text-red-800 space-y-1">
                  <li>• Your account and profile</li>
                  <li>• All projects and properties</li>
                  <li>• All analysis history and estimates</li>
                  <li>• Uploaded photos and AI analyses</li>
                </ul>
              </div>
              <p className="text-sm">
                We'll process your deletion request within 7 business days. You'll be signed out
                immediately.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Processing..." : "Delete Account"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
