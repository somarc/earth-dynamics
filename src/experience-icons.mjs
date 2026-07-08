/**
 * SVG icons for the experience / theme rail.
 * Designed to be minimal, geometric, and consistent with Wobblescope's
 * scientific / data-viz aesthetic. Use with currentColor for theming.
 *
 * All icons use a 24x24 viewBox and are intended to render ~18px.
 */

export const EXPERIENCE_ICONS = {
  'solid-earth': `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/>
      <!-- subtle plate / terrain lines -->
      <path d="M5 8.5 Q9 7 14 9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 15 Q11 16.5 17 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <!-- small mountain hint for solid topo -->
      <path d="M10 13 L12 9 L14 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>
  `,

  'ocean-climate': `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <!-- stacked waves -->
      <path d="M4 8 Q8 4 12 8 Q16 12 20 8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <path d="M4 13 Q8 9 12 13 Q16 17 20 13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <path d="M4 18 Q8 14 12 18 Q16 22 20 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,

  'magnetosphere': `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <!-- central body -->
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.75"/>
      <!-- magnetic field lines (symmetric) -->
      <path d="M5.5 6.5 Q2 12 5.5 17.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M18.5 6.5 Q22 12 18.5 17.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <!-- poles -->
      <circle cx="12" cy="6.5" r="1.3" fill="currentColor"/>
      <circle cx="12" cy="17.5" r="1.3" fill="currentColor"/>
    </svg>
  `,

  'earth-spin': `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <!-- globe -->
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.75"/>
      <!-- rotation axis -->
      <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <!-- rotation arc + arrow hint -->
      <path d="M16.8 7.5 A 5.8 5.8 0 0 1 16.8 16.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <!-- small arrow head -->
      <polyline points="15.2,16.1 17.1,16.6 16.3,14.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  'orbital': `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <!-- orbit ellipse -->
      <ellipse cx="12" cy="12" rx="9" ry="5" fill="none" stroke="currentColor" stroke-width="1.7"/>
      <!-- sun / center -->
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      <!-- planet on orbit -->
      <circle cx="19.2" cy="9.5" r="1.8" fill="currentColor"/>
      <!-- small orbital direction hint -->
      <path d="M18 7.8 Q20 8.8 19.5 10.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  `,

  'full-instrument': `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <!-- complete instrument / full stack symbol -->
      <rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/>
      <!-- layered bars -->
      <rect x="7.5" y="8" width="9" height="2.2" rx="0.8" fill="currentColor"/>
      <rect x="7.5" y="11.5" width="9" height="2.2" rx="0.8" fill="currentColor"/>
      <rect x="7.5" y="15" width="9" height="2.2" rx="0.8" fill="currentColor"/>
    </svg>
  `,
};

/**
 * Returns an SVG string for the given experience id.
 * Falls back to a generic circle if unknown.
 */
export function getExperienceIcon(id) {
  return EXPERIENCE_ICONS[id] || `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.75"/>
    </svg>
  `;
}
