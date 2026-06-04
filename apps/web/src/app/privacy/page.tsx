import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | SalesFlows AI',
  description:
    'SalesFlows AI privacy policy, including Google user data use and human-reviewed AI safeguards.',
};

const lastUpdated = 'June 3, 2026';
const contactEmail = 'support@salesflowsai.com';

const sections = [
  {
    title: 'What SalesFlows AI Does',
    body: [
      'SalesFlows AI is a CRM workspace that helps sales teams review synced email and calendar metadata, generate human-reviewed AI suggestions, and manage CRM follow-up work.',
      'The product is designed around explicit human control. Users choose when to sync external data, when to generate AI suggestions, and when to apply reviewed suggestions to CRM records or Gmail drafts.',
    ],
  },
  {
    title: 'Information We Collect',
    body: [
      'We collect account information such as your name, email address, organization, role, authentication data, and application settings.',
      'We also store CRM data that users create or import, including companies, contacts, opportunities, tasks, notes, activity events, AI suggestions, and AI usage records.',
      'We collect operational data such as request identifiers, timestamps, sync state, provider status, and security events needed to operate and protect the service.',
    ],
  },
  {
    title: 'Google User Data We Access',
    body: [
      'If you connect a Google account, SalesFlows AI may access and store Gmail metadata such as sender, recipient fields, subject, dates, thread IDs, message IDs, labels, categories, sync timestamps, and short Gmail snippets or fragments.',
      'SalesFlows AI may access and store Google Calendar metadata such as event title, start and end dates or times, organizer, attendees, location, calendar IDs, event IDs, iCal UID, status, HTML link, and sync timestamps.',
      'We store connected account metadata and sync state, including provider, Google account email, provider account ID, connection status, token expiry metadata, and sync status.',
      'OAuth access and refresh tokens are encrypted at rest. Tokens are used only to perform the Google actions the user explicitly starts or authorizes in the app.',
    ],
  },
  {
    title: 'How We Use Google User Data',
    body: [
      'We use Google user data to show synced Gmail and Calendar metadata in SalesFlows AI, help users decide what needs attention, and generate AI suggestions that remain subject to human review.',
      'Gmail snippets and metadata may be used to create email analysis suggestions or reply draft suggestions. Calendar metadata may be used to create meeting or follow-up analysis suggestions.',
      'We do not use Google user data for advertising. We do not sell Google user data.',
      "SalesFlows AI's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including Limited Use requirements.",
    ],
  },
  {
    title: 'How We Store and Protect Data',
    body: [
      'We use tenant-aware access controls so organization data is scoped to the correct organization and authorized users.',
      'Google OAuth tokens are encrypted at rest. Secrets, tokens, authorization codes, and API keys are not intentionally exposed in frontend code or logs.',
      'We use authentication, role-based access controls, request limits for sensitive operations, and safe logging practices to reduce the risk of unauthorized access.',
    ],
  },
  {
    title: 'Human-in-the-Loop AI Rules',
    body: [
      'AI suggestions require human review before they can be accepted, rejected, edited, or applied.',
      'SalesFlows AI does not send emails automatically. SalesFlows AI does not create Gmail drafts automatically. SalesFlows AI does not create CRM records automatically from AI analysis.',
      'Any CRM action, Gmail draft creation, sync action, import action, or AI generation action requires an explicit user click.',
    ],
  },
  {
    title: 'What We Do Not Do',
    body: [
      'We do not automatically send email.',
      'We do not automatically create Gmail drafts.',
      'We do not automatically create CRM tasks, notes, opportunities, companies, or contacts from AI analysis.',
      'We do not store full Gmail message bodies or attachments for the synced email review workflow described here.',
      'We do not sell personal data or Google user data.',
    ],
  },
  {
    title: 'Data Sharing',
    body: [
      'We share data only with service providers needed to operate SalesFlows AI, such as hosting, database, email delivery for account notifications, AI providers when configured, and observability providers if enabled.',
      'Service providers are expected to process data only for the purposes of operating, securing, and supporting the service.',
      'We may disclose information if required by law, to protect the service, or to prevent fraud, abuse, or security incidents.',
    ],
  },
  {
    title: 'Data Retention',
    body: [
      'We retain account, CRM, synced metadata, AI suggestion, and activity data for as long as needed to provide the service, comply with legal obligations, resolve disputes, and maintain security records.',
      'When a Google account is disconnected, new sync actions stop for that connected account and stored OAuth tokens are cleared through the disconnect flow. Some previously synced metadata or audit records may remain until deleted according to product or support processes.',
    ],
  },
  {
    title: 'User Choices and Account Disconnect',
    body: [
      'Users can connect, request disconnect, or reconnect Google accounts from the Connected Accounts settings area, subject to their organization role and approval policy.',
      'Organization owners or admins may manage connected account disconnect requests according to the existing approval flow.',
      'Users can stop future Google access by disconnecting the account in SalesFlows AI or by revoking access from their Google Account permissions page.',
    ],
  },
  {
    title: 'How to Request Deletion',
    body: [
      `To request deletion of your account or organization data, contact ${contactEmail}. We may need to verify your identity and organization permissions before deleting data.`,
      'Some records may be retained where required for security, legal compliance, backup integrity, or audit purposes.',
    ],
  },
  {
    title: 'Contact',
    body: [
      `For privacy questions, data requests, or Google data deletion requests, contact ${contactEmail}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-950">
            SalesFlows AI
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/terms" className="hover:text-slate-950">
              Terms
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
            Privacy Policy
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            This policy explains how SalesFlows AI handles personal data,
            synced Google metadata, AI suggestions, and CRM workflow data.
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

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-blue-950">
            <h2 className="text-base font-semibold text-blue-950">
              Google API Services User Data Policy
            </h2>
            <p className="mt-2">
              SalesFlows AI's use and transfer of information received from
              Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="font-semibold underline underline-offset-4"
                rel="noreferrer"
                target="_blank"
              >
                Google API Services User Data Policy
              </a>
              , including Limited Use requirements.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
