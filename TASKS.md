# VibeClips - MVP Task Checklist

**Last Updated:** October 28, 2024  
**MVP Deadline:** Tuesday, October 28th at 10:59 PM CT
**Progress:** PRs 1-4 Completed, PRs 5-7 In Progress

---

## PR#1: Desktop App Setup & Launch ✅ COMPLETE
**Branch:** `feature/pr1-desktop-app-setup`

- [x] Install Rust toolchain and Tauri prerequisites
- [x] Run `npm create tauri-app` with React + TypeScript template
- [x] Configure `tauri.conf.json` window settings (title, dimensions, min size)
- [x] Set up feature-based folder structure in `/src/features/`
- [x] Create basic UI layout with placeholder sections (Import, Timeline, Preview, Export)
- [x] Configure Tauri allowlist for file system and dialog APIs
- [x] Test app launch in development mode (`npm run tauri dev`)
- [x] Verify hot-reload functionality works
- [x] Test on target platform (Windows/Mac)
- [x] Commit and push branch

---

## PR#2: Video Import System ✅ COMPLETE
**Branch:** `feature/pr2-video-import`

- [x] Create `/src/features/import/` folder structure
- [x] Implement `ImportZone.tsx` component with drag & drop handlers
- [x] Implement `FilePicker.tsx` using Tauri dialog API
- [x] Add file type filtering for MP4 and MOV formats
- [x] Create `MediaLibrary.tsx` to display imported files
- [x] Set up React Context/State for storing imported video files
- [x] Extract video metadata (duration, resolution, file size) using HTML5 video
- [x] Create `VideoFile` TypeScript interface
- [x] Display file metadata in media library (filename, duration, size)
- [x] Test drag & drop with multiple video files
- [x] Test file picker dialog functionality
- [x] Verify metadata extraction accuracy
- [x] Handle error cases (unsupported formats, corrupted files)
- [x] Commit and push branch

---

## PR#3: Timeline View ✅ COMPLETE
**Branch:** `feature/pr3-timeline-view`

- [x] Create `/src/features/timeline/` folder structure
- [x] Implement `Timeline.tsx` container component
- [x] Create `TimelineCanvas.tsx` with HTML5 Canvas setup
- [x] Draw time ruler with tick marks and time labels
- [x] Implement canvas rendering loop
- [x] Create `TimelineClip` data structure/interface
- [x] Draw clip blocks on canvas with thumbnails
- [x] Implement drag from media library to timeline
- [x] Handle drop events to add clips to timeline
- [x] Create `Playhead.tsx` component (vertical line indicator)
- [x] Implement playhead dragging (scrubbing)
- [x] Update timeline state when clips are added
- [x] Calculate clip positions and durations on timeline
- [x] Add visual feedback for hover/drag states
- [x] Test timeline with multiple clips
- [x] Test playhead scrubbing across full timeline
- [x] Verify time ruler accuracy
- [x] Commit and push branch

---

## PR#4: Video Preview Player ✅ COMPLETE
**Branch:** `feature/pr4-video-preview`

- [x] Create `/src/features/preview/` folder structure
- [x] Implement `VideoPlayer.tsx` with HTML5 `<video>` element
- [x] Create `PlayerControls.tsx` with play/pause buttons
- [x] Synchronize video element with timeline playhead
- [x] Implement `getCurrentClip()` function to find clip at playhead
- [x] Update video source when playhead crosses clip boundaries
- [x] Handle video.currentTime updates when playhead is dragged
- [x] Update playhead position during video playback
- [x] Implement play/pause functionality
- [x] Ensure audio playback is synchronized
- [x] Handle edge cases (no clip at playhead, gaps between clips)
- [x] Test scrubbing updates preview correctly
- [x] Test playback across multiple clips
- [x] Verify audio sync during playback
- [x] Test play/pause controls
- [x] Commit and push branch

---

## PR#5: Trim Functionality
**Branch:** `feature/pr5-trim-clips`

- [ ] Add clip selection state to timeline
- [ ] Implement click handler to select clips on timeline
- [ ] Draw trim handles on selected clip (left and right edges)
- [ ] Implement mouse detection for trim handle hover
- [ ] Add drag handlers for left trim handle (in-point)
- [ ] Add drag handlers for right trim handle (out-point)
- [ ] Update clip `trimStart` and `trimEnd` values during drag
- [ ] Recalculate clip duration based on trim points
- [ ] Add visual indicator for trimmed portions (different color/opacity)
- [ ] Validate trim bounds (can't trim beyond original duration)
- [ ] Update preview player to respect trim points
- [ ] Update video.currentTime calculation to account for trimStart
- [ ] Test trimming from start of clip
- [ ] Test trimming from end of clip
- [ ] Test preview playback with trimmed clips
- [ ] Verify trim is non-destructive to source file
- [ ] Commit and push branch

---

## PR#6: Export to MP4
**Branch:** `feature/pr6-export-mp4`

- [ ] Create `/src/features/export/` folder structure
- [ ] Implement `ExportDialog.tsx` with output path selector
- [ ] Add export button to main UI
- [ ] Create Tauri command `export_video` in Rust (`src-tauri/src/main.rs`)
- [ ] Install/bundle FFmpeg binary or document installation
- [ ] Build FFmpeg command string with clip inputs
- [ ] Implement concat demuxer for sequential clips
- [ ] Apply trim filters (`-ss` and `-t`) for each clip
- [ ] Set output codec (`-c:v libx264 -c:a aac`)
- [ ] Execute FFmpeg command from Rust
- [ ] Parse FFmpeg progress output
- [ ] Implement `ExportProgress.tsx` with progress bar
- [ ] Send progress updates from Rust to frontend
- [ ] Handle FFmpeg errors and display to user
- [ ] Save exported video to user-selected path
- [ ] Test export with single clip
- [ ] Test export with multiple clips
- [ ] Test export with trimmed clips
- [ ] Verify exported video plays in external players (VLC, QuickTime)
- [ ] Test error handling (invalid paths, FFmpeg not found)
- [ ] Commit and push branch

---

## PR#7: Build & Package
**Branch:** `feature/pr7-build-package`

- [ ] Configure `tauri.conf.json` for production build
- [ ] Set app version, identifier, and metadata
- [ ] Add app icon assets (PNG files in various sizes)
- [ ] Configure bundle settings for target platform (Windows/Mac)
- [ ] Decide FFmpeg bundling strategy (include or instructions)
- [ ] Test production build: `npm run tauri build`
- [ ] Run packaged app on development machine
- [ ] Test all features in production build (import, timeline, preview, trim, export)
- [ ] Verify no console errors in production
- [ ] Test app on clean machine (no dev environment)
- [ ] Create README.md with installation instructions
- [ ] Document system requirements
- [ ] Add quick start guide to README
- [ ] Include FFmpeg setup instructions if not bundled
- [ ] Upload distributable to GitHub Releases or cloud storage
- [ ] Test installer/executable on target platform
- [ ] Commit and push branch
- [ ] Merge final PR to main

---

## Final MVP Verification

- [ ] All 7 PRs merged to main branch
- [ ] Desktop app launches successfully
- [ ] Import video files via drag & drop
- [ ] Import video files via file picker
- [ ] Timeline displays imported clips correctly
- [ ] Preview player plays clips
- [ ] Playhead scrubbing works smoothly
- [ ] Trim functionality works on clips
- [ ] Export to MP4 completes successfully
- [ ] Exported video contains all clips in correct order
- [ ] Exported video respects trim points
- [ ] Packaged app works on clean machine
- [ ] Create 3-5 minute demo video
- [ ] Prepare GitHub repository with documentation
- [ ] Submit MVP by Tuesday, October 28th at 10:59 PM CT

---

## Notes

- Check off tasks as they are completed
- If blocked on a task, note the blocker and continue with other tasks
- Update this file regularly to track progress
- Use git commit messages to reference completed tasks

