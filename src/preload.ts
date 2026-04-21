import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('radial', {
    hide: () => ipcRenderer.send('radial:hide'),
    quit: () => ipcRenderer.send('radial:quit'),
    dragStart: () => ipcRenderer.send('radial:drag-start'),
    dragStop: () => ipcRenderer.send('radial:drag-stop'),
    getPos: () => ipcRenderer.invoke('radial:get-pos'),
    move: (pos: { x: number, y: number }) => ipcRenderer.send('radial:move', pos),
    launch: (appId: string) => ipcRenderer.send('radial:launch', appId),
    openUrl: (url: string) => ipcRenderer.send('radial:openUrl', url),
})
