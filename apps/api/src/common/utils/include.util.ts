export function parseIncludeParam<T extends string>(
  include: string | undefined,
  allowedIncludes: readonly T[],
): T[] {
  if (!include) {
    return [];
  }

  const requestedIncludes = include
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return requestedIncludes.filter((value): value is T =>
    allowedIncludes.includes(value as T),
  );
}

export function hasInclude<T extends string>(
  includes: readonly T[],
  include: T,
): boolean {
  return includes.includes(include);
}