/**
 * Cloudflare Worker — production API surface (NOT DEPLOYED).
 *
 * Status: stub only. Local dev uses api/server.mjs + SQLite.
 * Roadmap H2: bind D1 and port routeRequest() from api/handlers.mjs.
 * See docs/architecture.md and docs/roadmap.md (Phase H).
 */
export default {
  async fetch(request, env) {
    return Response.json(
      {
        status: 'not_implemented',
        message: 'Wobblescope API worker stub',
        hint: 'Use api/server.mjs locally. Port routeRequest() + D1 for production.',
        roadmap: 'docs/roadmap.md#phase-h--ship',
        docs: 'docs/architecture.md',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  },
};