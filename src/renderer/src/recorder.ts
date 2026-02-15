function getSupportedMimeType(): string {
    const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
    ]
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type
    }
    return 'video/webm'
}

export interface RecorderState {
    mediaRecorder: MediaRecorder | null
    chunks: Blob[]
    stream: MediaStream | null
}

export function createRecorderState(): RecorderState {
    return {
        mediaRecorder: null,
        chunks: [],
        stream: null
    }
}

export async function startScreenRecording(
    state: RecorderState,
    stream: MediaStream
): Promise<void> {
    state.chunks = []
    state.stream = stream

    state.mediaRecorder = new MediaRecorder(state.stream, {
        mimeType: getSupportedMimeType()
    })

    state.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) state.chunks.push(e.data)
    }

    state.mediaRecorder.start(10000)
}

export async function startWebcamRecording(state: RecorderState): Promise<MediaStream> {
    state.chunks = []
    state.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
    })

    state.mediaRecorder = new MediaRecorder(state.stream, {
        mimeType: getSupportedMimeType()
    })

    state.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) state.chunks.push(e.data)
    }

    state.mediaRecorder.start(10000)
    return state.stream
}

export function stopRecording(state: RecorderState): Promise<Blob> {
    return new Promise((resolve) => {
        if (!state.mediaRecorder || state.mediaRecorder.state === 'inactive') {
            resolve(new Blob(state.chunks, { type: 'video/webm' }))
            return
        }
        state.mediaRecorder.onstop = () => {
            resolve(new Blob(state.chunks, { type: 'video/webm' }))
        }
        state.mediaRecorder.stop()
    })
}

export function cleanupRecorder(state: RecorderState): void {
    state.stream?.getTracks().forEach(t => t.stop())
    state.stream = null
    state.mediaRecorder = null
    state.chunks = []
}
