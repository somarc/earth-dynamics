import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backoffMs,
  fetchWithRetry,
  parseRetryAfterMs,
} from '../../ingest/lib/fetch-with-retry.mjs';

describe('parseRetryAfterMs', () => {
  it('parses integer seconds header to ms', () => {
    expect(parseRetryAfterMs('3')).toBe(3000);
    expect(parseRetryAfterMs('0')).toBeNull();
    expect(parseRetryAfterMs('')).toBeNull();
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it('parses HTTP-date header as future delta', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('returns null for past HTTP-date', () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    expect(parseRetryAfterMs(past)).toBeNull();
  });
});

describe('backoffMs', () => {
  it('scales linearly with attempt index', () => {
    expect(backoffMs(0, 1000)).toBe(1000);
    expect(backoffMs(1, 1000)).toBe(2000);
    expect(backoffMs(2, 500)).toBe(1500);
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns response on successful first try', async () => {
    const ok = new Response('hi', { status: 200 });
    fetch.mockResolvedValueOnce(ok);

    const res = await fetchWithRetry('https://example.test/ok', {}, {
      baseBackoffMs: 1,
      maxAttempts: 3,
      label: 'ok',
    });
    expect(res).toBe(ok);
    expect(await res.text()).toBe('hi');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    const headers = new Headers({ 'retry-after': '0' });
    // parseRetryAfterMs('0') → null, so backoff path is used; keep base tiny
    const tooMany = new Response('slow down', { status: 429, headers });
    const ok = new Response('done', { status: 200 });
    fetch
      .mockResolvedValueOnce(tooMany)
      .mockResolvedValueOnce(ok);

    const res = await fetchWithRetry('https://example.test/rate', {}, {
      baseBackoffMs: 1,
      maxAttempts: 4,
      label: 'rate',
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('done');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('uses Retry-After seconds when present', async () => {
    vi.useFakeTimers();
    const headers = new Headers({ 'retry-after': '2' });
    fetch
      .mockResolvedValueOnce(new Response('wait', { status: 429, headers }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const p = fetchWithRetry('https://example.test/ra', {}, {
      baseBackoffMs: 60_000,
      maxAttempts: 3,
      label: 'ra',
    });
    // advance past Retry-After (2s) without waiting full baseBackoff
    await vi.advanceTimersByTimeAsync(2000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns final non-ok response when retries exhausted (no network throw)', async () => {
    fetch.mockResolvedValue(new Response('nope', { status: 503 }));

    const res = await fetchWithRetry('https://example.test/down', {}, {
      baseBackoffMs: 1,
      maxAttempts: 2,
      label: 'down',
    });
    expect(res.status).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rethrows last network error after exhausting attempts', async () => {
    fetch.mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      fetchWithRetry('https://example.test/net', {}, {
        baseBackoffMs: 1,
        maxAttempts: 2,
        label: 'net',
      }),
    ).rejects.toThrow('ECONNRESET');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
