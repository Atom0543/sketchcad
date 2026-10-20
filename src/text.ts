// Outline text for laser work: HarfBuzz shapes the string (so Thai marks sit correctly), glyph outlines become closed bezier paths.
import * as hb from 'harfbuzzjs'
import type { BNode, Bz, Pt, Shape } from './geom'

type Cmd = { type: string; values: number[] }
const loaded = new Map<string, { font: hb.Font; upem: number; glyphs: Map<number, Cmd[]> }>()

function fontOf(key: string, bytes: ArrayBuffer) {
  let f = loaded.get(key)
  if (!f) {
    const face = new hb.Face(new hb.Blob(bytes))
    f = { font: new hb.Font(face), upem: face.upem || 1000, glyphs: new Map() }
    loaded.set(key, f)
  }
  return f
}

/** One glyph outline as closed bezier contours; quadratic curves are raised to cubic. k scales font units to mm. */
function contoursOf(cmds: Cmd[], ox: number, oy: number, k: number): BNode[][] {
  const out: BNode[][] = []
  let cur: BNode[] = []
  const P = (x: number, y: number): Pt => ({ x: ox + x * k, y: oy + y * k })
  const last = () => cur[cur.length - 1]
  const close = () => {
    if (cur.length > 1) {
      const a = cur[0], b = last()
      if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < 1e-6) { if (b.hi) a.hi = b.hi; cur.pop() } // the path came back to its start
      out.push(cur)
    }
    cur = []
  }
  const cubic = (c1: Pt, c2: Pt, p: Pt) => {
    const a = last()
    a.ho = { x: c1.x - a.p.x, y: c1.y - a.p.y }
    cur.push({ p, hi: { x: c2.x - p.x, y: c2.y - p.y } })
  }
  for (const { type, values: v } of cmds) {
    if (type === 'M') { close(); cur = [{ p: P(v[0], v[1]) }] }
    else if (type === 'L') cur.push({ p: P(v[0], v[1]) })
    else if (type === 'Q') {
      const a = last().p, q = P(v[0], v[1]), p = P(v[2], v[3])
      cubic({ x: a.x + (2 / 3) * (q.x - a.x), y: a.y + (2 / 3) * (q.y - a.y) }, { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) }, p)
    } else if (type === 'C') cubic(P(v[0], v[1]), P(v[2], v[3]), P(v[4], v[5]))
    else if (type === 'Z') close()
  }
  close()
  return out
}

/** Lay the text out: first line's baseline starts at (0,0), y up, size = em height in mm, more lines below. */
export function layoutText(key: string, bytes: ArrayBuffer, text: string, size: number): BNode[][] {
  const f = fontOf(key, bytes), k = size / f.upem, out: BNode[][] = []
  text.split('\n').forEach((line, row) => {
    if (!line) return
    const buf = new hb.Buffer()
    buf.addText(line); buf.guessSegmentProperties()
    hb.shape(f.font, buf)
    const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions()
    let pen = 0
    infos.forEach((g, i) => {
      if (g.codepoint === 0) { pen += pos[i].xAdvance; return } // missing glyph (e.g. Thai in an English-only font): leave a gap, no box
      let cmds = f.glyphs.get(g.codepoint)
      if (!cmds) { cmds = f.font.glyphToJson(g.codepoint) as Cmd[]; f.glyphs.set(g.codepoint, cmds) }
      out.push(...contoursOf(cmds, (pen + pos[i].xOffset) * k, -row * size * 1.3 + pos[i].yOffset * k, k))
      pen += pos[i].xAdvance
    })
  })
  return out
}

const inside = (p: Pt, poly: Pt[]) => {
  let r = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if (poly[i].y > p.y !== poly[j].y > p.y && p.x < ((poly[j].x - poly[i].x) * (p.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) r = !r
  return r
}

/** Closed paths for the cutter. Solid: letters filled, counters (holes of o, e, ก ...) painted in the paper colour. */
export function textShapes(contours: BNode[][], solid: boolean, extra: Pick<Shape, 'tag' | 'g'>): Shape[] {
  const polys = contours.map((c) => c.map((n) => n.p))
  const hole = contours.map((c, i) => polys.filter((q, j) => j !== i && inside(c[0].p, q)).length % 2 === 1)
  const mk = (i: number): Bz => ({ t: 'bz', nodes: contours[i], closed: true, ...extra, ...(solid ? { fill: hole[i] ? 'paper' : '#333333' } : {}) })
  const idx = contours.map((_, i) => i)
  return [...idx.filter((i) => !hole[i]), ...idx.filter((i) => hole[i])].map(mk) // holes after the letters they cut
}
