import * as THREE from 'three'
import type { BrainNode, BrainRegion } from './schema'
import { DEFAULT_COLORS } from './schema'
import { assignRegions, resolveAnchors, type BrainCloud } from './brainShape'

export const SCALE = 2.3

/** Where a node lives in the brain: which geometry dots it owns, and their centroid. */
export interface Cluster {
  id: string
  node: BrainNode
  depth: number
  parent: string | null
  color: THREE.Color
  /** indices into cloud.nodes */
  dots: number[]
  centroid: THREE.Vector3
  extent: number
}

export type ClusterMap = Map<string, Cluster>

/** Bounding sphere of a set of dots, plus an evenly-spread sample of them for camera framing. */
export function boundsOf(cloud: BrainCloud, dots?: number[]) {
  const idx = dots ?? cloud.nodes.map((_, i) => i)
  const pts = idx.map((i) => pos(cloud, i))
  const box = new THREE.Box3().setFromPoints(pts)
  const center = box.getCenter(new THREE.Vector3())
  let radius = 0
  for (const p of pts) radius = Math.max(radius, p.distanceTo(center))
  const step = Math.max(1, Math.ceil(pts.length / 140))
  return { center, radius, sample: pts.filter((_, i) => i % step === 0) }
}

function pos(cloud: BrainCloud, i: number) {
  const n = cloud.nodes[i]
  return new THREE.Vector3(n.pos[0] * SCALE, n.pos[1] * SCALE, n.pos[2] * SCALE)
}

function centroidOf(cloud: BrainCloud, dots: number[], fallback: THREE.Vector3) {
  if (!dots.length) return { centroid: fallback.clone(), extent: 0.4 }
  const c = new THREE.Vector3()
  for (const i of dots) c.add(pos(cloud, i))
  c.divideScalar(dots.length)
  let extent = 0
  for (const i of dots) extent = Math.max(extent, pos(cloud, i).distanceTo(c))
  return { centroid: c, extent: Math.max(extent, 0.35) }
}

/** Children inherit the parent's hue at spread lightness so sub-clusters stay readable. */
function tint(base: THREE.Color, index: number, count: number) {
  const hsl = { h: 0, s: 0, l: 0 }
  base.getHSL(hsl)
  const spread = count <= 1 ? 0 : (index / (count - 1) - 0.5) * 0.36
  return new THREE.Color().setHSL((hsl.h + spread * 0.08 + 1) % 1, Math.min(1, hsl.s * 1.05), Math.min(0.85, Math.max(0.35, hsl.l + spread)))
}

/**
 * Split a set of dots among `children` using farthest-point seeds + nearest-seed assignment.
 * Deterministic, spread out, and cheap — the brain has ~300 dots, so this runs in microseconds.
 */
function split(cloud: BrainCloud, dots: number[], count: number, centroid: THREE.Vector3): number[][] {
  const groups: number[][] = Array.from({ length: count }, () => [])
  if (!dots.length || count === 0) return groups
  if (count === 1) { groups[0] = [...dots]; return groups }
  const seeds: number[] = []
  let first = dots[0], fd = -1
  for (const i of dots) { const d = pos(cloud, i).distanceTo(centroid); if (d > fd) { fd = d; first = i } }
  seeds.push(first)
  while (seeds.length < Math.min(count, dots.length)) {
    let best = dots[0], bd = -1
    for (const i of dots) {
      if (seeds.includes(i)) continue
      const dmin = Math.min(...seeds.map((s) => pos(cloud, s).distanceTo(pos(cloud, i))))
      if (dmin > bd) { bd = dmin; best = i }
    }
    seeds.push(best)
  }
  for (const i of dots) {
    let k = 0, bd = Infinity
    seeds.forEach((s, si) => { const d = pos(cloud, s).distanceTo(pos(cloud, i)); if (d < bd) { bd = d; k = si } })
    groups[k].push(i)
  }
  return groups
}

/** Build the full cluster map for one lens: regions by anatomy, everything below by recursive splitting. */
export function clusterLens(cloud: BrainCloud, lens: BrainNode, palette: string[] = DEFAULT_COLORS): ClusterMap {
  const map: ClusterMap = new Map()
  const regions = lens.children ?? []
  const specs = regions.map((r) => r.region as BrainRegion | undefined)
  const anchors = resolveAnchors(specs)
  const stemIndex = specs.findIndex((s) => s === 'stem')
  const assignment = assignRegions(cloud.nodes, anchors, stemIndex)

  const lensColor = new THREE.Color(lens.color ?? '#7dd3fc')
  map.set(lens.id, { id: lens.id, node: lens, depth: 1, parent: null, color: lensColor, dots: cloud.nodes.map((_, i) => i), centroid: new THREE.Vector3(), extent: 3 })

  const recurse = (node: BrainNode, dots: number[], depth: number, parent: string, color: THREE.Color, fallback: THREE.Vector3) => {
    const { centroid, extent } = centroidOf(cloud, dots, fallback)
    map.set(node.id, { id: node.id, node, depth, parent, color, dots, centroid, extent })
    const kids = node.children ?? []
    if (!kids.length) return
    const groups = split(cloud, dots, kids.length, centroid)
    kids.forEach((k, i) => {
      const c = k.color ? new THREE.Color(k.color) : tint(color, i, kids.length)
      recurse(k, groups[i], depth + 1, node.id, c, centroid)
    })
  }

  regions.forEach((r, ri) => {
    const dots = assignment.map((a, i) => (a === ri ? i : -1)).filter((i) => i >= 0)
    const color = new THREE.Color(r.color ?? palette[ri % palette.length])
    recurse(r, dots, 2, lens.id, color, new THREE.Vector3(...anchors[ri]).multiplyScalar(SCALE))
  })
  return map
}

/** For the node in focus: which child (index) owns each dot, or -1 outside its subtree. */
export function ownership(cloud: BrainCloud, map: ClusterMap, focusId: string): Int16Array {
  const owner = new Int16Array(cloud.nodes.length).fill(-1)
  const focus = map.get(focusId)
  if (!focus) return owner
  const kids = focus.node.children ?? []
  if (!kids.length) { for (const i of focus.dots) owner[i] = 0; return owner }
  kids.forEach((k, ki) => { const c = map.get(k.id); if (c) for (const i of c.dots) owner[i] = ki })
  return owner
}
