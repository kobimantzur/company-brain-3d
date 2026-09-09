# Company Brain — full guide

## Props

| Prop | Default | What it does |
|---|---|---|
| `data` | — | A `Brain` (see below) |
| `onSelect` | — | `(node, path) => void`, fired on every zoom-in |
| `defaultLens` | first | Which top-level child to start on |
| `zoom` | `1` | Camera distance multiplier, `1.3` = closer |
| `autoRotate` | `true` | Slow spin at the overview |
| `scrollZoom` | `false` | Wheel/pinch dollies the camera. Off so the page keeps scrolling over the canvas |
| `background` | dark gradient | Any CSS colour, or `transparent` to show the host page through the canvas |
| `palette` | 8 colours | Colours for top-level segments that don't set their own |
| `height` | `100%` | Any CSS length, or `auto` to size itself from its width (no dead space) |
| `maxWidth` | `1180px` | Cap on the cards+brain layout; `none` to let it spread |
| `className` | — | Extra class on the root |

### Embedding in a host on React 18 (or no React at all)

`@react-three/fiber@9` needs React 19. If your site is on React 18 (Next 14, CRA, Gatsby…) or isn't React at all, use the standalone bundle instead of the package:

```bash
npm run build:embed        # → dist-embed/  (one self-contained page, ~1.1 MB)
cp -r dist-embed public/brain
```

```html
<iframe src="/brain/standalone.html?height=auto" style="width:100%;height:560px;border:0" loading="lazy"></iframe>
```

With `?height=auto` the page posts its ideal height to the parent, so the iframe can shrink-wrap it:

```js
addEventListener('message', (e) => {
  if (e.data?.type === 'company-brain:height') iframe.style.height = e.data.height + 'px'
})
```

It accepts `?src=/my-brain.json` to load your own data, plus `?zoom=`, `?maxWidth=`, `?autoRotate=0`, `?scrollZoom=1`.

### Embedding in a page

It's a plain block element — it does not take over the viewport and does not touch your page's `html`/`body`. Either give it an explicit height, or give its container one.

```tsx
// explicit height — the usual choice for a landing page section
<CompanyBrain data={brain} height="70vh" />

// or size the container and let it fill
<div style={{ height: 560, borderRadius: 20, overflow: 'hidden' }}>
  <CompanyBrain data={brain} />
</div>
```

#### Making it yours

Every style is scoped under `.cb-root`, so nothing leaks into the host page.

```tsx
<CompanyBrain
  data={brain}
  background="transparent"                                  // or any CSS colour
  palette={['#0f766e', '#7c3aed', '#b91c1c', '#a16207']}     // segments without their own colour
  className="my-brain"
/>
```

```css
/* tokens: text, chrome and the card surfaces */
.my-brain { --text: #10233a; --muted: #56708c; --line: #c9d6e6; --accent: #0369a1; }
.my-brain .cb-card { background: rgba(255,255,255,.85); }
```

With `background="transparent"` the WebGL canvas is see-through, so the brain sits on whatever the page
already has — gradient, image, light or dark. Per-node `color` in the JSON always wins over `palette`.

Minimum sensible height is ~420px; below that the brain gets cramped (pass `height` and it's respected anyway).

## The data model, level by level

The same shape as above, annotated — what each depth means to the visual.

```jsonc
{
  "version": 1,
  "title": "Northwind Systems",
  "children": [                                   // ← lenses: the toggle above the brain
    {
      "id": "sources", "title": "Data sources",
      "children": [                               // ← regions of the brain, one card each
        {
          "id": "emails", "title": "Emails", "region": "frontal", "color": "#3b82f6",
          "description": "Every email that comes in or goes out.",
          "children": [                           // ← hot-spots inside the region
            { "id": "inbox", "title": "Shared inbox", "description": "Where customers write in.",
              "children": [                       // ← keep going as deep as you like
                { "id": "rfp", "title": "RFP invitations" }   // ← a leaf = one neuron
              ] }
          ]
        }
      ]
    }
  ]
}
```

- **depth 1 — lenses.** Two or more children on the root give you a toggle; one child hides it.
- **depth 2 — regions.** Get a card, a colour, and a lobe. `region` places it (`frontal · temporal · parietal · occipital · stem`); leave it off and it's placed automatically.
- **depth 3+ — hot-spots.** Cards swap to the children of whatever you clicked; the camera flies in. Children inherit the parent's colour as tints.
- **leaves — neurons.** A single dot. Click it and you get its description.

`value` is an optional headline figure per node — `"65K"`, `"38 people"`, `"$1.2M"`. Free text, so format it however you like. Without it the card shows how many children the node has.

### Adding a lens or a segment

Everything is the JSON — there is no admin UI, and no code to touch.

**A new lens** (a new toggle button next to "Data sources" / "Departments") is another child of the root:

```jsonc
{
  "version": 1, "title": "Acme",
  "children": [
    { "id": "sources",     "title": "Data sources", "children": [ /* … */ ] },
    { "id": "departments", "title": "Departments",  "children": [ /* … */ ] },
    { "id": "customers",   "title": "Customers",    "children": [ /* … */ ] }   // ← new lens
  ]
}
```

One lens = no toggle at all. Two or three read well; past four the pill gets crowded.

**A new segment** (a new region of the brain, with its own card) is another child of that lens:

```jsonc
{
  "id": "sources", "title": "Data sources",
  "children": [
    { "id": "emails", "title": "Emails", "description": "Every email in or out.", "region": "frontal", "color": "#3b82f6" },
    { "id": "crm",    "title": "CRM", "description": "Where the money data lives.", "region": "stem", "color": "#34d399" },
    { "id": "calls",  "title": "Call recordings", "description": "Recorded and transcribed." }   // ← new segment, auto-placed
  ]
}
```

`region` and `color` are both optional. Omit them and the segment takes the next free lobe and a colour from the default palette. Children of a segment inherit its colour as tints, so a whole subtree stays visually one family.

**How many segments fit:** 5–6 is the sweet spot (one per anatomical lobe: `frontal`, `temporal` ×2, `parietal`, `occipital`, `stem`). Up to 8 still reads cleanly.

| Siblings | What happens |
|---|---|
| 5–6 | Each takes its own lobe. Best case |
| 7–8 | Still clean |
| 9–12 | Extras land on a ring; the brain reads speckled rather than lobed |
| 13+ | Cards outgrow the viewport (the columns scroll, so nothing is unreachable) and the leader lines cross the brain. It works, it just isn't good |

Verified at 5, 8, 12 and 20. If you have more than 8, group them — 6 segments with the rest one level
down reads far better than 20 side by side.

**How deep can it go:** unlimited. Every level is the same component: cards swap to the children of
whatever you opened, and the camera flies into that node's own cluster of dots. Tested to 6 levels; the
only limit is siblings-per-node, not depth. A node with no children is a leaf — a single neuron with its
description.

Validate any file against [`brain.schema.json`](brain.schema.json).

## How it's drawn

~300 dots sampled on a procedural brain surface (no mesh file). Regions claim dots by nearest anatomical anchor; every deeper node splits its parent's dots with farthest-point seeding, so the hierarchy is literally spatial: a child's dots are a sub-cluster of its parent's. Colours crossfade on lens change; the camera pans toward whatever card you hover.

`src/lib/` is the package. `src/App.tsx` + `src/data/demo.json` are the demo (a fictional B2B software company).

Dev harnesses, `npm run dev` then:
- `/` — the demo
- `/embed.html` — the component inside a normal scrolling landing page
- `/stress.html` — lenses at 5 / 8 / 12 / 20 segments and 6 levels deep, to see where it gets crowded

## Roadmap

- Search (⌘K) across all nodes
- `href` on nodes → open a link on leaf click
- Theme tokens

MIT.
