import { getOceanSnapshot } from './routes.mjs';

export function contributeOceanToDay(db, date) {
  return getOceanSnapshot(db, date);
}