export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type DateFormatOptions = {
  locale?: string;
  fallback?: string;
  invalidFallback?: string;
};

type MoneyFormatOptions = {
  locale?: string;
  fallback?: string;
};

export function formatDate(
  value: string | null | undefined,
  options: DateFormatOptions = {},
) {
  const {
    locale = 'en',
    fallback = 'Not set',
    invalidFallback = 'Invalid date',
  } = options;

  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return invalidFallback;
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(
  value: string | null | undefined,
  options: DateFormatOptions = {},
) {
  const {
    locale = 'en-US',
    fallback = 'Not set',
    invalidFallback = 'Invalid date',
  } = options;

  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return invalidFallback;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatMoney(
  value: number | null | undefined,
  options: MoneyFormatOptions = {},
) {
  const { locale = 'en', fallback = 'Not set' } = options;

  if (value === null || value === undefined) {
    return fallback;
  }

  return new Intl.NumberFormat(locale, {
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
