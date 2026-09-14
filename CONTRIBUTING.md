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

## Releasing

Publishing a GitHub release publishes that version to npm (`.github/workflows/release.yml`).

1. In a PR: bump `version` in `package.json` and rename `## Unreleased` in `CHANGELOG.md` to the version.
2. Merge it to `main` and let CI pass.
3. Create a GitHub release with the tag `v<version>` (e.g. `v0.2.0`), pasting the changelog entry as the notes.

The workflow checks the tag matches `package.json`, typechecks, lints, and publishes with provenance.
Versions with a pre-release suffix (`0.3.0-beta.1`) go to the `next` dist-tag instead of `latest`.
Auth is npm trusted publishing, so there's no npm token in the repo. The trusted publisher on npmjs.com
names `release.yml`, so renaming the workflow breaks publishing until that setting is updated too.

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
