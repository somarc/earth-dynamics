#!/usr/bin/env node
/** Import public/textures/home + home-region.json into SQLite. */
import { importHomeFromDisk } from '../ingest/home-store.mjs';

const result = importHomeFromDisk();
console.log(
  `Home region "${result.regionId}" → DB (${result.assets} assets, ${(result.bytes / 1_048_576).toFixed(1)} MB)`,
);