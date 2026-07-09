export type ExperienceView = 'geocentric' | 'heliocentric';

export interface SuggestedMoment {
  date: string;
  label: string;
  connectorRefs?: string[];
}

/** Guided theme manifest — composes layers, does not ingest. */
export interface ExperienceManifest {
  id: string;
  title: string;
  tagline: string;
  mascotCue?: string;

  /** Layer registry keys → default visibility when experience is active */
  layers: Record<string, boolean>;

  /** Panel DOM ids or chart-lane ids to show */
  panels: string[];
  hiddenPanels?: string[];
  showAllPanels?: boolean;
  showAllLayers?: boolean;
  /** Hide every sidebar panel (Bald Earth authoring mode). */
  hideAllPanels?: boolean;
  /**
   * Strip instrument chrome (spin axis, pole, trail) so only the planetary
   * body remains. Data layers should also be off via `layers`.
   */
  bareGlobe?: boolean;

  defaultView: ExperienceView;
  /** 0–1 globe shell opacity when experience activates (1 = solid, no x-ray bleed) */
  globeOpacity?: number;
  /** Hide event markers on the hemisphere facing away from the camera */
  hemisphereCull?: boolean;
  /** Connector / sourceKey ids for theme-scoped freshness chips */
  freshnessKeys: string[];

  suggestedMoments?: SuggestedMoment[];
}