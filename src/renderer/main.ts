import './styles.css'

declare global {
  interface Window {
    radial: {
      hide: () => void
      quit: () => void
      launch: (appId: string) => void
      openUrl: (url: string) => void
      openDevTools: () => void
    }
  }
}

// ───────── Menu config (mirrors what would live in ~/.radial) ─────────
type IconStyle = 'fas' | 'fab' | 'far'

interface MenuItem {
  id: string
  label: string
  icon: string
  iconStyle?: IconStyle
  command?: string
  url?: string
  children?: MenuItem[]
  theme?: boolean
  close?: boolean
  inspect?: boolean
}

const ROOT: MenuItem[] = [
  { id: 'files', label: 'Files', icon: 'fa-folder-open', command: 'files' },
  { id: 'terminal', label: 'Terminal', icon: 'fa-terminal', command: 'terminal' },
  { id: 'chrome', label: 'Chrome', icon: 'fa-chrome', iconStyle: 'fab', command: 'chrome' },
  { id: 'settings', label: 'Settings', icon: 'fa-gear', command: 'settings' },
  {
    id: 'google', label: 'Google', icon: 'fa-google', iconStyle: 'fab', children: [
      { id: 'gmail', label: 'Gmail', icon: 'fa-envelope', url: 'https://mail.google.com/' },
      { id: 'youtube', label: 'YouTube', icon: 'fa-youtube', iconStyle: 'fab', url: 'https://www.youtube.com/' },
      { id: 'gmusic', label: 'Google Music', icon: 'fa-music', url: 'https://music.youtube.com/' },
      { id: 'gcal', label: 'Google Calendar', icon: 'fa-calendar-days', url: 'https://calendar.google.com/' },
      { id: 'gdrive', label: 'Google Drive', icon: 'fa-google-drive', iconStyle: 'fab', url: 'https://drive.google.com/' },
    ],
  },
  {
    id: 'ai', label: 'AI', icon: 'fa-robot', children: [
      { id: 'gemini', label: 'Gemini', icon: 'fa-gem', url: 'https://gemini.google.com/' },
      { id: 'claude', label: 'Claude AI', icon: 'fa-brain', url: 'https://claude.ai/' },
      { id: 'chatgpt', label: 'ChatGPT', icon: 'fa-comments', url: 'https://chat.openai.com/' },
    ],
  },
  {
    id: 'pro', label: 'Professional', icon: 'fa-briefcase', children: [
      { id: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin', iconStyle: 'fab', url: 'https://www.linkedin.com/' },
      { id: 'github', label: 'GitHub', icon: 'fa-github', iconStyle: 'fab', url: 'https://github.com/' },
    ],
  },
  { id: 'theme', label: 'Theme (light/dark/auto)', icon: 'fa-circle-half-stroke', theme: true },
  { id: 'inspect', label: 'Inspect', icon: 'fa-bug', inspect: true },
]

// ───────── Geometry ─────────
const SIZE = 760
const CENTER = SIZE / 2
const CENTER_RADIUS = 16       // much smaller blue handle
const TRIGGER_INNER = 28       // 12px gap from the 16px center handle
const GAP = 12                 // thinner, uniform gap between rings
const RING_THICKNESS = 64      // identical width for ALL rings

function ringInner(level: number): number {
  // level -1 = Trigger Ring (first ring)
  // level 0 = ROOT command ring (second ring)
  if (level === -1) return TRIGGER_INNER
  // Subsequent rings start after the trigger ring + n*(thickness + gap)
  return TRIGGER_INNER + (level + 1) * (RING_THICKNESS + GAP)
}
function ringOuter(level: number): number {
  return ringInner(level) + RING_THICKNESS
}

// ───────── State ─────────
// rootOpen: when false only the center disc + trigger ring are drawn
let rootOpen = false
const breadcrumb: MenuItem[] = []
// How many rings were on-screen at the previous render.
let prevDepth = 0

// ───────── Theme ─────────
type ThemeMode = 'light' | 'dark' | 'auto'
const THEME_KEY = 'radial.theme'

function loadTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY) as ThemeMode | null
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
}

function applyTheme(mode: ThemeMode): void {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches
  const effective = mode === 'auto' ? (sysDark ? 'dark' : 'light') : mode
  document.documentElement.classList.toggle('dark', effective === 'dark')
}

function cycleTheme(): ThemeMode {
  const cur = loadTheme()
  const next: ThemeMode = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light'
  localStorage.setItem(THEME_KEY, next)
  applyTheme(next)
  return next
}

applyTheme(loadTheme())
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (loadTheme() === 'auto') applyTheme('auto')
})

// ───────── SVG helpers ─────────
function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg - 90) * Math.PI / 180

  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** Build a closed pie-segment (annular wedge) path. */
function arcPath(
  cx: number, cy: number,
  rIn: number, rOut: number,
  startDeg: number, endDeg: number,
): string {
  const [x1, y1] = polar(cx, cy, rOut, startDeg)
  const [x2, y2] = polar(cx, cy, rOut, endDeg)
  const [x3, y3] = polar(cx, cy, rIn, endDeg)
  const [x4, y4] = polar(cx, cy, rIn, startDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${x1} ${y1}`,
    `A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

// ───────── Rendering ─────────
const appEl = document.querySelector<HTMLDivElement>('#app')!

function render(): void {
  const levels: MenuItem[][] = []
  if (rootOpen) {
    levels.push(ROOT)
    for (const parent of breadcrumb) {
      if (parent.children && parent.children.length > 0) {
        levels.push(parent.children)
      }
    }
  }

  // Only animate when a new ring appears (expansion). Collapse = instant.
  const newLevelIndex = levels.length > prevDepth ? levels.length - 1 : -1
  prevDepth = levels.length

  const wedgesByLevel: string[][] = []
  const iconsByLevel: string[][] = []

  for (let level = 0; level < levels.length; level++) {
    const items = levels[level]!
    const rIn = ringInner(level)
    const rOut = ringOuter(level)
    wedgesByLevel[level] = []
    iconsByLevel[level] = []
    const n = items.length
    const slice = 360 / n
    const offset = -slice / 2

    for (let i = 0; i < n; i++) {
      const item = items[i]!
      const start = offset + i * slice
      const end = start + slice
      const d = arcPath(CENTER, CENTER, rIn, rOut, start, end)
      const mid = (start + end) / 2
      const midR = (rIn + rOut) / 2
      const [ix, iy] = polar(CENTER, CENTER, midR, mid)

      const isActive =
        level < breadcrumb.length && breadcrumb[level]!.id === item.id

      const iconStyle = item.iconStyle ?? 'fas'
      const tooltip = item.children
        ? `${item.label} (folder)`
        : item.label

      wedgesByLevel[level]!.push(
        `<path class="wedge${isActive ? ' active' : ''}" data-level="${level}" data-id="${item.id}" d="${d}"><title>${escapeHtml(tooltip)}</title></path>`
      )
      iconsByLevel[level]!.push(
        `<div class="icon-label" style="left:${ix}px;top:${iy}px;"><i class="${iconStyle} ${item.icon}"></i></div>`
      )
    }
  }

  const svgGroups = wedgesByLevel.map((wedges, level) => {
    const rIn = ringInner(level)
    const rOut = ringOuter(level)
    const rMid = (rIn + rOut) / 2
    const cls = level === newLevelIndex ? 'ring-group ring-expand' : 'ring-group'
    const bg = `<circle class="ring-track ring-track-${level}" cx="${CENTER}" cy="${CENTER}" r="${rMid}" stroke-width="${RING_THICKNESS}" />`
    return `<g class="${cls}" data-r-in="${rIn}" data-r-out="${rOut}">${bg}${wedges.join('')}</g>`
  }).join('\n')

  const iconGroups = iconsByLevel.map((ics, level) => {
    const rIn = ringInner(level)
    const rOut = ringOuter(level)
    const cls = level === newLevelIndex ? 'icon-ring ring-expand' : 'icon-ring'
    return `<div class="${cls}" data-r-in="${rIn}" data-r-out="${rOut}">${ics.join('')}</div>`
  }).join('\n')

  // Trigger Ring (Level -1) geometry
  const trIn = ringInner(-1)
  const trOut = ringOuter(-1)
  const trMid = (trIn + trOut) / 2

  appEl.innerHTML = `
    <div id="stage" class="flex h-screen w-screen items-center justify-center">
      <div
        id="surface"
        class="relative"
        style="width:${SIZE}px;height:${SIZE}px;"
      >
        <svg
          class="radial-svg absolute inset-0"
          width="${SIZE}" height="${SIZE}"
          viewBox="0 0 ${SIZE} ${SIZE}"
          style="z-index: 1;"
        >
          <!-- Trigger Ring: The menu starting point -->
          <circle
            class="trigger-ring"
            cx="${CENTER}" cy="${CENTER}" r="${trMid}" stroke-width="${RING_THICKNESS}"
          >
            <title>Menu</title>
          </circle>

          ${svgGroups}
        </svg>

        <div class="icon-layer" style="z-index: 2;">
          ${iconGroups}
        </div>

        <!-- Center Handle: HTML element so -webkit-app-region: drag actually works -->
        <div
          id="center"
          class="center-disc drag"
          title="Drag to move"
          style="left:${CENTER - CENTER_RADIUS}px;top:${CENTER - CENTER_RADIUS}px;width:${CENTER_RADIUS * 2}px;height:${CENTER_RADIUS * 2}px;"
        ></div>
      </div>
    </div>
  `

  // Wire events
  appEl.querySelectorAll<SVGPathElement>('path.wedge').forEach((el) => {
    el.addEventListener('click', onWedgeClick)
  })
  appEl.querySelector<SVGCircleElement>('.trigger-ring')?.addEventListener('click', onTriggerClick)
}

function onTriggerClick(): void {
  rootOpen = !rootOpen
  if (!rootOpen) breadcrumb.length = 0
  render()
}

function findItem(level: number, id: string): MenuItem | undefined {
  const levels: MenuItem[][] = [ROOT]
  for (const parent of breadcrumb) {
    if (parent.children) levels.push(parent.children)
  }
  return levels[level]?.find((m) => m.id === id)
}

function onWedgeClick(e: Event): void {
  const el = e.currentTarget as SVGPathElement
  const level = Number(el.dataset['level'])
  const id = el.dataset['id']!
  const item = findItem(level, id)
  if (!item) return

  if (item.close) {
    window.radial.quit()
    return
  }

  if (item.inspect) {
    window.radial.openDevTools()
    collapseToCenter()
    return
  }

  if (item.theme) {
    cycleTheme()
    return
  }

  if (item.children && item.children.length > 0) {
    if (breadcrumb[level]?.id === item.id) {
      // folder already open on this ring → toggle closed (drop it + any deeper)
      breadcrumb.length = level
    } else {
      // truncate breadcrumb to this level, then open this folder
      breadcrumb.length = level
      breadcrumb.push(item)
    }
    render()
    return
  }

  if (item.command) {
    window.radial.launch(item.command)
    collapseToCenter()
    return
  }

  if (item.url) {
    window.radial.openUrl(item.url)
    collapseToCenter()
    return
  }
}

function collapseToCenter(): void {
  breadcrumb.length = 0
  rootOpen = false
  render()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ───────── Keyboard ─────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (breadcrumb.length > 0) {
      breadcrumb.pop()
      render()
    } else if (rootOpen) {
      rootOpen = false
      render()
    } else {
      window.radial.quit()
    }
  }
})

render()
