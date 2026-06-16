export type SearchFieldValue = string | number | boolean | null | undefined;

export function normalizeSearchText(value: SearchFieldValue): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeSearchDigits(value: SearchFieldValue): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function matchesSearchQuery(query: SearchFieldValue, fields: SearchFieldValue[]): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const queryDigits = normalizeSearchDigits(query);

  if (!normalizedQuery) {
    return true;
  }

  return fields.some((field) => {
    const normalizedField = normalizeSearchText(field);
    const fieldDigits = normalizeSearchDigits(field);

    return normalizedField.includes(normalizedQuery)
      || (queryDigits.length > 0 && fieldDigits.includes(queryDigits));
  });
}

export function filterBySearch<T>(
  items: T[],
  query: SearchFieldValue,
  getFields: (item: T) => SearchFieldValue[]
): T[] {
  return items.filter((item) => matchesSearchQuery(query, getFields(item)));
}
