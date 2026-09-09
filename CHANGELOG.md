# Changelog

## 0.1.0

First release.

- One recursive node type: `title`, plus optional `description`, `value`, `color`, `region`, `children`
- Any depth — lenses, regions, hot-spots, leaves. Children claim a sub-cluster of the parent's dots
- Procedural brain geometry, no mesh file: ~290 points, k-NN edges
- Camera framing solved against the projected bounds across 12 azimuths, so nothing clips while spinning
- Hover a card and the brain turns to face that region; click to fly in
- Embeddable: scoped styles, `height="auto"`, `background="transparent"`, `palette`
- Standalone iframe bundle for React 18 / Vue / plain HTML hosts
- 16 Playwright tests across desktop and mobile
