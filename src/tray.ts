// Right-hand tray: panels the user can collapse, close, reorder (drag header) and reopen from the Window menu.
export type Panel = { id: string; title: () => string; render: (body: HTMLElement) => void; startClosed?: boolean }
type Layout = { order: string[]; collapsed: Record<string, boolean>; hidden: Record<string, boolean> }
const KEY = 'sketchcad.tray'

export function initTray(host: HTMLElement, panels: Panel[], closeLabel: () => string) {
  let L: Layout = { order: panels.map((p) => p.id), collapsed: Object.fromEntries(panels.filter((p) => p.startClosed).map((p) => [p.id, true])), hidden: {} }
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Layout | null; if (s?.order) L = { order: s.order, collapsed: { ...L.collapsed, ...s.collapsed }, hidden: s.hidden ?? {} } } catch { /* storage unavailable: use defaults */ }
  for (const p of panels) if (!L.order.includes(p.id)) L.order.push(p.id)
  L.order = L.order.filter((id) => panels.some((p) => p.id === id))
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)) } catch { /* ignore */ } }

  function build() {
    host.innerHTML = ''
    for (const id of L.order) {
      const p = panels.find((q) => q.id === id)!
      if (L.hidden[id]) continue
      const sec = document.createElement('section')
      sec.className = 'pn' + (L.collapsed[id] ? ' closed' : '')
      sec.dataset.id = id
      sec.innerHTML = `<header class="pnh" draggable="true"><span class="chv" aria-hidden="true"></span><span class="pnt"></span><button class="pnx" title="${closeLabel()}" aria-label="${closeLabel()}">×</button></header><div class="pnb"></div>`
      const head = sec.querySelector<HTMLElement>('.pnh')!
      sec.querySelector('.pnt')!.textContent = p.title()
      head.onclick = (e) => {
        if ((e.target as HTMLElement).closest('.pnx')) { L.hidden[id] = true; save(); build(); return }
        L.collapsed[id] = !L.collapsed[id]; save(); sec.classList.toggle('closed', L.collapsed[id])
        if (!L.collapsed[id]) p.render(sec.querySelector<HTMLElement>('.pnb')!) // render on first open
      }
      head.ondragstart = (e) => { e.dataTransfer?.setData('text/plain', id); sec.classList.add('dragging') }
      head.ondragend = () => sec.classList.remove('dragging')
      sec.ondragover = (e) => { e.preventDefault(); sec.classList.add('over') }
      sec.ondragleave = () => sec.classList.remove('over')
      sec.ondrop = (e) => {
        e.preventDefault()
        const from = e.dataTransfer?.getData('text/plain')
        if (!from || from === id) return build()
        L.order = L.order.filter((x) => x !== from)
        L.order.splice(L.order.indexOf(id), 0, from)
        save(); build()
      }
      host.appendChild(sec)
      if (!L.collapsed[id]) p.render(sec.querySelector<HTMLElement>('.pnb')!)
    }
  }
  /** Re-render open panels (collapsed ones render when opened). */
  function refresh() {
    for (const id of L.order) {
      const sec = host.querySelector<HTMLElement>(`.pn[data-id="${id}"]`)
      if (!sec) continue
      sec.querySelector('.pnt')!.textContent = panels.find((q) => q.id === id)!.title()
      if (!L.collapsed[id]) panels.find((q) => q.id === id)!.render(sec.querySelector<HTMLElement>('.pnb')!)
    }
  }
  build()
  return {
    refresh,
    rebuild: build,
    isOpen: (id: string) => !L.hidden[id],
    /** Show a panel and expand it (used to jump to the size fields). */
    open(id: string) { L.hidden[id] = false; L.collapsed[id] = false; save(); build() },
    toggle(id: string) { L.hidden[id] = !L.hidden[id]; if (!L.hidden[id]) L.collapsed[id] = false; save(); build() },
    panels,
  }
}
