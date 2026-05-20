import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Privacy policy for Refurb Genius — Learn how we handle your data.",
      },
      {
        property: "og:title",
        content: "Privacy Policy — Refurb Genius",
      },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="py-8 px-4 sm:px-6 md:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: May 2026</p>
          </div>

          {/* Beta Notice */}
          <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-yellow-900">⚠️ Controlled-Beta Notice</p>
            <p className="mt-2 text-sm text-yellow-800">
              Refurb Genius is in controlled-beta testing. This privacy policy applies to your
              participation in the beta program. Features, data handling, and terms may change as we
              develop the platform. Please review this policy regularly.
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-foreground">
            {/* Overview */}
            <section>
              <h2 className="text-2xl font-semibold">Overview</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Refurb Genius ("we," "us," or "our") operates as an AI-powered property
                refurbishment analysis platform for UK property investors. This privacy policy
                explains how we collect, use, and protect your personal data when you use our
                application and services.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                By using Refurb Genius, you agree to the practices described in this policy. If you
                do not agree, please do not use our service.
              </p>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="text-2xl font-semibold">Information We Collect</h2>

              <h3 className="mt-5 text-lg font-medium">Authentication & Account Data</h3>
              <p className="mt-2 text-sm leading-relaxed">
                When you create an account, we collect:
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Email address (used for login and communication)</li>
                <li>• Authentication tokens (OAuth2 PKCE flow via Supabase)</li>
                <li>• Basic profile information you provide</li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Project & Property Data</h3>
              <p className="mt-2 text-sm leading-relaxed">
                When you create projects or properties, we collect:
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Property address and location data (to determine region multipliers)</li>
                <li>• Property condition assessments and refurbishment scope</li>
                <li>• Estimated budgets, purchase prices, and financial projections</li>
                <li>• Deal metrics and investment analysis you input</li>
                <li>• Notes and personal comments about properties or deals</li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Uploaded Photos & Images</h3>
              <p className="mt-2 text-sm leading-relaxed">
                When you upload photos for AI analysis:
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Photos are processed by OpenAI's Vision API (external provider)</li>
                <li>• Photos may be retained temporarily for processing and caching</li>
                <li>• We do not store raw photos in our database permanently</li>
                <li>
                  • AI-generated analysis results (descriptions, room types, damage assessments) are
                  stored
                </li>
                <li>• See "Third-Party Processors" section for OpenAI's data handling</li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">AI Analysis & Generated Content</h3>
              <p className="mt-2 text-sm leading-relaxed">
                When you use AI features (photo analysis, design suggestions):
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Analysis results are processed by external AI providers (OpenAI)</li>
                <li>• Generated suggestions (design concepts, estimates) are advisory only</li>
                <li>
                  • We do not use your photos or analysis for model training without explicit
                  consent
                </li>
                <li>
                  • Some data may be retained by third-party providers for safety/abuse prevention
                </li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Usage & Analytics Data</h3>
              <p className="mt-2 text-sm leading-relaxed">We collect limited operational data:</p>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Features you access and their usage patterns</li>
                <li>• Error logs and system diagnostics (for debugging)</li>
                <li>• Approximate location data (from IP address)</li>
                <li>• Device type and browser information</li>
              </ul>
            </section>

            {/* How We Use Data */}
            <section>
              <h2 className="text-2xl font-semibold">How We Use Your Data</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                <li>
                  <strong>Account Management:</strong> To maintain your account, handle
                  authentication, and provide customer support
                </li>
                <li>
                  <strong>Service Delivery:</strong> To calculate financial estimates, ROI
                  projections, and property analysis
                </li>
                <li>
                  <strong>Operational Improvements:</strong> To fix bugs, optimize performance, and
                  improve feature reliability
                </li>
                <li>
                  <strong>Communication:</strong> To send important updates, beta status changes, or
                  policy modifications
                </li>
                <li>
                  <strong>Security & Compliance:</strong> To detect fraud, prevent abuse, and comply
                  with legal obligations
                </li>
                <li>
                  <strong>Beta Program:</strong> To gather feedback and understand how you use the
                  platform
                </li>
              </ul>
            </section>

            {/* Data Storage & Security */}
            <section>
              <h2 className="text-2xl font-semibold">Data Storage & Security</h2>

              <h3 className="mt-5 text-lg font-medium">Where We Store Data</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Your data is stored in Supabase, a PostgreSQL database hosted on AWS infrastructure
                in the EU region (primarily Ireland). This ensures compliance with UK data
                protection standards and GDPR principles.
              </p>

              <h3 className="mt-5 text-lg font-medium">Security Measures</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Encryption in transit (TLS/SSL for all communications)</li>
                <li>• Authentication via OAuth2 PKCE flow (industry standard)</li>
                <li>• Session tokens stored securely in browser storage</li>
                <li>• No plaintext passwords stored</li>
                <li>• Automated backups of critical data</li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Important Security Note</h3>
              <p className="mt-2 text-sm leading-relaxed text-yellow-900">
                <strong>During controlled-beta:</strong> Security audits may still be in progress.
                Do not upload sensitive personal information beyond what is necessary for property
                analysis. Be cautious with financial data and property addresses.
              </p>
            </section>

            {/* Third-Party Processors */}
            <section>
              <h2 className="text-2xl font-semibold">Third-Party Processors</h2>

              <h3 className="mt-5 text-lg font-medium">OpenAI (Vision & Text APIs)</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Photos uploaded for analysis are sent to OpenAI</li>
                <li>
                  • OpenAI processes images to extract design recommendations and damage assessments
                </li>
                <li>• See OpenAI's privacy policy: https://openai.com/privacy</li>
                <li>• We do NOT opt into model training by default</li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Supabase & Auth0</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Authentication and session management</li>
                <li>• Database hosting and backup services</li>
                <li>• See Supabase privacy policy: https://supabase.com/privacy</li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Other Services</h3>
              <p className="mt-2 text-sm leading-relaxed">
                We may integrate additional services as the platform develops. This policy will be
                updated to reflect any new processors.
              </p>
            </section>

            {/* Your Data Rights */}
            <section>
              <h2 className="text-2xl font-semibold">Your Data Rights</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Under UK GDPR and data protection laws, you have the right to:
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                <li>
                  <strong>Access:</strong> Request a copy of all data we hold about you
                </li>
                <li>
                  <strong>Correction:</strong> Ask us to update or correct inaccurate data
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your account and associated data
                  (see Account Deletion section)
                </li>
                <li>
                  <strong>Portability:</strong> Receive your data in a structured, machine-readable
                  format
                </li>
                <li>
                  <strong>Objection:</strong> Opt out of certain data processing activities
                </li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                To exercise these rights, contact us at support@refurbgenius.co.uk with your request
                and verification details.
              </p>
            </section>

            {/* Account Deletion */}
            <section>
              <h2 className="text-2xl font-semibold">Account Deletion</h2>
              <p className="mt-3 text-sm leading-relaxed">
                You can request account deletion at any time through your Settings. When you delete
                your account:
              </p>
              <ul className="mt-3 space-y-1 text-sm leading-relaxed">
                <li>• Your profile and authentication credentials are immediately deleted</li>
                <li>• Your projects, properties, and analysis history are deleted</li>
                <li>• Uploaded photos and AI-generated analysis results are deleted</li>
                <li>
                  • We retain anonymized usage data for operational diagnostics (cannot be linked to
                  you)
                </li>
                <li>• Deletion is processed within 7 business days</li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                Note: If you have shared projects with other users, deleting your account may affect
                their access to shared analyses. We will notify collaborators when account deletion
                occurs.
              </p>
            </section>

            {/* Contact Method */}
            <section>
              <h2 className="text-2xl font-semibold">Contact & Support</h2>
              <p className="mt-3 text-sm leading-relaxed">
                For data requests, privacy concerns, or account deletion inquiries, contact:
              </p>
              <div className="mt-3 rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">Email: support@refurbgenius.co.uk</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please include "Privacy Request" in the subject line. We will respond within 14
                  days.
                </p>
              </div>
            </section>

            {/* Cookie Policy */}
            <section>
              <h2 className="text-2xl font-semibold">Cookie Policy</h2>
              <p className="mt-3 text-sm leading-relaxed">
                We use minimal cookies for essential functionality:
              </p>
              <ul className="mt-3 space-y-1 text-sm leading-relaxed">
                <li>
                  <strong>Session Cookies:</strong> Authentication tokens (Supabase session)
                </li>
                <li>
                  <strong>Preference Cookies:</strong> User preferences (e.g., theme selection)
                </li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                We do not use third-party tracking cookies or analytics cookies during the
                controlled-beta phase. This may change as the platform develops.
              </p>
            </section>

            {/* Policy Changes */}
            <section>
              <h2 className="text-2xl font-semibold">Changes to This Policy</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Since Refurb Genius is in controlled-beta, we may update this privacy policy as the
                platform develops or as we integrate new features. We will notify you of material
                changes via email or in-app notifications. Continued use of the service after
                notification constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Beta Disclaimer */}
            <section>
              <h2 className="text-2xl font-semibold">Controlled-Beta Disclaimer</h2>
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-900">
                  <strong>Important:</strong> Data handling practices, security measures, and data
                  retention policies may change as we develop and refine the platform. By
                  participating in the controlled-beta program, you acknowledge that:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-red-900">
                  <li>• The service is provided "as-is" without guarantees of data persistence</li>
                  <li>
                    • Your data may be used to improve AI models and analysis accuracy (in
                    anonymized form)
                  </li>
                  <li>• Security audits may not be complete</li>
                  <li>
                    • We may reset or delete beta data without notice in extreme circumstances
                  </li>
                </ul>
              </div>
            </section>
          </div>

          {/* Footer Navigation */}
          <div className="mt-12 border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">
              Related:{" "}
              <a href="/terms" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              •{" "}
              <a href="/support" className="text-primary hover:underline">
                Support & Contact
              </a>
            </p>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
