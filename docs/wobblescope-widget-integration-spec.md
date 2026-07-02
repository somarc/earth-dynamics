<p align="center">
  <img src="/assets/weatherly-mascot.jpg" alt="Weatherly mascot" width="72" height="72" />
</p>

# Wobblescope → `widget` Block Integration Spec

**Status:** proposed — actioning in `earth-dynamics`  
**Authored:** SLICC (review workspace) · persisted here for durable reference  
**Related:** [`platform-intent.md`](platform-intent.md) · [`adr-layer-plugin-contract.md`](adr-layer-plugin-contract.md)

**Repos involved:**

- `somarc/earth-dynamics` — Wobblescope app (Vite/Three.js/SQLite), source of truth for the widget bundle
- `somarc/earth-dynamics-eds` — AEM Edge Delivery Services site (`aem-boilerplate` fork), hosts the authored shell + serves the widget

**Depends on:** layer-registry refactor (P3 finish landed; P4 radar in progress). Widget DOM-scoping is sequenced after registry work stabilizes.

---

## 1. Intent

Minimal Helix authoring surface. The EDS site is content-first and block-native everywhere except one seam: the Wobblescope globe itself, which mounts as a single `widget` block. Everything else on the site (nav, footer, hero, trust/methodology pages, data-source documentation) is authored in DA as ordinary Helix content and blocks — fully indexable, fully conventional.

This spec covers only the seam: how Wobblescope's existing app becomes a `widget`-block-loadable unit without forcing a rewrite into block-authored markup.

---

## 2. How the `widget` block works (confirmed from `earth-dynamics-eds`)

From `blocks/widget/widget.js`:

```js
function widgetUrl(widgetPath, widgetName, extension) {
  const prefix = widgetPath ? `${widgetPath}/` : '';
  return `${window.hlx.codeBasePath}/widgets/${prefix}${widgetName}.${extension}`;
}

export default async function decorate(widget) {
  const source = widget.querySelector('a[href]');
  const { pathname, searchParams } = new URL(source.href);
  const { widgetPath, widgetName } = parseWidgetHref(pathname);

  const resp = await fetch(widgetUrl(widgetPath, widgetName, 'html'));
  widget.innerHTML = await resp.text();

  const cssLoaded = loadCSS(widgetUrl(widgetPath, widgetName, 'css'));
  const decorationComplete = (async () => {
    const mod = await import(widgetUrl(widgetPath, widgetName, 'js'));
    if (mod.default) await mod.default(widget);
  })();
  await Promise.all([cssLoaded, decorationComplete]);
}
```

Key facts:

1. **Same-origin only.** Widget files must be served from the EDS site at `/widgets/<path>/<name>.{html,css,js}`.
2. **Author contract:** DA block contains a link, e.g. `[Wobblescope](/widgets/wobblescope/wobblescope.html)`.
3. **Mount contract:** `.js` default export receives the block element — already populated with fetched `.html`.
4. **Query params** on the link become `widget.dataset.*` (`?date=2026-06-26&view=helio`).
5. **CSS scoped** to `.wobblescope` per EDS block convention.

---

## 3. Changes in `earth-dynamics` (source repo)

### 3.1 Build output shape

```
earth-dynamics/
  vite.config.widget.js
  widget/wobblescope.html
  dist-widget/
    wobblescope.html
    wobblescope.css
    wobblescope.js
    assets/...
```

`npm run build:widget` — **implemented.**

### 3.2 `wobblescope.html` — DOM shell only

Body contents from `index.html` (bootstrap gate + `#app`), no `<html>`/`<head>`/`<body>`, no script tags.

### 3.3 `wobblescope.js` — scoped entry point

`src/main.js` exports `mountWobblescope(root)`; DOM lookups use `src/dom-scope.js` (`$id`, `$`, `$$`). Standalone dev still boots via `document.body` when `VITE_WIDGET` is unset.

### 3.4 `wobblescope.css` — block-scoped styles

`src/style.css` tokens and layout scoped under `.wobblescope`. Standalone: `<body class="wobblescope">`. EDS: block element carries `wobblescope` class.

### 3.5 API base URL

Widget build sets `VITE_API_BASE` at build time to the deployed Cloudflare Worker URL.

### 3.6 Query-param → initial state

`mountWobblescope(root)` reads `root.dataset.date` and `root.dataset.view` to seed timeline state. `layers` deferred to Phase G.

---

## 4. `earth-dynamics-eds` (EDS repo)

### 4.1 Widget files under `/widgets/wobblescope/`

Generated from `earth-dynamics` build — not hand-edited in EDS.

### 4.2 DA-authored page

```
| widget |
| :---- |
| [Wobblescope](/widgets/wobblescope/wobblescope.html) |
```

### 4.3 Everything else stays conventional

Nav, footer, hero, trust pages — ordinary DA blocks.

---

## 5. Sync mechanism

**(A) CI job copies build output across repos** (recommended). On merge to `earth-dynamics` `main`, run `npm run build:widget` and open a PR into `earth-dynamics-eds` `widgets/wobblescope/`.

Target feature branch + PR per EDS `AGENTS.md` publishing process.

---

## 6. Out of scope

- Migrating Wobblescope UI into native Helix blocks
- Cloudflare Worker + D1 production API (phase H)
- Performance/Lighthouse tuning (follow-up once seam works)
- Full Phase G deep-links (`?layers=`)

---

## 7. Sequencing

| Step | Status |
|------|--------|
| 1. Layer-registry P3/P4 | P3 finish done; radar next |
| 2. Widget build + DOM scoping (§3) | **In progress** — `build:widget`, `dom-scope.js`, `mountWobblescope` |
| 3. Cloudflare Worker + D1 (phase H) | Pending |
| 4. CI sync → `earth-dynamics-eds` | Pending |
| 5. DA homepage with widget block | Pending |
| 6. PSI/Lighthouse pass | Pending |