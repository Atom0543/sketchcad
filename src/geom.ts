// Shapes and pure geometry. No DOM here, so io.ts / pdf.ts can share it.
export type Pt = { x: number; y: number }
/** Points a dimension can be pinned to: a/b line ends, c circle centre, r rectangle corner i, p vertex i. */
export type Ref = { id: string; k: 'a' | 'b' | 'c' | 'r' | 'p'; i?: number }
type B = { id?: string; tag?: string; g?: number; fill?: string; fo?: boolean } // tag = layer id, g = group id, fill = CSS colour (closed shapes), fo = fill-only region from the paint bucket (no outline)
export type Rect = { t: 'rect'; x: number; y: number; w: number; h: number; r: number; sheet?: boolean } & B // sheet = material sheet frame (never exported)
export type Dim = { t: 'dim'; a: Pt; b: Pt; off: number; size: number; kind?: 'len' | 'diam' | 'rad'; color?: string; ra?: Ref; rb?: Ref; cid?: string; dir?: number; drv?: boolean; val?: number } & B // pinned to geometry when ra/rb/cid are set; drv = locked to val
export type Poly = { t: 'poly'; c: Pt; n: number; ap: number; rot: number } & B // ap = apothem (centre to flat)
export type Txt = { t: 'text'; p: Pt; s: string; size: number; tip?: Pt; color?: string } & B
export type Pl = { t: 'pl'; pts: Pt[]; closed: boolean } & B // imported / converted polyline
export type Guide = { t: 'guide'; p: Pt; d: Pt } & B // infinite construction line, never exported
export type Img = { t: 'image'; x: number; y: number; w: number; h: number; img: string; op: number } & B // trace underlay
export type Line = { t: 'line'; a: Pt; b: Pt } & B
export type Circle = { t: 'circle'; c: Pt; r: number } & B
export type Arc = { t: 'arc'; c: Pt; r: number; a0: number; a1: number } & B // counter-clockwise from a0 to a1 (radians)
export type Inst = { t: 'inst'; def: string; x: number; y: number; rot?: number; sc?: number; mir?: boolean } & B // mir = mirrored left-right (applied first) // placed copy of a component definition
/** Pen-tool path. hi / ho are handle offsets from the anchor (absent = corner). sm = handles stay in line when edited. */
export type BNode = { p: Pt; hi?: Pt; ho?: Pt; sm?: boolean }
export type Bz = { t: 'bz'; nodes: BNode[]; closed: boolean } & B
export type Shape = Line | Rect | Circle | Arc | Dim | Poly | Txt | Pl | Guide | Img | Inst | Bz

/** Underlay bitmaps live here (id -> data URL) so undo snapshots stay small. */
export const images: Record<string, string> = {}
/** Component definitions (shapes relative to their own origin) and layers ("tags"). Saved with the project. */
export const defs: Record<string, { name: string; shapes: Shape[] }> = {}
export type Tag = { id: string; name: string; color: number; visible: boolean; locked: boolean } // color = ACI index, 0 = automatic
export const tags: Tag[] = [{ id: '0', name: 'Untagged', color: 0, visible: true, locked: false }]
export const tagOf = (s: Shape) => tags.find((t) => t.id === (s.tag ?? '0')) ?? tags[0]
export const isVisible = (s: Shape) => tagOf(s).visible
export const isLocked = (s: Shape) => tagOf(s).locked
/** Text width measurer; main.ts swaps in a canvas-based one. */
export const env = { textW: (s: Txt) => s.s.length * s.size * 0.6 }

export const TAU = Math.PI * 2
export const normA = (a: number) => { const m = a % TAU; return m < 0 ? m + TAU : m }
export const sweepOf = (s: Arc) => { const d = normA(s.a1 - s.a0); return d < 1e-9 ? TAU : d }
export const arcAt = (s: Arc, t: number): Pt => { const a = s.a0 + sweepOf(s) * t; return { x: s.c.x + s.r * Math.cos(a), y: s.c.y + s.r * Math.sin(a) } }
export const inArc = (s: Arc, a: number) => normA(a - s.a0) <= sweepOf(s) + 1e-9
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const deg = (a: number) => (a * 180) / Math.PI

export function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}
export function nearestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return { x: a.x + t * dx, y: a.y + t * dy }
}
export function rectEdges(s: Rect): [Pt, Pt][] {
  const p = [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }]
  return p.map((q, i) => [q, p[(i + 1) % 4]])
}
export function polyVerts(s: Poly): Pt[] {
  const R = s.ap / Math.cos(Math.PI / s.n)
  return Array.from({ length: s.n }, (_, k) => {
    const a = s.rot + (2 * Math.PI * k) / s.n
    return { x: s.c.x + R * Math.cos(a), y: s.c.y + R * Math.sin(a) }
  })
}
export const polyEdges = (s: Poly): [Pt, Pt][] => { const v = polyVerts(s); return v.map((p, i) => [p, v[(i + 1) % v.length]]) }
/** Arc through three points p0 -> pm -> p2 (pm lies on the arc). */
export function arcFrom3(p0: Pt, pm: Pt, p2: Pt): Arc | null {
  const d = 2 * (p0.x * (pm.y - p2.y) + pm.x * (p2.y - p0.y) + p2.x * (p0.y - pm.y))
  if (Math.abs(d) < 1e-9) return null
  const q0 = p0.x * p0.x + p0.y * p0.y, q1 = pm.x * pm.x + pm.y * pm.y, q2 = p2.x * p2.x + p2.y * p2.y
  const c = { x: (q0 * (pm.y - p2.y) + q1 * (p2.y - p0.y) + q2 * (p0.y - pm.y)) / d, y: (q0 * (p2.x - pm.x) + q1 * (p0.x - p2.x) + q2 * (pm.x - p0.x)) / d }
  const A = (p: Pt) => Math.atan2(p.y - c.y, p.x - c.x)
  const a0 = A(p0), am = A(pm), a2 = A(p2)
  const ccw = normA(am - a0) <= normA(a2 - a0)
  return { t: 'arc', c, r: dist(c, p0), a0: ccw ? a0 : a2, a1: ccw ? a2 : a0 }
}
/** Arc from chord a-b with signed rise h (positive = left of a->b). */
export function arcFromBulge(a: Pt, b: Pt, h: number): Arc | null {
  const L = dist(a, b)
  if (L < 1e-9 || Math.abs(h) < 1e-9) return null
  const m = mid(a, b), n = { x: -(b.y - a.y) / L, y: (b.x - a.x) / L }
  return arcFrom3(a, { x: m.x + n.x * h, y: m.y + n.y * h }, b)
}
// ---- bezier paths ----
export type Cubic = [Pt, Pt, Pt, Pt]
export function bzSegs(s: Bz): Cubic[] {
  const n = s.nodes, out: Cubic[] = []
  const last = s.closed ? n.length : n.length - 1
  for (let i = 0; i < last; i++) {
    const a = n[i], b = n[(i + 1) % n.length]
    out.push([a.p, { x: a.p.x + (a.ho?.x ?? 0), y: a.p.y + (a.ho?.y ?? 0) }, { x: b.p.x + (b.hi?.x ?? 0), y: b.p.y + (b.hi?.y ?? 0) }, b.p])
  }
  return out
}
export function cubicAt(c: Cubic, t: number): Pt {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y }
}
const flatCache = new WeakMap<Bz, Pt[]>()
/** Polyline approximation of the curve (cached per shape object; edits create new objects). */
export function bzFlatten(s: Bz): Pt[] {
  const hit = flatCache.get(s)
  if (hit) return hit
  const pts: Pt[] = s.nodes.length ? [s.nodes[0].p] : []
  for (const c of bzSegs(s)) {
    const straight = c[1] === c[0] || (c[1].x === c[0].x && c[1].y === c[0].y && c[2].x === c[3].x && c[2].y === c[3].y)
    const n = straight ? 1 : Math.min(64, Math.max(12, Math.ceil(dist(c[0], c[3]) / 2)))
    for (let i = 1; i <= n; i++) pts.push(i === n ? c[3] : cubicAt(c, i / n))
  }
  if (s.closed && pts.length > 1) pts.pop() // last point repeats the first
  flatCache.set(s, pts)
  return pts
}
export function bzEdges(s: Bz): [Pt, Pt][] {
  const p = bzFlatten(s), e: [Pt, Pt][] = []
  for (let i = 0; i + 1 < p.length; i++) e.push([p[i], p[i + 1]])
  if (s.closed && p.length > 2) e.push([p[p.length - 1], p[0]])
  return e
}
export function splitCubic(c: Cubic, t: number): [Cubic, Cubic] {
  const L = (a: Pt, b: Pt): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  const ab = L(c[0], c[1]), bc = L(c[1], c[2]), cd = L(c[2], c[3]), abc = L(ab, bc), bcd = L(bc, cd), m = L(abc, bcd)
  return [[c[0], ab, abc, m], [m, bcd, cd, c[3]]]
}
/** Closest point on the curve: which segment and where along it. */
export function nearestOnBz(s: Bz, p: Pt): { seg: number; t: number; d: number; at: Pt } | null {
  let best: { seg: number; t: number; d: number; at: Pt } | null = null
  bzSegs(s).forEach((c, seg) => {
    for (let i = 0; i <= 64; i++) {
      const at = cubicAt(c, i / 64), d = dist(at, p)
      if (!best || d < best.d) best = { seg, t: i / 64, d, at }
    }
  })
  return best
}
/** Insert an anchor on segment `seg` at parameter t without changing the curve's shape. */
export function insertNode(s: Bz, seg: number, t: number): Bz {
  const c = bzSegs(s)[seg], [l, r] = splitCubic(c, t)
  const nodes = s.nodes.map((n) => ({ ...n }))
  const a = nodes[seg], b = nodes[(seg + 1) % nodes.length]
  a.ho = { x: l[1].x - a.p.x, y: l[1].y - a.p.y }
  b.hi = { x: r[2].x - b.p.x, y: r[2].y - b.p.y }
  const m: BNode = { p: l[3], hi: { x: l[2].x - l[3].x, y: l[2].y - l[3].y }, ho: { x: r[1].x - l[3].x, y: r[1].y - l[3].y }, sm: true }
  if (!m.hi?.x && !m.hi?.y && !m.ho?.x && !m.ho?.y) { // on a straight segment: give the new point handles along the line so it can be turned
    const L = dist(c[0], c[3]) || 1, u = { x: (c[3].x - c[0].x) / L, y: (c[3].y - c[0].y) / L }, h = L / 5
    m.hi = { x: -u.x * h, y: -u.y * h }; m.ho = { x: u.x * h, y: u.y * h }
  }
  nodes.splice(seg + 1, 0, m)
  return { ...s, nodes }
}
/** Turn a corner into a smooth point (handles along the neighbours' direction) or back. */
export function toggleSmooth(s: Bz, i: number): Bz {
  const nodes = s.nodes.map((n) => ({ ...n })), n = nodes[i]
  if (n.hi || n.ho) { delete n.hi; delete n.ho; n.sm = false; return { ...s, nodes } }
  const N = nodes.length
  const prev = nodes[i - 1] ?? (s.closed ? nodes[N - 1] : undefined), next = nodes[i + 1] ?? (s.closed ? nodes[0] : undefined)
  const a = prev?.p ?? n.p, b = next?.p ?? n.p
  const L = dist(a, b) || 1, t = { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
  const lp = prev ? dist(prev.p, n.p) / 3 : 0, ln = next ? dist(next.p, n.p) / 3 : 0
  n.hi = { x: -t.x * lp, y: -t.y * lp }; n.ho = { x: t.x * ln, y: t.y * ln }; n.sm = true
  return { ...s, nodes }
}
/** Editable path version of a basic shape (so it can be reshaped and filled), or null if it has no path form. */
export function toBz(s: Shape): Bz | null {
  const base = { tag: s.tag, g: s.g, fill: s.fill }
  const corner = (p: Pt): BNode => ({ p })
  if (s.t === 'bz') return s
  if (s.t === 'line') return { t: 'bz', nodes: [corner(s.a), corner(s.b)], closed: false, ...base }
  if (s.t === 'poly') return { t: 'bz', nodes: polyVerts(s).map(corner), closed: true, ...base }
  if (s.t === 'pl') return { t: 'bz', nodes: s.pts.map(corner), closed: s.closed, ...base }
  if (s.t === 'circle') {
    const { c, r } = s, k = 0.5522847498 * r
    const at = (x: number, y: number, hi: Pt, ho: Pt): BNode => ({ p: { x: c.x + x, y: c.y + y }, hi, ho, sm: true })
    return { t: 'bz', closed: true, ...base, nodes: [
      at(r, 0, { x: 0, y: -k }, { x: 0, y: k }), at(0, r, { x: k, y: 0 }, { x: -k, y: 0 }),
      at(-r, 0, { x: 0, y: k }, { x: 0, y: -k }), at(0, -r, { x: -k, y: 0 }, { x: k, y: 0 }),
    ] }
  }
  if (s.t === 'arc') {
    const sw = sweepOf(s), n = Math.max(1, Math.ceil(sw / (Math.PI / 2))), th = sw / n, h = (4 / 3) * Math.tan(th / 4) * s.r
    const nodes: BNode[] = Array.from({ length: n + 1 }, (_, i) => {
      const a = s.a0 + th * i, tx = -Math.sin(a), ty = Math.cos(a)
      return { p: { x: s.c.x + s.r * Math.cos(a), y: s.c.y + s.r * Math.sin(a) }, hi: i ? { x: -tx * h, y: -ty * h } : undefined, ho: i < n ? { x: tx * h, y: ty * h } : undefined, sm: true }
    })
    return { t: 'bz', nodes, closed: false, ...base }
  }
  if (s.t === 'rect') {
    const { x, y, w, h, r } = s
    if (!(r > 0)) return { t: 'bz', nodes: [corner({ x, y }), corner({ x: x + w, y }), corner({ x: x + w, y: y + h }), corner({ x, y: y + h })], closed: true, ...base }
    const k = 0.5522847498 * r, P = (px: number, py: number, hi?: Pt, ho?: Pt): BNode => ({ p: { x: px, y: py }, hi, ho })
    return { t: 'bz', closed: true, ...base, nodes: [
      P(x + r, y, { x: -k, y: 0 }), P(x + w - r, y, undefined, { x: k, y: 0 }), P(x + w, y + r, { x: 0, y: -k }),
      P(x + w, y + h - r, undefined, { x: 0, y: k }), P(x + w - r, y + h, { x: k, y: 0 }),
      P(x + r, y + h, undefined, { x: -k, y: 0 }), P(x, y + h - r, { x: 0, y: k }), P(x, y + r, undefined, { x: 0, y: -k }),
    ] }
  }
  return null
}
/** Freehand stroke -> smooth path: drop wobble (Douglas-Peucker), then Catmull-Rom handles through what is left. */
export function fitFree(raw: Pt[], tol: number, closeTol: number): { nodes: BNode[]; closed: boolean } {
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts
    const a = pts[0], b = pts[pts.length - 1]
    let idx = 0, dmax = 0
    for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], a, b); if (d > dmax) { dmax = d; idx = i } }
    return dmax > tol ? [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))] : [a, b]
  }
  let p = rdp(raw)
  const closed = p.length > 3 && dist(p[0], p[p.length - 1]) < closeTol
  if (closed) p = p.slice(0, -1)
  const n = p.length
  const nodes = p.map((q, i): BNode => {
    const prev = p[i - 1] ?? (closed ? p[n - 1] : undefined), next = p[i + 1] ?? (closed ? p[0] : undefined)
    if (!prev || !next) {
      const o = (next ?? prev)!, v = { x: (o.x - q.x) / 3, y: (o.y - q.y) / 3 }
      return next ? { p: q, ho: v } : { p: q, hi: v }
    }
    const t = { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 }
    return { p: q, hi: { x: -t.x, y: -t.y }, ho: t, sm: true }
  })
  return { nodes, closed }
}
/** Is p inside this closed shape? (used so a filled shape can be picked by clicking its body) */
export function pointInside(s: Shape, p: Pt): boolean {
  if (s.t === 'rect') return p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h
  if (s.t === 'circle') return dist(p, s.c) < s.r
  const v = s.t === 'poly' ? polyVerts(s) : s.t === 'pl' && s.closed ? s.pts : s.t === 'bz' && s.closed ? bzFlatten(s) : null
  if (!v) return false
  let inside = false
  for (let i = 0, j = v.length - 1; i < v.length; j = i++)
    if (v[i].y > p.y !== v[j].y > p.y && p.x < ((v[j].x - v[i].x) * (p.y - v[i].y)) / (v[j].y - v[i].y) + v[i].x) inside = !inside
  return inside
}
export function plEdges(s: Pl): [Pt, Pt][] {
  const e: [Pt, Pt][] = []
  for (let i = 0; i + 1 < s.pts.length; i++) e.push([s.pts[i], s.pts[i + 1]])
  if (s.closed && s.pts.length > 2) e.push([s.pts[s.pts.length - 1], s.pts[0]])
  return e
}
export function leaderLines(s: Txt): [Pt, Pt][] {
  if (!s.tip) return []
  const w = env.textW(s), y = s.p.y + s.size * 0.35
  const at = s.tip.x > s.p.x + w / 2 ? { x: s.p.x + w + s.size * 0.3, y } : { x: s.p.x - s.size * 0.3, y }
  const a = Math.atan2(at.y - s.tip.y, at.x - s.tip.x)
  const wing = (d: number): [Pt, Pt] => [s.tip!, { x: s.tip!.x + 2.5 * Math.cos(a + d), y: s.tip!.y + 2.5 * Math.sin(a + d) }]
  return [[s.tip, at], wing(0.35), wing(-0.35)]
}
export const dimText = (s: Dim, label: (mm: number) => string) => (s.kind === 'diam' ? '\u00d8' : s.kind === 'rad' ? 'R' : '') + label(dimGeom(s).len)
export function dimGeom(s: Dim) {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy) || 1
  const u = { x: dx / L, y: dy / L }, n = { x: -u.y, y: u.x }
  const p1 = { x: s.a.x + n.x * s.off, y: s.a.y + n.y * s.off }
  const p2 = { x: s.b.x + n.x * s.off, y: s.b.y + n.y * s.off }
  const e = Math.sign(s.off || 1) * 2 // extension overshoot
  const ex = (p: Pt, q: Pt): [Pt, Pt] => [p, { x: q.x + n.x * e, y: q.y + n.y * e }]
  const tk = (p: Pt): [Pt, Pt] => {
    const t = { x: (u.x + n.x) * 1.25, y: (u.y + n.y) * 1.25 }
    return [{ x: p.x - t.x, y: p.y - t.y }, { x: p.x + t.x, y: p.y + t.y }]
  }
  let ang = Math.atan2(dy, dx)
  if (Math.cos(ang) < -1e-9) ang += Math.PI // keep text readable
  return { p1, p2, lines: [[p1, p2], ex(s.a, p1), ex(s.b, p2), tk(p1), tk(p2)] as [Pt, Pt][], mid: mid(p1, p2), ang, len: L }
}
const rotP = (p: Pt, c: Pt, a: number): Pt => { const dx = p.x - c.x, dy = p.y - c.y, co = Math.cos(a), si = Math.sin(a); return { x: c.x + dx * co - dy * si, y: c.y + dx * si + dy * co } }
const scaP = (p: Pt, c: Pt, k: number): Pt => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k })
/** Closed polyline for a rectangle (rounded corners sampled) so it can be turned freely. */
export function rectToPl(s: Rect): Pl {
  const { x, y, w, h, r } = s
  const pts: Pt[] = []
  if (r > 0) {
    for (const [cx, cy, a0] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]] as [number, number, number][])
      for (let i = 0; i <= 6; i++) pts.push({ x: cx + r * Math.cos(a0 + (i * Math.PI) / 12), y: cy + r * Math.sin(a0 + (i * Math.PI) / 12) })
  } else pts.push({ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h })
  return { t: 'pl', pts, closed: true, tag: s.tag, g: s.g }
}
export function rotateShape(s: Shape, c: Pt, a: number): Shape {
  if (!a) return s
  const R = (p: Pt) => rotP(p, c, a)
  if (s.t === 'line' || s.t === 'dim') return { ...s, a: R(s.a), b: R(s.b) }
  if (s.t === 'circle') return { ...s, c: R(s.c) }
  if (s.t === 'arc') return { ...s, c: R(s.c), a0: s.a0 + a, a1: s.a1 + a }
  if (s.t === 'poly') return { ...s, c: R(s.c), rot: s.rot + a }
  if (s.t === 'text') return { ...s, p: R(s.p), tip: s.tip && R(s.tip) }
  if (s.t === 'pl') return { ...s, pts: s.pts.map(R) }
  if (s.t === 'bz') return { ...s, nodes: s.nodes.map((n) => ({ ...n, p: R(n.p), hi: n.hi && rotP(n.hi, { x: 0, y: 0 }, a), ho: n.ho && rotP(n.ho, { x: 0, y: 0 }, a) })) }
  if (s.t === 'guide') return { ...s, p: R(s.p), d: rotP(s.d, { x: 0, y: 0 }, a) }
  if (s.t === 'inst') { const o = R({ x: s.x, y: s.y }); return { ...s, x: o.x, y: o.y, rot: (s.rot ?? 0) + a } }
  if (s.t === 'rect') {
    const q = a / (Math.PI / 2)
    if (Math.abs(q - Math.round(q)) < 1e-9) { // quarter turns keep it a true rectangle
      const p1 = R({ x: s.x, y: s.y }), p2 = R({ x: s.x + s.w, y: s.y + s.h })
      return { ...s, x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) }
    }
    return rotateShape(rectToPl(s), c, a)
  }
  return s // images stay put
}
/** Mirror a shape across the vertical line x = c ('h', flips left-right) or the horizontal line y = c ('v', flips top-bottom). */
export function flipShape(s: Shape, axis: 'h' | 'v', c: number): Shape {
  const h = axis === 'h'
  const P = (p: Pt): Pt => (h ? { x: 2 * c - p.x, y: p.y } : { x: p.x, y: 2 * c - p.y })
  const V = (p: Pt): Pt => (h ? { x: -p.x, y: p.y } : { x: p.x, y: -p.y }) // vectors (handle offsets, directions)
  if (s.t === 'line') return { ...s, a: P(s.a), b: P(s.b) }
  if (s.t === 'dim') return { ...s, a: P(s.a), b: P(s.b), off: -s.off }
  if (s.t === 'circle') return { ...s, c: P(s.c) }
  if (s.t === 'arc') return { ...s, c: P(s.c), a0: (h ? Math.PI : 0) - s.a1, a1: (h ? Math.PI : 0) - s.a0 } // reflection reverses the sweep
  if (s.t === 'poly') return { ...s, c: P(s.c), rot: (h ? Math.PI : 0) - s.rot }
  if (s.t === 'pl') return { ...s, pts: s.pts.map(P) }
  if (s.t === 'bz') return { ...s, nodes: s.nodes.map((n) => ({ ...n, p: P(n.p), hi: n.hi && V(n.hi), ho: n.ho && V(n.ho) })) }
  if (s.t === 'guide') return { ...s, p: P(s.p), d: V(s.d) }
  if (s.t === 'rect') return h ? { ...s, x: 2 * c - s.x - s.w } : { ...s, y: 2 * c - s.y - s.h }
  if (s.t === 'text') { // keep the letters readable: mirror where the text sits, not the glyphs
    const w = env.textW(s)
    const p = h ? { x: 2 * c - s.p.x - w, y: s.p.y } : { x: s.p.x, y: 2 * c - s.p.y - s.size }
    return { ...s, p, tip: s.tip && P(s.tip) }
  }
  if (s.t === 'inst') { const o = P({ x: s.x, y: s.y }); return { ...s, x: o.x, y: o.y, rot: (h ? 0 : Math.PI) - (s.rot ?? 0), mir: !s.mir } }
  return s // underlay images are left alone
}
/** Mirror across the line through P at angle a (radians): turn the line flat, flip, turn back. */
export function reflectShape(s: Shape, P: Pt, a: number): Shape { return rotateShape(flipShape(rotateShape(s, P, -a), 'v', P.y), P, a) }
export function scaleShape(s: Shape, c: Pt, k: number): Shape {
  if (k === 1 || k <= 0) return s
  const S = (p: Pt) => scaP(p, c, k)
  if (s.t === 'line') return { ...s, a: S(s.a), b: S(s.b) }
  if (s.t === 'dim') return { ...s, a: S(s.a), b: S(s.b), off: s.off * k, size: s.size * k }
  if (s.t === 'circle' || s.t === 'arc') return { ...s, c: S(s.c), r: s.r * k }
  if (s.t === 'poly') return { ...s, c: S(s.c), ap: s.ap * k }
  if (s.t === 'text') return { ...s, p: S(s.p), tip: s.tip && S(s.tip), size: s.size * k }
  if (s.t === 'pl') return { ...s, pts: s.pts.map(S) }
  if (s.t === 'bz') return { ...s, nodes: s.nodes.map((n) => ({ ...n, p: S(n.p), hi: n.hi && { x: n.hi.x * k, y: n.hi.y * k }, ho: n.ho && { x: n.ho.x * k, y: n.ho.y * k } })) }
  if (s.t === 'guide') return { ...s, p: S(s.p) }
  if (s.t === 'rect') { const p = S({ x: s.x, y: s.y }); return { ...s, x: p.x, y: p.y, w: s.w * k, h: s.h * k, r: s.r * k } }
  if (s.t === 'image') { const p = S({ x: s.x, y: s.y }); return { ...s, x: p.x, y: p.y, w: s.w * k, h: s.h * k } }
  const o = S({ x: s.x, y: s.y }); return { ...s, x: o.x, y: o.y, sc: (s.sc ?? 1) * k } // inst
}
export function expandInst(s: Inst, depth = 0): Shape[] {
  const d = defs[s.def]
  if (!d || depth > 8) return []
  const O = { x: 0, y: 0 }
  return d.shapes.flatMap((c) => {
    const t = translate(rotateShape(scaleShape(s.mir ? flipShape(c, 'h', 0) : c, O, s.sc ?? 1), O, s.rot ?? 0), s.x, s.y)
    return t.t === 'inst' ? expandInst(t, depth + 1) : [t]
  })
}
/** Plain drawable shapes: components expanded, hidden layers dropped. */
export const flat = (shapes: Shape[]): Shape[] => shapes.filter(isVisible).flatMap((s) => (s.t === 'inst' ? expandInst(s) : [s]))
/** Every straight edge of a shape (used for tape-measure guides and edge snapping). */
export function straightEdges(s: Shape): [Pt, Pt][] {
  if (s.t === 'inst') return expandInst(s).flatMap(straightEdges)
  if (s.t === 'line') return [[s.a, s.b]]
  if (s.t === 'rect') {
    if (!(s.r > 0)) return rectEdges(s)
    const { x, y, w, h } = s, r = Math.min(s.r, w / 2, h / 2) // only the straight sides: the corners are arcs
    const e: [Pt, Pt][] = [[{ x: x + r, y }, { x: x + w - r, y }], [{ x: x + w, y: y + r }, { x: x + w, y: y + h - r }], [{ x: x + w - r, y: y + h }, { x: x + r, y: y + h }], [{ x, y: y + h - r }, { x, y: y + r }]]
    return e.filter(([a, b]) => dist(a, b) > 1e-9)
  }
  if (s.t === 'poly') return polyEdges(s)
  if (s.t === 'pl') return plEdges(s)
  return []
}
export function shapeDist(s: Shape, p: Pt): number {
  if (s.fill && pointInside(s, p)) return 0
  if (s.t === 'bz') return Math.min(Infinity, ...bzEdges(s).map(([a, b]) => segDist(p, a, b)))
  if (s.t === 'arc') {
    if (inArc(s, Math.atan2(p.y - s.c.y, p.x - s.c.x))) return Math.abs(dist(p, s.c) - s.r)
    return Math.min(dist(p, arcAt(s, 0)), dist(p, arcAt(s, 1)))
  }
  if (s.t === 'inst') return Math.min(Infinity, ...expandInst(s).map((c) => shapeDist(c, p)))
  if (s.t === 'line') return segDist(p, s.a, s.b)
  if (s.t === 'circle') return Math.abs(dist(p, s.c) - s.r)
  if (s.t === 'dim') { const g = dimGeom(s); return Math.min(segDist(p, g.p1, g.p2), segDist(p, s.a, g.p1), segDist(p, s.b, g.p2)) }
  if (s.t === 'poly') return Math.min(...polyEdges(s).map(([a, b]) => segDist(p, a, b)))
  if (s.t === 'pl') return Math.min(Infinity, ...plEdges(s).map(([a, b]) => segDist(p, a, b)))
  if (s.t === 'guide') return Math.abs((p.x - s.p.x) * -s.d.y + (p.y - s.p.y) * s.d.x)
  if (s.t === 'image') {
    const dx = Math.max(s.x - p.x, 0, p.x - (s.x + s.w)), dy = Math.max(s.y - p.y, 0, p.y - (s.y + s.h))
    return Math.hypot(dx, dy) === 0 ? Math.min(p.x - s.x, s.x + s.w - p.x, p.y - s.y, s.y + s.h - p.y) : Math.hypot(dx, dy)
  }
  if (s.t === 'text') {
    const w = env.textW(s)
    const dx = Math.max(s.p.x - p.x, 0, p.x - (s.p.x + w)), dy = Math.max(s.p.y - p.y, 0, p.y - (s.p.y + s.size))
    return Math.min(Math.hypot(dx, dy), ...leaderLines(s).map(([a, b]) => segDist(p, a, b)))
  }
  return Math.min(...rectEdges(s).map(([a, b]) => segDist(p, a, b)))
}
export function translate(s: Shape, dx: number, dy: number): Shape {
  const m = (p: Pt) => ({ x: p.x + dx, y: p.y + dy })
  if (s.t === 'line' || s.t === 'dim') return { ...s, a: m(s.a), b: m(s.b) }
  if (s.t === 'circle' || s.t === 'poly' || s.t === 'arc') return { ...s, c: m(s.c) }
  if (s.t === 'text') return { ...s, p: m(s.p), tip: s.tip && m(s.tip) }
  if (s.t === 'pl') return { ...s, pts: s.pts.map(m) }
  if (s.t === 'bz') return { ...s, nodes: s.nodes.map((n) => ({ ...n, p: m(n.p) })) }
  if (s.t === 'guide') return { ...s, p: m(s.p) }
  return { ...s, x: s.x + dx, y: s.y + dy } // rect, image, inst
}
// ---- crossings: cut shapes where they overlap ----
/** A straight piece or an arc (a full circle is an arc with sweep TAU). u runs 0..len along it. */
type Prim = { k: 'l'; a: Pt; b: Pt } | { k: 'a'; c: Pt; r: number; a0: number; sw: number }
export function prims(s: Shape): Prim[] | null {
  const L = (e: [Pt, Pt][]): Prim[] => e.map(([a, b]) => ({ k: 'l', a, b }))
  if (s.t === 'line') return L([[s.a, s.b]])
  if (s.t === 'rect') { if (s.sheet) return null; if (!(s.r > 0)) return L(rectEdges(s)); const z = toBz(s); return z ? L(bzEdges(z)) : null }
  if (s.t === 'circle') return [{ k: 'a', c: s.c, r: s.r, a0: 0, sw: TAU }]
  if (s.t === 'arc') return [{ k: 'a', c: s.c, r: s.r, a0: s.a0, sw: sweepOf(s) }]
  if (s.t === 'poly') return L(polyEdges(s))
  if (s.t === 'pl') return L(plEdges(s))
  if (s.t === 'bz') return L(bzEdges(s))
  return null
}
const plen = (q: Prim) => (q.k === 'l' ? dist(q.a, q.b) : q.r * q.sw)
const inRange = (q: Extract<Prim, { k: 'a' }>, p: Pt) => normA(Math.atan2(p.y - q.c.y, p.x - q.c.x) - q.a0) <= q.sw + 1e-7
function paramOf(q: Prim, p: Pt): number {
  if (q.k === 'l') { const L = dist(q.a, q.b) || 1; return Math.max(0, Math.min(L, ((p.x - q.a.x) * (q.b.x - q.a.x) + (p.y - q.a.y) * (q.b.y - q.a.y)) / L)) }
  return Math.min(q.sw, normA(Math.atan2(p.y - q.c.y, p.x - q.c.x) - q.a0)) * q.r
}
const pointOn = (q: Prim, u: number): Pt => q.k === 'l'
  ? { x: q.a.x + ((q.b.x - q.a.x) * u) / (dist(q.a, q.b) || 1), y: q.a.y + ((q.b.y - q.a.y) * u) / (dist(q.a, q.b) || 1) }
  : { x: q.c.x + q.r * Math.cos(q.a0 + u / q.r), y: q.c.y + q.r * Math.sin(q.a0 + u / q.r) }
function primDist(q: Prim, p: Pt): number {
  if (q.k === 'l') return segDist(p, q.a, q.b)
  return inRange(q, p) ? Math.abs(dist(p, q.c) - q.r) : Math.min(dist(p, pointOn(q, 0)), dist(p, pointOn(q, q.r * q.sw)))
}
const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x
function hits(p: Prim, q: Prim): Pt[] {
  const eps = 1e-7
  if (p.k === 'l' && q.k === 'l') {
    const r = { x: p.b.x - p.a.x, y: p.b.y - p.a.y }, s = { x: q.b.x - q.a.x, y: q.b.y - q.a.y }, den = cross(r, s)
    if (Math.abs(den) < 1e-12) return []
    const qp = { x: q.a.x - p.a.x, y: q.a.y - p.a.y }, t = cross(qp, s) / den, u = cross(qp, r) / den
    return t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps ? [{ x: p.a.x + r.x * t, y: p.a.y + r.y * t }] : []
  }
  if (p.k === 'a' && q.k === 'l') return hits(q, p)
  if (p.k === 'l' && q.k === 'a') { // segment against circle, keep points inside the arc
    const d = { x: p.b.x - p.a.x, y: p.b.y - p.a.y }, f = { x: p.a.x - q.c.x, y: p.a.y - q.c.y }
    const A = d.x * d.x + d.y * d.y, B = 2 * (f.x * d.x + f.y * d.y), C = f.x * f.x + f.y * f.y - q.r * q.r, D = B * B - 4 * A * C
    if (A < 1e-12 || D < 0) return []
    const out: Pt[] = []
    for (const t of D < 1e-12 ? [-B / (2 * A)] : [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)]) {
      const pt = { x: p.a.x + d.x * t, y: p.a.y + d.y * t }
      if (t >= -eps && t <= 1 + eps && inRange(q, pt)) out.push(pt)
    }
    return out
  }
  const a = p as Extract<Prim, { k: 'a' }>, b = q as Extract<Prim, { k: 'a' }>, d = dist(a.c, b.c)
  if (d < 1e-9 || d > a.r + b.r + eps || d < Math.abs(a.r - b.r) - eps) return []
  const x = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a.r * a.r - x * x))
  const ux = (b.c.x - a.c.x) / d, uy = (b.c.y - a.c.y) / d, mx = a.c.x + ux * x, my = a.c.y + uy * x
  return [{ x: mx - uy * h, y: my + ux * h }, { x: mx + uy * h, y: my - ux * h }].filter((pt) => inRange(a, pt) && inRange(b, pt))
}
const piece = (q: Prim, u1: number, u2: number, base: Pick<Shape, 'tag' | 'g'>): Shape | null => {
  if (u2 - u1 < 1e-6) return null
  return q.k === 'l' ? { t: 'line', a: pointOn(q, u1), b: pointOn(q, u2), ...base } : { t: 'arc', c: q.c, r: q.r, a0: q.a0 + u1 / q.r, a1: q.a0 + u2 / q.r, ...base }
}
const whole = (q: Prim, base: Pick<Shape, 'tag' | 'g'>): Shape => q.k === 'l' ? { t: 'line', a: q.a, b: q.b, ...base } : q.sw >= TAU - 1e-9 ? { t: 'circle', c: q.c, r: q.r, ...base } : { t: 'arc', c: q.c, r: q.r, a0: q.a0, a1: q.a0 + q.sw, ...base }
const crossings = (q: Prim, others: Prim[]) => others.flatMap((o) => hits(q, o).map((pt) => paramOf(q, pt))).sort((x, y) => x - y)
/** Eraser on a shape that crosses others: remove only the stretch between the neighbouring crossings; the rest becomes separate lines/arcs. null = no crossing there (delete the whole shape). */
function spanOf(shapes: Shape[], idx: number, p: Pt) {
  const s = shapes[idx], ps = prims(s)
  if (!ps) return null
  let hi = 0, bd = Infinity
  ps.forEach((q, i) => { const d = primDist(q, p); if (d < bd) { bd = d; hi = i } })
  const hit = ps[hi], len = plen(hit), u0 = paramOf(hit, p), base = { tag: s.tag, g: s.g }
  const others = shapes.flatMap((o, j) => (j === idx || !isVisible(o) ? [] : prims(o) ?? []))
  const cr = crossings(hit, others).filter((u, i, a) => i === 0 || u - a[i - 1] > 1e-6)
  if (!cr.length) return null
  if (hit.k === 'a' && hit.sw >= TAU - 1e-9) { // a full circle: the removed stretch wraps around
    if (cr.length < 2) return null
    let k = cr.findIndex((u) => u > u0) - 1
    if (k < -1) k = cr.length - 1
    const left = cr[(k + cr.length) % cr.length], right = cr[(k + 1) % cr.length], gap = ((right - left) % len + len) % len || len
    return { ps, hi, hit, len, base, left, right, gap, wrap: true }
  }
  return { ps, hi, hit, len, base, left: Math.max(0, ...cr.filter((u) => u <= u0)), right: Math.min(len, ...cr.filter((u) => u >= u0)), gap: 0, wrap: false }
}
/** Eraser on a shape that crosses others: remove only the stretch between the neighbouring crossings; the rest becomes separate lines/arcs. null = no crossing there (delete the whole shape). */
export function trimErase(shapes: Shape[], idx: number, p: Pt): Shape[] | null {
  const sp = spanOf(shapes, idx, p)
  if (!sp) return null
  const { ps, hi, hit, len, base, left, right, gap, wrap } = sp
  const rest = ps.filter((_, i) => i !== hi).map((q) => whole(q, base))
  const out = wrap ? [piece(hit, right, right + (len - gap), base)] : [piece(hit, 0, left, base), piece(hit, right, len, base)]
  return [...rest, ...(out.filter(Boolean) as Shape[])]
}
/** The stretch the eraser would remove at p (for the highlight). null = the whole shape goes. */
export function erasedPart(shapes: Shape[], idx: number, p: Pt): Shape | null {
  const sp = spanOf(shapes, idx, p)
  return sp ? (sp.wrap ? piece(sp.hit, sp.left, sp.left + sp.gap, sp.base) : piece(sp.hit, sp.left, sp.right, sp.base)) : null
}
/** Cut a shape into separate lines/arcs at every crossing with the other shapes. null = nothing crosses it. */
export function splitShape(shapes: Shape[], idx: number): Shape[] | null {
  const s = shapes[idx], ps = prims(s)
  if (!ps) return null
  const others = shapes.flatMap((o, j) => (j === idx || !isVisible(o) ? [] : prims(o) ?? []))
  const base = { tag: s.tag, g: s.g }
  let cut = false
  const out: Shape[] = []
  for (const q of ps) {
    const len = plen(q), cr = crossings(q, others).filter((u) => u > 1e-6 && u < len - 1e-6)
    if (!cr.length) { out.push(whole(q, base)); continue }
    cut = true
    const us = [0, ...cr, len]
    for (let i = 0; i + 1 < us.length; i++) { const pc = piece(q, us[i], us[i + 1], base); if (pc) out.push(pc) }
  }
  return cut ? out : null
}
export type Box = { x0: number; y0: number; x1: number; y1: number }
export function bounds(shapes: Shape[], skip: Shape['t'][] = ['guide']): Box | null {
  let b: Box | null = null
  const add = (p: Pt) => {
    b = b ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
  }
  for (const s of shapes.flatMap((q) => (q.t === 'inst' ? expandInst(q) : [q]))) {
    if (skip.includes(s.t)) continue
    if (s.t === 'line') add(s.a), add(s.b)
    else if (s.t === 'rect') add({ x: s.x, y: s.y }), add({ x: s.x + s.w, y: s.y + s.h })
    else if (s.t === 'circle') add({ x: s.c.x - s.r, y: s.c.y - s.r }), add({ x: s.c.x + s.r, y: s.c.y + s.r })
    else if (s.t === 'arc') {
      add(arcAt(s, 0)); add(arcAt(s, 1))
      for (let q = 0; q < 4; q++) if (inArc(s, (q * Math.PI) / 2)) add({ x: s.c.x + s.r * Math.cos((q * Math.PI) / 2), y: s.c.y + s.r * Math.sin((q * Math.PI) / 2) })
    }
    else if (s.t === 'poly') polyVerts(s).forEach(add)
    else if (s.t === 'pl') s.pts.forEach(add)
    else if (s.t === 'bz') bzFlatten(s).forEach(add)
    else if (s.t === 'dim') dimGeom(s).lines.forEach(([a, c]) => (add(a), add(c)))
    else if (s.t === 'text') { add(s.p); add({ x: s.p.x + env.textW(s), y: s.p.y + s.size }); leaderLines(s).forEach(([a, c]) => (add(a), add(c))) }
    else if (s.t === 'image') add({ x: s.x, y: s.y }), add({ x: s.x + s.w, y: s.y + s.h })
  }
  return b
}
