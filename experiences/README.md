# Wobblescope Experiences

Guided themes that **compose** layer registry plugins — they do not fetch data.

**Plan:** [`docs/experience-platform-plan.md`](../docs/experience-platform-plan.md)  
**Template:** Copy `_template/` when K1 lands.

## Quick model

```
experiences/<id>/
  experience.mjs   # manifest: layers, panels, moments, freshnessKeys
```

Experiences set which globe layers and sidebar panels are active, default view, and theme-scoped freshness. Atomic layers remain in `layers/`.

## Status

| Phase | State |
|-------|--------|
| K1 registry | `planned` |
| K2 solid-earth, ocean-climate proofs | `planned` |

Do not add experiences by hand-editing `index.html` once K1 ships — registry discovery only.