import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
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
} from "@repo/ui";
import { UK_REGIONS } from "@/core/constants";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { UKRegion } from "@/core/projects";

const DEFAULT_REGION_KEY = "refurbgenius:default-region";

export const Route = createFileRoute("/_authed/settings")({
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
      const { deleteAccountForClient } =
        await import("@/features/account-deletion/presentation/deleteAccountForClient");
      await deleteAccountForClient();

      toast.success("Your account has been deleted.");

      await signOut();
      navigate({ to: "/" });
    } catch (error) {
      logger.error("[settings] Delete account failed", { error: String(error) });
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
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
              <div className="flex flex-wrap gap-3">
                <a
                  href="/privacy"
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms"
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  Terms of Service
                </a>
                <a
                  href="/support"
                  className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  Contact support
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-destructive">Danger Zone</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-foreground">Delete Account</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Permanently delete your account, all projects, properties, and analysis history.
                  Deletion completes before this app reports success. This action cannot be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                {isDeleting ? "Processing…" : "Delete Account"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Your data will be permanently removed from our servers when deletion completes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Account?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to permanently delete your account? This action cannot be
                undone.
              </p>
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-foreground">This will delete:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Your account and profile</li>
                  <li>• All projects and properties</li>
                  <li>• All analysis history and estimates</li>
                  <li>• Uploaded photos and AI analyses</li>
                </ul>
              </div>
              <p className="text-sm">
                You will be signed out after deletion completes. This cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Processing..." : "Delete Account"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
