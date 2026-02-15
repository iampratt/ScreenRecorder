import { app, BrowserWindow, desktopCapturer, ipcMain, shell } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

let mainWindow: BrowserWindow | null = null


const videosDir: string=join(process.cwd(), 'videos')


function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#1c1917',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    })

    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

function setupIPC(): void {
    ipcMain.handle('get-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 320, height: 180 },
                fetchWindowIcons: true
            })
            console.log(`[get-sources] Found ${sources.length} sources`)

            if (process.platform === 'darwin' && sources.length === 0) {
                console.warn('[get-sources] No sources found on macOS. Likely permission issue.')
            }

            return sources.map(source => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL(),
                appIcon: source.appIcon?.toDataURL() || null,
                display_id: source.display_id
            }))
        } catch (error) {
            console.error('[get-sources] Full error object:', error)
            console.error('[get-sources] Error name:', error instanceof Error ? error.name : 'unknown')
            console.error('[get-sources] Error message:', error instanceof Error ? error.message : String(error))
            console.error('[get-sources] Error stack:', error instanceof Error ? error.stack : 'no stack')
            return []
        }
    })

    ipcMain.handle('open-settings', () => {
        if (process.platform === 'darwin') {
            shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
        }
    })

    ipcMain.handle('create-session', () => {
        const sessionId = uuidv4()
        const dir = join(videosDir, sessionId)
        mkdirSync(dir, { recursive: true })
        return sessionId
    })

    ipcMain.handle('save-recording', (_event, sessionId: string, type: string, buffer: ArrayBuffer) => {
        const dir = join(videosDir, sessionId)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
        const filename = type === 'screen' ? 'screen.webm' : 'webcam.webm'
        const filePath = join(dir, filename)
        writeFileSync(filePath, Buffer.from(buffer))
        return filePath
    })

    ipcMain.handle('open-folder', async (_event, sessionId: string) => {
        const dir = join(videosDir, sessionId)
        if (existsSync(dir)) {
            await shell.openPath(dir)
        }
    })

    ipcMain.handle('get-sessions', () => {
        if (!existsSync(videosDir)) return []

        return readdirSync(videosDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => {
                const folderPath = join(videosDir, d.name)
                const files = readdirSync(folderPath)
                let name = d.name.slice(0, 8)
                const metaPath = join(folderPath, 'meta.json')
                if (existsSync(metaPath)) {
                    try {
                        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
                        if (meta.name) name = meta.name
                    } catch {}
                }
                return {
                    id: d.name,
                    name,
                    files,
                    hasScreen: files.includes('screen.webm'),
                    hasWebcam: files.includes('webcam.webm')
                }
            })
            .reverse()
    })

    ipcMain.handle('rename-session', (_event, sessionId: string, newName: string) => {
        const dir = join(videosDir, sessionId)
        if (existsSync(dir)) {
            writeFileSync(join(dir, 'meta.json'), JSON.stringify({ name: newName }))
            return true
        }
        return false
    })
}

app.whenReady().then(() => {
    setupIPC()
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
