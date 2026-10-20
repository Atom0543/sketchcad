// SketchUp-style inference helpers: where edges cross, and cutting lines where they meet.
import { dist, segDist, isVisible, isLocked, straightEdges, bzEdges, toBz, arcAt, sweepOf, TAU, type Pt, type Shape, type Line } from './geom'

const EPS = 1e-4 // mm

/** Where segments a-b and c-d cross (null when parallel or apart). */
export function segCross(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-9 * Math.hypot(rx, ry) * Math.hypot(sx, sy)) return null
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null
  return { x: a.x + t * rx, y: a.y + t * ry }
}

/** Points strictly inside `l` where `o` touches or crosses it. */
function cutsOn(l: Line, o: Line): Pt[] {
  const out = [o.a, o.b].filter((p) => segDist(p, l.a, l.b) < EPS)
  const x = segCross(l.a, l.b, o.a, o.b)
  if (x) out.push(x)
  return out.filter((p) => dist(p, l.a) > EPS && dist(p, l.b) > EPS)
}

function cut(l: Line, pts: Pt[]): Line[] {
  if (!pts.length) return [l]
  const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y
  const t = (p: Pt) => (p.x - l.a.x) * dx + (p.y - l.a.y) * dy
  const chain = [l.a, ...pts.sort((p, q) => t(p) - t(q)).filter((p, i, all) => !i || dist(p, all[i - 1]) > EPS), l.b]
  return chain.slice(1).map((q, i) => ({ ...l, a: chain[i], b: q }))
}

const plain = (s: Shape): s is Line => s.t === 'line' && !s.g && isVisible(s) && !isLocked(s)

/**
 * Like SketchUp: the line just drawn (last in the list) and every plain line it touches are cut where they meet,
 * and pieces lying on top of each other collapse into one - so overlapping lines read as a single line with extra points.
 */
export function weldLast(shapes: Shape[]): Shape[] {
  const n = shapes[shapes.length - 1]
  if (!n || !plain(n)) return shapes
  const out: Shape[] = [], nCuts: Pt[] = []
  for (const s of shapes.slice(0, -1)) {
    if (!plain(s)) { out.push(s); continue }
    nCuts.push(...cutsOn(n, s))
    out.push(...cut(s, cutsOn(s, n)))
  }
  const same = (p: Line, q: Shape) => q.t === 'line' && ((dist(p.a, q.a) < EPS && dist(p.b, q.b) < EPS) || (dist(p.a, q.b) < EPS && dist(p.b, q.a) < EPS))
  return [...out, ...cut(n, nCuts).filter((p) => !out.some((q) => same(p, q)))]
}

/**
 * Paint-bucket region: the closed outline around p made of touching lines, arcs and curves (endpoints must meet).
 * Walks the face boundary of the planar graph; null when p is not enclosed.
 */
export function faceAt(shapes: Shape[], p: Pt): Pt[] | null {
  const key = (q: Pt) => `${Math.round(q.x * 100)},${Math.round(q.y * 100)}`
  const at = new Map<string, Pt>(), adj = new Map<string, Set<string>>()
  const edges: [string, string][] = []
  const segs: [Pt, Pt][] = []
  const add = (a: Pt, b: Pt) => { if (key(a) !== key(b)) segs.push([a, b]) }
  for (const s of shapes) {
    if (!isVisible(s) || s.t === 'guide' || s.t === 'image' || s.t === 'dim' || s.t === 'text' || s.fo) continue
    if (s.t === 'arc') { const n = Math.max(4, Math.ceil((sweepOf(s) * 180) / Math.PI / 4)); for (let i = 0; i < n; i++) add(arcAt(s, i / n), arcAt(s, (i + 1) / n)) }
    else if (s.t === 'circle') { const q = (i: number) => ({ x: s.c.x + s.r * Math.cos((i * TAU) / 90), y: s.c.y + s.r * Math.sin((i * TAU) / 90) }); for (let i = 0; i < 90; i++) add(q(i), q(i + 1)) }
    else if (s.t === 'bz') for (const [a, b] of bzEdges(s)) add(a, b)
    else if (s.t === 'rect' && s.r > 0) { const z = toBz(s); if (z) for (const [a, b] of bzEdges(z)) add(a, b) }
    else for (const [a, b] of straightEdges(s)) add(a, b)
  }
  // a line that ends on, or crosses, another edge splits it there, so the pieces meet at real nodes
  for (const [a, b] of segs) {
    const cuts: Pt[] = []
    for (const [c, d] of segs) {
      if (c === a) continue
      for (const q of [c, d]) if (segDist(q, a, b) < EPS) cuts.push(q)
      const x = segCross(a, b, c, d)
      if (x) cuts.push(x)
    }
    const dx = b.x - a.x, dy = b.y - a.y, t = (q: Pt) => (q.x - a.x) * dx + (q.y - a.y) * dy
    const chain = [a, ...cuts.filter((q) => dist(q, a) > EPS && dist(q, b) > EPS).sort((q, r) => t(q) - t(r)), b]
    for (let i = 0; i + 1 < chain.length; i++) {
      const ka = key(chain[i]), kb = key(chain[i + 1])
      if (ka === kb) continue
      if (!at.has(ka)) at.set(ka, chain[i])
      if (!at.has(kb)) at.set(kb, chain[i + 1])
      ;(adj.get(ka) ?? adj.set(ka, new Set()).get(ka)!).add(kb)
      ;(adj.get(kb) ?? adj.set(kb, new Set()).get(kb)!).add(ka)
      edges.push([ka, kb])
    }
  }
  // nearest edge to the right of p, oriented so p is on its left
  let best: [string, string] | null = null, bx = Infinity
  for (const [ka, kb] of edges) {
    let u = at.get(ka)!, v = at.get(kb)!, ku = ka, kv = kb
    if (u.y === v.y) continue
    if (u.y > v.y) { [u, v] = [v, u]; [ku, kv] = [kv, ku] }
    if (!(u.y <= p.y && p.y < v.y)) continue
    const x = u.x + ((p.y - u.y) / (v.y - u.y)) * (v.x - u.x)
    if (x > p.x && x < bx) { bx = x; best = [ku, kv] }
  }
  if (!best) return null
  const out: Pt[] = []
  let [u, v] = best
  const [u0, v0] = best
  for (let n = 0; n < 20000; n++) {
    out.push(at.get(u)!)
    const pu = at.get(u)!, pv = at.get(v)!, back = Math.atan2(pu.y - pv.y, pu.x - pv.x)
    let w = u, bestCw = Infinity
    for (const k of adj.get(v)!) {
      const q = at.get(k)!
      let cw = (back - Math.atan2(q.y - pv.y, q.x - pv.x)) % TAU
      if (cw < 0) cw += TAU
      if (cw < 1e-9) cw = TAU
      if (cw < bestCw) { bestCw = cw; w = k }
    }
    u = v; v = w
    if (u === u0 && v === v0) {
      let area = 0
      out.forEach((a, i) => { const b = out[(i + 1) % out.length]; area += a.x * b.y - b.x * a.y })
      return area > 0 ? out : null
    }
  }
  return null
}

/** Where the circle (c, r) meets the segment a-b. */
export function circleSegHits(c: Pt, r: number, a: Pt, b: Pt): Pt[] {
  const dx = b.x - a.x, dy = b.y - a.y, fx = a.x - c.x, fy = a.y - c.y
  const A = dx * dx + dy * dy
  if (A < 1e-12) return []
  const B = 2 * (fx * dx + fy * dy), disc = B * B - 4 * A * (fx * fx + fy * fy - r * r)
  if (disc < 0) return []
  const q = Math.sqrt(disc)
  return [(-B - q) / (2 * A), (-B + q) / (2 * A)].filter((t, i, all) => t >= -1e-9 && t <= 1 + 1e-9 && (i === 0 || t - all[0] > 1e-9)).map((t) => ({ x: a.x + t * dx, y: a.y + t * dy }))
}

/** Closed polygon pushed inward by k (outward when negative): neighbouring edges meet at a mitre. null if it collapses. */
export function offsetPoly(pts: Pt[], k: number): Pt[] | null {
  const v = pts.filter((p, i) => dist(p, pts[(i + 1) % pts.length]) > 1e-9)
  const n = v.length
  if (n < 3) return null
  let area = 0
  v.forEach((a, i) => { const b = v[(i + 1) % n]; area += a.x * b.y - b.x * a.y })
  const f = (area > 0 ? 1 : -1) * k // inward is to the left of a counter-clockwise polygon
  const nrm = v.map((a, i) => { const b = v[(i + 1) % n], L = dist(a, b); return { x: -(b.y - a.y) / L, y: (b.x - a.x) / L } })
  const out = v.map((p, i) => {
    const m = nrm[(i + n - 1) % n], q = nrm[i]
    const dot = Math.max(1 + m.x * q.x + m.y * q.y, 0.05) // 2cos^2(half the turn): near 0 at a hairpin
    let dx = (f * (m.x + q.x)) / dot, dy = (f * (m.y + q.y)) / dot
    const L = Math.hypot(dx, dy), lim = Math.abs(f) * 4 // cap very sharp mitres
    if (L > lim) { dx = (dx / L) * lim; dy = (dy / L) * lim }
    return { x: p.x + dx, y: p.y + dy }
  })
  // an edge that turned round means the offset collapsed through itself
  const ok = out.every((a, i) => { const b = out[(i + 1) % n], c = v[i], d = v[(i + 1) % n]; return (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y) > 0 })
  return ok ? out : null
}
