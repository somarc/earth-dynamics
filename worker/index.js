/**
 * Cloudflare Worker — production API surface.
 * Copy api/handlers.mjs logic here with D1 bindings when deploying.
 * See docs/architecture.md
 */
export default {
  async fetch(request, env) {
    return Response.json(
      {
        message: 'Wobblescope API worker stub',
        hint: 'Bind D1 and port routeRequest() from api/handlers.mjs',
        docs: 'docs/architecture.md',
      },
      { status: 503 }
    );
  },
};