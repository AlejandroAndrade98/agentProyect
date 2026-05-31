const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|secret|token|api[_-]?key|client[_-]?secret|code|oauth)/i;

const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g;
const QUERY_SECRET_PATTERN =
  /((?:access_token|refresh_token|id_token|client_secret|password|token|secret|code)=)([^&\s]+)/gi;

export function redactSensitiveValues<T>(value: T, depth = 0): T {
  if (depth > 6) {
    return '[MaxDepth]' as T;
  }

  if (typeof value === 'string') {
    return redactSensitiveString(value) as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item, depth + 1)) as T;
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : redactSensitiveValues(nestedValue, depth + 1);
  }

  return redacted as T;
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(BEARER_TOKEN_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(QUERY_SECRET_PATTERN, '$1[REDACTED]');
}
