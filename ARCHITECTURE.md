# VibeClips - Technical Architecture

**Version:** MVP 1.0  
**Last Updated:** October 27, 2025

---

## Overview

VibeClips is a desktop video editor built with **Tauri** (Rust backend) and **React** (TypeScript frontend). The application uses **FFmpeg** for video processing and **HTML5 Canvas** for timeline rendering.

---

## Technology Stack

### Frontend
- **Framework:** React 18.x with TypeScript
- **UI Rendering:** HTML5 Canvas (timeline), DOM (controls, panels)
- **Video Playback:** HTML5 `<video>` element
- **State Management:** React Context API + hooks
- **Styling:** CSS Modules or Tailwind CSS

### Backend
- **Desktop Framework:** Tauri 1.x
- **Runtime:** Rust (backend), WebView2 (Windows) / WebKit (macOS)
- **Video Processing:** FFmpeg (native binary)
- **File System:** Tauri FS API
- **IPC:** Tauri Commands (Rust ↔ JavaScript bridge)

### Build & Development
- **Package Manager:** npm or pnpm
- **Build Tool:** Vite (bundled with Tauri)
- **TypeScript:** Type safety across frontend
- **Rust Compiler:** cargo (for Tauri backend)

---

## Project Structure

```
vibe-clips/
├── src/                          # Frontend React application
│   ├── features/                 # Feature-based organization
│   │   ├── import/               # Video import functionality
│   │   │   ├── ImportZone.tsx    # Drag & drop area
│   │   │   ├── FilePicker.tsx    # File selection dialog
│   │   │   ├── MediaLibrary.tsx  # List of imported videos
│   │   │   └── importSlice.ts    # State management for imports
│   │   │
│   │   ├── timeline/             # Timeline editor
│   │   │   ├── Timeline.tsx      # Main timeline container
│   │   │   ├── TimelineCanvas.tsx # Canvas rendering logic
│   │   │   ├── TimelineClip.tsx  # Clip representation
│   │   │   ├── Playhead.tsx      # Playhead indicator
│   │   │   ├── timelineUtils.ts  # Helper functions
│   │   │   └── timelineSlice.ts  # Timeline state
│   │   │
│   │   ├── preview/              # Video preview player
│   │   │   ├── VideoPlayer.tsx   # Main player component
│   │   │   ├── PlayerControls.tsx # Play/pause/scrub controls
│   │   │   └── playerSlice.ts    # Player state
│   │   │
│   │   └── export/               # Video export
│   │       ├── ExportDialog.tsx  # Export settings UI
│   │       ├── ExportProgress.tsx # Progress indicator
│   │       └── exportUtils.ts    # Export helpers
│   │
│   ├── components/               # Shared/reusable components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── ProgressBar.tsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useVideoMetadata.ts   # Extract video metadata
│   │   ├── useCanvas.ts          # Canvas setup & rendering
│   │   └── useTauriCommand.ts    # Tauri IPC wrapper
│   │
│   ├── utils/                    # Utility functions
│   │   ├── formatTime.ts         # Time formatting
│   │   ├── fileHelpers.ts        # File manipulation
│   │   └── constants.ts          # App constants
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── video.ts              # VideoFile, TimelineClip types
│   │   ├── export.ts             # Export settings types
│   │   └── index.ts              # Barrel exports
│   │
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # React entry point
│   └── styles.css                # Global styles
│
├── src-tauri/                    # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs               # Main Tauri entry, command definitions
│   │   ├── ffmpeg.rs             # FFmpeg command builder
│   │   └── lib.rs                # Library exports
│   │
│   ├── tauri.conf.json           # Tauri configuration
│   ├── Cargo.toml                # Rust dependencies
│   └── icons/                    # App icons (various sizes)
│
├── public/                       # Static assets
├── dist/                         # Build output (gitignored)
├── package.json                  # Node dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite bundler config
├── .gitignore
├── README.md                     # Installation & usage guide
├── PRD.md                        # Product requirements
├── TASKS.md                      # Task checklist
├── ARCHITECTURE.md               # This file
└── RUBRIC.md                     # Project rubric
```

---

## Data Flow Architecture

### 1. Video Import Flow
```
User Action (drag/drop or file picker)
  ↓
Frontend: ImportZone/FilePicker component
  ↓
Tauri Dialog API (select file)
  ↓
Frontend: Extract metadata (HTML5 video)
  ↓
State: Add VideoFile to import context
  ↓
UI: Display in MediaLibrary
```

### 2. Timeline Editing Flow
```
User drags clip from MediaLibrary
  ↓
Frontend: Timeline drop handler
  ↓
State: Add TimelineClip to timeline array
  ↓
Canvas: Redraw timeline with new clip
  ↓
User adjusts trim handles
  ↓
State: Update TimelineClip trim points
  ↓
Canvas: Redraw clip with new dimensions
```

### 3. Preview Playback Flow
```
User clicks play or drags playhead
  ↓
Frontend: Update playhead position
  ↓
Timeline: Calculate current clip at playhead time
  ↓
VideoPlayer: Load clip source + seek to trimmed position
  ↓
HTML5 Video: Play with audio
  ↓
Animation loop: Update playhead position during playback
```

### 4. Export Flow
```
User clicks Export button
  ↓
Frontend: ExportDialog (select output path)
  ↓
Tauri Command: invoke("export_video", { clips, outputPath })
  ↓
Rust: Build FFmpeg command with clip inputs & trim filters
  ↓
Rust: Execute FFmpeg process
  ↓
Rust: Stream progress back to frontend (events)
  ↓
Frontend: Update ExportProgress UI
  ↓
Rust: Return success/error
  ↓
Frontend: Show completion message
```

---

## Key Data Structures

### VideoFile (Imported Media)
```typescript
interface VideoFile {
  id: string;                    // Unique identifier
  path: string;                  // Absolute file path
  filename: string;              // Display name
  duration: number;              // Total duration in seconds
  size: number;                  // File size in bytes
  resolution: {
    width: number;
    height: number;
  };
  thumbnail?: string;            // Base64 or path to thumbnail
}
```

### TimelineClip (Clip on Timeline)
```typescript
interface TimelineClip {
  id: string;                    // Unique clip instance ID
  videoFileId: string;           // Reference to VideoFile
  startTime: number;             // Position on timeline (seconds)
  duration: number;              // Current duration after trimming
  trimStart: number;             // Trim in-point (seconds from clip start)
  trimEnd: number;               // Trim out-point (seconds from clip start)
  track: number;                 // Track number (0 for MVP)
}
```

### ExportSettings
```typescript
interface ExportSettings {
  outputPath: string;            // Save location
  resolution: '720p' | '1080p' | 'source';
  codec: 'h264' | 'h265';
  quality: 'low' | 'medium' | 'high';
}
```

---

## Technical Decisions & Rationale

### Why Tauri?
- **Lightweight:** ~3MB bundle vs 100MB+ with Electron
- **Performance:** Native Rust backend, no Node.js overhead
- **Security:** Strong sandboxing and permission model
- **Modern:** Built for current web standards

### Why Canvas for Timeline?
- **Performance:** Can render hundreds of clips efficiently
- **Control:** Full control over drawing and interactions
- **Smooth animations:** 60fps playhead and scrubbing
- **Custom UI:** Not limited by DOM/CSS constraints

### Why Native FFmpeg?
- **Quality:** Full FFmpeg capabilities (encoding, filters, codecs)
- **Speed:** Native binary is much faster than WASM alternatives
- **Reliability:** Industry-standard tool, battle-tested
- **Flexibility:** Can invoke any FFmpeg command

### Why React?
- **Rapid development:** Rich ecosystem and component libraries
- **State management:** Hooks and Context API for MVP needs
- **TypeScript support:** Strong typing prevents bugs
- **Tauri compatibility:** Works seamlessly with Tauri

---

## FFmpeg Integration

### Architecture
```
React Frontend
  ↓ (Tauri Command)
Rust Backend
  ↓ (std::process::Command)
FFmpeg Binary
  ↓ (stdout/stderr)
Rust (parse output)
  ↓ (Tauri Event)
React Frontend (progress updates)
```

### Example FFmpeg Command (MVP Export)
```bash
ffmpeg \
  -f concat -safe 0 -i concat_list.txt \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  output.mp4
```

Where `concat_list.txt` contains:
```
file '/path/to/clip1.mp4'
inpoint 5.0
outpoint 15.0
file '/path/to/clip2.mp4'
inpoint 0.0
outpoint 10.0
```

### Rust Command Implementation
```rust
#[tauri::command]
async fn export_video(clips: Vec<ClipData>, output_path: String) -> Result<String, String> {
    // 1. Create temporary concat file
    let concat_file = create_concat_file(&clips)?;
    
    // 2. Build FFmpeg command
    let output = Command::new("ffmpeg")
        .args(&["-f", "concat", "-safe", "0", "-i", &concat_file])
        .args(&["-c:v", "libx264", "-c:a", "aac"])
        .arg(&output_path)
        .output()
        .map_err(|e| e.to_string())?;
    
    // 3. Check for errors
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    Ok(output_path)
}
```

---

## Canvas Timeline Rendering

### Rendering Loop
```typescript
function drawTimeline(ctx: CanvasRenderingContext2D, state: TimelineState) {
  // 1. Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 2. Draw background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 3. Draw time ruler
  drawTimeRuler(ctx, state.zoom, state.scrollOffset);
  
  // 4. Draw clips
  state.clips.forEach(clip => {
    drawClip(ctx, clip, state.zoom, state.scrollOffset);
  });
  
  // 5. Draw playhead
  drawPlayhead(ctx, state.playheadPosition, state.zoom, state.scrollOffset);
  
  // 6. Draw selection/trim handles if clip selected
  if (state.selectedClip) {
    drawTrimHandles(ctx, state.selectedClip, state.zoom, state.scrollOffset);
  }
}
```

### Coordinate System
- **Time to Pixel:** `pixelX = timeInSeconds * pixelsPerSecond * zoom - scrollOffset`
- **Pixel to Time:** `timeInSeconds = (pixelX + scrollOffset) / (pixelsPerSecond * zoom)`
- **Default:** 100 pixels per second at 1x zoom

---

## Performance Considerations

### Timeline Optimization
- Use requestAnimationFrame for smooth playhead updates
- Debounce canvas redraws during scrubbing
- Only redraw changed regions when possible
- Limit clip count for MVP (warn at 50+ clips)

### Video Preview Optimization
- Preload next clip during playback
- Use video.preload = 'auto' for buffering
- Cache decoded frames when possible
- Throttle scrubbing updates (60fps max)

### Export Optimization
- Show estimated time remaining
- Use FFmpeg hardware acceleration if available (-hwaccel)
- Process in background thread (Rust async)
- Cancel export capability

### Memory Management
- Clean up video element references
- Release canvas ImageData after use
- Clear timeout/interval handlers
- Limit thumbnail cache size

---

## Security & Permissions

### Tauri Allowlist (tauri.conf.json)
```json
{
  "allowlist": {
    "dialog": {
      "open": true,
      "save": true
    },
    "fs": {
      "readFile": true,
      "writeFile": true,
      "scope": ["$TEMP/*", "$HOME/Videos/*"]
    },
    "shell": {
      "execute": true,
      "scope": [{ "name": "ffmpeg", "cmd": "ffmpeg", "args": true }]
    }
  }
}
```

### File System Access
- Only allow read access to user-selected files
- Write access limited to export destination
- No arbitrary file system traversal
- Validate all file paths in Rust backend

---

## Testing Strategy

### Unit Testing
- Utility functions (time formatting, coordinate conversion)
- FFmpeg command builder
- Trim calculation logic

### Integration Testing
- Import → Timeline → Export pipeline
- Playhead synchronization with video player
- Trim points reflected in export

### Manual Testing
- Drag & drop various file formats
- Timeline with 10+ clips
- Export with trimmed clips
- Multi-minute video export
- App performance during 15+ minute session

---

## Build & Deployment

### Development
```bash
npm install
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```

Outputs:
- **Windows:** `.exe` installer in `src-tauri/target/release/bundle/`
- **macOS:** `.dmg` or `.app` in `src-tauri/target/release/bundle/`

### Distribution
- Upload to GitHub Releases
- Provide download links in README
- Include FFmpeg installation instructions
- Optional: Auto-updater (post-MVP)

---

## Future Architecture Considerations (Post-MVP)

### Multi-track Support
- Extend timeline to support multiple video/audio tracks
- Z-index for overlays and PiP
- Track muting/solo controls

### Effects Pipeline
- Plugin architecture for effects
- Real-time preview rendering
- GPU-accelerated filters (WebGL)

### Project Persistence
- Save/load project files (.vibe format)
- Auto-save functionality
- Project recovery

### Cloud Integration
- Export to cloud storage (Drive, Dropbox)
- Shared project links
- Collaborative editing (WebRTC)

---

## Dependencies

### Frontend (package.json)
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tauri-apps/api": "^1.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.2.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
```

### Backend (Cargo.toml)
```toml
[dependencies]
tauri = { version = "1.5", features = ["dialog-all", "fs-all", "shell-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
```

### External
- **FFmpeg:** Must be installed or bundled (static binary)
- **System WebView:** WebView2 (Windows), WebKit (macOS)

---

## Resources & Documentation

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Canvas API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [HTML5 Video Element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video)

---

## Glossary

- **Clip:** An instance of a video file placed on the timeline
- **Timeline:** The visual representation of video sequence
- **Playhead:** Current time indicator on timeline
- **Trim:** Adjusting in/out points of a clip
- **In-point:** Start time of visible portion of clip
- **Out-point:** End time of visible portion of clip
- **Scrubbing:** Dragging playhead to preview different times
- **Canvas:** HTML5 drawing surface for custom graphics
- **IPC:** Inter-Process Communication (Rust ↔ JavaScript)

---

**End of Architecture Document**

