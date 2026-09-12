import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brain3D, type Projection } from './Brain3D'
import { assertBrain, resolve, DEFAULT_COLORS, type Brain, type BrainNode } from './schema'

export interface CompanyBrainProps {
  data: Brain
  /** Fired when a node is opened (clicked). Leaves fire too. */
  onSelect?: (node: BrainNode, path: string[]) => void
  /** Start on this lens id. Default: the first. */
  defaultLens?: string
  /** Camera distance multiplier. 1.3 = closer. */
  zoom?: number
  autoRotate?: boolean
  /** Let the mouse wheel / pinch dolly the camera. Off by default: when on, the canvas swallows
   *  wheel events and the host page stops scrolling under the cursor. */
  scrollZoom?: boolean
  /** Any CSS length, or 'auto' to size itself from its width so there's no dead space around the brain.
   *  Default '100%' — fills its container, so the container needs a height. */
  height?: string
  /** Default 1180px. 'none' lets the cards spread on very wide pages. */
  maxWidth?: string
  /** Any CSS colour behind the brain, or 'transparent' to show the host page through it. */
  background?: string
  /** Colours for top-level segments that don't set their own `color`. */
  palette?: string[]
  /** 'dark' (default) glows on black; 'light' is ink on paper, for light host pages. */
  theme?: 'dark' | 'light'
  className?: string
}

interface Card { id: string; title: string; description?: string; color: string; value: string | null }

function colorOf(brain: Brain, path: string[], node: BrainNode, index: number, palette: string[]) {
  if (node.color) return node.color
  for (let i = path.length; i > 0; i--) { const a = resolve(brain, path.slice(0, i)); if (a?.color) return a.color }
  return palette[index % palette.length]
}

/** Brain in the middle, one card per child of the focused node around it, leader lines into the brain.
 *  Click a card or a region → zoom in. Every level is the same component. */
export function CompanyBrain({ data, onSelect, defaultLens, zoom = 1, autoRotate = true, scrollZoom = false, height, maxWidth, background, palette = DEFAULT_COLORS, theme = 'dark', className }: CompanyBrainProps) {
  assertBrain(data)
  const [path, setPathRaw] = useState<string[]>(() => [defaultLens && data.children.some((l) => l.id === defaultLens) ? defaultLens : data.children[0].id])
  const [hoverCard, setHoverCard] = useState<string | null>(null)
  // the camera follows the strip while it's moving, then lets go so the idle spin resumes
  const [camTarget, setCamTarget] = useState<string | null>(null)
  const camRelease = useRef<number | null>(null)
  const [hoverRegion, setHoverRegion] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  // height="auto": the brain is ~1.5:1, so pick a height from the width instead of leaving slack above and below
  const [autoHeight, setAutoHeight] = useState<number | null>(null)
  useEffect(() => {
    if (height !== 'auto' || !wrap.current) return
    const el = wrap.current
    const measure = () => {
      const w = el.clientWidth
      const narrow = window.matchMedia('(max-width: 900px)').matches
      const stageW = narrow ? w : Math.max(320, w - 2 * Math.min(240, Math.max(200, w * 0.2)))
      const stage = Math.min(narrow ? 580 : 720, Math.max(340, stageW / (narrow ? 1.0 : 1.28)))
      const strip = narrow ? (stripRef.current?.offsetHeight ?? 120) : 0
      const bar = el.querySelector('.cb-topbar')?.getBoundingClientRect().height ?? 56
      setAutoHeight(Math.round(stage + strip + bar))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [height])
  const canvasWrap = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const stripRef = useRef<HTMLDivElement>(null)

  const setPath = useCallback((p: string[]) => {
    setPathRaw(p); setHoverCard(null); setHoverRegion(null); setCamTarget(null)
    const n = resolve(data, p)
    if (n && p.length > 1) onSelect?.(n, p)
  }, [data, onSelect])

  const lens = resolve(data, [path[0]]) ?? data.children[0]
  const focus = resolve(data, path) ?? lens
  const depth = path.length
  const cards = useMemo<Card[]>(() => (focus.children ?? []).map((n, i) => ({ id: n.id, title: n.title, description: n.description, color: colorOf(data, path, n, i, palette), value: n.value ?? (n.children?.length ? String(n.children.length) : null) })), [focus, data, path, palette])
  // mobile: one horizontal strip holds every card; desktop: alternate left / right
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => { const mq = window.matchMedia('(max-width: 900px)'); const f = () => setMobile(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])
  const left = mobile ? cards : cards.filter((_, i) => i % 2 === 0), right = mobile ? [] : cards.filter((_, i) => i % 2 === 1)
  const trail = path.map((_, i) => resolve(data, path.slice(0, i + 1))).filter((n): n is BrainNode => !!n)

  // leader lines: card edge → projected child centroid. The projector runs inside R3F's frame loop, so we
  // stash and poll on our own timer instead of setting state from there.
  const projection = useRef<Projection | null>(null)
  const onProjected = useCallback((p: Projection) => { projection.current = p }, [])
  const [lines, setLines] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number; color: string; hot: boolean; behind: boolean }[]>([])
  const frame = useRef({ cards, left, hoverCard, hoverRegion })
  frame.current = { cards, left, hoverCard, hoverRegion }
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = projection.current, w = wrap.current, cw = canvasWrap.current
      if (!p || !w || !cw) return
      const f = frame.current
      const wr = w.getBoundingClientRect(), cr = cw.getBoundingClientRect()
      const out: typeof lines = []
      for (const c of f.cards) {
        const el = cardRefs.current.get(c.id), pt = p[c.id]
        if (!el || !pt) continue
        const r = el.getBoundingClientRect()
        const isLeft = f.left.includes(c)
        const mobile = r.bottom < cr.top + 4
        out.push({ id: c.id, x1: mobile ? r.left + r.width / 2 - wr.left : (isLeft ? r.right : r.left) - wr.left, y1: mobile ? r.bottom - wr.top : r.top + r.height / 2 - wr.top, x2: cr.left - wr.left + pt.x, y2: cr.top - wr.top + pt.y, color: c.color, hot: f.hoverCard === c.id || f.hoverRegion === c.id, behind: pt.z > 0.9995 })
      }
      setLines(out)
    }, 33)
    return () => window.clearInterval(id)
  }, [])

  // mobile: the card strip scrolls horizontally; the chip nearest the centre is "hovered", which pans the brain
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    // synchronous on purpose: rAF is throttled in background tabs and this is six getBoundingClientRect calls
    const onScroll = () => {
      if (!window.matchMedia('(max-width: 900px)').matches) return
      const mid = strip.getBoundingClientRect().left + strip.clientWidth / 2
      let best: string | null = null, bd = Infinity
      for (const [id, el] of cardRefs.current) { const r = el.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = id } }
      setHoverCard(best)
      setCamTarget(best)
      if (camRelease.current) window.clearTimeout(camRelease.current)
      camRelease.current = window.setTimeout(() => setCamTarget(null), 1600)
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => { strip.removeEventListener('scroll', onScroll); if (camRelease.current) window.clearTimeout(camRelease.current) }
  }, [])

  const hot = hoverCard ?? hoverRegion
  const accent = cards[0]?.color ?? focus.color ?? '#7dd3fc'

  return (
    <div
      ref={wrap}
      data-theme={theme}
      className={`cb-root depth-${Math.min(depth, 3)}${hot ? ' has-hot' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...(background ? { ['--cb-bg' as string]: background === 'transparent' ? 'transparent' : background } : null), ...(height ? { ['--cb-height' as string]: height === 'auto' ? `${autoHeight ?? 520}px` : height, ['--cb-min-height' as string]: '0' } : null), ...(maxWidth ? { ['--cb-max-width' as string]: maxWidth } : null) } as React.CSSProperties}
    >
      <svg className="cb-lines" aria-hidden>
        {lines.map((l) => (
          <g key={l.id} style={{ color: l.color }} className={l.hot ? 'is-hot' : ''} opacity={l.hot ? 1 : hot ? 0.18 : l.behind ? 0.35 : 1}>
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            <circle cx={l.x1} cy={l.y1} r={3} />
            <circle cx={l.x2} cy={l.y2} r={l.hot ? 5 : 3.5} className="cb-dot" />
          </g>
        ))}
      </svg>

      <div className="cb-topbar">
        {depth === 1 && data.children.length > 1 && (
          <div className="cb-lens" role="tablist">
            {data.children.map((l) => <button key={l.id} role="tab" aria-selected={lens.id === l.id} className={lens.id === l.id ? 'is-on' : ''} onClick={() => setPath([l.id])}>{l.title}</button>)}
          </div>
        )}
        {depth > 1 && (
          <div className="cb-trail" style={{ '--c': accent } as React.CSSProperties}>
            <button onClick={() => setPath(path.slice(0, -1))} aria-label="Back">‹ Back</button>
            {trail.map((n, i) => (
              <span key={n.id} className="cb-crumb">
                {i > 0 && <i>›</i>}
                {i < trail.length - 1 ? <button onClick={() => setPath(path.slice(0, i + 1))}>{n.title}</button> : <strong>{n.title}</strong>}
              </span>
            ))}
          </div>
        )}
      </div>

      <div ref={stripRef} className="cb-col cb-col-left">
        {left.map((c) => <CardView key={c.id} card={c} side="left" hot={hot === c.id} refs={cardRefs} onHover={setHoverCard} onClick={() => setPath([...path, c.id])} />)}
      </div>

      <div ref={canvasWrap} className="cb-stage">
        {/* no explicit default here: Brain3D picks black for dark and transparent (the root's paper) for light */}
        <Brain3D brain={data} path={path} onPathChange={setPath} highlightId={hoverCard} cameraTargetId={mobile ? camTarget : hoverCard} onHover={setHoverRegion} onProjected={onProjected} zoom={zoom} autoRotate={autoRotate} scrollZoom={scrollZoom} background={background} palette={palette} theme={theme} />
        {depth > 1 && !cards.length && (
          <div className="cb-leaf" style={{ '--c': accent } as React.CSSProperties}>
            <strong>{focus.title}</strong>
            {focus.description && <p>{focus.description}</p>}
            <em>a single neuron · ‹ Back to go up</em>
          </div>
        )}
      </div>

      <div className="cb-col cb-col-right">
        {right.map((c) => <CardView key={c.id} card={c} side="right" hot={hot === c.id} refs={cardRefs} onHover={setHoverCard} onClick={() => setPath([...path, c.id])} />)}
      </div>
    </div>
  )
}

function CardView({ card, side, hot, refs, onHover, onClick }: { card: Card; side: 'left' | 'right'; hot: boolean; refs: React.MutableRefObject<Map<string, HTMLButtonElement>>; onHover: (id: string | null) => void; onClick: () => void }) {
  return (
    <button
      ref={(el) => { if (el) refs.current.set(card.id, el); else refs.current.delete(card.id) }}
      className={`cb-card side-${side}${hot ? ' is-hot' : ''}`}
      style={{ '--c': card.color } as React.CSSProperties}
      onMouseEnter={() => onHover(card.id)} onMouseLeave={() => onHover(null)} onClick={onClick}
    >
      <span className="cb-card-title"><strong>{card.title}</strong>{card.value && <em>{card.value}</em>}</span>
      {card.description && <span className="cb-card-desc">{card.description}</span>}
    </button>
  )
}
