# Contributing

Thanks for looking. Issues and PRs are both welcome.

## Getting set up

```bash
npm install
npm run dev          # demo at :5173
npm test             # Playwright, desktop + mobile
```

Other entry points, all served by `npm run dev`:

| Route | What it's for |
|---|---|
| `/` | the demo |
| `/embed.html` | the component inside a normal scrolling page |
| `/stress.html` | 5 / 8 / 12 / 20 segments and 6 levels deep, to see where it breaks |

## Before you open a PR

```bash
npx tsc -b        # types
npm run lint      # oxlint
npm test          # 16 tests, desktop + mobile
```

CI runs all three. A UI change should say what it looks like — a screenshot or a short clip in the PR
saves a round trip.

## Layout

| Path | What's in it |
|---|---|
| `src/lib/` | the package — everything else is demo or harness |
| `src/lib/schema.ts` | the one recursive node type, plus `assertBrain` / `resolve` / `flatten` |
| `src/lib/brainShape.ts` | procedural brain geometry: ~290 points, k-NN edges, no mesh file |
| `src/lib/cluster.ts` | which dots belong to which node, at every depth |
| `src/lib/Brain3D.tsx` | the canvas: dots, glow, labels, camera |
| `src/lib/CompanyBrain.tsx` | cards, leader lines, breadcrumb, mobile strip |
| `src/data/demo.json` | fictional demo data |
| `tests/` | Playwright specs |

## Things worth knowing

- **Camera framing is solved numerically.** It projects a sample of the dots across 12 azimuths and takes
  the worst case, so nothing clips as the brain spins. If you change the geometry, re-run the tests.
- **Never `setState` from inside `useFrame`.** R3F's frame loop will nest renders and React throws
  "Maximum update depth exceeded". Stash in a ref and poll.
- **Styles are scoped under `.cb-root`** so the component can't touch a host page. Keep it that way.
- **~8 siblings per node** is the practical ceiling; deeper is unlimited.
