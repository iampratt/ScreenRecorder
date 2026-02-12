# ScreenCraft — Screen & Webcam Recorder

A cross-platform Electron desktop app for recording your screen and webcam simultaneously.

## Features

- **Screen/Window Picker** — View all available screens & windows with live thumbnails
- **Webcam Toggle** — Optionally record webcam as a separate feed
- **Independent Recordings** — Screen and webcam saved as separate `.webm` files
- **UUID Sessions** — Each recording stored in `videos/<uuid>/` with `screen.webm` + `webcam.webm`
- **Live Timer** — Real-time recording duration display
- **Recording Complete** — Post-recording screen with "Open Folder" button
- **Session History** — Browse previous recordings from the sidebar

## Tech Stack

- **Electron** — Cross-platform desktop runtime
- **TypeScript** — Type-safe main, preload, and renderer
- **electron-vite** — Fast HMR build tooling for Electron
- **MediaRecorder API** — Browser-native recording
- **Vanilla CSS** — Custom dark cinematic UI (no framework)

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Directory Structure

```
videos/
├── 4a12ffac-b243-4fa3-8c9f-1123dfeaa342/
│   ├── screen.webm
│   └── webcam.webm
├── ...
```

A new UUID-based folder is created for each recording session.

## Architecture

```
src/
├── main/index.ts          # Electron main process (IPC, file I/O)
├── preload/index.ts       # Context bridge (safe API exposure)
└── renderer/
    ├── index.html         # App shell
    └── src/
        ├── main.ts        # Entry point
        ├── app.ts         # App controller (UI + state)
        ├── recorder.ts    # MediaRecorder wrappers
        ├── styles.css     # Design system + theme
        └── env.d.ts       # Type declarations
```

## Known Limitations

- **Audio**: Currently captures video only (no system audio or microphone)
- **Format**: Recordings saved as `.webm` (VP9/VP8). No MP4 export yet.
- **macOS Permissions**: Screen recording permission must be granted in System Preferences → Privacy & Security → Screen Recording
- **Large Recordings**: Entire recording is buffered in memory before saving. Very long sessions (1hr+) may use significant RAM.
- **Mid-recording Close**: The app attempts to save partial data on close, but this is best-effort.
