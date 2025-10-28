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

## PR#7: Build & Package

**Branch:** `feature/pr7-build-package`

### Description
Create distributable desktop application for Windows and/or macOS.

### Acceptance Criteria
- [ ] Production build completes without errors
- [ ] App runs in production mode (not just dev)
- [ ] Packaged installer/executable created
- [ ] FFmpeg binary bundled or installation instructions provided
- [ ] App icon configured
- [ ] Basic README with installation instructions

### Technical Implementation
- Configure `tauri.conf.json` for production:
  - Set app version and identifier
  - Configure bundle settings for target platform
  - Add app icon assets
- Bundle FFmpeg:
  - **Option A:** Include FFmpeg binary in app resources
  - **Option B:** Provide installation script/instructions
- Build commands:
  - `npm run tauri build` - creates distributable
- Test packaged app on clean machine (no dev tools)
- Create README.md with:
  - Installation instructions
  - System requirements
  - Quick start guide
  - FFmpeg setup if needed

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

## Success Criteria for MVP

All 7 PRs merged and tested by **Tuesday, October 28th at 10:59 PM CT**:

1. ✅ Desktop app launches *(Completed)*
2. ✅ Video import (drag & drop + file picker) *(Completed)*
3. ✅ Timeline shows imported clips *(Completed)*
4. ✅ Video preview plays clips *(Completed)*
5. ✅ Trim clips with in/out points *(Completed)*
6. ✅ Export to MP4 *(Completed)*
7. ⏳ Packaged native app *(Pending)*

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

