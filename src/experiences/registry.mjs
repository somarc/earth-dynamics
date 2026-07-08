const modules = import.meta.glob(
  ['../../experiences/*/experience.mjs', '!../../experiences/_*/experience.mjs'],
  { eager: true },
);

const ORDER = [
  'solid-earth',
  'ocean-climate',
  'magnetosphere',
  'earth-spin',
  'orbital',
  'full-instrument',
];

export function allExperiences() {
  const list = Object.values(modules).map((m) => m.default).filter(Boolean);
  return list.sort((a, b) => {
    const ia = ORDER.indexOf(a.id);
    const ib = ORDER.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export function getExperience(id) {
  return allExperiences().find((e) => e.id === id) ?? allExperiences()[0];
}

export const DEFAULT_EXPERIENCE_ID = 'ocean-climate';