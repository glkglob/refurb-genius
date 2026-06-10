import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Privacy policy for Refurb Genius — how we collect, use, and protect your data.",
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
            <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-foreground">
            {/* Who We Are */}
            <section>
              <h2 className="text-2xl font-semibold">Who We Are</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Refurb Genius is an AI-assisted property refurbishment analysis platform for UK
                property investors. Refurb Genius is operated by Rissolol Ltd ("we," "us," or
                "our"), a company registered in England and Wales (company number: [to be
                completed]), with its registered office at [registered office address — to be
                completed].
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                For the purposes of UK data protection law — the UK General Data Protection
                Regulation (UK GDPR), the Data Protection Act 2018, and the Data (Use and Access)
                Act 2025 — we are the "data controller" responsible for your personal data. We are
                registered with the Information Commissioner's Office (ICO) under registration
                number [to be completed].
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                You can contact us about anything in this policy at{" "}
                <a
                  href="mailto:support@refurbgenius.co.uk"
                  className="text-primary hover:underline"
                >
                  support@refurbgenius.co.uk
                </a>{" "}
                (please mark privacy queries "Privacy Request").
              </p>
            </section>

            {/* Overview */}
            <section>
              <h2 className="text-2xl font-semibold">Overview</h2>
              <p className="mt-3 text-sm leading-relaxed">
                This privacy policy explains what personal data we collect, why we collect it, the
                legal bases we rely on, how long we keep it, who we share it with (including the AI
                providers that help power the service), and the rights you have over your data. By
                using Refurb Genius you confirm you have read and understood this policy.
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
                <li>• Basic profile information you provide (such as your name)</li>
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
                <li>• Photos are processed by our AI provider (OpenAI) to generate analysis</li>
                <li>• Photos are stored in our secure storage so you can revisit your projects</li>
                <li>
                  • AI-generated analysis results (descriptions, room types, condition assessments)
                  are stored against your project
                </li>
                <li>• See the "Third-Party Processors" section for how OpenAI handles data</li>
              </ul>
              <p className="mt-2 text-sm leading-relaxed">
                Please do not upload photographs that identify other people, or that contain special
                category data (see "Special Category & Sensitive Data" below). Where photos may show
                third parties (for example, tenants or neighbours), you are responsible for ensuring
                you have a lawful basis to share them with us.
              </p>

              <h3 className="mt-5 text-lg font-medium">Usage & Analytics Data</h3>
              <p className="mt-2 text-sm leading-relaxed">We collect limited operational data:</p>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Features you access and their usage patterns</li>
                <li>• Error logs and system diagnostics (for debugging and security)</li>
                <li>• Approximate location data (derived from IP address)</li>
                <li>• Device type and browser information</li>
              </ul>
            </section>

            {/* Lawful Bases */}
            <section>
              <h2 className="text-2xl font-semibold">Our Lawful Bases for Processing</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Under the UK GDPR we must have a lawful basis for processing your personal data. We
                rely on the following:
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                <li>
                  <strong>Performance of a contract (Art. 6(1)(b)):</strong> to create and manage
                  your account, run analyses you request, and deliver the service to you.
                </li>
                <li>
                  <strong>Legitimate interests (Art. 6(1)(f)):</strong> to keep the platform secure,
                  prevent fraud and abuse, debug and improve features, and understand how the
                  service is used. We balance these interests against your rights and freedoms.
                </li>
                <li>
                  <strong>Consent (Art. 6(1)(a)):</strong> for any non-essential cookies and for any
                  optional marketing communications. You can withdraw consent at any time.
                </li>
                <li>
                  <strong>Legal obligation (Art. 6(1)(c)):</strong> to comply with our legal and
                  regulatory duties, including responding to lawful requests.
                </li>
              </ul>
            </section>

            {/* How We Use Data */}
            <section>
              <h2 className="text-2xl font-semibold">How We Use Your Data</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                <li>
                  <strong>Account Management:</strong> to maintain your account, handle
                  authentication, and provide customer support.
                </li>
                <li>
                  <strong>Service Delivery:</strong> to calculate refurbishment estimates, ROI
                  projections, and property analysis.
                </li>
                <li>
                  <strong>Operational Improvements:</strong> to fix bugs, optimise performance, and
                  improve feature reliability.
                </li>
                <li>
                  <strong>Communication:</strong> to send service-related updates and policy
                  changes. Marketing messages are only sent where you have opted in.
                </li>
                <li>
                  <strong>Security & Compliance:</strong> to detect fraud, prevent abuse, and comply
                  with legal obligations.
                </li>
              </ul>
            </section>

            {/* AI Processing & Automated Decision-Making */}
            <section>
              <h2 className="text-2xl font-semibold">AI Processing & Automated Decision-Making</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Refurb Genius uses artificial intelligence to help interpret your photos and to
                generate refurbishment scopes, design suggestions, cost estimates, and indicative
                investment metrics. We want to be transparent about how this works:
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                <li>
                  <strong>AI is decision-support, not a decision-maker.</strong> The estimates,
                  scores, and suggestions the platform produces are advisory tools to help you. They
                  do not, by themselves, produce a legal or similarly significant decision about
                  you. You remain in control of every investment or refurbishment decision.
                </li>
                <li>
                  <strong>No solely automated decisions with legal effect.</strong> We do not use
                  your data to make solely automated decisions that produce legal effects concerning
                  you or similarly significantly affect you within the meaning of Article 22 UK
                  GDPR. If this ever changes, we will tell you in advance and provide the safeguards
                  the law requires, including the right to obtain human review, to express your
                  point of view, and to contest the outcome.
                </li>
                <li>
                  <strong>Human review on request.</strong> If you believe an AI-generated output is
                  wrong or unfair, you can contact us for a human review at
                  support@refurbgenius.co.uk.
                </li>
                <li>
                  <strong>Accuracy limits.</strong> AI outputs can be incomplete or incorrect. They
                  must be verified by qualified professionals before you rely on them. See our{" "}
                  <a href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </a>{" "}
                  for the full AI and estimate disclaimers.
                </li>
                <li>
                  <strong>Training.</strong> We do not permit your photos, project data, or analysis
                  results to be used to train our AI providers' models, and we do not opt in to
                  model training by default. We will not use your content to train models without
                  your explicit, separate consent.
                </li>
              </ul>
            </section>

            {/* Special Category Data */}
            <section>
              <h2 className="text-2xl font-semibold">Special Category & Sensitive Data</h2>
              <p className="mt-3 text-sm leading-relaxed">
                The service is designed for property and financial information, not for sensitive
                personal data. Please do not upload or enter "special category data" as defined by
                the UK GDPR (for example, data revealing health, racial or ethnic origin, religious
                beliefs, or biometric data), and avoid including identifiable images of other
                people. We do not ask for this data and have no lawful basis to process it as part
                of the service.
              </p>
            </section>

            {/* Data Storage, Security & Retention */}
            <section>
              <h2 className="text-2xl font-semibold">Data Storage, Security & Retention</h2>

              <h3 className="mt-5 text-lg font-medium">Where We Store Data</h3>
              <p className="mt-2 text-sm leading-relaxed">
                Your account, project data, and uploaded photos are stored using Supabase
                (PostgreSQL and object storage) hosted on cloud infrastructure located in the United
                Kingdom / European Economic Area. This supports compliance with UK data protection
                standards.
              </p>

              <h3 className="mt-5 text-lg font-medium">Security Measures</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Encryption in transit (TLS/SSL for all communications)</li>
                <li>• Authentication via OAuth2 PKCE flow (industry standard)</li>
                <li>• Row-level security so each user can only access their own data</li>
                <li>• Session tokens stored securely; no plaintext passwords stored</li>
                <li>• Automated backups of critical data</li>
              </ul>
              <p className="mt-2 text-sm leading-relaxed">
                No system can be guaranteed to be completely secure, but we take appropriate
                technical and organisational measures to protect your data as required by the UK
                GDPR.
              </p>

              <h3 className="mt-5 text-lg font-medium">How Long We Keep Data</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>
                  • <strong>Account & project data:</strong> kept for as long as your account is
                  active, then deleted following account closure (see "Account Deletion").
                </li>
                <li>
                  • <strong>Uploaded photos & AI results:</strong> kept with the related project
                  until you delete the project or your account.
                </li>
                <li>
                  • <strong>Operational logs & diagnostics:</strong> typically retained for up to 12
                  months, then deleted or anonymised.
                </li>
                <li>
                  • <strong>Records we must keep by law:</strong> retained only for as long as the
                  relevant legal or regulatory obligation requires.
                </li>
              </ul>
            </section>

            {/* International Transfers */}
            <section>
              <h2 className="text-2xl font-semibold">International Data Transfers</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Some of our processors — in particular our AI provider, OpenAI — process data
                outside the UK, including in the United States. Where personal data is transferred
                outside the UK, we ensure an appropriate safeguard is in place as required by the UK
                GDPR, such as:
              </p>
              <ul className="mt-3 space-y-1 text-sm leading-relaxed">
                <li>
                  • transfers to providers certified under the UK Extension to the EU–US Data
                  Privacy Framework; and/or
                </li>
                <li>
                  • the UK International Data Transfer Agreement (IDTA) or the UK Addendum to the EU
                  Standard Contractual Clauses, together with a transfer risk assessment.
                </li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                You can request more information about the specific safeguards in place by
                contacting us.
              </p>
            </section>

            {/* Third-Party Processors */}
            <section>
              <h2 className="text-2xl font-semibold">Third-Party Processors</h2>

              <h3 className="mt-5 text-lg font-medium">OpenAI (Vision & Text APIs)</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Photos and related prompts you submit for analysis are sent to OpenAI</li>
                <li>
                  • OpenAI processes them to generate condition assessments and design
                  recommendations
                </li>
                <li>• We do not opt in to OpenAI model training</li>
                <li>
                  • OpenAI privacy policy:{" "}
                  <a
                    href="https://openai.com/policies/privacy-policy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    openai.com/policies/privacy-policy
                  </a>
                </li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Supabase</h3>
              <ul className="mt-2 space-y-1 text-sm leading-relaxed">
                <li>• Authentication, session management, database, and file storage</li>
                <li>
                  • Supabase privacy policy:{" "}
                  <a
                    href="https://supabase.com/privacy"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    supabase.com/privacy
                  </a>
                </li>
              </ul>

              <h3 className="mt-5 text-lg font-medium">Other Services</h3>
              <p className="mt-2 text-sm leading-relaxed">
                We use a limited number of additional processors for hosting, error monitoring, and
                product analytics, each under a data processing agreement. We will update this
                policy to reflect any material changes to our processors.
              </p>
            </section>

            {/* Your Data Rights */}
            <section>
              <h2 className="text-2xl font-semibold">Your Data Rights</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Under the UK GDPR and the Data Protection Act 2018, you have the right to:
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                <li>
                  <strong>Access:</strong> request a copy of the personal data we hold about you.
                </li>
                <li>
                  <strong>Rectification:</strong> ask us to correct inaccurate or incomplete data.
                </li>
                <li>
                  <strong>Erasure:</strong> request deletion of your account and associated data
                  (see "Account Deletion").
                </li>
                <li>
                  <strong>Restriction:</strong> ask us to limit how we process your data in certain
                  circumstances.
                </li>
                <li>
                  <strong>Portability:</strong> receive your data in a structured, commonly used,
                  machine-readable format.
                </li>
                <li>
                  <strong>Objection:</strong> object to processing based on our legitimate
                  interests, and to any direct marketing.
                </li>
                <li>
                  <strong>Withdraw consent:</strong> where we rely on consent, withdraw it at any
                  time without affecting prior processing.
                </li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                To exercise any of these rights, email support@refurbgenius.co.uk with "Privacy
                Request" in the subject line. We will respond within one month, as required by law.
                There is normally no charge.
              </p>
              <p className="mt-3 text-sm leading-relaxed">
                <strong>Right to complain:</strong> if you are unhappy with how we handle your data,
                you can complain to the Information Commissioner's Office (ICO), the UK supervisory
                authority, at{" "}
                <a
                  href="https://ico.org.uk/make-a-complaint/"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  ico.org.uk
                </a>{" "}
                or by calling 0303 123 1113. We would, however, appreciate the chance to address
                your concerns first.
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
                <li>• Your profile and authentication credentials are deleted</li>
                <li>• Your projects, properties, and analysis history are deleted</li>
                <li>• Uploaded photos and AI-generated analysis results are deleted</li>
                <li>
                  • We may retain anonymised, non-identifying usage data for operational diagnostics
                </li>
                <li>• Deletion is processed within 30 days</li>
              </ul>
              <p className="mt-3 text-sm leading-relaxed">
                If you have shared projects with other users, deleting your account may affect their
                access to shared analyses.
              </p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-semibold">Cookies</h2>
              <p className="mt-3 text-sm leading-relaxed">
                In line with the Privacy and Electronic Communications Regulations (PECR), we use
                the following cookies and similar technologies:
              </p>
              <ul className="mt-3 space-y-1 text-sm leading-relaxed">
                <li>
                  <strong>Strictly necessary cookies:</strong> authentication and session cookies
                  (Supabase session) and security cookies. These are required for the service to
                  function and do not need consent.
                </li>
                <li>
                  <strong>Preference cookies:</strong> remember choices such as your light/dark
                  theme selection.
                </li>
                <li>
                  <strong>Analytics cookies:</strong> where used, these help us understand usage.
                  Non-essential cookies are only set with your consent, which you can withdraw at
                  any time.
                </li>
              </ul>
            </section>

            {/* Children */}
            <section>
              <h2 className="text-2xl font-semibold">Children's Privacy</h2>
              <p className="mt-3 text-sm leading-relaxed">
                Refurb Genius is intended for use by property professionals and investors and is not
                directed at children. The service is not intended for anyone under 18, and we do not
                knowingly collect personal data from children. If you believe a child has provided
                us with personal data, please contact us so we can delete it.
              </p>
            </section>

            {/* Data Breaches */}
            <section>
              <h2 className="text-2xl font-semibold">Data Breaches</h2>
              <p className="mt-3 text-sm leading-relaxed">
                We maintain procedures to detect, investigate, and respond to personal data
                breaches. Where a breach is likely to result in a risk to your rights and freedoms,
                we will notify the ICO within 72 hours where required, and will inform you without
                undue delay where the breach is likely to result in a high risk to you.
              </p>
            </section>

            {/* Policy Changes */}
            <section>
              <h2 className="text-2xl font-semibold">Changes to This Policy</h2>
              <p className="mt-3 text-sm leading-relaxed">
                We may update this privacy policy from time to time as the platform and applicable
                law evolve. We will update the "Last updated" date above and, where changes are
                material, notify you by email or in-app notification. Your continued use of the
                service after an update constitutes acceptance of the revised policy.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-semibold">Contact & Support</h2>
              <p className="mt-3 text-sm leading-relaxed">
                For data requests, privacy concerns, or account deletion inquiries, contact:
              </p>
              <div className="mt-3 rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">Email: support@refurbgenius.co.uk</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please include "Privacy Request" in the subject line. We will respond within one
                  month.
                </p>
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
