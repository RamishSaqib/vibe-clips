# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development (starts both Vite + Tauri)
npm run tauri:dev

# Build for production
npm run tauri:build

# Frontend-only dev server (port 1420)
npm run dev

# Rust-only commands (from src-tauri/)
cargo build
cargo check
cargo clippy
```

## Testing

No automated tests are currently configured. When adding tests:
- Frontend: Add Vitest configuration
- Backend: `cd src-tauri && cargo test`

## Prerequisites

- Node.js 18+
- Rust 1.77.2+
- FFmpeg installed and available in PATH (required for video processing, thumbnails, export)

## Architecture Overview

VibeClips is a desktop video editor built with **Tauri 2.x** (Rust backend) + **React 19** (TypeScript frontend) + **Vite 7**.

### Frontend-Backend Communication

The frontend communicates with Rust via Tauri IPC commands defined in `src-tauri/src/lib.rs`.

**Video processing:**
| Command | Purpose |
|---------|---------|
| `export_video` | FFmpeg-based video export with multi-track support |
| `generate_video_thumbnail` | Create video thumbnails via FFmpeg |
| `import_video_file` | Import video with MOV-to-MP4 conversion |
| `get_video_duration_from_file` | Extract duration via FFprobe |
| `composite_pip_video` | Picture-in-picture video compositing |

**Recording:**
| Command | Purpose |
|---------|---------|
| `start_screen_recording_async` / `stop_screen_recording_async` | Screen capture |
| `list_screen_sources` / `list_audio_devices` | Device enumeration |
| `get_recording_status` | Check if recording is active |
| `mux_video_audio` / `convert_webm_to_mp4` | Post-recording processing |

**Other:**
| Command | Purpose |
|---------|---------|
| `transcribe_clip` | OpenAI Whisper transcription |
| `save_api_key` / `get_api_key` / `delete_api_key` | Secure API key storage via keyring |
| `write_srt_file` | Subtitle file generation |

### State Management

React Context API provides global state:

- **VideoContext** (`src/contexts/VideoContext.tsx`): Imported video files (`VideoFile[]`)
- **TimelineContext** (`src/contexts/TimelineContext.tsx`): Timeline clips, playhead, tracks, selection
- **RecordingContext** (`src/contexts/RecordingContext.tsx`): Screen/webcam recording state
- **SubtitleContext** (`src/contexts/SubtitleContext.tsx`): Subtitle tracks for export

### Feature Modules

Each feature is self-contained in `src/features/`:

| Feature | Components |
|---------|------------|
| `import/` | Import, ImportZone (drag-drop), MediaLibrary |
| `timeline/` | Timeline, TimelineCanvas (HTML5 Canvas rendering) |
| `preview/` | VideoPlayer (HTML5 video playback) |
| `export/` | ExportDialog (FFmpeg export with settings) |
| `recording/` | ScreenRecording, WebcamRecording, CombinedRecording |
| `filters/` | FilterPanel (brightness/contrast/saturation) |
| `subtitles/` | SubtitlePanel, SubtitleEditor |
| `settings/` | Settings (API key management) |

### Key Data Types

```typescript
// src/types/video.ts
interface VideoFile {
  id: string;
  path: string;
  filename: string;
  file?: File;     // Browser File object
  duration: number;
  size: number;
  resolution: { width: number; height: number };
  thumbnail?: string;
}

// src/types/timeline.ts
interface TimelineClip {
  id: string;
  videoFileId: string;   // Reference to VideoFile
  startTime: number;     // Position on timeline (seconds)
  duration: number;      // Duration after trimming
  trimStart: number;     // In-point offset
  trimEnd: number;       // Out-point offset
  track: number;         // 0=main, 1=overlay1, 2=overlay2
  filters?: ClipFilters; // brightness/contrast/saturation
}

type OverlayPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';

interface TimelineState {
  clips: TimelineClip[];
  playheadPosition: number;
  zoom: number;
  scrollOffset: number;
  selectedClipId: string | null;
  snapEnabled: boolean;
  tracks: TrackState[];  // Track mute/solo and overlay positions
}
```

### Rust Backend Modules

- `main.rs`: Tauri entry point
- `lib.rs`: All Tauri commands and FFmpeg integration
- `screen_capture.rs`: Windows Graphics Capture API for screen recording
- `audio_capture.rs`: Audio device capture via cpal
- `transcription.rs`: OpenAI Whisper API integration

### FFmpeg Integration Pattern

FFmpeg is invoked via `std::process::Command` with a helper that:
1. Checks for bundled FFmpeg in resources
2. Falls back to system PATH
3. Creates hidden commands (no console window on Windows)

```rust
fn create_hidden_command(app_handle: Option<&tauri::AppHandle>, program: &str) -> Command
```

### Multi-Track Export

The export system supports:
- Track 0: Main video timeline (concatenated clips)
- Track 1-2: Overlay videos with configurable positions
- Per-clip filters (eq filter in FFmpeg)
- Subtitle burn-in from SRT files

### Canvas Timeline Rendering

The timeline uses HTML5 Canvas (`TimelineCanvas.tsx`) for:
- Clip visualization with thumbnails
- Playhead rendering and scrubbing
- Trim handle interactions
- Zoom/scroll coordination
