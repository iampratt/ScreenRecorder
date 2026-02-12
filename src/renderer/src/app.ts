import { ScreenRecorder, WebcamRecorder } from './recorder'
import type { SourceInfo, SessionInfo } from './env'

export class App {
    private sources: SourceInfo[] = []
    private selectedSource: SourceInfo | null = null
    private webcamEnabled = false
    private isRecording = false
    private currentSessionId: string | null = null
    private screenRecorder = new ScreenRecorder()
    private webcamRecorder = new WebcamRecorder()
    private timerInterval: ReturnType<typeof setInterval> | null = null
    private elapsedSeconds = 0
    private previewStream: MediaStream | null = null

    // DOM refs
    private el = {
        sourcesList: null as HTMLElement | null,
        sessionsList: null as HTMLElement | null,
        previewVideo: null as HTMLVideoElement | null,
        webcamPreview: null as HTMLVideoElement | null,
        idleState: null as HTMLElement | null,
        webcamToggle: null as HTMLButtonElement | null,
        recordBtn: null as HTMLButtonElement | null,
        timer: null as HTMLElement | null,
        completeOverlay: null as HTMLElement | null,
        completeInfo: null as HTMLElement | null,
        completeFiles: null as HTMLElement | null,
        openFolderBtn: null as HTMLButtonElement | null,
        newRecordingBtn: null as HTMLButtonElement | null,
        refreshBtn: null as HTMLButtonElement | null,
        recordingIndicator: null as HTMLElement | null,
        errorToast: null as HTMLElement | null,
        errorMessage: null as HTMLElement | null,
    }

    async init(): Promise<void> {
        this.bindElements()
        this.bindEvents()
        await this.loadSources()
        await this.loadSessions()
        this.setupBeforeUnload()
    }

    private bindElements(): void {
        this.el.sourcesList = document.getElementById('sources-list')
        this.el.sessionsList = document.getElementById('sessions-list')
        this.el.previewVideo = document.getElementById('preview-video') as HTMLVideoElement
        this.el.webcamPreview = document.getElementById('webcam-preview') as HTMLVideoElement
        this.el.idleState = document.getElementById('idle-state')
        this.el.webcamToggle = document.getElementById('webcam-toggle') as HTMLButtonElement
        this.el.recordBtn = document.getElementById('record-btn') as HTMLButtonElement
        this.el.timer = document.getElementById('timer')
        this.el.completeOverlay = document.getElementById('complete-overlay')
        this.el.completeInfo = document.getElementById('complete-info')
        this.el.completeFiles = document.getElementById('complete-files')
        this.el.openFolderBtn = document.getElementById('open-folder-btn') as HTMLButtonElement
        this.el.newRecordingBtn = document.getElementById('new-recording-btn') as HTMLButtonElement
        this.el.refreshBtn = document.getElementById('refresh-sources') as HTMLButtonElement
        this.el.recordingIndicator = document.getElementById('recording-indicator')
        this.el.errorToast = document.getElementById('error-toast')
        this.el.errorMessage = document.getElementById('error-message')
    }

    private bindEvents(): void {
        this.el.refreshBtn?.addEventListener('click', () => this.loadSources())
        this.el.webcamToggle?.addEventListener('click', () => this.toggleWebcam())
        this.el.recordBtn?.addEventListener('click', () => this.toggleRecording())
        this.el.openFolderBtn?.addEventListener('click', () => this.openFolder())
        this.el.newRecordingBtn?.addEventListener('click', () => this.newRecording())
    }

    /* ── Sources ──────────────────────────────────────── */

    private async loadSources(): Promise<void> {
        try {
            this.sources = await window.electronAPI.getSources()
            this.renderSources()
        } catch (err) {
            console.error('Failed to load sources:', err)
        }
    }

    private renderSources(): void {
        if (!this.el.sourcesList) return
        this.el.sourcesList.innerHTML = ''

        const screens = this.sources.filter(s => s.id.startsWith('screen:'))
        const windows = this.sources.filter(s => s.id.startsWith('window:'))

        if (screens.length === 0 && windows.length === 0) {
            const help = document.createElement('div')
            help.className = 'sources-empty-help'
            help.innerHTML = `
                <div class="empty-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                </div>
                <p>No sources found.</p>
                <p class="small">If you're on macOS, you may need to grant Screen Recording permission.</p>
                <button id="open-settings-btn" class="btn btn-secondary btn-small">Open Settings</button>
            `
            this.el.sourcesList.appendChild(help)
            document.getElementById('open-settings-btn')?.addEventListener('click', () => window.electronAPI.openSettings())
            return
        }

        if (screens.length > 0) {
            this.addGroupLabel('Screens')
            screens.forEach(s => this.addSourceCard(s))
        }
        if (windows.length > 0) {
            this.addGroupLabel('Windows')
            windows.forEach(s => this.addSourceCard(s))
        }
    }

    private addGroupLabel(text: string): void {
        const label = document.createElement('div')
        label.className = 'source-group-label'
        label.textContent = text
        this.el.sourcesList!.appendChild(label)
    }

    private addSourceCard(source: SourceInfo): void {
        const card = document.createElement('div')
        card.className = 'source-card'
        if (this.selectedSource?.id === source.id) card.classList.add('selected')
        if (this.isRecording) card.style.pointerEvents = 'none'

        card.innerHTML = `
      <div class="source-thumbnail"><img src="${source.thumbnail}" alt="${source.name}" /></div>
      <div class="source-info">
        ${source.appIcon ? `<img src="${source.appIcon}" class="source-icon" alt="" />` : ''}
        <span class="source-name">${source.name}</span>
      </div>`

        card.addEventListener('click', () => this.selectSource(source))
        this.el.sourcesList!.appendChild(card)
    }

    private async selectSource(source: SourceInfo): Promise<void> {
        if (this.isRecording) return
        this.selectedSource = source
        this.renderSources()

        // Stop existing preview
        this.stopPreview()

        try {
            this.previewStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id
                    }
                } as any
            })

            if (this.el.previewVideo) {
                this.el.previewVideo.srcObject = this.previewStream
                this.el.previewVideo.classList.remove('hidden')
            }
            this.el.idleState?.classList.add('hidden')

            // Enable record button
            if (this.el.recordBtn) this.el.recordBtn.disabled = false
        } catch (err) {
            console.error('Failed to start preview:', err)
            this.showError('Failed to capture selected source')
        }
    }

    private stopPreview(): void {
        this.previewStream?.getTracks().forEach(t => t.stop())
        this.previewStream = null
        if (this.el.previewVideo) {
            this.el.previewVideo.srcObject = null
        }
    }

    /* ── Webcam ───────────────────────────────────────── */

    private async toggleWebcam(): Promise<void> {
        this.webcamEnabled = !this.webcamEnabled
        this.el.webcamToggle?.classList.toggle('active', this.webcamEnabled)

        if (this.webcamEnabled) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                    audio: false
                })
                if (this.el.webcamPreview) {
                    this.el.webcamPreview.srcObject = stream
                    this.el.webcamPreview.classList.remove('hidden')
                }
            } catch (err) {
                console.error('Webcam error:', err)
                this.webcamEnabled = false
                this.el.webcamToggle?.classList.remove('active')
                this.showError('Webcam access denied. Check your permissions.')
            }
        } else {
            this.stopWebcamPreview()
        }
    }

    private stopWebcamPreview(): void {
        if (this.el.webcamPreview) {
            const stream = this.el.webcamPreview.srcObject as MediaStream | null
            stream?.getTracks().forEach(t => t.stop())
            this.el.webcamPreview.srcObject = null
            this.el.webcamPreview.classList.add('hidden')
        }
    }

    /* ── Recording ────────────────────────────────────── */

    private async toggleRecording(): Promise<void> {
        if (this.isRecording) {
            await this.stopRecording()
        } else {
            await this.startRecording()
        }
    }

    private async startRecording(): Promise<void> {
        if (!this.selectedSource) return

        try {
            this.currentSessionId = await window.electronAPI.createSession()
            this.isRecording = true
            this.updateRecordingUI(true)

            // Start screen recording
            const screenStream = await this.screenRecorder.start(this.selectedSource.id)

            // Update preview with the recording stream
            if (this.el.previewVideo) {
                this.previewStream?.getTracks().forEach(t => t.stop())
                this.previewStream = screenStream
                this.el.previewVideo.srcObject = screenStream
            }

            // Start webcam recording if enabled
            if (this.webcamEnabled) {
                try {
                    const webcamStream = await this.webcamRecorder.start()
                    if (this.el.webcamPreview) {
                        this.el.webcamPreview.srcObject = webcamStream
                        this.el.webcamPreview.classList.remove('hidden')
                    }
                } catch (err) {
                    console.error('Webcam recording failed:', err)
                    this.showError('Webcam recording failed, continuing with screen only')
                }
            }

            this.startTimer()
        } catch (err) {
            console.error('Failed to start recording:', err)
            this.isRecording = false
            this.updateRecordingUI(false)
            this.showError('Failed to start recording')
        }
    }

    private async stopRecording(): Promise<void> {
        this.isRecording = false
        this.stopTimer()
        this.updateRecordingUI(false)

        try {
            // Stop screen recording and save
            const screenBlob = await this.screenRecorder.stop()
            this.screenRecorder.cleanup()

            if (this.currentSessionId && screenBlob.size > 0) {
                const buffer = await screenBlob.arrayBuffer()
                await window.electronAPI.saveRecording(this.currentSessionId, 'screen', buffer)
            }

            // Stop webcam recording and save
            if (this.webcamEnabled) {
                const webcamBlob = await this.webcamRecorder.stop()
                this.webcamRecorder.cleanup()

                if (this.currentSessionId && webcamBlob.size > 0) {
                    const buffer = await webcamBlob.arrayBuffer()
                    await window.electronAPI.saveRecording(this.currentSessionId, 'webcam', buffer)
                }
            }

            // Show complete screen
            this.showCompleteOverlay()
            await this.loadSessions()

            // Restart preview with fresh stream
            if (this.selectedSource) {
                try {
                    this.previewStream = await navigator.mediaDevices.getUserMedia({
                        audio: false,
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: this.selectedSource.id
                            }
                        } as any
                    })
                    if (this.el.previewVideo) {
                        this.el.previewVideo.srcObject = this.previewStream
                    }
                } catch { /* preview fails silently */ }
            }
        } catch (err) {
            console.error('Failed to save recording:', err)
            this.showError('Error saving recording')
        }
    }

    private updateRecordingUI(recording: boolean): void {
        this.el.recordBtn?.classList.toggle('recording', recording)
        this.el.timer?.classList.toggle('active', recording)
        this.el.recordingIndicator?.classList.toggle('hidden', !recording)

        const label = this.el.recordBtn?.querySelector('.record-label')
        if (label) label.textContent = recording ? 'Stop Recording' : 'Start Recording'

        // Disable source switching during recording
        this.renderSources()
    }

    /* ── Timer ────────────────────────────────────────── */

    private startTimer(): void {
        this.elapsedSeconds = 0
        this.updateTimerDisplay()
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds++
            this.updateTimerDisplay()
        }, 1000)
    }

    private stopTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval)
            this.timerInterval = null
        }
    }

    private updateTimerDisplay(): void {
        const h = Math.floor(this.elapsedSeconds / 3600)
        const m = Math.floor((this.elapsedSeconds % 3600) / 60)
        const s = this.elapsedSeconds % 60
        const pad = (n: number) => n.toString().padStart(2, '0')
        if (this.el.timer) {
            this.el.timer.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`
        }
    }

    /* ── Complete Overlay ─────────────────────────────── */

    private showCompleteOverlay(): void {
        if (this.el.completeInfo) {
            this.el.completeInfo.textContent = `Session ${this.currentSessionId?.slice(0, 8)}...`
        }
        if (this.el.completeFiles) {
            const badges: string[] = ['<span class="complete-file-badge">screen.webm</span>']
            if (this.webcamEnabled) badges.push('<span class="complete-file-badge">webcam.webm</span>')
            this.el.completeFiles.innerHTML = badges.join('')
        }
        this.el.completeOverlay?.classList.remove('hidden')
    }

    private async openFolder(): Promise<void> {
        if (this.currentSessionId) {
            await window.electronAPI.openFolder(this.currentSessionId)
        }
    }

    private newRecording(): void {
        this.el.completeOverlay?.classList.add('hidden')
        this.elapsedSeconds = 0
        this.updateTimerDisplay()
        this.currentSessionId = null
    }

    /* ── Sessions ─────────────────────────────────────── */

    private async loadSessions(): Promise<void> {
        try {
            const sessions = await window.electronAPI.getSessions()
            this.renderSessions(sessions)
        } catch (err) {
            console.error('Failed to load sessions:', err)
        }
    }

    private renderSessions(sessions: SessionInfo[]): void {
        if (!this.el.sessionsList) return
        this.el.sessionsList.innerHTML = ''

        if (sessions.length === 0) {
            const empty = document.createElement('div')
            empty.className = 'sessions-empty'
            empty.textContent = 'No recordings yet'
            this.el.sessionsList.appendChild(empty)
            return
        }

        sessions.forEach(session => {
            const item = document.createElement('div')
            item.className = 'session-item'

            const files: string[] = []
            if (session.hasScreen) files.push('screen')
            if (session.hasWebcam) files.push('webcam')

            item.innerHTML = `
        <span class="session-dot"></span>
        <div class="session-meta">
          <div class="session-name">${session.name}</div>
          <div class="session-files">${files.join(' + ')}</div>
        </div>`

            item.addEventListener('click', () => window.electronAPI.openFolder(session.id))
            this.el.sessionsList!.appendChild(item)
        })
    }

    /* ── Error Toast ──────────────────────────────────── */

    private showError(message: string): void {
        if (this.el.errorMessage) this.el.errorMessage.textContent = message
        this.el.errorToast?.classList.remove('hidden')
        setTimeout(() => this.el.errorToast?.classList.add('hidden'), 4000)
    }

    /* ── Before Unload ────────────────────────────────── */

    private setupBeforeUnload(): void {
        window.addEventListener('beforeunload', async () => {
            if (this.isRecording) {
                await this.stopRecording()
            }
        })
    }
}
