export type IconStyle = 'fas' | 'fab' | 'far'

export interface MenuItem {
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

const PLATFORM = window.radial.platform
const IS_MAC = PLATFORM === 'darwin'
const IS_WIN = PLATFORM === 'win32'

const filesItem: MenuItem = IS_MAC
  ? { id: 'files', label: 'Finder', icon: 'fa-folder-open', command: 'files' }
  : IS_WIN
    ? { id: 'files', label: 'Explorer', icon: 'fa-folder-open', command: 'files' }
    : { id: 'files', label: 'Files', icon: 'fa-folder-open', command: 'files' }

const terminalItems: MenuItem[] = IS_WIN
  ? [
      { id: 'cmd', label: 'Command Prompt', icon: 'fa-terminal', command: 'cmd' },
      { id: 'powershell', label: 'PowerShell', icon: 'fa-terminal', command: 'powershell' },
    ]
  : [{ id: 'terminal', label: 'Terminal', icon: 'fa-terminal', command: 'terminal' }]

const browserItems: MenuItem[] = IS_MAC
  ? [
      { id: 'chrome', label: 'Chrome', icon: 'fa-chrome', iconStyle: 'fab', command: 'chrome' },
      { id: 'safari', label: 'Safari', icon: 'fa-safari', iconStyle: 'fab', command: 'safari' },
    ]
  : [{ id: 'chrome', label: 'Chrome', icon: 'fa-chrome', iconStyle: 'fab', command: 'chrome' }]

export const ROOT_MENU: MenuItem[] = [
  filesItem,
  ...terminalItems,
  ...browserItems,
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
      { id: 'gemini', label: 'Gemini', icon: 'fa-wand-magic-sparkles gradient-icon', url: 'https://gemini.google.com/' },
      { id: 'claude', label: 'Claude AI', icon: 'fa-certificate text-[#D97757]', url: 'https://claude.ai/' },
      { id: 'chatgpt', label: 'ChatGPT', icon: 'fa-brands fa-instalod', url: 'https://chat.openai.com/' },
    ],
  },
  {
    id: 'pro', label: 'Professional', icon: 'fa-briefcase', children: [
      { id: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin', iconStyle: 'fab', url: 'https://www.linkedin.com/' },
      { id: 'github', label: 'GitHub', icon: 'fa-github', iconStyle: 'fab', url: 'https://github.com/' },
    ],
  },
  { id: 'settings', label: 'Settings', icon: 'fa-gear', command: 'settings' },
  { id: 'inspect', label: 'Inspect', icon: 'fa-bug', inspect: true },
  { id: 'theme', label: 'Theme (light/dark/auto)', icon: 'fa-circle-half-stroke', theme: true },
]
