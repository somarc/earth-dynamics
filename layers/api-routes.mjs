import { homeRoutes } from './home-region/routes.mjs';

export const LAYER_ROUTES = homeRoutes();

export function matchLayerRoute(url) {
  const path = new URL(url, 'http://local').pathname;

  for (const route of LAYER_ROUTES) {
    if (route.match) {
      const params = route.match(url);
      if (params) return { route, params };
      continue;
    }
    if (route.path === path) return { route, params: {} };
  }
  return null;
}