export interface SourceInfo {
    id: string
    name: string
    thumbnail: string
    appIcon: string | null
    display_id: string
}

export interface SessionInfo {
    id: string
    name: string
    files: string[]
    hasScreen: boolean
    hasWebcam: boolean
}

export interface ElectronAPI {
    getSources(): Promise<SourceInfo[]>
    createSession(): Promise<string>
    saveRecording(sessionId: string, type: string, buffer: ArrayBuffer): Promise<string>
    openFolder(sessionId: string): Promise<void>
    getSessions(): Promise<SessionInfo[]>
    renameSession(sessionId: string, newName: string): Promise<boolean>
    openSettings(): Promise<void>
}

declare global {
    interface Window {
        electronAPI: ElectronAPI
    }
}
