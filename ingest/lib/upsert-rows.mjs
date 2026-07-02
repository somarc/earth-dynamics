/**
 * Transactional batched upsert for SQLite.
 */

export function upsertRows(db, sql, rows, { batchSize = 500 } = {}) {
  if (!rows?.length) return 0;
  const stmt = db.prepare(sql);
  let written = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const tx = db.transaction(() => {
      for (const row of batch) {
        stmt.run(row);
        written += 1;
      }
    });
    tx();
  }

  return written;
}