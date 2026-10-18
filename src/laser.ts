// Laser-cutting helpers: kerf offset, open/duplicate path check, sheet utilisation. Pure geometry, opt-in from the UI.
import { type Pt, type Shape, type Rect, dist, mid, polyEdges, rectEdges, arcAt, plEdges, tagOf, expandInst, bzFlatten, pointInside } from './geom'

export type Laser = { on: boolean; colors: boolean; kerfOn: boolean; kerf: number; kerfTag: string }
export const defaultLaser = (): Laser => ({ on: false, colors: true, kerfOn: false, kerf: 0.2, kerfTag: '' })
/** Pure colours that laser software maps to layers (index = AutoCAD colour number). */
export const LASER_HEX = ['#000000', '#ff0000', '#e6b800', '#00b400', '#00b4e6', '#0000ff', '#ff00ff', '#000000']
export const laserColor = (s: Shape) => LASER_HEX[tagOf(s).color] ?? '#000000'

type Closed = Extract<Shape, { t: 'rect' | 'circle' | 'poly' | 'pl' | 'bz' }>
export const isClosed = (s: Shape): s is Closed => s.t === 'rect' || s.t === 'circle' || s.t === 'poly' || ((s.t === 'pl' || s.t === 'bz') && s.closed)
const plArea = (p: Pt[]) => Math.abs(p.reduce((a, q, i) => a + (q.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * q.y), 0)) / 2
export function area(s: Closed): number {
  if (s.t === 'rect') return s.w * s.h - (4 - Math.PI) * s.r * s.r
  if (s.t === 'circle') return Math.PI * s.r * s.r
  if (s.t === 'poly') return s.n * s.ap * s.ap * Math.tan(Math.PI / s.n)
  return plArea(s.t === 'bz' ? bzFlatten(s) : s.pts)
}
export function repPoint(s: Closed): Pt {
  if (s.t === 'rect') return { x: s.x + s.w / 2, y: s.y + s.h / 2 }
  if (s.t === 'circle' || s.t === 'poly') return s.c
  const v = s.t === 'bz' ? bzFlatten(s) : s.pts
  return { x: v.reduce((a, q) => a + q.x, 0) / v.length, y: v.reduce((a, q) => a + q.y, 0) / v.length }
}
export function containsPt(s: Closed, p: Pt): boolean {
  if (s.t === 'rect') return p.x > s.x && p.x < s.x + s.w && p.y > s.y && p.y < s.y + s.h
  return pointInside(s, p)
}
const isHole = (s: Closed, all: Closed[]) => { const p = repPoint(s), a = area(s); return all.some((o) => o !== s && o.tag === s.tag && area(o) > a && containsPt(o, p)) }

function offsetPoly(pts: Pt[], d: number): Pt[] | null {
  const n = pts.length
  if (n < 3) return null
  const ccw = pts.reduce((a, q, i) => a + (q.x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * q.y), 0) > 0
  const nrm = (a: Pt, b: Pt): Pt => { const L = dist(a, b) || 1, dx = (b.x - a.x) / L, dy = (b.y - a.y) / L; return ccw ? { x: dy, y: -dx } : { x: -dy, y: dx } }
  const out = pts.map((p, i) => {
    const n1 = nrm(pts[(i + n - 1) % n], p), n2 = nrm(p, pts[(i + 1) % n])
    const k = Math.min(1 / Math.max(1 + n1.x * n2.x + n1.y * n2.y, 0.25), 4) // miter limit
    return { x: p.x + (n1.x + n2.x) * d * k, y: p.y + (n1.y + n2.y) * d * k }
  })
  return plArea(out) > 1e-9 && (d > 0 || plArea(out) < plArea(pts)) ? out : null
}
/** Grow outer contours by kerf/2 and shrink holes by kerf/2 on the chosen tag, so the cut part ends up the drawn size. */
export function kerfApply(list: Shape[], L: Laser): Shape[] {
  const half = L.kerf / 2
  if (!L.kerfOn || !(half > 0)) return list
  const mine = list.filter((s): s is Closed => isClosed(s) && (s.tag ?? '0') === (L.kerfTag || '0'))
  return list.map((s) => {
    if (!isClosed(s) || !mine.includes(s)) return s
    const d = isHole(s, mine) ? -half : half
    if (s.t === 'rect') return s.w + 2 * d > 0 && s.h + 2 * d > 0 ? { ...s, x: s.x - d, y: s.y - d, w: s.w + 2 * d, h: s.h + 2 * d, r: s.r > 0 ? Math.max(0, s.r + d) : 0 } : s
    if (s.t === 'circle') return s.r + d > 0 ? { ...s, r: s.r + d } : s
    if (s.t === 'poly') return s.ap + d > 0 ? { ...s, ap: s.ap + d } : s
    const o = offsetPoly(s.t === 'bz' ? bzFlatten(s) : s.pts, d)
    return o ? { t: 'pl', pts: o, closed: true, tag: s.tag, g: s.g, fill: s.fill } : s
  })
}

export type Check = { open: Pt[]; dup: Pt[] }
/** Find loose path ends and doubled-up geometry (a laser would cut those twice or leave a gap). */
export function checkPaths(list: Shape[]): Check {
  const eps = 0.05
  const ends: Pt[] = []
  const seen = new Map<string, Pt>(), dup: Pt[] = []
  const key = (...n: number[]) => n.map((v) => Math.round(v / 0.01)).join(',')
  const note = (k: string, at: Pt) => { if (seen.has(k)) dup.push(at); else seen.set(k, at) }
  for (const s of list) {
    if (s.t === 'line') {
      ends.push(s.a, s.b)
      const [p, q] = s.a.x < s.b.x || (s.a.x === s.b.x && s.a.y <= s.b.y) ? [s.a, s.b] : [s.b, s.a]
      note('L' + key(p.x, p.y, q.x, q.y), mid(s.a, s.b))
    } else if (s.t === 'arc') { ends.push(arcAt(s, 0), arcAt(s, 1)); note('A' + key(s.c.x, s.c.y, s.r, s.a0, s.a1), arcAt(s, 0.5)) }
    else if (s.t === 'bz' && !s.closed && s.nodes.length > 1) ends.push(s.nodes[0].p, s.nodes[s.nodes.length - 1].p)
    else if (s.t === 'pl' && !s.closed) { ends.push(s.pts[0], s.pts[s.pts.length - 1]); for (const [a, b] of plEdges(s)) note('L' + key(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)), mid(a, b)) }
    else if (s.t === 'circle') note('C' + key(s.c.x, s.c.y, s.r), s.c)
    else if (s.t === 'rect') note('R' + key(s.x, s.y, s.w, s.h), { x: s.x + s.w / 2, y: s.y + s.h / 2 })
    else if (s.t === 'poly') { for (const [a, b] of polyEdges(s)) note('L' + key(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)), mid(a, b)) }
  }
  const open = ends.filter((e, i) => !ends.some((o, j) => j !== i && dist(e, o) <= eps && Math.floor(i / 2) !== Math.floor(j / 2)))
  void rectEdges; void expandInst
  return { open, dup }
}

export function sheetStats(list: Shape[], sheet: Rect) {
  const closed = list.filter((s): s is Closed => isClosed(s) && !(s.t === 'rect' && s.sheet))
  const inside = (s: Closed) => {
    const p = repPoint(s)
    return p.x >= sheet.x && p.x <= sheet.x + sheet.w && p.y >= sheet.y && p.y <= sheet.y + sheet.h
  }
  const gross = closed.filter((s) => inside(s) && !isHole(s, closed)).reduce((a, s) => a + area(s), 0)
  const holes = closed.filter((s) => inside(s) && isHole(s, closed)).reduce((a, s) => a + area(s), 0)
  return { used: gross - holes, util: (gross - holes) / (sheet.w * sheet.h), outside: closed.filter((s) => !inside(s)).length }
}

// ponytail: tiny dev-only self-check
if (import.meta.env?.DEV) {
  const big: Shape = { t: 'rect', x: 0, y: 0, w: 100, h: 100, r: 0, tag: 'c' }, hole: Shape = { t: 'circle', c: { x: 50, y: 50 }, r: 10, tag: 'c' }
  const out = kerfApply([big, hole], { ...defaultLaser(), on: true, kerfOn: true, kerf: 1, kerfTag: 'c' })
  console.assert(out[0].t === 'rect' && out[0].w === 101 && out[1].t === 'circle' && out[1].r === 9.5, 'kerf outer grows, hole shrinks')
  const c = checkPaths([{ t: 'line', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }, { t: 'line', a: { x: 10, y: 0 }, b: { x: 10, y: 10 } }, { t: 'line', a: { x: 10, y: 0 }, b: { x: 0, y: 0 } }])
  console.assert(c.dup.length === 1 && c.open.length >= 2, 'checkPaths')
}
