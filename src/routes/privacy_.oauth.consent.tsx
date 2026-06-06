import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Mail, User, LogIn } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy_/oauth/consent")({
  head: () => ({
    meta: [
      { title: "Authorise Access — Refurb Genius" },
      {
        name: "description",
        content:
          "Review and authorise the data Refurb Genius requests when you sign in with Google.",
      },
      // Prevent search engines from indexing this flow page.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OAuthConsentPage,
});

const REQUESTED_SCOPES = [
  {
    icon: Mail,
    label: "Email address",
    detail: "Used to identify your account and send important notifications.",
  },
  {
    icon: User,
    label: "Basic profile",
    detail: "Your name and profile picture so we can personalise your experience.",
  },
];

function OAuthConsentPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md space-y-6">
          {/* App identity */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-md">
              <ShieldCheck className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Refurb Genius</h1>
            <p className="text-sm text-muted-foreground">
              is requesting access to your Google account
            </p>
          </div>

          {/* Scopes */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <p className="text-sm font-medium text-foreground">This will allow Refurb Genius to:</p>
            <ul className="space-y-3">
              {REQUESTED_SCOPES.map(({ icon: Icon, label, detail }) => (
                <li key={label} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* What we won't do */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">What we will never do:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Access your Gmail, Drive, or any other Google service</li>
              <li>Share your data with third parties for advertising</li>
              <li>Post anything to your Google account</li>
            </ul>
          </div>

          {/* CTA — directs users to the actual auth flow */}
          <div className="space-y-3">
            <Link to="/auth" search={{ mode: "signin" }} className="block">
              <Button className="w-full gap-2">
                <LogIn className="h-4 w-4" />
                Continue to sign in
              </Button>
            </Link>
            <Link to="/" className="block">
              <Button variant="outline" className="w-full">
                Cancel
              </Button>
            </Link>
          </div>

          {/* Legal */}
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
