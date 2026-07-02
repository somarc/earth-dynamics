import { getHomeAsset, getHomeRegionConfig, listHomeAssetKeys } from '../../ingest/home-store.mjs';

export function homeRoutes() {
  return [
    {
      path: '/api/home',
      handler(db, url) {
        const config = getHomeRegionConfig();
        if (!config) {
          return { status: 404, body: { error: 'Home region not ingested — run npm run sync-home' } };
        }
        const assets = listHomeAssetKeys().map((a) => ({
          key: a.asset_key,
          bytes: a.byte_length,
          mime: a.mime_type,
          fetchedAt: a.fetched_at,
        }));
        return { status: 200, body: { ...config, assetInventory: assets } };
      },
    },
    {
      path: '/api/home/assets/:key',
      match(url) {
        const path = new URL(url, 'http://local').pathname;
        const m = path.match(/^\/api\/home\/assets\/([a-z0-9-]+)$/);
        return m ? { key: m[1] } : null;
      },
      handler(db, url, params) {
        const asset = getHomeAssetBinary(params.key);
        if (!asset) return { status: 404, body: { error: 'Home asset not found' } };
        return {
          status: 200,
          binary: true,
          mime: asset.mime,
          body: asset.data,
          headers: {
            'Cache-Control': 'public, max-age=31536000, immutable',
            ETag: `"${asset.sha256}"`,
            'Content-Length': String(asset.byteLength),
          },
        };
      },
    },
  ];
}

function getHomeAssetBinary(assetKey, regionId = 'eastern-ontario') {
  const row = getHomeAsset(regionId, assetKey);
  if (!row) return null;
  return {
    mime: row.mime_type,
    data: row.data,
    sha256: row.sha256,
    byteLength: row.byte_length,
  };
}