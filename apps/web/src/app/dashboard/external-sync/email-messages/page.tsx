import { redirect } from 'next/navigation';

export default function ExternalEmailMessagesPage() {
  redirect('/dashboard/external-sync/email-messages/board');
}
