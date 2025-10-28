# VibeClips - Product Requirements Document (PRD)
## MVP Feature Development Plan

**Project:** VibeClips Desktop Video Editor  
**Timeline:** MVP Due Tuesday, October 28th at 10:59 PM CT  
**Tech Stack:** Tauri + React + FFmpeg + Canvas API

---

## Overview

This PRD outlines the 7 core features required for MVP submission. Each feature corresponds to a numbered Pull Request (PR) that should be developed on a separate git branch and merged sequentially.

---

## PR#1: Desktop App Setup & Launch

**Branch:** `feature/pr1-desktop-app-setup`

### Description
Initialize the Tauri desktop application with React frontend. The app should launch successfully and display a basic UI shell.

### Acceptance Criteria
- [x] Tauri project initialized with React template
- [x] App launches in development mode (`npm run tauri dev`)
- [x] Basic window configuration set (title: "VibeClips", minimum size: 1200x800)
- [x] React development environment configured with TypeScript
- [x] Basic UI layout with placeholder sections for: Import, Timeline, Preview, Export

### Technical Implementation
- Use `create-tauri-app` with React + TypeScript template
- Configure `tauri.conf.json`:
  - Set window title and dimensions
  - Enable file system API access
  - Configure allowlist for future features
- Set up project structure with feature-based folders:
  ```
  /src
    /features
      /import
      /timeline
      /preview
      /export
    /components
    /utils
    App.tsx
  ```

### Dependencies
- Node.js 18+
- Rust toolchain
- Tauri CLI

### Testing
- App launches without errors
- Window displays correctly on Windows/Mac
- Development hot-reload works

---

## PR#2: Video Import System

**Branch:** `feature/pr2-video-import`

### Description
Enable users to import video files (MP4, MOV) into the application using drag & drop or file picker.

### Acceptance Criteria
- [x] Drag and drop zone for video files
- [x] File picker button to browse and select videos
- [x] Support for MP4 and MOV file formats
- [x] Display imported files in a media library panel
- [x] Show basic metadata for each file (filename, duration, file size)
- [x] Store imported file paths in application state

### Technical Implementation
- Create `/src/features/import/` components:
  - `ImportZone.tsx` - drag & drop area
  - `FilePicker.tsx` - file selection dialog
  - `MediaLibrary.tsx` - list of imported files
- Use Tauri's `open` dialog API for file picker
- Implement drag & drop event handlers
- Use HTML5 video element temporarily to extract metadata (duration, dimensions)
- Store file data in React state/context:
  ```typescript
  interface VideoFile {
    id: string;
    path: string;
    filename: string;
    duration: number;
    size: number;
    resolution: { width: number; height: number };
  }
  ```

### Dependencies
- Requires PR#1 (app setup)
- Tauri `dialog` API
- File system access permissions

### Testing
- Drag and drop MP4/MOV files successfully imports them
- File picker dialog opens and imports selected files
- Media library displays all imported files
- Metadata extraction works correctly

---

## PR#3: Timeline View

**Branch:** `feature/pr3-timeline-view`

### Description
Build a visual timeline interface using HTML5 Canvas that displays imported clips and allows basic interaction.

### Acceptance Criteria
- [x] Canvas-based timeline with time ruler (showing seconds/minutes)
- [x] Drag clips from media library onto timeline
- [x] Display clips as visual blocks on timeline with thumbnails
- [x] Show playhead (current time indicator) that can be dragged
- [x] Display clip duration and position on timeline
- [x] Single track for MVP (multi-track in future)

### Technical Implementation
- Create `/src/features/timeline/` components:
  - `Timeline.tsx` - main timeline container
  - `TimelineCanvas.tsx` - Canvas rendering logic
  - `TimelineClip.tsx` - clip representation
  - `Playhead.tsx` - current time indicator
- Implement canvas drawing:
  - Draw time ruler with tick marks
  - Draw clip blocks with thumbnails
  - Draw playhead as vertical line
- Timeline data structure:
  ```typescript
  interface TimelineClip {
    id: string;
    videoFileId: string;
    startTime: number; // position on timeline
    duration: number;
    trimStart: number; // trim in-point
    trimEnd: number; // trim out-point
  }
  ```
- Implement drag and drop from media library to timeline
- Handle playhead dragging for scrubbing

### Dependencies
- Requires PR#2 (imported video files to display)
- Canvas API
- React hooks for canvas rendering

### Testing
- Clips can be dragged from media library to timeline
- Timeline displays clips at correct positions
- Playhead can be dragged smoothly
- Time ruler shows accurate time markers

---

## PR#4: Video Preview Player

**Branch:** `feature/pr4-video-preview`

### Description
Implement a video player that displays the current frame at the playhead position and allows playback of timeline content.

### Acceptance Criteria
- [x] Video player displays in preview panel
- [x] Play/pause controls functional
- [x] Player shows frame at current playhead position
- [x] Scrubbing playhead updates preview in real-time
- [x] Audio synchronized with video playback
- [x] Playback respects timeline clip arrangement

### Technical Implementation
- Create `/src/features/preview/` components:
  - `VideoPlayer.tsx` - main player component
  - `PlayerControls.tsx` - play/pause buttons
- Use HTML5 `<video>` element for playback
- Synchronize video element with timeline playhead:
  - When playhead moves, update video.currentTime
  - When video plays, update playhead position
- For MVP, play single clip at playhead position
- Handle switching between clips during playback:
  ```typescript
  function getCurrentClip(playheadTime: number): TimelineClip | null {
    return timelineClips.find(clip => 
      playheadTime >= clip.startTime && 
      playheadTime < clip.startTime + clip.duration
    );
  }
  ```

### Dependencies
- Requires PR#3 (timeline with playhead)
- HTML5 video element
- Audio playback support

### Testing
- Play/pause controls work correctly
- Preview shows correct frame when scrubbing
- Audio plays in sync with video
- Player handles clip boundaries correctly

---

## PR#5: Trim Functionality

**Branch:** `feature/pr5-trim-clips`

### Description
Allow users to set in/out points on clips to trim them without modifying source files.

### Acceptance Criteria
- [ ] Click on clip to select it
- [ ] Drag clip edges to adjust trim points (in/out)
- [ ] Display trim handles on selected clip
- [ ] Visual feedback showing trimmed vs full duration
- [ ] Preview player respects trim points during playback
- [ ] Clip duration updates when trimmed

### Technical Implementation
- Add selection state to timeline clips
- Implement trim handles on canvas:
  - Left handle for trim start (in-point)
  - Right handle for trim end (out-point)
- Update clip data when handles are dragged:
  ```typescript
  function handleTrimDrag(clipId: string, handle: 'start' | 'end', newTime: number) {
    if (handle === 'start') {
      clip.trimStart = newTime;
      clip.duration -= deltaTime;
    } else {
      clip.trimEnd = newTime;
      clip.duration -= deltaTime;
    }
  }
  ```
- Add visual indicator (different color) for trimmed portions
- Update preview player to use trimmed duration

### Dependencies
- Requires PR#4 (preview player to show trimmed playback)
- Mouse interaction on canvas

### Testing
- Trim handles appear on selected clips
- Dragging handles adjusts clip duration correctly
- Preview respects trim points
- Trim changes are non-destructive to source file

---

## PR#6: Export to MP4

**Branch:** `feature/pr6-export-mp4`

### Description
Implement video export functionality using FFmpeg to render timeline composition to MP4 file.

### Acceptance Criteria
- [x] Export button in UI
- [x] Export dialog with output path selection
- [x] FFmpeg processes timeline clips into single MP4
- [x] Progress indicator during export (timeout handling)
- [x] Respects clip order, positions, and trim points
- [x] Exported video plays correctly in external player

### Technical Implementation
- Create `/src/features/export/` components:
  - `ExportDialog.tsx` - export settings UI
  - `ExportProgress.tsx` - progress indicator
- Create Rust command in `src-tauri/src/main.rs`:
  ```rust
  #[tauri::command]
  async fn export_video(clips: Vec<ClipData>, output_path: String) -> Result<String, String> {
    // Build FFmpeg command
    // Execute FFmpeg with clip inputs and filters
    // Return success/error
  }
  ```
- FFmpeg command structure for MVP:
  - Use concat demuxer for sequential clips
  - Apply trim filters: `-ss` (start) and `-t` (duration)
  - Output codec: `-c:v libx264 -c:a aac`
  - Example: `ffmpeg -i clip1.mp4 -ss 5 -t 10 -i clip2.mp4 output.mp4`
- Create temporary concat file listing all clips with trim points
- Handle FFmpeg progress output and display to user

### Dependencies
- Requires PR#5 (trim data to export correctly)
- FFmpeg binary (must be installed or bundled)
- Tauri command invocation
- File system write permissions

### Testing
- Export dialog opens with file save picker
- FFmpeg command executes without errors
- Progress indicator shows export progress
- Exported video contains all clips in correct order
- Trim points are applied correctly in exported video
- Video plays in VLC/QuickTime/Windows Media Player

---

## PR#7: Build & Package ✅ COMPLETE

**Branch:** `feature/pr7-build-package`

### Description
Create distributable desktop application for Windows and/or macOS.

### Acceptance Criteria
- [x] Production build completes without errors
- [x] App runs in production mode (not just dev)
- [x] Packaged installer/executable created
- [x] FFmpeg binary bundled with installation instructions provided
- [x] App icon configured
- [x] Basic README with installation instructions

### Technical Implementation
- Configure `tauri.conf.json` for production:
  - Set app version and identifier
  - Configure bundle settings for target platform
  - Add app icon assets
- Bundle FFmpeg:
  - Provided installation script/instructions in README
  - Added FFmpeg binary discovery system (checks PATH and common locations)
  - Created `binaries/` folder for optional bundled binaries
- Build commands:
  - `npm run tauri build` - creates distributable
- Test packaged app on clean machine (no dev tools)
- Create README.md with:
  - Installation instructions
  - System requirements
  - Quick start guide
  - FFmpeg setup instructions

### Dependencies
- Requires PR#1-6 (all core features)
- Platform build tools (Windows: MSVC, macOS: Xcode)
- Code signing certificates (optional for MVP)

### Testing
- Built app launches on target platform
- All features work in production build
- Import, timeline, preview, trim, export all functional
- No console errors in production
- Installer/executable runs on machine without dev environment

---

## PR#8: Screen Recording ✅ COMPLETE

**Branch:** `feature/pr8-screen-recording`

### Description
Implement native screen recording functionality with system audio capture using FFmpeg and Windows WASAPI.

### Acceptance Criteria
- [x] Record screen with configurable display selection
- [x] Capture system audio (desktop audio) using WASAPI loopback
- [x] Save recordings as MP4 files
- [x] Display recording indicator during capture
- [x] Save recordings to media library
- [x] Add recordings to timeline automatically

### Technical Implementation
- Created `/src/features/recording/` components:
  - `RecordingPanel.tsx` - tabbed recording interface
  - `ScreenRecording.tsx` - screen recording controls
- Implemented Rust backend (`src-tauri/src/screen_capture.rs`):
  - Windows: gdigrab for screen capture
  - WASAPI loopback for system audio capture
  - Audio/video synchronization with timing offsets
  - FFmpeg muxing with proper sync correction
- Screen source enumeration using Windows GDI API
- Timer-based duration tracking
- Audio sync fixes with adelay and apad filters

### Dependencies
- FFmpeg with gdigrab and WASAPI support
- Windows API for display enumeration
- Rust crates: windows, lazy_static

### Testing
- Screen recording captures video correctly
- System audio is captured and synced
- Recordings save to media library
- Timeline integration works

---

## PR#9: Webcam Recording ✅ COMPLETE

**Branch:** `feature/pr9-webcam-recording`

### Description
Add webcam recording capability with audio using browser MediaRecorder API.

### Acceptance Criteria
- [x] Enumerate available webcam devices
- [x] Show live camera preview
- [x] Record webcam video with microphone audio
- [x] Support multiple resolutions (480p, 720p, 1080p)
- [x] Mirror preview option for user comfort
- [x] Convert WebM recordings to MP4 format
- [x] Add recordings to media library

### Technical Implementation
- Created `WebcamRecording.tsx` component
- Used MediaRecorder API for browser-based recording
- Camera device enumeration via getUserMedia()
- Live preview with mirror transform option
- Resolution selection (480p/720p/1080p)
- WebM to MP4 conversion using FFmpeg
- Thumbnail generation for recordings

### Dependencies
- Browser MediaDevices API
- MediaRecorder API
- FFmpeg for format conversion

### Testing
- Camera preview displays correctly
- Recording captures video and audio
- WebM to MP4 conversion works
- Recordings integrate with timeline

---

## PR#10: Combined PiP Recording ✅ COMPLETE

**Branch:** `feature/pr10-combined-recording`

### Description
Implement combined screen + webcam recording with Picture-in-Picture (PiP) compositing.

### Acceptance Criteria
- [x] Record screen and webcam simultaneously
- [x] Configure PiP position (4 corners)
- [x] Configure PiP size (small/medium/large)
- [x] Configurable padding from edges
- [x] Audio options (system audio, mic audio, or both)
- [x] FFmpeg compositing with overlay filter
- [x] Save options (screen only, webcam only, composite, or all)
- [x] Proper audio/video synchronization

### Technical Implementation
- Created `CombinedRecording.tsx` with comprehensive UI:
  - Screen source selector
  - Camera selector with live preview
  - PiP configuration (position, size, padding)
  - Audio options checkboxes
  - Save options for different outputs
- Implemented `composite_pip_video` Rust command:
  - FFmpeg filter_complex with scale and overlay
  - Multi-track audio mixing with amix
  - Screen start offset calculation for A/V sync
  - Webcam latency compensation (100ms buffer)
  - Audio delay filters (adelay) for sync correction
  - Audio padding (apad) for duration matching
- Recording timing coordination:
  - Screen starts first, webcam follows
  - Offset calculation for synchronization
  - Audio stream delay compensation

### Dependencies
- Screen recording (PR#8)
- Webcam recording (PR#9)
- FFmpeg filter_complex capabilities
- Audio sync expertise

### Testing
- Screen and webcam record simultaneously
- PiP overlay appears in correct position/size
- Audio from both sources is mixed correctly
- All save options work (screen/webcam/composite)
- A/V sync is maintained

---

## PR#11: UI Improvements & Video Management ✅ COMPLETE

**Branch:** `main` (direct commits)

### Description
Polish UI, improve timeline trim functionality, and add video removal capability.

### Acceptance Criteria
- [x] Improved timeline trim UI with better visual feedback
- [x] Separate time ruler section above clips
- [x] Enhanced trim handles (larger, gradient, grip lines)
- [x] Hover effects on trim handles
- [x] Diagonal hatching pattern for trimmed regions
- [x] Video deletion from media library
- [x] Confirmation dialog for video deletion
- [x] Automatic clip removal when video is deleted
- [x] Playhead repositioning when timeline is shortened

### Technical Implementation
- Enhanced `TimelineCanvas.tsx`:
  - Added dedicated ruler section (30px)
  - Increased handle width (14px)
  - Added gradient and shadow effects
  - Implemented grip lines for affordance
  - Added hover state with cursor changes
  - Diagonal hatching for trimmed areas
- Created `ConfirmDialog.tsx` component:
  - Reusable modal for confirmations
  - Support for dangerous actions (red styling)
- Updated `MediaLibrary.tsx`:
  - Added delete button with hover reveal
  - Integration with confirmation dialog
  - Dual-path handling for data URLs and file paths
- Updated contexts:
  - `VideoContext`: Added `removeVideo` function
  - `TimelineContext`: Added `removeClipsByVideoId` function

### Testing
- Timeline trim markers are visible and intuitive
- Trim handles respond to hover
- Video deletion works with confirmation
- Clips are removed when video is deleted
- Timeline adjusts correctly

---

## PR#12: Production Build Fixes ✅ COMPLETE

**Branch:** `main` (direct commits)

### Description
Fix all issues preventing production builds from working correctly, including FFmpeg discovery, CSP configuration, and file path handling.

### Acceptance Criteria
- [x] FFmpeg console windows hidden in production
- [x] FFmpeg binary discovery system implemented
- [x] Bundled FFmpeg binaries support
- [x] Content Security Policy (CSP) configured correctly
- [x] Data URL support for imported videos
- [x] File path support for recorded videos
- [x] Dual-path handling in all video components
- [x] Thumbnail generation working for all video types
- [x] Discard button fixed in combined recording
- [x] Audio sync issues resolved

### Technical Implementation
- Created `create_hidden_command()` helper in Rust:
  - Uses CREATE_NO_WINDOW flag on Windows
  - Prevents FFmpeg console windows
- Implemented `find_ffmpeg_binary()` system:
  - Checks bundled binaries first
  - Falls back to system PATH
  - Checks common installation locations
- Updated `tauri.conf.json`:
  - Modified CSP to allow `data:` and `asset:` URLs
  - Added `resources: ["binaries/*"]` for bundling
- Fixed `RecordingContext.tsx`:
  - Proper state management in discard handlers
  - Better error handling
  - Explicit state resets
- Audio sync improvements:
  - Webcam latency buffer (100ms)
  - Proper aresample=async=1 placement
  - Changed to fps_mode vfr from deprecated -vsync
- Import flow fixes:
  - Unique ID generation with array index
  - Data URL handling maintained for browser compatibility

### Testing
- Production build works without FFmpeg console windows
- Imported videos display correctly
- Recorded videos display correctly
- Thumbnails generate for all video types
- Audio stays synchronized
- Discard button works properly

---

## PR#13: Code Refactoring & Optimization ✅ COMPLETE

**Branch:** `main` (direct commits)

### Description
Major code refactoring to improve maintainability, performance, and code quality using DRY principles.

### Acceptance Criteria
- [x] Create shared utility functions
- [x] Create shared constants file
- [x] Extract duplicate code across components
- [x] Optimize Timeline rendering with memoization
- [x] Add reusable custom hooks
- [x] Improve error handling consistency
- [x] Reduce code duplication
- [x] Maintain backward compatibility

### Technical Implementation
- Created `src/utils/format.ts`:
  - `formatTime()` - MM:SS formatting
  - `formatDuration()` - Human-readable durations
  - `formatFileSize()` - File size formatting
  - Eliminated 7+ duplicate implementations
- Created `src/utils/constants.ts`:
  - `TIMELINE_CONSTANTS` - Rendering parameters
  - `RECORDING_RESOLUTIONS` - Resolution presets
  - `DRAG_THROTTLE_MS` / `TRIM_THROTTLE_MS` - Frame limiters
  - `DRAG_THRESHOLD` - Click vs drag detection
- Created `src/hooks/useCameraPreview.ts`:
  - Reusable camera preview logic
  - Automatic lifecycle management
  - Error and loading states
- Optimized `TimelineCanvas.tsx`:
  - Added `useMemo` for maxDuration and canvasWidth
  - Converted handlers to `useCallback`
  - Replaced magic numbers with constants
  - Better performance with fewer re-renders
- Updated 8 components to use shared utilities:
  - All recording components
  - Timeline components
  - Media library
  - Export dialog
- Created `REFACTORING_SUMMARY.md` documentation

### Statistics
- Files created: 4 new utility/hook files
- Files modified: 8 components refactored
- Code reduced: ~150 lines of duplication removed
- Performance: Improved with memoization
- Build status: ✅ Successful compilation

### Testing
- All components compile without errors
- No linter errors
- Timeline performance improved
- All features work identically
- Backward compatible (no breaking changes)

---

## Success Criteria for MVP

All PRs completed and tested:

1. ✅ Desktop app launches *(Completed - PR#1)*
2. ✅ Video import (drag & drop + file picker) *(Completed - PR#2)*
3. ✅ Timeline shows imported clips *(Completed - PR#3)*
4. ✅ Video preview plays clips *(Completed - PR#4)*
5. ✅ Trim clips with in/out points *(Completed - PR#5)*
6. ✅ Export to MP4 *(Completed - PR#6)*
7. ✅ Packaged native app *(Completed - PR#7)*
8. ✅ Screen recording with system audio *(Completed - PR#8)*
9. ✅ Webcam recording *(Completed - PR#9)*
10. ✅ Combined PiP recording *(Completed - PR#10)*
11. ✅ UI improvements & video management *(Completed - PR#11)*
12. ✅ Production build fixes *(Completed - PR#12)*
13. ✅ Code refactoring & optimization *(Completed - PR#13)*

---

## Development Workflow

1. Create feature branch from main: `git checkout -b feature/pr#-name`
2. Implement feature following acceptance criteria
3. Test locally
4. Commit and push branch
5. Create Pull Request with description referencing this PRD
6. Review and merge to main
7. Repeat for next PR

---

## Notes

- Each PR builds on previous work - follow sequential order
- Test each feature thoroughly before moving to next
- Keep commits focused and descriptive
- Document any deviations from plan in PR descriptions
- If blocked, document issue and continue with parallel work where possible

