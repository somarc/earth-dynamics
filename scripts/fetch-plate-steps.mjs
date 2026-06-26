#!/usr/bin/env node
/**
 * Download PB2002 digitization steps (kinematic boundary classes) from fraxen/tectonicplates.
 * Bird (2003) G³ 4(3), doi:10.1029/2001GC000252
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'plate-boundary-steps.json');
const URL = 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_steps.json';

const res = await fetch(URL);
if (!res.ok) throw new Error(`PB2002_steps ${res.status}`);
const data = await res.json();
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data));
console.log(`Wrote ${OUT} (${data.features?.length ?? 0} steps)`);