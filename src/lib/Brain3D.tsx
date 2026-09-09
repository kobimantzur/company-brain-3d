import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Brain } from './schema'
import { buildBrainCloud, type BrainCloud } from './brainShape'
import { boundsOf, clusterLens, ownership, SCALE, type Cluster, type ClusterMap } from './cluster'

const HOT = new THREE.Color('#ffffff')
const DIM = new THREE.Color('#1b3a5c')
/** Direction the camera sits in, relative to whatever it's looking at. Distance is computed from the geometry. */
const HOME_DIR = new THREE.Vector3(2.1, 1.7, 10.4).normalize()
const FOV = 42
const FLY_MS = 750
const BLEND_MS = 900

/** Soft radial sprite so each dot glows instead of rendering as a hard square. */
function makeGlowTexture(soft = false) {
  const size = soft ? 128 : 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  if (soft) { g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(0.75, 'rgba(255,255,255,0.08)') }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(0.6, 'rgba(255,255,255,0.15)') }
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- the wireframe: every dot coloured by which child of the focused node owns it ----------

function Cloud({ cloud, children, owner, blendFrom, blend, hovered, dimOutside, onHover, onClick }: {
  cloud: BrainCloud; children: Cluster[]; owner: Int16Array; blendFrom: React.MutableRefObject<Float32Array | null>; blend: React.MutableRefObject<number>
  hovered: number | null; dimOutside: boolean; onHover: (child: number | null) => void; onClick: (child: number) => void
}) {
  const texture = useMemo(() => makeGlowTexture(), [])
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const { positions, linePositions, colors, lineColors } = useMemo(() => {
    const positions = new Float32Array(cloud.nodes.length * 3)
    cloud.nodes.forEach((n, i) => positions.set([n.pos[0] * SCALE, n.pos[1] * SCALE, n.pos[2] * SCALE], i * 3))
    const linePositions = new Float32Array(cloud.edges.length * 6)
    cloud.edges.forEach(([a, b], i) => { linePositions.set(positions.subarray(a * 3, a * 3 + 3), i * 6); linePositions.set(positions.subarray(b * 3, b * 3 + 3), i * 6 + 3) })
    return { positions, linePositions, colors: new Float32Array(cloud.nodes.length * 3), lineColors: new Float32Array(cloud.edges.length * 6) }
  }, [cloud])
  useEffect(() => () => texture.dispose(), [texture])
  const tmp = useMemo(() => new THREE.Color(), [])
  const tmp2 = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const b = blend.current
    const ease = 1 - Math.pow(1 - b, 3)
    cloud.nodes.forEach((n, i) => {
      const o = owner[i]
      const twinkle = 0.5 + 0.5 * Math.max(0, Math.sin(t * 1.3 + n.phase)) ** 2
      if (o < 0) tmp.copy(DIM).multiplyScalar(dimOutside ? 0.35 : 0.8)
      else {
        const inHover = hovered === o
        const dim = hovered !== null && !inHover
        tmp.copy(children[o]?.color ?? DIM).lerp(HOT, inHover ? 0.25 + 0.25 * twinkle : twinkle * 0.18)
        if (dim) tmp.multiplyScalar(0.3)
      }
      if (blendFrom.current && b < 1) { tmp2.fromArray(blendFrom.current, i * 3); tmp.lerp(tmp2, 1 - ease) }
      tmp.toArray(colors, i * 3)
    })
    cloud.edges.forEach(([a, b2], i) => {
      const same = hovered !== null && owner[a] === hovered && owner[b2] === hovered
      const dim = hovered !== null && !same
      const k = same ? 1.2 : dim ? 0.25 : 0.7
      tmp.fromArray(colors, a * 3).multiplyScalar(k).toArray(lineColors, i * 6)
      tmp.fromArray(colors, b2 * 3).multiplyScalar(k).toArray(lineColors, i * 6 + 3)
    })
    const pc = pointsRef.current?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    const lc = linesRef.current?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (pc) pc.needsUpdate = true
    if (lc) lc.needsUpdate = true
  })

  return (
    <group>
      <lineSegments ref={linesRef} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <points ref={pointsRef}
        onPointerMove={(e) => { e.stopPropagation(); const o = e.index !== undefined ? owner[e.index] : -1; onHover(o >= 0 ? o : null) }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); const o = e.index !== undefined ? owner[e.index] : -1; if (o >= 0) onClick(o) }}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.34} map={texture} vertexColors transparent sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  )
}

// ---------- soft fill behind the hovered child ----------

function Glow({ children, hovered }: { children: Cluster[]; hovered: number | null }) {
  const texture = useMemo(() => makeGlowTexture(true), [])
  useEffect(() => () => texture.dispose(), [texture])
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(() => {
    children.forEach((c, i) => {
      const spr = refs.current[i]
      if (!spr) return
      const mat = spr.material as THREE.SpriteMaterial
      mat.opacity += ((hovered === i ? 0.3 : 0) - mat.opacity) * 0.15
      const s = spr.scale.x + (c.extent * 2.5 * (0.94 + mat.opacity * 0.14) - spr.scale.x) * 0.15
      spr.scale.set(s, s, 1)
    })
  })
  return (
    <group>
      {children.map((c, i) => (
        <sprite key={c.id} ref={(el) => { refs.current[i] = el }} position={c.centroid} scale={[c.extent * 2.5, c.extent * 2.5, 1]} renderOrder={-1}>
          <spriteMaterial map={texture} color={c.color} transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  )
}

// ---------- labels on the children of the focused node (depth ≥ 3) ----------

function Labels({ children, hovered, show }: { children: Cluster[]; hovered: number | null; show: boolean }) {
  if (!show) return null
  return (
    <>
      {children.map((c, i) => (
        <Html key={c.id} position={c.centroid} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`cb-marker${hovered === i ? ' is-hot' : ''}`} style={{ '--c': c.color.getStyle() } as React.CSSProperties}>
            <span>{c.node.title}</span>{c.node.value ?? c.node.children?.length ? <em>{c.node.value ?? c.node.children?.length}</em> : null}
          </div>
        </Html>
      ))}
    </>
  )
}

// ---------- camera ----------

/** Where the camera should sit: a point to look at, a direction to sit in, and how big the thing is. */
interface Framing { look: THREE.Vector3; dir: THREE.Vector3; radius: number; sample: THREE.Vector3[] }
interface Flight extends Framing { then: () => void }

/** flight = a discrete fly-to (click). peek = the child a hovered card points at — the camera turns to face it
 *  and dollies in slightly, then eases back. zoom = external multiplier on the resting distance. */
function CameraRig({ flight, home, zoom, peek, peekKey, autoRotate, scrollZoom }: { flight: Flight | null; home: Framing; zoom: number; peek: THREE.Vector3 | null; peekKey: string | null; autoRotate: boolean; scrollZoom: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, size } = useThree()
  // Solve the framing against what actually lands on screen: place the camera, project a sample of the
  // dots, then correct distance and look-at until the bounding box is centred and fills the canvas.
  // Doing it numerically means camera tilt, perspective and aspect are all handled without fudge factors.
  const { dist, look } = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height)
    const tanHalfV = Math.tan((FOV / 2) * Math.PI / 180)
    const FILL = 0.9
    const AZIMUTHS = 12
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 1000)
    // horizontal centre is rotation-invariant: the mean of the points on the XZ plane
    const look = home.look.clone()
    if (home.sample.length) {
      const mean = home.sample.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(home.sample.length)
      look.x = mean.x; look.z = mean.z
    }
    let dist = (home.radius / tanHalfV) * Math.max(1, 1 / aspect)
    const v = new THREE.Vector3()
    for (let pass = 0; pass < 5; pass++) {
      // check every azimuth the auto-rotate will pass through, and frame for the worst one
      let minY = Infinity, maxY = -Infinity, span = 0
      for (let a = 0; a < AZIMUTHS; a++) {
        const dir = home.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (a / AZIMUTHS) * Math.PI * 2)
        cam.position.copy(look).add(dir.multiplyScalar(dist))
        cam.lookAt(look)
        cam.updateMatrixWorld(true)
        cam.updateProjectionMatrix()
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
        for (const p of home.sample) {
          v.copy(p).project(cam)
          x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x)
          y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
        }
        if (!isFinite(x0)) continue
        minY = Math.min(minY, y0); maxY = Math.max(maxY, y1)
        span = Math.max(span, x1 - x0, y1 - y0)
      }
      if (!isFinite(minY)) break
      look.y += ((minY + maxY) / 2) * dist * tanHalfV
      if (span > 0.001) dist *= (span / 2) / FILL
    }
    return { dist, look }
  }, [home, size.width, size.height])
  const start = useRef<number | null>(null)
  const from = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const dolly = useRef<{ from: number; to: number; start: number; dir: THREE.Vector3 } | null>(null)
  const prevKey = useRef('')
  const peekTarget = useRef(home.look.clone())
  // peek pans only part-way toward the region so the whole brain stays in frame
  const peekDir = useRef<THREE.Vector3 | null>(null)
  useEffect(() => { peekTarget.current = peek ? home.look.clone().lerp(peek, 0.3) : home.look; peekDir.current = peek ? peek.clone() : null }, [peek, home])
  useEffect(() => {
    const key = `${zoom}|${peekKey ?? ''}|${look.toArray().map((n) => n.toFixed(2)).join(',')}|${dist.toFixed(2)}`
    if (key === prevKey.current) return
    prevKey.current = key
    const c = controls.current
    if (!c || flight) return
    const dir = camera.position.clone().sub(c.target).normalize()
    const current = camera.position.distanceTo(c.target)
    const target = (dist / zoom) * (peekKey ? 0.9 : 1)
    dolly.current = { from: current, to: target, start: performance.now(), dir }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, peekKey, look, dist])
  useFrame(({ camera, clock }) => {
    const c = controls.current
    if (!c) return
    if (flight) {
      dolly.current = null
      const now = clock.getElapsedTime() * 1000
      if (start.current === null) { start.current = now; from.current = { pos: camera.position.clone(), look: c.target.clone() } }
      const t = Math.min(1, (now - start.current) / FLY_MS)
      const ease = 1 - Math.pow(1 - t, 3)
      const dest = look.clone().add(flight.dir.clone().multiplyScalar(dist / zoom))
      camera.position.lerpVectors(from.current!.pos, dest, ease)
      c.target.lerpVectors(from.current!.look, look, ease)
      c.update()
      if (t >= 1) flight.then()
      return
    }
    start.current = null; from.current = null
    c.target.lerp(peekTarget.current, 0.07)
    if (dolly.current) {
      const d = dolly.current
      const t = Math.min(1, (performance.now() - d.start) / 500)
      const ease = 1 - Math.pow(1 - t, 3)
      camera.position.copy(c.target).add(d.dir.clone().multiplyScalar(d.from + (d.to - d.from) * ease))
      if (t >= 1) dolly.current = null
    }
    // orbit so the peeked region turns to face the camera — centres it without pushing the brain out of frame
    if (peekDir.current) {
      const off = camera.position.clone().sub(c.target)
      const sph = new THREE.Spherical().setFromVector3(off)
      const want = new THREE.Spherical().setFromVector3(peekDir.current)
      const dTheta = Math.atan2(Math.sin(want.theta - sph.theta), Math.cos(want.theta - sph.theta))
      sph.theta += dTheta * 0.06
      sph.phi += (THREE.MathUtils.clamp(want.phi, 0.7, 2.0) - sph.phi) * 0.06
      camera.position.copy(c.target).add(off.setFromSpherical(sph))
      if (dolly.current) dolly.current.dir = off.clone().normalize()
    }
    c.update()
  })
  // enableZoom off means the wheel is never captured, so the host page keeps scrolling normally
  return <OrbitControls ref={controls} enablePan={false} enableZoom={scrollZoom} enabled={!flight} autoRotate={autoRotate && !flight && !peekKey} autoRotateSpeed={0.4} minDistance={1.2} maxDistance={40} />
}

export interface Projection { [id: string]: { x: number; y: number; z: number } }

/** Projects child centroids to canvas pixels so the shell can draw leader lines to cards. */
function Projector({ children, onProjected }: { children: Cluster[]; onProjected?: (p: Projection) => void }) {
  const last = useRef(0)
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size, clock }) => {
    if (!onProjected) return
    const now = clock.getElapsedTime()
    if (now - last.current < 1 / 30) return
    last.current = now
    const out: Projection = {}
    for (const c of children) { v.copy(c.centroid).project(camera); out[c.id] = { x: (v.x + 1) / 2 * size.width, y: (1 - v.y) / 2 * size.height, z: v.z } }
    onProjected(out)
  })
  return null
}

function Blend({ blend, active, onDone }: { blend: React.MutableRefObject<number>; active: boolean; onDone: () => void }) {
  const start = useRef<number | null>(null)
  useFrame(({ clock }) => {
    if (!active) { start.current = null; blend.current = 1; return }
    const now = clock.getElapsedTime() * 1000
    if (start.current === null) start.current = now
    blend.current = Math.min(1, (now - start.current) / BLEND_MS)
    if (blend.current >= 1) onDone()
  })
  return null
}

// ---------- root ----------

export interface Brain3DProps {
  brain: Brain
  /** ids from the root: [lens, region?, sub?, …]. The last one is in focus; its children are what you see. */
  path: string[]
  onPathChange: (path: string[]) => void
  /** child id to light up from outside (card hover) */
  highlightId?: string | null
  /** child id the camera should turn toward. Usually the same as highlightId; on mobile it clears
   *  shortly after a swipe so the idle spin can resume while the card stays highlighted. */
  cameraTargetId?: string | null
  onHover?: (id: string | null) => void
  onProjected?: (p: Projection) => void
  zoom?: number
  autoRotate?: boolean
  scrollZoom?: boolean
  /** Any CSS colour, or 'transparent' to let the host page show through the canvas. */
  background?: string
  /** Colours handed to depth-2 nodes that don't set their own. */
  palette?: string[]
}

export function Brain3D({ brain, path, onPathChange, highlightId, cameraTargetId, onHover, onProjected, zoom = 1, autoRotate = true, scrollZoom = false, background = '#000000', palette }: Brain3DProps) {
  const lens = useMemo(() => brain.children.find((l) => l.id === path[0]) ?? brain.children[0], [brain, path])
  const cloud = useMemo(() => buildBrainCloud((lens.children ?? []).map((r) => r.region)), [lens])
  const clusters = useMemo<ClusterMap>(() => clusterLens(cloud, lens, palette), [cloud, lens, palette])
  const focusId = path[path.length - 1] ?? lens.id
  const focus = clusters.get(focusId) ?? clusters.get(lens.id)!
  const children = useMemo<Cluster[]>(() => (focus.node.children ?? []).map((k) => clusters.get(k.id)!).filter(Boolean), [focus, clusters])
  const owner = useMemo(() => ownership(cloud, clusters, focus.id), [cloud, clusters, focus])

  // colour crossfade when the lens (or focus) changes
  const blend = useRef(1)
  const blendFrom = useRef<Float32Array | null>(null)
  const [blending, setBlending] = useState(false)
  const lastKey = useRef(focus.id)
  const colorsRef = useRef<Float32Array | null>(null)
  useEffect(() => {
    if (lastKey.current === focus.id) return
    lastKey.current = focus.id
    if (colorsRef.current) { blendFrom.current = Float32Array.from(colorsRef.current); blend.current = 0; setBlending(true) }
  }, [focus.id])

  const [hovered, setHoveredRaw] = useState<number | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const clearTimer = useRef<number | null>(null)
  const dragging = useRef(false)
  const downAt = useRef<{ x: number; y: number } | null>(null)
  const lastMouse = useRef({ x: 0, y: 0 })
  const wasClick = () => { const d = downAt.current; return !d || Math.hypot(lastMouse.current.x - d.x, lastMouse.current.y - d.y) < 6 }
  function setHovered(i: number | null) {
    if (clearTimer.current) { window.clearTimeout(clearTimer.current); clearTimer.current = null }
    if (dragging.current) { setHoveredRaw(null); return }
    if (i === null) clearTimer.current = window.setTimeout(() => setHoveredRaw(null), 180)
    else setHoveredRaw(i)
  }
  useEffect(() => { onHover?.(hovered !== null ? children[hovered]?.id ?? null : null) }, [hovered, children, onHover])
  useEffect(() => { setHoveredRaw(null) }, [focus.id])

  // camera home for the current focus: the whole brain for a lens, the region's own sphere below that
  const bounds = useMemo(() => boundsOf(cloud), [cloud])
  const home = useMemo<Framing>(() => {
    if (focus.depth <= 1) return { look: bounds.center.clone(), dir: HOME_DIR.clone(), radius: bounds.radius, sample: bounds.sample }
    const b = boundsOf(cloud, focus.dots)
    const dir = b.center.clone().sub(bounds.center).normalize().lerp(HOME_DIR, 0.35).normalize()
    return { look: b.center.clone(), dir, radius: b.radius, sample: b.sample }
  }, [focus, bounds, cloud])
  const prevHome = useRef(home)
  useEffect(() => {
    if (prevHome.current === home) return
    prevHome.current = home
    setFlight({ ...home, then: () => setFlight(null) })
  }, [home])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && path.length > 1) onPathChange(path.slice(0, -1)) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [path, onPathChange])

  const highlightIndex = highlightId ? children.findIndex((c) => c.id === highlightId) : -1
  const hot = hovered !== null ? hovered : highlightIndex >= 0 ? highlightIndex : null
  // only a hovered *card* steers the camera; hovering the brain itself just lights the region (otherwise the camera chases the cursor)
  const camId = cameraTargetId === undefined ? highlightId : cameraTargetId
  const camIndex = camId ? children.findIndex((c) => c.id === camId) : -1
  const peek = camIndex >= 0 && hovered === null && focus.depth <= 1 ? children[camIndex] : null

  return (
    <div className="cb-brain"
      onPointerMove={(e) => { lastMouse.current = { x: e.clientX, y: e.clientY } }}
      onPointerDown={(e) => { dragging.current = true; downAt.current = { x: e.clientX, y: e.clientY }; lastMouse.current = { x: e.clientX, y: e.clientY }; setHoveredRaw(null) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerLeave={() => { dragging.current = false }}>
      <Canvas camera={{ position: HOME_DIR.clone().multiplyScalar(12).toArray(), fov: FOV }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]} raycaster={{ params: { Points: { threshold: 0.3 }, Line: { threshold: 0 }, Mesh: {}, LOD: {}, Sprite: {} } }} style={{ cursor: hot !== null ? 'pointer' : 'grab' }}>
        {background !== 'transparent' && <color attach="background" args={[background]} />}
        <Blend blend={blend} active={blending} onDone={() => setBlending(false)} />
        <Glow children={children} hovered={hot} />
        <Cloud cloud={cloud} children={children} owner={owner} blendFrom={blendFrom} blend={blend} hovered={hot} dimOutside={focus.depth > 1}
          onHover={setHovered} onClick={(i) => { if (wasClick()) onPathChange([...path, children[i].id]) }} />
        <ColorTap cloudRef={colorsRef} cloud={cloud} />
        <Labels children={children} hovered={hot} show={focus.depth >= 2} />
        <Projector children={children} onProjected={onProjected} />
        <CameraRig flight={flight} home={home} zoom={zoom} peek={peek?.centroid ?? null} peekKey={peek?.id ?? null} autoRotate={autoRotate && focus.depth <= 1} scrollZoom={scrollZoom} />
      </Canvas>
    </div>
  )
}

/** Keeps a copy of the last rendered dot colours so a focus change can crossfade from them. */
function ColorTap({ cloudRef, cloud }: { cloudRef: React.MutableRefObject<Float32Array | null>; cloud: BrainCloud }) {
  const { scene } = useThree()
  useFrame(() => {
    const pts = scene.getObjectByProperty('type', 'Points') as THREE.Points | undefined
    const attr = pts?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (attr && attr.count === cloud.nodes.length) cloudRef.current = attr.array as Float32Array
  })
  return null
}
