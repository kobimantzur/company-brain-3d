/**
 * Procedural wireframe brain: a point cloud sampled on a deformed ellipsoid
 * (cerebrum with a longitudinal fissure), a cerebellum and a brainstem,
 * joined by k-nearest-neighbour edges. No external mesh, no assets.
 *
 * Coordinate frame: +x = anterior (front), +y = superior (up), +z = right.
 */

export interface BrainNode {
  pos: [number, number, number]
  /** 'cerebrum' nodes get assigned to a domain; others stay ambient. */
  part: 'cerebrum' | 'cerebellum' | 'stem'
  domain: number | null
  phase: number
}

export interface BrainCloud {
  nodes: BrainNode[]
  /** Pairs of node indices. */
  edges: [number, number][]
  /** One anchor per domain, in brain space. */
  anchors: [number, number, number][]
}

export type Region = 'frontal' | 'temporal' | 'parietal' | 'occipital' | 'stem'

export const REGION_ANCHORS: Record<Region, [number, number, number]> = {
  frontal: [0.9, 0.3, 0],
  temporal: [0.15, -0.4, 0.85],
  parietal: [-0.3, 0.8, 0],
  occipital: [-1.0, 0.1, 0],
  stem: [-0.6, -0.75, 0],
}

/** Fallback spread for domains without an explicit region. */
const FALLBACK_ANCHORS: [number, number, number][] = [
  REGION_ANCHORS.frontal, REGION_ANCHORS.parietal, REGION_ANCHORS.occipital, REGION_ANCHORS.temporal,
  [0.15, -0.4, -0.85], [0.2, 0.85, 0],
]

function hash(n: number) {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

function fibonacciSphere(count: number, seed: number): [number, number, number][] {
  const out: [number, number, number][] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i + seed
    out.push([Math.cos(theta) * r, y, Math.sin(theta) * r])
  }
  return out
}

function cerebrumPoint([ux, uy, uz]: [number, number, number], i: number): [number, number, number] {
  // ellipsoid radii: long front-back, moderate height, wide
  let x = ux * 1.15
  let y = uy * 0.8
  let z = uz * 0.95
  // flatter underside, rounder top
  if (y < 0) y *= 0.72
  // frontal lobe tapers slightly, occipital pole squarer
  if (x > 0.5) y *= 1 - (x - 0.5) * 0.25
  // longitudinal fissure: dip along the top midline
  if (y > 0) y -= 0.16 * Math.exp(-(z * z) / 0.02) * (y / 0.8)
  // temporal lobes bulge out and down
  if (y < 0.05 && Math.abs(z) > 0.45 && x > -0.5) { z *= 1.08; y -= 0.06 }
  // gyri noise
  const n = (hash(i * 7.31) - 0.5) * 0.07
  return [x + n, y + n * 0.6, z + n]
}

function knnEdges(nodes: BrainNode[], k: number, maxLen: number): [number, number][] {
  const edges = new Set<string>()
  const out: [number, number][] = []
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].pos
    const near = nodes
      .map((n, j) => ({ j, d: j === i ? Infinity : Math.hypot(a[0] - n.pos[0], a[1] - n.pos[1], a[2] - n.pos[2]) }))
      .filter((n) => n.d < maxLen)
      .sort((p, q) => p.d - q.d)
      .slice(0, k)
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (!edges.has(key)) { edges.add(key); out.push([i, j]) }
    }
  }
  return out
}

export type RegionSpec = Region | [number, number, number] | undefined

/** Resolve region names / explicit anchors to anchor positions; duplicates of 'temporal' go to the other side. */
export function resolveAnchors(regions: RegionSpec[]): [number, number, number][] {
  const used = new Set<string>()
  const free = [...FALLBACK_ANCHORS]
  const out: [number, number, number][] = []
  let temporalSeen = 0
  for (const r of regions) {
    let a: [number, number, number] | undefined
    if (Array.isArray(r)) a = r
    else if (r === 'temporal') { a = temporalSeen === 0 ? REGION_ANCHORS.temporal : [0.15, -0.4, -0.85]; temporalSeen++ }
    else if (r) a = REGION_ANCHORS[r]
    if (a && used.has(JSON.stringify(a))) a = undefined
    if (!a) {
      const f = free.find((x) => !used.has(JSON.stringify(x)))
      a = f ?? [Math.cos((out.length / regions.length) * Math.PI * 2), 0.3, Math.sin((out.length / regions.length) * Math.PI * 2) * 0.9]
    }
    used.add(JSON.stringify(a))
    out.push(a)
  }
  return out
}

/** Assign every node to the nearest anchor. Stem/cerebellum nodes go to `stemIndex` when given. */
export function assignRegions(nodes: BrainNode[], anchors: [number, number, number][], stemIndex: number): (number | null)[] {
  // mirror the temporal anchor across the midline only when there is a single side-anchor
  const sideAnchors = anchors.filter((a) => Math.abs(a[2]) > 0.5).length
  return nodes.map((n) => {
    if (n.part !== 'cerebrum') return stemIndex >= 0 ? stemIndex : null
    let best = 0, bd = Infinity
    anchors.forEach((a, d) => {
      if (d === stemIndex) return
      const dz = sideAnchors === 1 && Math.abs(a[2]) > 0.5 ? Math.min(Math.abs(n.pos[2] - a[2]), Math.abs(n.pos[2] + a[2])) : Math.abs(n.pos[2] - a[2])
      const dd = Math.hypot(n.pos[0] - a[0], n.pos[1] - a[1], dz)
      if (dd < bd) { bd = dd; best = d }
    })
    return best
  })
}

export function buildBrainCloud(regions: RegionSpec[], density = 1): BrainCloud {
  const nodes: BrainNode[] = []

  for (const [i, u] of fibonacciSphere(Math.round(230 * density), 0.3).entries()) {
    nodes.push({ pos: cerebrumPoint(u, i), part: 'cerebrum', domain: null, phase: hash(i * 3.7) * Math.PI * 2 })
  }
  for (const [i, u] of fibonacciSphere(Math.round(42 * density), 1.7).entries()) {
    const n = (hash(i * 5.1) - 0.5) * 0.04
    nodes.push({ pos: [-0.78 + u[0] * 0.42 + n, -0.5 + u[1] * 0.28 + n, u[2] * 0.52 + n], part: 'cerebellum', domain: null, phase: hash(i * 9.1) * Math.PI * 2 })
  }
  for (let i = 0; i < 14; i++) {
    const t = i / 13
    const ang = hash(i * 2.3) * Math.PI * 2
    nodes.push({ pos: [-0.3 - t * 0.25 + Math.cos(ang) * 0.11, -0.45 - t * 0.7, Math.sin(ang) * 0.11], part: 'stem', domain: null, phase: hash(i * 4.4) * Math.PI * 2 })
  }

  const anchors = resolveAnchors(regions)
  const stemIndex = regions.findIndex((r) => r === 'stem')
  const assigned = assignRegions(nodes, anchors, stemIndex)
  nodes.forEach((n, i) => { n.domain = assigned[i] })

  const edges = knnEdges(nodes, 3, 0.55)
  return { nodes, edges, anchors }
}
