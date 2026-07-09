import { describe, expect, it } from 'vitest';
import { parseExperienceSearch } from '../../src/experiences/controller.mjs';

describe('parseExperienceSearch', () => {
  it('parses a leading-? query string', () => {
    expect(parseExperienceSearch('?experience=solid-earth&date=2024-05-11')).toEqual({
      experienceId: 'solid-earth',
      date: '2024-05-11',
    });
  });

  it('parses a bare query string without ?', () => {
    expect(parseExperienceSearch('experience=space-weather&date=2023-01-02')).toEqual({
      experienceId: 'space-weather',
      date: '2023-01-02',
    });
  });

  it('parses a full URL', () => {
    expect(
      parseExperienceSearch('https://example.com/app?experience=orbital&date=2020-12-21'),
    ).toEqual({
      experienceId: 'orbital',
      date: '2020-12-21',
    });
  });

  it('parses path + query', () => {
    expect(parseExperienceSearch('/view?experience=solid-earth')).toEqual({
      experienceId: 'solid-earth',
      date: null,
    });
  });

  it('accepts URLSearchParams', () => {
    const params = new URLSearchParams({ experience: 'all', date: '2011-03-11' });
    expect(parseExperienceSearch(params)).toEqual({
      experienceId: 'all',
      date: '2011-03-11',
    });
  });

  it('accepts URL instances', () => {
    const url = new URL('http://localhost/?experience=solid-earth&date=2024-05-11');
    expect(parseExperienceSearch(url)).toEqual({
      experienceId: 'solid-earth',
      date: '2024-05-11',
    });
  });

  it('returns nulls for empty / missing input', () => {
    expect(parseExperienceSearch('')).toEqual({ experienceId: null, date: null });
    expect(parseExperienceSearch(null)).toEqual({ experienceId: null, date: null });
    expect(parseExperienceSearch(undefined)).toEqual({ experienceId: null, date: null });
    expect(parseExperienceSearch('?foo=bar')).toEqual({ experienceId: null, date: null });
  });

  it('ignores unrelated params and preserves only experience/date', () => {
    expect(
      parseExperienceSearch('?experience=solid-earth&date=2024-05-11&utm=1&view=geo'),
    ).toEqual({
      experienceId: 'solid-earth',
      date: '2024-05-11',
    });
  });
});
