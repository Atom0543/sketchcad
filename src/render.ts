// Canvas drawing shared by the main view, PNG export and the print preview.
import { type Pt, type Shape, polyVerts, dimGeom, dimText, leaderLines, images, expandInst, sweepOf, bzSegs } from './geom'

export type View = { ox: number; oy: number; s: number } // screen = o + world*s (y flipped)
export const FONT = '"Segoe UI", "Leelawadee UI", sans-serif'
export type Style = { color: string; w: number; dash?: number[]; label: (mm: number) => string; exact?: boolean }

const cache = new Map<string, HTMLImageElement>()
export let onImageLoad: () => void = () => {}
export const setImageLoadHandler = (f: () => void) => (onImageLoad = f)
function img(id: string) {
  let el = cache.get(id)
  if (!el) {
    el = new Image()
    el.onload = () => onImageLoad()
    el.src = images[id] ?? ''
    cache.set(id, el)
  }
  return el
}

export function shapePath(ctx: CanvasRenderingContext2D, s: Shape, v: View) {
  const X = (x: number) => v.ox + x * v.s, Y = (y: number) => v.oy - y * v.s
  ctx.beginPath()
  const segs = (l: [Pt, Pt][]) => { for (const [a, b] of l) { ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)) } }
  if (s.t === 'line') segs([[s.a, s.b]])
  else if (s.t === 'rect') ctx.roundRect(X(s.x), Y(s.y + s.h), s.w * v.s, s.h * v.s, s.r * v.s)
  else if (s.t === 'circle') ctx.arc(X(s.c.x), Y(s.c.y), s.r * v.s, 0, Math.PI * 2)
  else if (s.t === 'arc') ctx.arc(X(s.c.x), Y(s.c.y), s.r * v.s, -s.a0, -(s.a0 + sweepOf(s)), true)
  else if (s.t === 'poly') { polyVerts(s).forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.closePath() }
  else if (s.t === 'pl') { s.pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); if (s.closed) ctx.closePath() }
  else if (s.t === 'bz') {
    if (s.nodes.length) ctx.moveTo(X(s.nodes[0].p.x), Y(s.nodes[0].p.y))
    for (const c of bzSegs(s)) ctx.bezierCurveTo(X(c[1].x), Y(c[1].y), X(c[2].x), Y(c[2].y), X(c[3].x), Y(c[3].y))
    if (s.closed) ctx.closePath()
  }
  else if (s.t === 'text') segs(leaderLines(s))
  else if (s.t === 'dim') segs(dimGeom(s).lines)
  else if (s.t === 'guide') {
    const L = 1e5
    ctx.moveTo(X(s.p.x - s.d.x * L), Y(s.p.y - s.d.y * L)); ctx.lineTo(X(s.p.x + s.d.x * L), Y(s.p.y + s.d.y * L))
  }
}

export function drawShape(ctx: CanvasRenderingContext2D, s: Shape, v: View, st: Style) {
  const X = (x: number) => v.ox + x * v.s, Y = (y: number) => v.oy - y * v.s
  if (s.t === 'inst') { for (const c of expandInst(s)) drawShape(ctx, c, v, st); return }
  if (s.t === 'image') {
    const el = img(s.img)
    if (el.complete && el.naturalWidth) {
      ctx.save(); ctx.globalAlpha = s.op
      ctx.drawImage(el, X(s.x), Y(s.y + s.h), s.w * v.s, s.h * v.s)
      ctx.restore()
    }
    if (!st.exact) { // frame so the underlay can be picked
      ctx.save(); ctx.strokeStyle = st.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 1
      ctx.strokeRect(X(s.x), Y(s.y + s.h), s.w * v.s, s.h * v.s); ctx.restore()
    }
    return
  }
  if (s.t === 'rect' && s.sheet) { // material sheet: dashed frame with its size
    shapePath(ctx, s, v)
    ctx.fillStyle = st.color; ctx.globalAlpha = 0.05; ctx.fill(); ctx.globalAlpha = 1
    ctx.strokeStyle = st.color; ctx.lineWidth = st.w; ctx.setLineDash([12, 6]); ctx.stroke(); ctx.setLineDash([])
    ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.fillText(`${st.label(s.w)} × ${st.label(s.h)}`, X(s.x) + 4, Y(s.y + s.h) - 3)
    return
  }
  shapePath(ctx, s, v)
  if (s.fill && (s.t === 'rect' || s.t === 'circle' || s.t === 'poly' || (s.t === 'pl' && s.closed) || (s.t === 'bz' && s.closed))) { ctx.fillStyle = s.fill; ctx.fill() }
  ctx.strokeStyle = st.color; ctx.lineWidth = st.w; ctx.setLineDash(s.t === 'guide' ? [8, 6] : (st.dash ?? [])); ctx.stroke(); ctx.setLineDash([])
  if (s.t === 'dim') {
    const g = dimGeom(s)
    ctx.save(); ctx.translate(X(g.mid.x), Y(g.mid.y)); ctx.rotate(-g.ang)
    ctx.fillStyle = st.color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.font = `${s.drv ? '700 ' : ''}${st.exact ? s.size * v.s : Math.max(11, s.size * v.s)}px ${FONT}`
    ctx.fillText(dimText(s, st.label), 0, -3 * (st.exact ? v.s / 2 : 1)); ctx.restore()
  } else if (s.t === 'text') {
    ctx.fillStyle = st.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.font = `${st.exact ? s.size * v.s : Math.max(6, s.size * v.s)}px ${FONT}`
    ctx.fillText(s.s, X(s.p.x), Y(s.p.y))
  }
}
