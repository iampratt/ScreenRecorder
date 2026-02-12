import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    createSession: () => ipcRenderer.invoke('create-session'),
    saveRecording: (sessionId: string, type: string, buffer: ArrayBuffer) =>
        ipcRenderer.invoke('save-recording', sessionId, type, buffer),
    openFolder: (sessionId: string) => ipcRenderer.invoke('open-folder', sessionId),
    getSessions: () => ipcRenderer.invoke('get-sessions'),
    renameSession: (sessionId: string, newName: string) =>
        ipcRenderer.invoke('rename-session', sessionId, newName),
    openSettings: () => ipcRenderer.invoke('open-settings')
})
