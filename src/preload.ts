import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('radial', {
    hide: () => ipcRenderer.send('radial:hide'),
    quit: () => ipcRenderer.send('radial:quit'),
    launch: (appId: string) => ipcRenderer.send('radial:launch', appId),
    openUrl: (url: string) => ipcRenderer.send('radial:openUrl', url),
    openDevTools: () => ipcRenderer.send('radial:openDevTools'),
    platform: process.platform,
})
