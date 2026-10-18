// Page setup: several pages, paper, scale (per page), scale label, placement; PDF download and browser print.
import { jsPDF } from 'jspdf'
import { type Pt, type Shape, bounds, polyVerts, dimGeom, leaderLines, deg, arcAt, bzSegs, dimText } from './geom'
import { svgBody, svgColored, type Label } from './io'
import { drawShape } from './render'

export const PAPERS: Record<string, [number, number]> = {
  A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297], A5: [148, 210],
  Letter: [215.9, 279.4], Legal: [215.9, 355.6], Tabloid: [279.4, 431.8],
}
const SCALES: [string, number][] = [['10:1', 0.1], ['5:1', 0.2], ['2:1', 0.5], ['1:1', 1], ['1:2', 2], ['1:5', 5], ['1:10', 10], ['1:20', 20], ['1:50', 50], ['1:100', 100]]

/** A piece that can be put on its own page: a group, a component copy, or "everything else". */
export type Unit = { id: string; name: string; shapes: Shape[] }
export type PageDeps = {
  units: () => Unit[]; color?: () => ((s: Shape) => string) | null; label: Label
  t: (k: string) => string; toast: (m: string) => void; save: (b: Blob, name: string) => void
}
type PageCfg = { scaleKey: string; ratio: number; pos: Pt; centered: boolean }
const newPage = (): PageCfg => ({ scaleKey: 'fit', ratio: 1, pos: { x: 0, y: 0 }, centered: true })
const ratioText = (k: number) => (k >= 1 ? `${+k.toPrecision(3)}:1` : `1:${+(1 / k).toPrecision(3)}`)

export function initPage(d: PageDeps) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const dlg = $<HTMLDialogElement>('pg'), cv = $<HTMLCanvasElement>('pgCv')
  const paperSel = $<HTMLSelectElement>('pgPaper'), orient = $<HTMLSelectElement>('pgOrient'), scaleSel = $<HTMLSelectElement>('pgScale')
  const ratio = $<HTMLInputElement>('pgRatio'), margin = $<HTMLInputElement>('pgMargin'), lw = $<HTMLInputElement>('pgLw')
  const showScale = $<HTMLInputElement>('pgShowScale'), corner = $<HTMLSelectElement>('pgCorner')
  paperSel.innerHTML = Object.keys(PAPERS).map((k) => `<option${k === 'A4' ? ' selected' : ''}>${k}</option>`).join('')
  scaleSel.innerHTML = `<option value="fit">${d.t('fit')}</option>` + SCALES.map(([l, n]) => `<option value="${n}"${l === '1:1' ? ' selected' : ''}>${l}</option>`).join('') + `<option value="custom">${d.t('custom')}</option>`
  const pages: PageCfg[] = [newPage()]
  let cur = 0
  const assign: Record<string, number> = {} // unit id -> page index

  const unitsOn = (i: number) => d.units().filter((u) => Math.min(assign[u.id] ?? 0, pages.length - 1) === i)
  function layout(i: number) {
    const cfg = pages[i]
    const shapes = unitsOn(i).flatMap((u) => u.shapes).filter((s) => s.t !== 'guide' && s.t !== 'image')
    const b = bounds(shapes) ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
    const [w0, h0] = PAPERS[paperSel.value]
    const land = orient.value === 'l'
    const W = land ? h0 : w0, H = land ? w0 : h0
    const m = Math.max(0, parseFloat(margin.value) || 0)
    const bw = Math.max(b.x1 - b.x0, 1e-6), bh = Math.max(b.y1 - b.y0, 1e-6)
    let k = cfg.scaleKey === 'fit' ? Math.min((W - 2 * m) / bw, (H - 2 * m) / bh)
      : cfg.scaleKey === 'custom' ? 1 / (cfg.ratio || 1) : 1 / parseFloat(cfg.scaleKey)
    if (!isFinite(k) || k <= 0) k = 1
    const dw = bw * k, dh = bh * k
    if (cfg.centered) cfg.pos = { x: (W - dw) / 2, y: (H - dh) / 2 }
    return { shapes, b, W, H, k, dw, dh, m, land, cfg }
  }
  /** "Scale 1:2" label in the chosen corner, in page millimetres. */
  function scaleLabel(L: ReturnType<typeof layout>) {
    const c = corner.value, size = 3.5
    return { text: `${d.t('scaleWord')} ${ratioText(L.k)}`, x: c[1] === 'l' ? L.m : L.W - L.m, y: c[0] === 'b' ? L.H - L.m : L.m + size, size, align: (c[1] === 'l' ? 'left' : 'right') as 'left' | 'right' }
  }
  function syncForm() {
    const cfg = pages[cur]
    scaleSel.value = cfg.scaleKey; ratio.value = String(cfg.ratio)
    $('pgCustom').hidden = cfg.scaleKey !== 'custom'
  }
  function renderTabs() {
    $('pgTabs').innerHTML = pages.map((_, i) => `<button type="button" class="btn${i === cur ? ' on' : ''}" data-p="${i}">${d.t('pageN')} ${i + 1}</button>`).join('')
      + `<button type="button" class="btn" data-a="add" title="${d.t('addPage')}">+ ${d.t('addPage')}</button>` + (pages.length > 1 ? `<button type="button" class="btn" data-a="del" title="${d.t('delPage')}">× ${d.t('delPage')}</button>` : '')
  }
  function renderUnits() {
    const us = d.units()
    $('pgUnits').innerHTML = us.length > 1
      ? us.map((u) => `<div class="row"><span title="${u.name}">${u.name}</span><select data-u="${u.id}">${pages.map((_, i) => `<option value="${i}"${Math.min(assign[u.id] ?? 0, pages.length - 1) === i ? ' selected' : ''}>${d.t('pageN')} ${i + 1}</option>`).join('')}</select></div>`).join('')
      : `<p class="note">${d.t('unitsHint')}</p>`
  }
  function refreshAll() { renderTabs(); renderUnits(); syncForm(); preview() }

  function preview() {
    const L = layout(cur)
    const dpr = devicePixelRatio, cw = cv.clientWidth, ch = cv.clientHeight
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr)
    const c = cv.getContext('2d')!
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const s = Math.min((cw - 24) / L.W, (ch - 24) / L.H)
    const ox = (cw - L.W * s) / 2, oy = (ch - L.H * s) / 2
    c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 10; c.fillStyle = '#fff'; c.fillRect(ox, oy, L.W * s, L.H * s); c.shadowBlur = 0
    c.strokeStyle = '#9cf'; c.setLineDash([4, 3]); c.lineWidth = 1; c.strokeRect(ox + L.m * s, oy + L.m * s, (L.W - 2 * L.m) * s, (L.H - 2 * L.m) * s); c.setLineDash([])
    c.save(); c.beginPath(); c.rect(ox, oy, L.W * s, L.H * s); c.clip()
    const v = { ox: ox + (L.cfg.pos.x - L.b.x0 * L.k) * s, oy: oy + (L.cfg.pos.y + L.b.y1 * L.k) * s, s: L.k * s }
    const w = Math.max(1, (parseFloat(lw.value) || 0.25) * s)
    const colorOf = d.color?.() ?? null
    for (const sh of L.shapes) drawShape(c, sh, v, { color: colorOf ? colorOf(sh) : '#111', w, label: d.label, exact: true })
    if (showScale.checked && L.shapes.length) {
      const t = scaleLabel(L)
      c.fillStyle = '#111'; c.font = `${t.size * s}px "Segoe UI","Leelawadee UI",sans-serif`; c.textAlign = t.align; c.textBaseline = 'alphabetic'
      c.fillText(t.text, ox + t.x * s, oy + t.y * s)
    }
    c.restore()
    $('pgInfo').textContent = `${paperSel.value} ${L.land ? d.t('landscape') : d.t('portrait')} · ${L.W}×${L.H} mm\n${d.t('drawing')} ${+L.dw.toFixed(1)}×${+L.dh.toFixed(1)} mm · ${ratioText(L.k)}`
      + (L.dw > L.W - 2 * L.m + 0.01 || L.dh > L.H - 2 * L.m + 0.01 ? '\n⚠ ' + d.t('tooBig') : '') + (L.shapes.length ? '' : '\n' + d.t('emptyPage'))
    $('pgInfo').style.whiteSpace = 'pre-line'
  }

  function toPdf(): Blob {
    let doc: jsPDF | null = null
    pages.forEach((_, i) => {
      const L = layout(i)
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [L.W, L.H], orientation: L.W > L.H ? 'l' : 'p' })
      else doc.addPage([L.W, L.H], L.W > L.H ? 'l' : 'p')
      const g = doc
      const X = (x: number) => L.cfg.pos.x + (x - L.b.x0) * L.k, Y = (y: number) => L.cfg.pos.y + (L.b.y1 - y) * L.k
      g.setLineWidth(parseFloat(lw.value) || 0.25); g.setDrawColor(17); g.setTextColor(17)
      const line = (a: Pt, b: Pt) => g.line(X(a.x), Y(a.y), X(b.x), Y(b.y))
      const poly = (pts: Pt[], closed: boolean, st = 'S') => {
        if (pts.length < 2) return
        g.lines(pts.slice(1).map((p, j) => [X(p.x) - X(pts[j].x), Y(p.y) - Y(pts[j].y)]), X(pts[0].x), Y(pts[0].y), [1, 1], st, closed)
      }
      const text = (s: string, p: Pt, size: number, ang = 0, align: 'left' | 'center' = 'left') => {
        g.setFontSize(size * L.k * (72 / 25.4))
        g.text(s, X(p.x), Y(p.y), { angle: deg(ang), align })
      }
      const colorOf = d.color?.() ?? null
      const rgb = (c: string) => { const n = parseInt(c.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const }
      const style = (s: Shape) => { if (s.fill) { g.setFillColor(...rgb(s.fill)); return 'FD' } return 'S' }
      for (const s of L.shapes) {
        if (colorOf) { const n = parseInt(colorOf(s).slice(1), 16); g.setDrawColor((n >> 16) & 255, (n >> 8) & 255, n & 255); g.setTextColor((n >> 16) & 255, (n >> 8) & 255, n & 255) }
        if (s.t === 'line') line(s.a, s.b)
        else if (s.t === 'circle') g.circle(X(s.c.x), Y(s.c.y), s.r * L.k, style(s))
        else if (s.t === 'bz') {
          const sg = bzSegs(s)
          if (sg.length) g.lines(sg.map((c) => [X(c[1].x) - X(c[0].x), Y(c[1].y) - Y(c[0].y), X(c[2].x) - X(c[0].x), Y(c[2].y) - Y(c[0].y), X(c[3].x) - X(c[0].x), Y(c[3].y) - Y(c[0].y)]), X(sg[0][0].x), Y(sg[0][0].y), [1, 1], s.closed ? style(s) : 'S', s.closed)
        }
        else if (s.t === 'arc') poly(Array.from({ length: 49 }, (_, j) => arcAt(s, j / 48)), false)
        else if (s.t === 'rect') g.roundedRect(X(s.x), Y(s.y + s.h), s.w * L.k, s.h * L.k, s.r * L.k, s.r * L.k, style(s))
        else if (s.t === 'poly') poly(polyVerts(s), true, style(s))
        else if (s.t === 'pl') poly(s.pts, s.closed, s.closed ? style(s) : 'S')
        else if (s.t === 'text') { leaderLines(s).forEach(([a, b]) => line(a, b)); text(s.s, s.p, s.size) }
        else if (s.t === 'dim') {
          const dg = dimGeom(s)
          dg.lines.forEach(([a, b]) => line(a, b))
          const up = { x: -Math.sin(dg.ang), y: Math.cos(dg.ang) }
          text(dimText(s, d.label), { x: dg.mid.x + up.x * s.size * 0.4, y: dg.mid.y + up.y * s.size * 0.4 }, s.size, dg.ang, 'center')
        }
      }
      if (showScale.checked && L.shapes.length) {
        const t = scaleLabel(L)
        g.setTextColor(17); g.setFontSize(t.size * (72 / 25.4)); g.text(t.text, t.x, t.y, { align: t.align })
      }
    })
    return (doc as unknown as jsPDF).output('blob')
  }
  function printPages() {
    const colorOf = d.color?.() ?? null
    const [w0, h0] = PAPERS[paperSel.value], land = orient.value === 'l'
    const W = land ? h0 : w0, H = land ? w0 : h0
    const svgs = pages.map((_, i) => {
      const L = layout(i), sw = (parseFloat(lw.value) || 0.25) / L.k
      const body = colorOf ? svgColored(L.shapes, d.label, colorOf, sw) : svgBody(L.shapes, d.label, '#111', sw)
      const t = scaleLabel(L)
      const lab = showScale.checked && L.shapes.length ? `<text x="${t.x}" y="${t.y}" font-size="${t.size}" text-anchor="${t.align === 'left' ? 'start' : 'end'}" font-family="Segoe UI, Leelawadee UI, sans-serif">${t.text}</text>` : ''
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" style="page-break-after:always"><g transform="translate(${L.cfg.pos.x} ${L.cfg.pos.y}) scale(${L.k}) translate(${-L.b.x0} ${L.b.y1})">${body}</g>${lab}</svg>`
    })
    const html = `<!doctype html><meta charset="utf-8"><style>@page{size:${W}mm ${H}mm;margin:0}html,body{margin:0}svg{display:block}svg:last-child{page-break-after:auto!important}</style>${svgs.join('')}`
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    f.srcdoc = html
    f.onload = () => { f.contentWindow?.print(); setTimeout(() => f.remove(), 60000) }
    document.body.appendChild(f)
  }

  // interactions
  $('pgTabs').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (!el) return
    if (el.dataset.p) cur = +el.dataset.p
    else if (el.dataset.a === 'add') { pages.push(newPage()); cur = pages.length - 1 }
    else if (el.dataset.a === 'del' && pages.length > 1) {
      for (const id of Object.keys(assign)) { if (assign[id] === cur) assign[id] = 0; else if (assign[id] > cur) assign[id]-- }
      pages.splice(cur, 1); cur = Math.min(cur, pages.length - 1)
    }
    refreshAll()
  })
  $('pgUnits').addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement
    if (el.dataset.u) { assign[el.dataset.u] = +el.value; pages.forEach((p) => (p.centered = true)); refreshAll() }
  })
  let drag: { x: number; y: number } | null = null
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing' })
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return
    const L = layout(cur), s = Math.min((cv.clientWidth - 24) / L.W, (cv.clientHeight - 24) / L.H)
    pages[cur].pos = { x: pages[cur].pos.x + (e.clientX - drag.x) / s, y: pages[cur].pos.y + (e.clientY - drag.y) / s }
    pages[cur].centered = false; drag = { x: e.clientX, y: e.clientY }; preview()
  })
  cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab' })
  for (const el of [paperSel, orient, scaleSel, ratio, margin, lw, showScale, corner]) el.addEventListener('input', () => {
    if (el === scaleSel || el === ratio) {
      pages[cur].scaleKey = scaleSel.value; pages[cur].ratio = parseFloat(ratio.value) || 1; pages[cur].centered = true
      $('pgCustom').hidden = scaleSel.value !== 'custom'
    } else if (el !== lw && el !== showScale && el !== corner) pages.forEach((p) => (p.centered = true))
    preview()
  })
  $('pgCenter').onclick = () => { pages[cur].centered = true; preview() }
  $('pgCancel').onclick = () => dlg.close()
  $('pgPdf').onclick = () => {
    if (d.units().some((u) => u.shapes.some((s) => s.t === 'text' && /[^\u0000-ÿ]/.test(s.s)))) d.toast(d.t('pdfThai'))
    d.save(toPdf(), 'drawing.pdf'); dlg.close()
  }
  $('pgPrint').onclick = () => { dlg.close(); printPages() }
  return { open() { pages.forEach((p) => (p.centered = true)); dlg.showModal(); refreshAll() } }
}
