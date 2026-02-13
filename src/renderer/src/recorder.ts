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

export class ScreenRecorder {
    private mediaRecorder: MediaRecorder | null = null
    private chunks: Blob[] = []
    private stream: MediaStream | null = null

    async start(sourceId: string): Promise<MediaStream> {
        this.chunks = []
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId
                }
            } as any
        })

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: getSupportedMimeType()
        })

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data)
        }

        this.mediaRecorder.start(10000) // 10s chunks to reduce memory usage
        return this.stream
    }

    async startWithStream(stream: MediaStream): Promise<void> {
        this.chunks = []
        this.stream = stream

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: getSupportedMimeType()
        })

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data)
        }

        this.mediaRecorder.start(10000) // 10s chunks to reduce memory usage
    }

    stop(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(new Blob(this.chunks, { type: 'video/webm' }))
                return
            }
            this.mediaRecorder.onstop = () => {
                resolve(new Blob(this.chunks, { type: 'video/webm' }))
            }
            this.mediaRecorder.stop()
        })
    }

    cleanup(): void {
        this.stream?.getTracks().forEach(t => t.stop())
        this.stream = null
        this.mediaRecorder = null
        this.chunks = []
    }

    getStream(): MediaStream | null {
        return this.stream
    }
}

export class WebcamRecorder {
    private mediaRecorder: MediaRecorder | null = null
    private chunks: Blob[] = []
    private stream: MediaStream | null = null

    async start(): Promise<MediaStream> {
        this.chunks = []
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
        })

        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: getSupportedMimeType()
        })

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data)
        }

        this.mediaRecorder.start(10000) // 10s chunks to reduce memory usage
        return this.stream
    }

    stop(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(new Blob(this.chunks, { type: 'video/webm' }))
                return
            }
            this.mediaRecorder.onstop = () => {
                resolve(new Blob(this.chunks, { type: 'video/webm' }))
            }
            this.mediaRecorder.stop()
        })
    }

    cleanup(): void {
        this.stream?.getTracks().forEach(t => t.stop())
        this.stream = null
        this.mediaRecorder = null
        this.chunks = []
    }

    getStream(): MediaStream | null {
        return this.stream
    }
}
