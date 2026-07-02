/**
 * HTTP fetch with exponential backoff and Retry-After support.
 */

export class FetchRetryError extends Error {
  constructor(message, { status, url, attempts } = {}) {
    super(message);
    this.name = 'FetchRetryError';
    this.status = status;
    this.url = url;
    this.attempts = attempts;
  }
}

function parseRetryAfterMs(header) {
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

function backoffMs(attempt, baseMs) {
  return baseMs * (attempt + 1);
}

export async function fetchWithRetry(
  url,
  init = {},
  {
    maxAttempts = 4,
    baseBackoffMs = 10_000,
    retryOn = (res) => res.status === 429 || res.status >= 500,
    label = url,
  } = {},
) {
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok || !retryOn(res) || attempt === maxAttempts - 1) {
        return res;
      }

      const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
      const wait = retryAfter ?? backoffMs(attempt, baseBackoffMs);
      console.log(`    ${label}: HTTP ${res.status}, retry in ${Math.round(wait / 1000)}s (${attempt + 1}/${maxAttempts})…`);
      await new Promise((r) => setTimeout(r, wait));
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts - 1) break;
      const wait = backoffMs(attempt, baseBackoffMs);
      console.log(`    ${label}: ${err.message}, retry in ${Math.round(wait / 1000)}s (${attempt + 1}/${maxAttempts})…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  if (lastError) throw lastError;
  throw new FetchRetryError(`${label}: failed after ${maxAttempts} attempts`, {
    url: String(url),
    attempts: maxAttempts,
  });
}