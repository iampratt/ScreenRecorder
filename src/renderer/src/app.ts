import {
    createRecorderState,
    startScreenRecording,
    startWebcamRecording,
    stopRecording,
    cleanupRecorder,
    type RecorderState
} from './recorder'
import type { SourceInfo, SessionInfo } from './env'

interface AppState {
    sources: SourceInfo[]
    selectedSource: SourceInfo | null
    webcamEnabled: boolean
    isRecording: boolean
    currentSessionId: string | null
    screenRecorder: RecorderState
    webcamRecorder: RecorderState
    timerInterval: ReturnType<typeof setInterval> | null
    elapsedSeconds: number
    previewStream: MediaStream | null
}

interface DOMElements {
    sourcesList: HTMLElement | null
    sessionsList: HTMLElement | null
    previewVideo: HTMLVideoElement | null
    webcamPreview: HTMLVideoElement | null
    idleState: HTMLElement | null
    webcamToggle: HTMLButtonElement | null
    recordBtn: HTMLButtonElement | null
    timer: HTMLElement | null
    completeOverlay: HTMLElement | null
    completeInfo: HTMLElement | null
    completeFiles: HTMLElement | null
    openFolderBtn: HTMLButtonElement | null
    newRecordingBtn: HTMLButtonElement | null
    refreshBtn: HTMLButtonElement | null
    recordingIndicator: HTMLElement | null
    errorToast: HTMLElement | null
    errorMessage: HTMLElement | null
}

function createAppState(): AppState {
    return {
        sources: [],
        selectedSource: null,
        webcamEnabled: false,
        isRecording: false,
        currentSessionId: null,
        screenRecorder: createRecorderState(),
        webcamRecorder: createRecorderState(),
        timerInterval: null,
        elapsedSeconds: 0,
        previewStream: null
    }
}

function getDOMElements(): DOMElements {
    return {
        sourcesList: document.getElementById('sources-list'),
        sessionsList: document.getElementById('sessions-list'),
        previewVideo: document.getElementById('preview-video') as HTMLVideoElement,
        webcamPreview: document.getElementById('webcam-preview') as HTMLVideoElement,
        idleState: document.getElementById('idle-state'),
        webcamToggle: document.getElementById('webcam-toggle') as HTMLButtonElement,
        recordBtn: document.getElementById('record-btn') as HTMLButtonElement,
        timer: document.getElementById('timer'),
        completeOverlay: document.getElementById('complete-overlay'),
        completeInfo: document.getElementById('complete-info'),
        completeFiles: document.getElementById('complete-files'),
        openFolderBtn: document.getElementById('open-folder-btn') as HTMLButtonElement,
        newRecordingBtn: document.getElementById('new-recording-btn') as HTMLButtonElement,
        refreshBtn: document.getElementById('refresh-sources') as HTMLButtonElement,
        recordingIndicator: document.getElementById('recording-indicator'),
        errorToast: document.getElementById('error-toast'),
        errorMessage: document.getElementById('error-message')
    }
}

async function loadSources(state: AppState, el: DOMElements): Promise<void> {
    try {
        state.sources = await window.electronAPI.getSources()
        renderSources(state, el)
    } catch (err) {
        console.error('Failed to load sources:', err)
    }
}

function renderSources(state: AppState, el: DOMElements): void {
    if (!el.sourcesList) return
    el.sourcesList.innerHTML = ''

    const screens = state.sources.filter(s => s.id.startsWith('screen:'))
    const windows = state.sources.filter(s => s.id.startsWith('window:'))

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
        el.sourcesList.appendChild(help)
        document.getElementById('open-settings-btn')?.addEventListener('click', () => window.electronAPI.openSettings())
        return
    }

    if (screens.length > 0) {
        addGroupLabel('Screens', el)
        screens.forEach(s => addSourceCard(s, state, el))
    }
    if (windows.length > 0) {
        addGroupLabel('Windows', el)
        windows.forEach(s => addSourceCard(s, state, el))
    }
}

function addGroupLabel(text: string, el: DOMElements): void {
    const label = document.createElement('div')
    label.className = 'source-group-label'
    label.textContent = text
    el.sourcesList!.appendChild(label)
}

function addSourceCard(source: SourceInfo, state: AppState, el: DOMElements): void {
    const card = document.createElement('div')
    card.className = 'source-card'
    if (state.selectedSource?.id === source.id) card.classList.add('selected')
    if (state.isRecording) card.style.pointerEvents = 'none'

    card.innerHTML = `
      <div class="source-thumbnail"><img src="${source.thumbnail}" alt="${source.name}" /></div>
      <div class="source-info">
        ${source.appIcon ? `<img src="${source.appIcon}" class="source-icon" alt="" />` : ''}
        <span class="source-name">${source.name}</span>
      </div>`

    card.addEventListener('click', () => selectSource(source, state, el))
    el.sourcesList!.appendChild(card)
}

async function selectSource(source: SourceInfo, state: AppState, el: DOMElements): Promise<void> {
    if (state.isRecording) return
    state.selectedSource = source
    renderSources(state, el)

    stopPreview(state, el)

    try {
        state.previewStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id
                }
            } as any
        })

        if (el.previewVideo) {
            el.previewVideo.srcObject = state.previewStream
            el.previewVideo.classList.remove('hidden')
        }
        el.idleState?.classList.add('hidden')

        if (el.recordBtn) el.recordBtn.disabled = false
    } catch (err) {
        console.error('Failed to start preview:', err)
        showError('Failed to capture selected source', el)

        if (el.recordBtn) el.recordBtn.disabled = true

        state.selectedSource = null
        renderSources(state, el)
    }
}

function stopPreview(state: AppState, el: DOMElements): void {
    state.previewStream?.getTracks().forEach(t => t.stop())
    state.previewStream = null
    if (el.previewVideo) {
        el.previewVideo.srcObject = null
    }
}

async function toggleWebcam(state: AppState, el: DOMElements): Promise<void> {
    state.webcamEnabled = !state.webcamEnabled
    el.webcamToggle?.classList.toggle('active', state.webcamEnabled)

    if (state.webcamEnabled) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false
            })
            if (el.webcamPreview) {
                el.webcamPreview.srcObject = stream
                el.webcamPreview.classList.remove('hidden')
            }
        } catch (err) {
            console.error('Webcam error:', err)
            state.webcamEnabled = false
            el.webcamToggle?.classList.remove('active')
            showError('Webcam access denied. Check your permissions.', el)
        }
    } else {
        stopWebcamPreview(el)
    }
}

function stopWebcamPreview(el: DOMElements): void {
    if (el.webcamPreview) {
        const stream = el.webcamPreview.srcObject as MediaStream | null
        stream?.getTracks().forEach(t => t.stop())
        el.webcamPreview.srcObject = null
        el.webcamPreview.classList.add('hidden')
    }
}

async function toggleRecording(state: AppState, el: DOMElements): Promise<void> {
    if (state.isRecording) {
        await stopRecordingSession(state, el)
    } else {
        await startRecordingSession(state, el)
    }
}

async function startRecordingSession(state: AppState, el: DOMElements): Promise<void> {
    if (!state.selectedSource || !state.previewStream) return

    try {
        state.currentSessionId = await window.electronAPI.createSession()
        state.isRecording = true
        updateRecordingUI(true, state, el)

        await startScreenRecording(state.screenRecorder, state.previewStream)

        if (state.webcamEnabled) {
            try {
                const webcamStream = await startWebcamRecording(state.webcamRecorder)
                if (el.webcamPreview) {
                    el.webcamPreview.srcObject = webcamStream
                    el.webcamPreview.classList.remove('hidden')
                }
            } catch (err) {
                console.error('Webcam recording failed:', err)
                showError('Webcam recording failed, continuing with screen only', el)
            }
        }

        startTimer(state, el)
    } catch (err) {
        console.error('Failed to start recording:', err)
        state.isRecording = false
        updateRecordingUI(false, state, el)
        showError('Failed to start recording', el)
    }
}

async function stopRecordingSession(state: AppState, el: DOMElements): Promise<void> {
    state.isRecording = false
    stopTimer(state)
    updateRecordingUI(false, state, el)

    try {
        const screenBlob = await stopRecording(state.screenRecorder)
        cleanupRecorder(state.screenRecorder)

        if (state.currentSessionId && screenBlob.size > 0) {
            try {
                const buffer = await screenBlob.arrayBuffer()
                await window.electronAPI.saveRecording(state.currentSessionId, 'screen', buffer)
            } catch (err) {
                console.error('Failed to convert screen blob:', err)
                showError('Failed to save screen recording (conversion error)', el)
            }
        }

        if (state.webcamEnabled) {
            const webcamBlob = await stopRecording(state.webcamRecorder)
            cleanupRecorder(state.webcamRecorder)

            if (state.currentSessionId && webcamBlob.size > 0) {
                try {
                    const buffer = await webcamBlob.arrayBuffer()
                    await window.electronAPI.saveRecording(state.currentSessionId, 'webcam', buffer)
                } catch (err) {
                    console.error('Failed to convert webcam blob:', err)
                    showError('Failed to save webcam recording (conversion error)', el)
                }
            }
        }

        showCompleteOverlay(state, el)
        await loadSessions(el)
    } catch (err) {
        console.error('Failed to save recording:', err)
        showError('Error saving recording', el)
    }
}

function updateRecordingUI(recording: boolean, state: AppState, el: DOMElements): void {
    el.recordBtn?.classList.toggle('recording', recording)
    el.timer?.classList.toggle('active', recording)
    el.recordingIndicator?.classList.toggle('hidden', !recording)

    const label = el.recordBtn?.querySelector('.record-label')
    if (label) label.textContent = recording ? 'Stop Recording' : 'Start Recording'

    renderSources(state, el)
}

function startTimer(state: AppState, el: DOMElements): void {
    state.elapsedSeconds = 0
    updateTimerDisplay(state, el)
    state.timerInterval = setInterval(() => {
        state.elapsedSeconds++
        updateTimerDisplay(state, el)
    }, 1000)
}

function stopTimer(state: AppState): void {
    if (state.timerInterval) {
        clearInterval(state.timerInterval)
        state.timerInterval = null
    }
}

function updateTimerDisplay(state: AppState, el: DOMElements): void {
    const h = Math.floor(state.elapsedSeconds / 3600)
    const m = Math.floor((state.elapsedSeconds % 3600) / 60)
    const s = state.elapsedSeconds % 60
    const pad = (n: number) => n.toString().padStart(2, '0')
    if (el.timer) {
        el.timer.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`
    }
}

function showCompleteOverlay(state: AppState, el: DOMElements): void {
    if (el.completeInfo) {
        el.completeInfo.textContent = `Session ${state.currentSessionId?.slice(0, 8)}...`
    }
    if (el.completeFiles) {
        const badges: string[] = ['<span class="complete-file-badge">screen.webm</span>']
        if (state.webcamEnabled) badges.push('<span class="complete-file-badge">webcam.webm</span>')
        el.completeFiles.innerHTML = badges.join('')
    }
    el.completeOverlay?.classList.remove('hidden')
}

async function openFolder(state: AppState): Promise<void> {
    if (state.currentSessionId) {
        await window.electronAPI.openFolder(state.currentSessionId)
    }
}

function newRecording(state: AppState, el: DOMElements): void {
    el.completeOverlay?.classList.add('hidden')
    state.elapsedSeconds = 0
    updateTimerDisplay(state, el)
    state.currentSessionId = null
}

async function loadSessions(el: DOMElements): Promise<void> {
    try {
        const sessions = await window.electronAPI.getSessions()
        renderSessions(sessions, el)
    } catch (err) {
        console.error('Failed to load sessions:', err)
    }
}

function renderSessions(sessions: SessionInfo[], el: DOMElements): void {
    if (!el.sessionsList) return
    el.sessionsList.innerHTML = ''

    if (sessions.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'sessions-empty'
        empty.textContent = 'No recordings yet'
        el.sessionsList.appendChild(empty)
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
        el.sessionsList!.appendChild(item)
    })
}

function showError(message: string, el: DOMElements): void {
    if (el.errorMessage) el.errorMessage.textContent = message
    el.errorToast?.classList.remove('hidden')
    setTimeout(() => el.errorToast?.classList.add('hidden'), 4000)
}

function setupEventListeners(state: AppState, el: DOMElements): void {
    el.refreshBtn?.addEventListener('click', () => loadSources(state, el))
    el.webcamToggle?.addEventListener('click', () => toggleWebcam(state, el))
    el.recordBtn?.addEventListener('click', () => toggleRecording(state, el))
    el.openFolderBtn?.addEventListener('click', () => openFolder(state))
    el.newRecordingBtn?.addEventListener('click', () => newRecording(state, el))

    window.addEventListener('beforeunload', async () => {
        if (state.isRecording) {
            await stopRecordingSession(state, el)
        }
    })
}

export async function initApp(): Promise<void> {
    const state = createAppState()
    const el = getDOMElements()

    setupEventListeners(state, el)
    await loadSources(state, el)
    await loadSessions(el)
}
