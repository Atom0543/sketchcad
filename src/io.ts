// File formats: DXF / SVG in and out, plus the app's own project file.
import type { Laser } from './laser'
import { type Pt, type Shape, type Pl, type Tag, polyVerts, plEdges, dimGeom, leaderLines, bounds, deg, dist, images, defs, tags, tagOf, sweepOf, arcAt, bzFlatten, bzSegs, dimText } from './geom'

export type Label = (mm: number) => string

// ---------- DXF out ----------
/** `shapes` must already be flat (components expanded, hidden layers dropped): see geom.flat(). */
export function toDxf(shapes: Shape[]): string {
  const label: Label = (mm) => String(+mm.toFixed(3))
  const p = (c: number, v: string | number) => `${c}\n${v}\n`
  const used = [...new Set(shapes.map((s) => tagOf(s)))].filter((t) => t.id !== '0')
  const lay = (sh: Shape) => { const t = tagOf(sh); return p(8, t.id === '0' ? '0' : t.name) + (t.color ? p(62, t.color) : '') }
  const ln = (a: Pt, b: Pt, sh: Shape) => p(0, 'LINE') + lay(sh) + p(10, a.x) + p(20, a.y) + p(30, 0) + p(11, b.x) + p(21, b.y) + p(31, 0)
  const poly = (v: [number, number, number][], closed: boolean, sh: Shape) => {
    let o = p(0, 'LWPOLYLINE') + lay(sh) + p(90, v.length) + p(70, closed ? 1 : 0)
    for (const [vx, vy, b] of v) o += p(10, vx) + p(20, vy) + (b ? p(42, b) : '')
    return o
  }
  let s = p(0, 'SECTION') + p(2, 'HEADER') + p(9, '$ACADVER') + p(1, 'AC1015') + p(9, '$INSUNITS') + p(70, 4) + p(0, 'ENDSEC')
  s += p(0, 'SECTION') + p(2, 'TABLES')
  s += p(0, 'TABLE') + p(2, 'LTYPE') + p(70, 1) + p(0, 'LTYPE') + p(2, 'CONTINUOUS') + p(70, 0) + p(3, 'Solid line') + p(72, 65) + p(73, 0) + p(40, 0) + p(0, 'ENDTAB')
  s += p(0, 'TABLE') + p(2, 'LAYER') + p(70, used.length + 1)
  s += p(0, 'LAYER') + p(2, '0') + p(70, 0) + p(62, 7) + p(6, 'CONTINUOUS')
  for (const t of used) s += p(0, 'LAYER') + p(2, t.name) + p(70, 0) + p(62, t.color || 7) + p(6, 'CONTINUOUS')
  s += p(0, 'ENDTAB') + p(0, 'ENDSEC')
  s += p(0, 'SECTION') + p(2, 'ENTITIES')
  const bulge = Math.tan(Math.PI / 8)
  for (const sh of shapes) {
    if (sh.t === 'line') s += ln(sh.a, sh.b, sh)
    else if (sh.t === 'circle') s += p(0, 'CIRCLE') + lay(sh) + p(10, sh.c.x) + p(20, sh.c.y) + p(30, 0) + p(40, sh.r)
    else if (sh.t === 'bz') s += poly(bzFlatten(sh).map((q) => [q.x, q.y, 0]), sh.closed, sh) // curves become fine polylines in DXF
    else if (sh.t === 'arc') s += p(0, 'ARC') + lay(sh) + p(10, sh.c.x) + p(20, sh.c.y) + p(30, 0) + p(40, sh.r) + p(50, deg(sh.a0)) + p(51, deg(sh.a0 + sweepOf(sh)))
    else if (sh.t === 'poly') s += poly(polyVerts(sh).map((q) => [q.x, q.y, 0]), true, sh)
    else if (sh.t === 'pl') s += poly(sh.pts.map((q) => [q.x, q.y, 0]), sh.closed, sh)
    else if (sh.t === 'rect') {
      const { x, y, w, h, r } = sh
      s += poly(r > 0
        ? [[x + r, y, 0], [x + w - r, y, bulge], [x + w, y + r, 0], [x + w, y + h - r, bulge], [x + w - r, y + h, 0], [x + r, y + h, bulge], [x, y + h - r, 0], [x, y + r, bulge]]
        : [[x, y, 0], [x + w, y, 0], [x + w, y + h, 0], [x, y + h, 0]], true, sh)
    } else if (sh.t === 'text') {
      for (const [a, b] of leaderLines(sh)) s += ln(a, b, sh)
      s += p(0, 'TEXT') + lay(sh) + p(10, sh.p.x) + p(20, sh.p.y) + p(30, 0) + p(40, sh.size) + p(1, sh.s)
    } else if (sh.t === 'dim') {
      const g = dimGeom(sh)
      for (const [a, b] of g.lines) s += ln(a, b, sh)
      const up = { x: -Math.sin(g.ang), y: Math.cos(g.ang) }
      const tx = g.mid.x + up.x * sh.size * 0.4, ty = g.mid.y + up.y * sh.size * 0.4
      s += p(0, 'TEXT') + lay(sh) + p(10, tx) + p(20, ty) + p(30, 0) + p(40, sh.size) + p(1, dimText(sh, label)) + p(50, deg(g.ang))
        + p(72, 1) + p(11, tx) + p(21, ty) + p(31, 0) + p(73, 0)
    } // guides, underlay images and component instances (already expanded) are not written as such
  }
  return s + p(0, 'ENDSEC') + p(0, 'EOF')
}

// ---------- DXF in ----------
const UNIT_MM: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 }
const arcPts = (a: Pt, b: Pt, bulge: number): Pt[] => {
  // points strictly between a and b along the bulge arc
  const th = 4 * Math.atan(bulge), c = dist(a, b)
  if (!c || !th) return []
  const R = c / (2 * Math.sin(Math.abs(th) / 2))
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const h = R * Math.cos(th / 2) * Math.sign(th) // centre offset along the chord normal
  const cx = mx - ((b.y - a.y) / c) * h, cy = my + ((b.x - a.x) / c) * h
  const a0 = Math.atan2(a.y - cy, a.x - cx)
  const n = Math.max(2, Math.ceil(Math.abs(th) / (Math.PI / 24)))
  return Array.from({ length: n - 1 }, (_, i) => ({ x: cx + R * Math.cos(a0 + (th * (i + 1)) / n), y: cy + R * Math.sin(a0 + (th * (i + 1)) / n) }))
}
export function parseDxf(text: string): { shapes: Shape[]; skipped: string[]; layers: Tag[] } {
  const L = text.split(/\r?\n/)
  type Ent = { type: string; g: [number, string][] }
  const ents: Ent[] = []
  let section = '', cur: Ent | null = null, unit = 1
  for (let i = 0; i + 1 < L.length; i += 2) {
    const code = parseInt(L[i].trim()), val = L[i + 1].trim()
    if (code === 0) {
      if (val === 'SECTION') { section = ''; cur = null; continue }
      if (val === 'ENDSEC') { section = ''; cur = null; continue }
      cur = { type: val, g: [] }
      if (section === 'ENTITIES') ents.push(cur)
    } else if (code === 2 && cur === null && !section) section = val
    else if (cur) cur.g.push([code, val])
    else if (section === 'HEADER' && code === 9 && val === '$INSUNITS') {
      const nx = parseInt(L[i + 3]?.trim() ?? '')
      unit = UNIT_MM[nx] ?? 1
    }
  }
  if (!ents.length) throw new Error('No drawing entities found in this DXF')
  const out: Shape[] = [], skipped = new Set<string>()
  const layers = new Map<string, Tag>()
  const layerOf = (g: [number, string][]): string | undefined => {
    const name = g.find(([k]) => k === 8)?.[1]
    if (!name || name === '0') return undefined
    if (!layers.has(name)) { const c = parseInt(g.find(([k]) => k === 62)?.[1] ?? '0'); layers.set(name, { id: name, name, color: c >= 1 && c <= 7 ? c : 0, visible: true, locked: false }) }
    return name
  }
  const num = (g: [number, string][], c: number, d = 0) => { const f = g.find(([k]) => k === c); return f ? parseFloat(f[1]) : d }
  const S = (n: number) => n * unit
  const P = (x: number, y: number): Pt => ({ x: S(x), y: S(y) })
  const pushPl = (pts: Pt[], closed: boolean) => {
    if (pts.length < 2) return
    if (closed && pts.length === 4) { // axis-aligned 4-point loop = rectangle
      const xs = [...new Set(pts.map((q) => +q.x.toFixed(6)))], ys = [...new Set(pts.map((q) => +q.y.toFixed(6)))]
      if (xs.length === 2 && ys.length === 2) return void out.push({ t: 'rect', x: Math.min(...xs), y: Math.min(...ys), w: Math.abs(xs[1] - xs[0]), h: Math.abs(ys[1] - ys[0]), r: 0 })
    }
    if (!closed && pts.length === 2) return void out.push({ t: 'line', a: pts[0], b: pts[1] })
    out.push({ t: 'pl', pts, closed })
  }
  for (let i = 0; i < ents.length; i++) {
    const { type, g } = ents[i]
    const before = out.length
    const lname = layerOf(g)
    if (type === 'LINE') out.push({ t: 'line', a: P(num(g, 10), num(g, 20)), b: P(num(g, 11), num(g, 21)) })
    else if (type === 'CIRCLE') out.push({ t: 'circle', c: P(num(g, 10), num(g, 20)), r: S(num(g, 40)) })
    else if (type === 'ARC') {
      out.push({ t: 'arc', c: P(num(g, 10), num(g, 20)), r: S(num(g, 40)), a0: (num(g, 50) * Math.PI) / 180, a1: (num(g, 51) * Math.PI) / 180 })
    } else if (type === 'LWPOLYLINE') {
      const v: { p: Pt; b: number }[] = []
      for (const [k, s] of g) {
        if (k === 10) v.push({ p: { x: S(parseFloat(s)), y: 0 }, b: 0 })
        else if (k === 20 && v.length) v[v.length - 1].p.y = S(parseFloat(s))
        else if (k === 42 && v.length) v[v.length - 1].b = parseFloat(s)
      }
      const closed = (num(g, 70) & 1) === 1
      const pts: Pt[] = []
      v.forEach((q, j) => {
        pts.push(q.p)
        const nx = v[j + 1] ?? (closed ? v[0] : null)
        if (q.b && nx) pts.push(...arcPts(q.p, nx.p, q.b))
      })
      pushPl(pts, closed)
    } else if (type === 'POLYLINE') {
      const pts: Pt[] = []
      let j = i + 1
      while (j < ents.length && ents[j].type === 'VERTEX') { pts.push(P(num(ents[j].g, 10), num(ents[j].g, 20))); j++ }
      pushPl(pts, (num(g, 70) & 1) === 1)
      i = j - 1
    } else if (type === 'TEXT' || type === 'MTEXT') {
      const raw = (g.find(([k]) => k === 1)?.[1] ?? '').replace(/\\P/g, ' ').replace(/\{?\\[A-Za-z][^;]*;|[{}]/g, '')
      if (raw) out.push({ t: 'text', p: P(num(g, 10), num(g, 20)), s: raw, size: S(num(g, 40, 2.5)) || 2.5 })
    } else if (type !== 'VERTEX' && type !== 'SEQEND' && type !== 'EOF') skipped.add(type)
    if (lname) for (let k = before; k < out.length; k++) out[k].tag = lname
  }
  return { shapes: out, skipped: [...skipped], layers: [...layers.values()] }
}

// ---------- SVG out ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const n3 = (n: number) => +n.toFixed(3)
/** SVG elements in drawing millimetres, y flipped (SVG y runs down). */
export function svgBody(shapes: Shape[], label: Label, stroke = '#111', sw = 0.25): string {
  const f = (p: Pt) => `${n3(p.x)},${n3(-p.y)}`
  const line = (a: Pt, b: Pt) => `<line x1="${n3(a.x)}" y1="${n3(-a.y)}" x2="${n3(b.x)}" y2="${n3(-b.y)}"/>`
  const F = (s: Shape) => (s.fill ? ` fill="${esc(s.fill)}"` : '')
  const text = (s: string, p: Pt, size: number, ang = 0, anchor = 'start') =>
    `<text x="${n3(p.x)}" y="${n3(-p.y)}" font-size="${n3(size)}" text-anchor="${anchor}" fill="${stroke}" stroke="none" font-family="Segoe UI, Leelawadee UI, sans-serif"${ang ? ` transform="rotate(${n3(-deg(ang))} ${n3(p.x)} ${n3(-p.y)})"` : ''}>${esc(s)}</text>`
  let o = `<g fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">`
  for (const s of shapes) {
    if (s.t === 'line') o += line(s.a, s.b)
    else if (s.t === 'bz') { const sg = bzSegs(s); o += s.nodes.length ? `<path d="M${f(s.nodes[0].p)} ${sg.map((c) => `C${f(c[1])} ${f(c[2])} ${f(c[3])}`).join(' ')}${s.closed ? ' Z' : ''}"${s.closed ? F(s) : ''}/>` : '' }
    else if (s.t === 'circle') o += `<circle cx="${n3(s.c.x)}" cy="${n3(-s.c.y)}" r="${n3(s.r)}"${F(s)}/>`
    else if (s.t === 'rect') o += `<rect x="${n3(s.x)}" y="${n3(-(s.y + s.h))}" width="${n3(s.w)}" height="${n3(s.h)}"${s.r ? ` rx="${n3(s.r)}"` : ''}${F(s)}/>`
    else if (s.t === 'arc') { const a = arcAt(s, 0), b = arcAt(s, 1); o += `<path d="M${f(a)} A${n3(s.r)},${n3(s.r)} 0 ${sweepOf(s) > Math.PI ? 1 : 0} 0 ${f(b)}"/>` }
    else if (s.t === 'poly') o += `<polygon points="${polyVerts(s).map(f).join(' ')}"${F(s)}/>`
    else if (s.t === 'pl') o += `<${s.closed ? 'polygon' : 'polyline'} points="${s.pts.map(f).join(' ')}"${s.closed ? F(s) : ''}/>`
    else if (s.t === 'text') { for (const [a, b] of leaderLines(s)) o += line(a, b); o += text(s.s, s.p, s.size) }
    else if (s.t === 'dim') {
      const g = dimGeom(s)
      for (const [a, b] of g.lines) o += line(a, b)
      const up = { x: -Math.sin(g.ang), y: Math.cos(g.ang) }
      o += text(dimText(s, label), { x: g.mid.x + up.x * s.size * 0.4, y: g.mid.y + up.y * s.size * 0.4 }, s.size, g.ang, 'middle')
    }
  }
  return o + '</g>'
}
/** Same as svgBody but one <g> per colour (laser software maps colours to layers). */
export function svgColored(shapes: Shape[], label: Label, colorOf: (s: Shape) => string, sw = 0.25): string {
  const g = new Map<string, Shape[]>()
  for (const s of shapes) { const c = colorOf(s); g.set(c, [...(g.get(c) ?? []), s]) }
  return [...g].map(([c, l]) => svgBody(l, label, c, sw)).join('')
}
export function toSvg(shapes: Shape[], label: Label, colorOf?: (s: Shape) => string): string {
  const b = bounds(shapes) ?? { x0: 0, y0: 0, x1: 100, y1: 100 }
  const m = 5, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n3(w)}mm" height="${n3(h)}mm" viewBox="${n3(b.x0 - m)} ${n3(-b.y1 - m)} ${n3(w)} ${n3(h)}">${colorOf ? svgColored(shapes, label, colorOf) : svgBody(shapes, label)}</svg>\n`
}

// ---------- SVG in ----------
export function parseSvg(text: string): Shape[] {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('This is not a valid SVG file')
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden'
  const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement
  const vb = svg.viewBox.baseVal
  if (!svg.getAttribute('width')) svg.setAttribute('width', String(vb?.width || 300))
  if (!svg.getAttribute('height')) svg.setAttribute('height', String(vb?.height || 150))
  host.appendChild(svg); document.body.appendChild(host)
  const out: Shape[] = []
  try {
    const box = svg.getBoundingClientRect() // element space -> CSS px measured from the svg's own top-left
    if (!box.width) throw new Error('Could not measure this SVG')
    const root = new DOMMatrix().translate(-box.left, -box.top)
    const mm = 25.4 / 96
    for (const el of Array.from(svg.querySelectorAll('line,rect,circle,ellipse,polyline,polygon,path,text')) as SVGGraphicsElement[]) {
      if (el.closest('defs,clipPath,mask,symbol,pattern,marker')) continue
      const sc = el.getScreenCTM()
      if (!sc) continue
      const M = root.multiply(sc)
      const T = (x: number, y: number): Pt => { const q = new DOMPoint(x, y).matrixTransform(M); return { x: q.x * mm, y: -q.y * mm } }
      const k = Math.hypot(M.a, M.b) * mm
      const axis = Math.abs(M.b) < 1e-9 && Math.abs(M.c) < 1e-9 && Math.abs(Math.abs(M.a) - Math.abs(M.d)) < 1e-9
      const A = (n: string) => parseFloat(el.getAttribute(n) ?? '0') || 0
      const tag = el.localName
      const addPl = (pts: Pt[], closed: boolean) => {
        const q = simplify(pts, closed)
        if (q.length === 2 && !closed) out.push({ t: 'line', a: q[0], b: q[1] })
        else if (q.length >= 2) out.push({ t: 'pl', pts: q, closed })
      }
      if (tag === 'line') out.push({ t: 'line', a: T(A('x1'), A('y1')), b: T(A('x2'), A('y2')) })
      else if (tag === 'rect') {
        const x = A('x'), y = A('y'), w = A('width'), h = A('height')
        const a = T(x, y), c = T(x + w, y + h)
        if (axis) out.push({ t: 'rect', x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), w: Math.abs(c.x - a.x), h: Math.abs(c.y - a.y), r: Math.min(A('rx') * k, Math.abs(c.x - a.x) / 2, Math.abs(c.y - a.y) / 2) })
        else addPl([T(x, y), T(x + w, y), T(x + w, y + h), T(x, y + h)], true)
      } else if (tag === 'circle' && axis) out.push({ t: 'circle', c: T(A('cx'), A('cy')), r: A('r') * k })
      else if (tag === 'circle' || tag === 'ellipse') {
        const rx = tag === 'circle' ? A('r') : A('rx'), ry = tag === 'circle' ? A('r') : A('ry')
        addPl(Array.from({ length: 64 }, (_, i) => T(A('cx') + rx * Math.cos((i * 2 * Math.PI) / 64), A('cy') + ry * Math.sin((i * 2 * Math.PI) / 64))), true)
      } else if (tag === 'polyline' || tag === 'polygon') {
        const nums = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(parseFloat)
        const pts: Pt[] = []
        for (let i = 0; i + 1 < nums.length; i += 2) pts.push(T(nums[i], nums[i + 1]))
        addPl(pts, tag === 'polygon')
      } else if (tag === 'path') {
        for (const sp of flattenPath(el.getAttribute('d') ?? '')) {
          const pts = sp.pts.map((q) => T(q.x, q.y))
          addPl(sp.closed && pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 1e-6 ? pts.slice(0, -1) : pts, sp.closed)
        }
      } else if (tag === 'text' && el.textContent?.trim()) {
        out.push({ t: 'text', p: T(A('x'), A('y')), s: el.textContent.trim(), size: (parseFloat(getComputedStyle(el).fontSize) || 12) * k })
      }
    }
  } finally { host.remove() }
  return out
}

/** SVG path data -> polylines (user units). Lines stay exact; curves and arcs are sampled. */
export function flattenPath(d: string): { pts: Pt[]; closed: boolean }[] {
  const tok = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const out: { pts: Pt[]; closed: boolean }[] = []
  let i = 0, cmd = '', cx = 0, cy = 0, sx0 = 0, sy0 = 0, lc: Pt | null = null, lq: Pt | null = null, cur: { pts: Pt[]; closed: boolean } | null = null
  const num = () => parseFloat(tok[i++])
  const add = (x: number, y: number) => { cx = x; cy = y; cur?.pts.push({ x, y }) }
  const N = 24
  while (i < tok.length) {
    if (/^[A-Za-z]$/.test(tok[i])) cmd = tok[i++]
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase()
    const ox = rel ? cx : 0, oy = rel ? cy : 0
    if (C === 'Z') { if (cur) { cur.closed = true; cx = sx0; cy = sy0 } cur = null; lc = lq = null; continue }
    if (C === 'M') {
      const x = num() + ox, y = num() + oy
      cur = { pts: [], closed: false }; out.push(cur); add(x, y); sx0 = x; sy0 = y; cmd = rel ? 'l' : 'L'; lc = lq = null
    } else {
      if (!cur) { cur = { pts: [{ x: cx, y: cy }], closed: false }; out.push(cur) }
      if (C === 'L') add(num() + ox, num() + oy), (lc = lq = null)
      else if (C === 'H') add(num() + ox, cy), (lc = lq = null)
      else if (C === 'V') add(cx, num() + oy), (lc = lq = null)
      else if (C === 'C' || C === 'S') {
        const p0 = { x: cx, y: cy }
        const c1: Pt = C === 'S' ? (lc ? { x: 2 * cx - lc.x, y: 2 * cy - lc.y } : p0) : { x: num() + ox, y: num() + oy }
        const c2 = { x: num() + ox, y: num() + oy }, p3 = { x: num() + ox, y: num() + oy }
        for (let k = 1; k <= N; k++) {
          const t = k / N, u = 1 - t
          add(u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x, u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y)
        }
        lc = c2; lq = null
      } else if (C === 'Q' || C === 'T') {
        const p0 = { x: cx, y: cy }
        const c1: Pt = C === 'T' ? (lq ? { x: 2 * cx - lq.x, y: 2 * cy - lq.y } : p0) : { x: num() + ox, y: num() + oy }
        const p2 = { x: num() + ox, y: num() + oy }
        for (let k = 1; k <= N; k++) { const t = k / N, u = 1 - t; add(u * u * p0.x + 2 * u * t * c1.x + t * t * p2.x, u * u * p0.y + 2 * u * t * c1.y + t * t * p2.y) }
        lq = c1; lc = null
      } else if (C === 'A') {
        let rx = Math.abs(num()), ry = Math.abs(num()); const phi = (num() * Math.PI) / 180, fa = num(), fs = num()
        const x2 = num() + ox, y2 = num() + oy, x1 = cx, y1 = cy
        if (!rx || !ry || (x1 === x2 && y1 === y2)) add(x2, y2)
        else { // SVG spec F.6.5: endpoint -> centre parameterisation
          const cp = Math.cos(phi), sp = Math.sin(phi)
          const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
          const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy
          const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
          if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam) }
          const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
          const co = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)))
          const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx
          const ccx = cp * cxp - sp * cyp + (x1 + x2) / 2, ccy = sp * cxp + cp * cyp + (y1 + y2) / 2
          const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
          const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
          let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
          if (!fs && dth > 0) dth -= 2 * Math.PI
          else if (fs && dth < 0) dth += 2 * Math.PI
          const n = Math.max(4, Math.ceil(Math.abs(dth) / (Math.PI / 24)))
          for (let k = 1; k <= n; k++) {
            const a = th1 + (dth * k) / n
            add(cp * rx * Math.cos(a) - sp * ry * Math.sin(a) + ccx, sp * rx * Math.cos(a) + cp * ry * Math.sin(a) + ccy)
          }
        }
        lc = lq = null
      } else i++ // unknown token: skip so we never loop forever
    }
  }
  return out.filter((p) => p.pts.length > 1)
}

/** Drop points that lie on the straight line between their neighbours. */
function simplify(pts: Pt[], closed: boolean): Pt[] {
  const keep = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-6)
  if (keep.length < 3) return keep
  return keep.filter((p, i) => {
    const a = keep[i - 1] ?? (closed ? keep[keep.length - 1] : null), b = keep[i + 1] ?? (closed ? keep[0] : null)
    if (!a || !b) return true
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / (dist(a, b) || 1) > 0.005
  })
}

// ---------- project file ----------
export type Project = { app: 'sketchcad'; v: 1; unit: string; shapes: Shape[]; images: Record<string, string>; defs: typeof defs; tags: Tag[]; laser?: Laser }
export const toProject = (shapes: Shape[], unit: string, laser?: Laser): string => JSON.stringify({ app: 'sketchcad', v: 1, unit, shapes, images, defs, tags, laser } satisfies Project)
export function parseProject(text: string): Project {
  const d = JSON.parse(text) as Project
  if (d.app !== 'sketchcad' || !Array.isArray(d.shapes)) throw new Error('This is not a SketchCAD project file')
  return { ...d, images: d.images ?? {}, defs: d.defs ?? {}, tags: d.tags?.length ? d.tags : [...tags] }
}
export const plCount = (s: Pl) => plEdges(s).length

// ponytail: dev-only round-trip check
if (import.meta.env?.DEV) {
  const tri = flattenPath('M0 40 L20 40 L20 30 Z')
  console.assert(tri.length === 1 && tri[0].closed && tri[0].pts.length === 3, 'flattenPath triangle')
  const arc = flattenPath('M10 0 A10 10 0 0 1 0 10')
  console.assert(arc[0].pts.length > 4 && Math.abs(Math.hypot(arc[0].pts[3].x, arc[0].pts[3].y) - 10) < 1e-6, 'flattenPath arc')
  const back = parseDxf(toDxf([{ t: 'line', a: { x: 0, y: 0 }, b: { x: 10, y: 5 } }, { t: 'circle', c: { x: 1, y: 2 }, r: 3 }, { t: 'rect', x: 0, y: 0, w: 4, h: 2, r: 0 }])).shapes
  console.assert(back.length === 3 && back[0].t === 'line' && back[1].t === 'circle' && back[2].t === 'rect', 'dxf round trip')
}
