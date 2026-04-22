import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell } from 'electron'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PID_FILE = path.join(process.env['XDG_RUNTIME_DIR'] ?? os.tmpdir(), 'radial.pid')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
    app.exit(0)
}

const WIN_SIZE = 760

if (process.platform === 'linux') {
    // Disable hardware acceleration entirely for maximum stability on Linux/Wayland/X11.
    // This resolves segmentation faults (exit code 139) and GPU process crashes.
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
}

let win: BrowserWindow | null = null

const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'

const APP_COMMANDS: Record<string, string[][]> = {
    files: IS_MAC
        ? [['open', '-a', 'Finder']]
        : IS_WIN
            ? [['explorer.exe']]
            : [['nautilus'], ['nemo'], ['dolphin'], ['thunar'], ['xdg-open', process.env['HOME'] ?? '/']],
    chrome: IS_MAC
        ? [['open', '-a', 'Google Chrome']]
        : IS_WIN
            ? [['cmd', '/c', 'start', 'chrome']]
            : [['google-chrome'], ['google-chrome-stable'], ['chromium-browser'], ['chromium']],
    safari: IS_MAC ? [['open', '-a', 'Safari']] : [],
    terminal: IS_MAC
        ? [['open', '-a', 'Terminal']]
        : [['gnome-terminal'], ['ptyxis'], ['konsole'], ['xfce4-terminal'], ['xterm']],
    cmd: IS_WIN ? [['cmd', '/c', 'start', '', 'cmd.exe']] : [],
    powershell: IS_WIN
        ? [
            ['cmd', '/c', 'start', '', 'pwsh.exe'],
            ['cmd', '/c', 'start', '', 'powershell.exe'],
        ]
        : [],
    settings: IS_MAC
        ? [['open', '-a', 'System Settings'], ['open', '-a', 'System Preferences']]
        : IS_WIN
            ? [['cmd', '/c', 'start', 'ms-settings:']]
            : [['gnome-control-center'], ['systemsettings5'], ['xfce4-settings-manager'], ['systemsettings'], ['nm-connection-editor']],
}

function launchApp(appId: string): void {
    const candidates = APP_COMMANDS[appId]
    if (!candidates) {
        console.warn(`[radial] unknown app id: ${appId}`)
        return
    }
    const tryNext = (i: number): void => {
        if (i >= candidates.length) {
            console.warn(`[radial] no launcher for ${appId} found on PATH`)
            return
        }
        const candidate = candidates[i]!
        const [exe, ...args] = candidate
        if (!exe) {
            tryNext(i + 1)
            return
        }
        try {
            const child = spawn(exe, args, { detached: true, stdio: 'ignore' })
            child.on('error', () => tryNext(i + 1))
            child.unref()
        } catch {
            tryNext(i + 1)
        }
    }
    tryNext(0)
}

function baseWindowOptions(): Electron.BrowserWindowConstructorOptions {
    const iconPath = path.join(__dirname, '../icons/radial512x512.png')
    return {
        frame: false,
        transparent: true,
        resizable: false,
        movable: true,
        alwaysOnTop: true,
        show: false,
        hasShadow: false,
        backgroundColor: '#00000000',
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    }
}

function createWindow(): void {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

    win = new BrowserWindow({
        ...baseWindowOptions(),
        width: WIN_SIZE,
        height: WIN_SIZE,
        x: sw - WIN_SIZE,
        y: sh - WIN_SIZE,
        skipTaskbar: !IS_MAC,
    })

    win.setMenuBarVisibility(false)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    win.webContents.once('did-finish-load', () => {
        win?.show()
        win?.focus()
    })

    win.on('closed', () => {
        win = null
    })
}

function showWindow(): void {
    if (!win) {
        createWindow()
        return
    }
    if (!win.isVisible()) {
        win.show()
    }
    if (win.isMinimized()) win.restore()
    win.focus()
}

function hideWindow(): void {
    if (win && !win.isDestroyed()) {
        win.hide()
    }
}

function toggleWindow(): void {
    if (!win) {
        createWindow()
        return
    }
    if (win.isVisible()) hideWindow()
    else showWindow()
}

function registerToggleShortcut(): void {
    const candidates: string[] = IS_MAC
        ? ['Option+R', 'Command+Option+R', 'CommandOrControl+Shift+R']
        : ['Control+Alt+R', 'Super+R', 'Alt+R']

    for (const accel of candidates) {
        try {
            const ok = globalShortcut.register(accel, toggleWindow)
            if (ok && globalShortcut.isRegistered(accel)) {
                console.log(`[radial] global shortcut registered: ${accel}`)
                return
            }
        } catch (err) {
            console.warn(`[radial] failed to register ${accel}:`, err)
        }
    }
    console.warn('[radial] could not register any global shortcut.')
}

app.on('second-instance', toggleWindow)
process.on('SIGUSR1', toggleWindow)

app.whenReady().then(() => {
    try {
        fs.writeFileSync(PID_FILE, String(process.pid), { flag: 'w' })
    } catch (err) {
        console.warn('[radial] could not write pid file:', err)
    }
    createWindow()
    registerToggleShortcut()
    app.on('activate', showWindow)
})

ipcMain.on('radial:hide', hideWindow)
ipcMain.on('radial:quit', () => app.quit())
ipcMain.on('radial:openDevTools', () => {
    win?.webContents.openDevTools({ mode: 'detach' })
})
ipcMain.on('radial:launch', (_e, appId: string) => {
    launchApp(appId)
})
ipcMain.on('radial:openUrl', (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url).catch((err) => {
            console.warn(`[radial] openExternal failed for ${url}:`, err)
        })
    }
})

app.on('window-all-closed', () => {
    // keep resident
})

app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    try {
        if (fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8') === String(process.pid)) {
            fs.unlinkSync(PID_FILE)
        }
    } catch {
        // ignore
    }
})
