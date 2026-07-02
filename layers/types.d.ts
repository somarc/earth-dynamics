/** Layer plugin contract — see docs/adr-layer-plugin-contract.md */

export type LayerKind =
  | 'ingested-timeseries'
  | 'static-reference'
  | 'derived-runtime'
  | 'regional-imagery'
  | 'chart-lane'
  | 'scene-primitive';

export type LayerEpistemic =
  | 'measured'
  | 'modeled'
  | 'derived'
  | 'pedagogical'
  | 'exploratory';

export interface LayerGlobeContext {
  EARTH_RADIUS: number;
  scene: import('three').Scene;
  surfaceGroup: import('three').Group;
}

export interface LayerGlobeManifest {
  defaultVisible?: boolean;
  toggleId?: string;
  legacyKey?: string;
  parent?: 'surface' | 'earth' | 'axis';
  init?: (ctx: LayerGlobeContext) => Promise<import('three').Object3D | null>;
  update?: (
    group: import('three').Group,
    frame: Record<string, unknown>,
    date: string,
    ctx: LayerGlobeContext,
  ) => void;
  pickTypes?: string[];
  legend?: {
    id: string;
    class: string;
    label: string;
    title: string;
    help?: string;
  };
}

export interface LayerRoute {
  path: string;
  handler: (db: unknown, url: string) => { status: number; body?: unknown; binary?: boolean };
}

export interface LayerManifest {
  id: string;
  kind: LayerKind;
  name: string;
  epistemic: LayerEpistemic;
  sourceKey?: string;
  order?: number;
  ingestKey?: string;
  ingestAliases?: string[];
  skipIfFresh?: boolean;
  ingest?: (ctx: { db?: unknown; force?: boolean }) => Promise<{ rowCount?: number; notes?: string }>;
  schema?: string | null;
  contributeToDaySnapshot?: (
    db: unknown,
    date: string,
    opts: Record<string, unknown>,
  ) => Record<string, unknown>;
  routes?: LayerRoute[];
  static?: { url: string; load: () => Promise<unknown> };
  globe?: LayerGlobeManifest;
  presets?: Record<string, boolean>;
}