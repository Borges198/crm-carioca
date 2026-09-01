function normalizeFlightNumber(value) {
  if (typeof value !== "string") return value;

  const match = value.match(/^\s*Voo\s+(.+?)\s*$/iu);
  return match ? match[1] : value;
}

function visit(value, path, changes) {
  if (Array.isArray(value)) {
    return value.map((item, index) => visit(item, `${path}.${index}`, changes));
  }

  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    if (key !== "numeroVoo") return [key, visit(child, childPath, changes)];

    const normalized = normalizeFlightNumber(child);
    if (normalized !== child) {
      changes.push({ path: childPath, original: child, normalizado: normalized });
    }
    return [key, normalized];
  }));
}

export function normalizeStructuredOutputWithReport(value) {
  const changes = [];
  return {
    value: visit(value, "", changes),
    changes,
  };
}

export function normalizeStructuredOutput(value) {
  return normalizeStructuredOutputWithReport(value).value;
}
