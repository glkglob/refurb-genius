import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, FileText, AlertCircle } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Support & Contact — Get help with Refurb Genius.",
      },
      {
        property: "og:title",
        content: "Support & Contact — Refurb Genius",
      },
    ],
  }),
});

function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="py-8 px-4 sm:px-6 md:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Support & Contact</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We're here to help! Find answers and report issues below.
            </p>
          </div>

          {/* Quick Contact */}
          <div className="mb-8 rounded-lg bg-primary/5 border border-primary/20 p-6">
            <h2 className="text-lg font-semibold text-foreground">Need Help?</h2>
            <p className="mt-2 text-sm text-foreground/80">
              Email us with any questions, feedback, or issues:
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <a
                href="mailto:support@refurbgenius.co.uk"
                className="font-medium text-primary hover:underline"
              >
                support@refurbgenius.co.uk
              </a>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              We typically respond within 24 hours (UK business hours).
            </p>
          </div>

          {/* Main Content */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* Issue Categories */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Common Issues</h2>
              <div className="space-y-3">
                <IssueCard
                  icon={<AlertCircle className="h-5 w-5" />}
                  title="Account & Login"
                  items={[
                    "Can't log in to my account",
                    "Password reset not working",
                    "OAuth/Google sign-in issues",
                    "Session timeout problems",
                  ]}
                />
                <IssueCard
                  icon={<FileText className="h-5 w-5" />}
                  title="Features & Functionality"
                  items={[
                    "Photo upload failing",
                    "Estimates not calculating",
                    "ROI projections seem incorrect",
                    "AI analysis missing or errors",
                  ]}
                />
                <IssueCard
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Data & Projects"
                  items={[
                    "Can't save or access projects",
                    "Data not persisting",
                    "Deleting account or data",
                    "Exporting my information",
                  ]}
                />
              </div>
            </section>

            {/* Report a Bug */}
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Report a Bug</h2>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm leading-relaxed text-foreground/90">
                  If you've encountered a bug or unexpected behavior, please help us improve by
                  reporting it with as much detail as possible:
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-foreground">Include these details:</h4>
                    <ul className="mt-2 space-y-1 text-xs text-foreground/80">
                      <li>
                        • <strong>What happened:</strong> Describe the issue step-by-step
                      </li>
                      <li>
                        • <strong>Expected behavior:</strong> What should have happened
                      </li>
                      <li>
                        • <strong>Browser & device:</strong> Chrome/Safari, iPhone/Desktop, etc.
                      </li>
                      <li>
                        • <strong>Frequency:</strong> Does it happen every time?
                      </li>
                      <li>
                        • <strong>Screenshots/video:</strong> If possible, attach visuals
                      </li>
                      <li>
                        • <strong>Error messages:</strong> Copy any error text you see
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">Send to:</h4>
                    <p className="mt-1 text-xs text-foreground/80">
                      <strong>Subject:</strong> "Bug Report: [Brief description]"
                    </p>
                    <p className="text-xs text-foreground/80">
                      <strong>Email:</strong> support@refurbgenius.co.uk
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Detailed Help */}
          <section className="mt-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Getting Started</h2>

            <div className="space-y-6">
              {/* Account & Authentication */}
              <div className="rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground">Account & Authentication</h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      How do I create an account?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Visit the homepage and click "Sign Up". You can register using your email or
                      Google account. We use OAuth2 PKCE for secure authentication.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">I forgot my password</h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Click "Forgot password?" on the login screen. We'll send a reset link to your
                      email within 5 minutes. If you don't receive it, check your spam folder or
                      contact us.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Can I use multiple email addresses for one account?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      No, each account is tied to one email address. If you need to change your
                      email, please contact support@refurbgenius.co.uk.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Will I be logged out automatically?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Yes, sessions expire after 7 days of inactivity. On mobile, we keep sessions
                      alive as long as the app is in use. You can log out manually in Settings.
                    </p>
                  </div>
                </div>
              </div>

              {/* Using the Platform */}
              <div className="rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground">Using the Platform</h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      How do I create a property deal?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Go to "Deal Copilot" and click "New Deal". Enter property details (address,
                      purchase price, estimated GDV, refurbishment budget). Upload photos to get
                      AI-powered analysis. The platform will calculate estimates and ROI
                      automatically.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Why are some estimates different from my quotes?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Our estimates use regional cost multipliers and simplified assumptions. They
                      are
                      <strong> not</strong> substitutes for professional quotes. Always get
                      competitive bids from contractors before committing to a project.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">Can I save draft deals?</h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Yes! Your form saves automatically as you type. You can return to incomplete
                      deals anytime. However, analysis results are only shown when all required
                      fields are complete.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      What do the investment scores mean?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Scores are based on ROI, yield, and project profitability. "Strong" deals have
                      high ROI (20%+) and investment scores (8+). Scores are advisory only and don't
                      account for taxes, financing, or personal circumstances.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Can I export deals as PDF reports?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      This feature is coming soon. For now, you can screenshot analyses or copy data
                      manually. We're working on PDF export functionality.
                    </p>
                  </div>
                </div>
              </div>

              {/* Photos & AI Analysis */}
              <div className="rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground">Photos & AI Analysis</h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      What happens to photos I upload?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Photos are sent to OpenAI's Vision API for analysis. They are not stored
                      permanently in our database. Analysis results (descriptions, room assessments)
                      are saved. We do not use your photos for model training without consent.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Is AI analysis always accurate?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      No. AI can misidentify rooms, overestimate damage severity, or suggest
                      impractical designs.{" "}
                      <strong>Always verify AI recommendations with professional inspection</strong>
                      before making decisions.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Can I re-analyze a photo with different prompts?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Currently, analysis is fixed. Custom analysis options are planned for future
                      releases.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">Are my photos secure?</h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Photos are transmitted over encrypted HTTPS and processed securely by OpenAI.
                      For sensitive properties, consider anonymizing addresses or removing
                      identifying features before upload.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data & Privacy */}
              <div className="rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground">Data & Privacy</h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      How do I delete my account?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Go to Settings and select "Delete Account". Your account and all associated
                      data (projects, properties, analyses) will be deleted within 7 business days.
                      This action is irreversible.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">Can I export my data?</h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      You can request a data export via the Data & Privacy settings. We'll provide
                      your information in a machine-readable format within 14 days. Contact support
                      for assistance.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">Is my data backed up?</h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Yes. Data is stored in Supabase (PostgreSQL on AWS) with automated backups.
                      However, during controlled-beta, we may reset data without notice in
                      exceptional circumstances.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-foreground">
                      Who can access my projects?
                    </h4>
                    <p className="mt-1 text-sm text-foreground/80">
                      Only you can access your projects by default. You can share projects with
                      other users if collaboration features become available. Shared projects remain
                      in your account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Controlled-Beta */}
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
                <h3 className="text-lg font-semibold text-yellow-900">
                  Controlled-Beta & Feedback
                </h3>

                <div className="mt-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-sm text-yellow-900">
                      Why is the platform still in beta?
                    </h4>
                    <p className="mt-1 text-sm text-yellow-800">
                      We're actively developing features, gathering feedback, and hardening the
                      platform for general availability. Your participation helps us improve.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-yellow-900">
                      How can I provide feedback?
                    </h4>
                    <p className="mt-1 text-sm text-yellow-800">
                      Email us at support@refurbgenius.co.uk with feature suggestions, usability
                      feedback, or general comments. We read all feedback and prioritize
                      improvements based on user input.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-yellow-900">
                      Will the service remain free?
                    </h4>
                    <p className="mt-1 text-sm text-yellow-800">
                      During controlled-beta, Refurb Genius is free. Pricing may change when we exit
                      beta or introduce new features. We'll provide notice before any paid features
                      are introduced.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-yellow-900">
                      What if the platform shuts down?
                    </h4>
                    <p className="mt-1 text-sm text-yellow-800">
                      While we're committed to Refurb Genius, beta services can be discontinued. We
                      will provide at least 30 days' notice and allow you to export your data before
                      shutdown.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Still Need Help */}
          <section className="mt-12 rounded-lg bg-primary/5 border border-primary/20 p-6">
            <h2 className="text-lg font-semibold text-foreground">Still Need Help?</h2>
            <p className="mt-2 text-sm text-foreground/80">
              We're here to assist. Please reach out with any questions or issues:
            </p>
            <div className="mt-4">
              <p className="font-medium text-sm text-foreground">
                Email: support@refurbgenius.co.uk
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Response time: 24 hours (UK business hours)
              </p>
            </div>
          </section>

          {/* Footer Navigation */}
          <div className="mt-8 border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">
              Related:{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>{" "}
              •{" "}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>
            </p>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

function IssueCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 text-primary">{icon}</div>
        <div>
          <h4 className="font-medium text-foreground">{title}</h4>
          <ul className="mt-2 space-y-1">
            {items.map((item) => (
              <li key={item} className="text-sm text-foreground/70">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
