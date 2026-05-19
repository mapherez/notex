export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function hashStableJson(value: unknown) {
  return hashText(stableStringify(value));
}

export async function hashText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const nextValue = (value as Record<string, unknown>)[key];
      if (nextValue !== undefined) {
        result[key] = sortValue(nextValue);
      }
      return result;
    }, {});
}
