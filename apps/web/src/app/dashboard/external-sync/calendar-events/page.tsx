import { redirect } from 'next/navigation';

export default function ExternalCalendarEventsPage() {
  redirect('/dashboard/external-sync/calendar-events/board');
}
