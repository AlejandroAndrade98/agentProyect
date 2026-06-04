import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | SalesFlows AI',
  description:
    'SalesFlows AI terms of service for CRM, synced Google metadata, and human-reviewed AI suggestions.',
};

const lastUpdated = 'June 3, 2026';
const contactEmail = 'support@salesflowsai.com';

const sections = [
  {
    title: 'Acceptance',
    body: [
      'By accessing or using SalesFlows AI, you agree to these Terms of Service. If you use the service on behalf of an organization, you represent that you have authority to accept these terms for that organization.',
    ],
  },
  {
    title: 'Description of the Service',
    body: [
      'SalesFlows AI provides CRM workflows, synced Gmail and Google Calendar metadata views, AI suggestion review queues, and human-controlled actions for sales follow-up work.',
      'The service is currently intended for controlled beta and business use. Features may change as the product evolves.',
    ],
  },
  {
    title: 'User Accounts and Responsibilities',
    body: [
      'You are responsible for keeping your login credentials secure and for all activity under your account.',
      'You must use SalesFlows AI only for lawful business purposes and only with data you are authorized to access, sync, import, review, or process.',
      'Organization owners and admins are responsible for managing user access, roles, connected account requests, and organization data.',
    ],
  },
  {
    title: 'Google Account Connection',
    body: [
      'If you connect a Google account, you authorize SalesFlows AI to access the Google data covered by the scopes you approve, such as Gmail metadata, Gmail snippets, and Calendar metadata.',
      'Google connection, sync, import, analysis, and Gmail draft creation are user-controlled actions. Disconnecting a Google account stops future sync access for that connected account and clears stored OAuth tokens through the disconnect flow.',
      'You may also revoke SalesFlows AI access through your Google Account permissions page.',
    ],
  },
  {
    title: 'AI-Generated Suggestions Disclaimer',
    body: [
      'AI suggestions may be incomplete, inaccurate, or inappropriate for your situation. They are not legal, financial, employment, or professional advice.',
      'You are responsible for reviewing AI output before relying on it or applying any CRM or Gmail draft action.',
    ],
  },
  {
    title: 'Human Review Requirement',
    body: [
      'AI suggestions require human review. A suggestion must be reviewed, accepted, edited, rejected, or explicitly applied by an authorized user before it affects a CRM workflow or Gmail draft flow.',
      'SalesFlows AI does not make final business decisions for you.',
    ],
  },
  {
    title: 'No Automatic Emails or CRM Changes',
    body: [
      'SalesFlows AI does not send emails automatically.',
      'SalesFlows AI does not create Gmail drafts automatically.',
      'SalesFlows AI does not create CRM records automatically from AI analysis.',
      'Any email-related draft action, CRM action, sync, import, or AI generation requires an explicit user click.',
    ],
  },
  {
    title: 'Acceptable Use',
    body: [
      'You may not use SalesFlows AI to violate laws, infringe rights, access data without permission, send spam, abuse Google services, attempt to bypass security controls, or upload malicious content.',
      'You may not use the service to process data in ways that your organization is not authorized to perform.',
    ],
  },
  {
    title: 'Data and Content Ownership',
    body: [
      'You and your organization retain ownership of CRM content, synced metadata, notes, tasks, opportunities, and other content you provide or create in SalesFlows AI.',
      'You grant SalesFlows AI the rights needed to host, process, display, secure, and operate that content for the service.',
    ],
  },
  {
    title: 'Subscription and Billing',
    body: [
      'Billing and subscription terms may be introduced or updated as the product moves beyond beta. If paid plans are offered, pricing and payment terms will be provided before charges apply.',
    ],
  },
  {
    title: 'Availability and Beta Disclaimer',
    body: [
      'SalesFlows AI may be unavailable, interrupted, or changed during beta. We do not promise uninterrupted availability, specific uptime, or that every beta feature will remain available.',
      'You should maintain appropriate backups and operational processes for critical business information.',
    ],
  },
  {
    title: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, SalesFlows AI is provided as-is and without warranties. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost revenue, lost data, or business interruption.',
      'Our total liability for claims related to the service will be limited to the amount paid for the service during the period allowed by applicable law, or a reasonable minimum if no fees were paid.',
    ],
  },
  {
    title: 'Termination',
    body: [
      'You may stop using the service at any time. We may suspend or terminate access if you violate these terms, create security risk, misuse the service, or if continued access would be unlawful.',
    ],
  },
  {
    title: 'Changes to These Terms',
    body: [
      'We may update these terms as the service evolves. When changes are material, we will make reasonable efforts to provide notice through the service or another appropriate channel.',
    ],
  },
  {
    title: 'Contact',
    body: [`For questions about these terms, contact ${contactEmail}.`],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-950">
            SalesFlows AI
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/privacy" className="hover:text-slate-950">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-slate-950">
              Sign in
            </Link>
          </div>
        </nav>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            SalesFlows AI
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Terms of Service
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            These terms explain the rules for using SalesFlows AI, including
            CRM workflows, Google account connection, and human-reviewed AI
            suggestions.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Last updated: {lastUpdated}
          </p>
        </section>

        <div className="mt-8 space-y-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-sm leading-7 text-white">
            <h2 className="text-base font-semibold">Privacy Policy</h2>
            <p className="mt-2 text-slate-200">
              Review the SalesFlows AI Privacy Policy for details about Google
              user data, encrypted OAuth tokens, and data deletion requests.
            </p>
            <Link
              href="/privacy"
              className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Open Privacy Policy
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
