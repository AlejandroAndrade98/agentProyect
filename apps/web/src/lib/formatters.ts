export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'Not set';
  }

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function truncateText(
  value: string | null | undefined,
  maxLength: number,
) {
  const text = value?.replace(/\s+/g, ' ').trim();

  if (!text) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength).trimEnd();
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > Math.floor(maxLength * 0.7)) {
    return `${truncated.slice(0, lastSpaceIndex)}...`;
  }

  return `${truncated}...`;
}
