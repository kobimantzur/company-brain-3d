# Changelog

## Unreleased

- **`theme="light"`**: a light version for light host pages. Cards, chips and labels switch to a paper
  palette, and the brain paints with normal blending, since additive glow washes out to white on a light
  ground. Highlights push toward ink and faded regions sink into the paper instead of into black. `dark`
  stays the default and renders exactly as before.
- Standalone embed: `?theme=light|dark`, and a host page can switch it live by posting
  `{ type: 'company-brain:theme', theme }` to the iframe, with no reload.
- Standalone embed now starts with a transparent body instead of black, so a light embed doesn't flash.

## 0.1.1

Packaging and docs only — the component itself is unchanged.

- `brain.schema.json` shipped with a `$id` pointing at the pre-rename repo. Fixed to `company-brain-3d`
- The demo site built with `base: '/company-brain/'`, so every asset 404'd on GitHub Pages and the page rendered blank. Fixed
- Fixed the two dead links in the issue-template chooser

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
