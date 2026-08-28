export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string
): string | null {
  if (min === null && max === null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)}`;
  if (min !== null) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

export function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date;
  }
}
