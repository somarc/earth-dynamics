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

  defaultView: ExperienceView;
  /** Connector / sourceKey ids for theme-scoped freshness chips */
  freshnessKeys: string[];

  suggestedMoments?: SuggestedMoment[];
}