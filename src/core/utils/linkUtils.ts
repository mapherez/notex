export function normalizeExternalHref(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith('mailto:')) {
    return trimmed;
  }

  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export function titleFromExternalHref(input: string) {
  const normalized = normalizeExternalHref(input);

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '');
    const firstPart = host.split('.')[0];
    return firstPart || host || input.trim();
  } catch {
    return input
      .trim()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/^www\./i, '')
      .split(/[./?#]/)[0];
  }
}
