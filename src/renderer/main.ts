import './styles.css'
import { ROOT_MENU, MenuItem } from './menu-config'

declare global {
  interface Window {
    radial: {
      hide: () => void
      quit: () => void
      launch: (appId: string) => void
      openUrl: (url: string) => void
      openDevTools: () => void
      platform: NodeJS.Platform
    }
  }
}

// ───────── Geometry Constants ─────────
const SIZE = 760
const CENTER = SIZE / 2
const CENTER_RADIUS = 32       // central drag handle
const TRIGGER_INNER = 44       // 12px gap from the center handle
const GAP = 12                 // uniform gap between rings
const RING_THICKNESS = 64      // identical width for ALL rings

// ───────── State ─────────
let rootOpen = false
const breadcrumb: MenuItem[] = []
let prevDepth = 0
let pendingCollapseTimeout: number | null = null
const COLLAPSE_MS = 500

// ───────── Theme Management ─────────
type ThemeMode = 'light' | 'dark' | 'auto'
const THEME_KEY = 'radial.theme'

const loadTheme = (): ThemeMode => {
  const v = localStorage.getItem(THEME_KEY) as ThemeMode | null
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
}

const applyTheme = (mode: ThemeMode): void => {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches
  const effective = mode === 'auto' ? (sysDark ? 'dark' : 'light') : mode
  document.documentElement.classList.toggle('dark', effective === 'dark')
}

const cycleTheme = (): ThemeMode => {
  const cur = loadTheme()
  const next: ThemeMode = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light'
  localStorage.setItem(THEME_KEY, next)
  applyTheme(next)
  return next
}

// ───────── Geometry Helpers ─────────
const ringInner = (level: number): number => 
  level === -1 ? TRIGGER_INNER : TRIGGER_INNER + (level + 1) * (RING_THICKNESS + GAP)

const ringOuter = (level: number): number => ringInner(level) + RING_THICKNESS

const polar = (cx: number, cy: number, r: number, angleDeg: number): [number, number] => {
  const rad = (angleDeg - 90) * Math.PI / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!))

// ───────── Rendering Logic ─────────
const appEl = document.querySelector<HTMLDivElement>('#app')!

const buildWedge = (item: MenuItem, level: number, i: number, n: number, midR: number): { wedge: string; icon: string } => {
  const slice = 360 / n
  const offset = -slice / 2
  const start = offset + i * slice
  const mid = start + slice / 2
  const [ix, iy] = polar(CENTER, CENTER, midR, mid)
  const dashOffset = 90 - start

  const isActive = level < breadcrumb.length && breadcrumb[level]!.id === item.id
  const iconStyle = item.iconStyle ?? 'fas'
  const tooltip = item.children ? `${item.label} (folder)` : item.label

  return {
    wedge: `<circle class="wedge${isActive ? ' active' : ''}" data-level="${level}" data-id="${item.id}" cx="${CENTER}" cy="${CENTER}" r="${midR}" pathLength="360" stroke-dasharray="${slice} ${360 - slice}" stroke-dashoffset="${dashOffset}"><title>${escapeHtml(tooltip)}</title></circle>`,
    icon: `<div class="icon-label" style="left:${ix}px;top:${iy}px;"><i class="${iconStyle} ${item.icon}"></i></div>`
  }
}

const buildDOM = (levels: MenuItem[][], newLevelIndex: number): void => {
  const svgGroups: string[] = []
  const iconGroups: string[] = []

  levels.forEach((items, level) => {
    const rIn = ringInner(level)
    const rOut = ringOuter(level)
    const rMid = (rIn + rOut) / 2
    const n = items.length
    
    const levelWedges: string[] = []
    const levelIcons: string[] = []
    
    items.forEach((item, i) => {
      const { wedge, icon } = buildWedge(item, level, i, n, rMid)
      levelWedges.push(wedge)
      levelIcons.push(icon)
    })

    const isExpanding = level === newLevelIndex
    const groupCls = `ring-group${isExpanding ? ' ring-expand' : ''}`
    const iconCls = `icon-ring${isExpanding ? ' ring-expand' : ''}`
    const vars = `--r-in:${rIn}px;--r-out:${rOut}px;--r-mid:${rMid}px;`
    
    svgGroups.push(`<g class="${groupCls}" style="${vars}"><circle class="ring-track ring-track-${level % 3}" cx="${CENTER}" cy="${CENTER}" r="${rMid}" />${levelWedges.join('')}</g>`)
    iconGroups.push(`<div class="${iconCls}" style="${vars}">${levelIcons.join('')}</div>`)
  })

  const trMid = (ringInner(-1) + ringOuter(-1)) / 2
  const centerSize = CENTER_RADIUS * 2

  appEl.innerHTML = `
    <div id="stage" class="flex h-screen w-screen items-center justify-center">
      <div id="surface" class="relative" style="width:${SIZE}px;height:${SIZE}px;">
        <svg class="radial-svg absolute inset-0" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" style="z-index: 1;">
          <circle class="trigger-ring" cx="${CENTER}" cy="${CENTER}" r="${trMid}"><title>Menu</title></circle>
          ${svgGroups.join('')}
        </svg>
        <div class="icon-layer" style="z-index: 2;">${iconGroups.join('')}</div>
        <div id="center" class="center-disc drag" style="left:${CENTER - CENTER_RADIUS}px;top:${CENTER - CENTER_RADIUS}px;width:${centerSize}px;height:${centerSize}px;">
          <span class="center-drag-glyph">&#x263C;&#xFE0E;</span>
        </div>
      </div>
    </div>
  `

  // Re-attach events
  appEl.querySelectorAll<SVGCircleElement>('circle.wedge').forEach(el => el.onclick = onWedgeClick)
  const trigger = appEl.querySelector<SVGCircleElement>('.trigger-ring')
  if (trigger) trigger.onclick = onTriggerClick
}

const render = (): void => {
  if (pendingCollapseTimeout !== null) {
    clearTimeout(pendingCollapseTimeout)
    pendingCollapseTimeout = null
  }

  const levels: MenuItem[][] = []
  if (rootOpen) {
    levels.push(ROOT_MENU)
    breadcrumb.forEach(parent => {
      if (parent.children?.length) levels.push(parent.children)
    })
  }

  if (levels.length < prevDepth) {
    const rings = appEl.querySelectorAll<SVGGElement>('g.ring-group')
    const iconRings = appEl.querySelectorAll<HTMLDivElement>('div.icon-ring')
    rings.forEach((ring, i) => i >= levels.length && ring.classList.add('ring-collapse'))
    iconRings.forEach((ring, i) => i >= levels.length && ring.classList.add('ring-collapse'))
    
    prevDepth = levels.length
    pendingCollapseTimeout = window.setTimeout(() => {
      pendingCollapseTimeout = null
      buildDOM(levels, -1)
    }, COLLAPSE_MS)
    return
  }

  const newLevelIndex = levels.length > prevDepth ? levels.length - 1 : -1
  prevDepth = levels.length
  buildDOM(levels, newLevelIndex)
}

// ───────── Event Handlers ─────────
const onTriggerClick = (e: MouseEvent): void => {
  e.stopPropagation()
  rootOpen = !rootOpen
  if (!rootOpen) breadcrumb.length = 0
  render()
}

const onWedgeClick = (e: MouseEvent): void => {
  e.stopPropagation()
  const el = e.currentTarget as SVGCircleElement
  const level = Number(el.dataset['level'])
  const id = el.dataset['id']!
  
  const levels = [ROOT_MENU, ...breadcrumb.map(b => b.children ?? [])]
  const item = levels[level]?.find(m => m.id === id)
  if (!item) return

  if (item.close) { window.radial.quit(); return }
  if (item.inspect) { window.radial.openDevTools(); collapseToCenter(); return }
  if (item.theme) { cycleTheme(); return }

  if (item.children?.length) {
    if (breadcrumb[level]?.id === item.id) {
      breadcrumb.length = level
    } else {
      breadcrumb.length = level
      breadcrumb.push(item)
    }
    render()
    return
  }

  if (item.command) window.radial.launch(item.command)
  if (item.url) window.radial.openUrl(item.url)
  collapseToCenter()
}

const collapseToCenter = (): void => {
  breadcrumb.length = 0
  rootOpen = false
  render()
}

// ───────── Initialization ─────────
applyTheme(loadTheme())
matchMedia('(prefers-color-scheme: dark)').onchange = () => {
  if (loadTheme() === 'auto') applyTheme('auto')
}

window.onkeydown = (e) => {
  if (e.key === 'Escape') {
    if (breadcrumb.length > 0) { breadcrumb.pop(); render() }
    else if (rootOpen) { rootOpen = false; render() }
    else window.radial.hide()
  }
}

// Close when clicking stage background (transparent area)
document.onclick = (e) => {
    if ((e.target as HTMLElement).id === 'stage') {
        collapseToCenter()
    }
}

render()
