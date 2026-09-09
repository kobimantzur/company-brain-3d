/**
 * Company Brain schema v1 — one recursive type.
 *
 * A brain is a tree. Every node has a title and a description. Nothing else is required.
 *   depth 0  root            the company
 *   depth 1  lenses          "Departments", "Data sources" — the toggle above the brain
 *   depth 2  regions         lobes of the brain, one card each
 *   depth 3+ sub-regions     hot-spots inside the parent; click to zoom deeper
 *   leaves   neurons         a single glowing dot
 */

export type BrainRegion = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'stem'

export interface BrainNode {
  id: string
  title: string
  description?: string
  /** A headline figure for the card — "65K", "38 people", "$1.2M". Free text: format it how you want.
   *  When unset the card falls back to showing how many children the node has. */
  value?: string
  /** Hex colour. Children inherit (as tints) when unset. */
  color?: string
  /** Placement hint for depth-2 nodes only. Unset = auto. */
  region?: BrainRegion
  children?: BrainNode[]
}

export interface Brain {
  version: 1
  title: string
  description?: string
  /** The lenses. One child = no toggle shown. */
  children: BrainNode[]
}

export function assertBrain(input: unknown): asserts input is Brain {
  const b = input as Brain
  if (!b || typeof b !== 'object') throw new Error('brain: not an object')
  if (b.version !== 1) throw new Error(`brain: unsupported version ${String(b.version)} (expected 1)`)
  if (!b.title) throw new Error('brain: title required')
  if (!Array.isArray(b.children) || b.children.length === 0) throw new Error('brain: children[] (lenses) required')
  const ids = new Set<string>()
  const walk = (n: BrainNode, path: string) => {
    if (!n.id || !n.title) throw new Error(`brain: node at ${path} needs id + title`)
    if (ids.has(n.id)) throw new Error(`brain: duplicate id "${n.id}"`)
    ids.add(n.id)
    n.children?.forEach((c, i) => walk(c, `${path}/${n.id}[${i}]`))
  }
  b.children.forEach((c, i) => walk(c, `root[${i}]`))
}

/** Follow a path of ids from the root. Returns the node at the end, or null. */
export function resolve(brain: Brain, path: string[]): BrainNode | null {
  let list: BrainNode[] | undefined = brain.children
  let node: BrainNode | null = null
  for (const id of path) {
    node = list?.find((n) => n.id === id) ?? null
    if (!node) return null
    list = node.children
  }
  return node
}

/** Every node with its depth and ancestry — handy for search and for the clusterer. */
export function flatten(brain: Brain): { node: BrainNode; depth: number; path: string[] }[] {
  const out: { node: BrainNode; depth: number; path: string[] }[] = []
  const walk = (n: BrainNode, depth: number, path: string[]) => {
    out.push({ node: n, depth, path })
    n.children?.forEach((c) => walk(c, depth + 1, [...path, c.id]))
  }
  brain.children.forEach((c) => walk(c, 1, [c.id]))
  return out
}

export const DEFAULT_COLORS = ['#3b82f6', '#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#818cf8']
