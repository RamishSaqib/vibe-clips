# VibeClips - MVP Task Checklist

**Last Updated:** October 28, 2024  
**MVP Deadline:** Tuesday, October 28th at 10:59 PM CT
**Progress:** All Core PRs Completed (PR#1-13) ✅

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

## PR#5: Trim Functionality ✅ COMPLETE
**Branch:** `feature/pr5-trim-clips`

- [x] Add clip selection state to timeline
- [x] Implement click handler to select clips on timeline
- [x] Draw trim handles on selected clip (left and right edges)
- [x] Implement mouse detection for trim handle hover
- [x] Add drag handlers for left trim handle (in-point)
- [x] Add drag handlers for right trim handle (out-point)
- [x] Update clip `trimStart` and `trimEnd` values during drag
- [x] Recalculate clip duration based on trim points
- [x] Add visual indicator for trimmed portions (different color/opacity)
- [x] Validate trim bounds (can't trim beyond original duration)
- [x] Update preview player to respect trim points
- [x] Update video.currentTime calculation to account for trimStart
- [x] Test trimming from start of clip
- [x] Test trimming from end of clip
- [x] Test preview playback with trimmed clips
- [x] Verify trim is non-destructive to source file
- [x] Commit and push branch

---

## PR#6: Export to MP4 ✅ COMPLETE
**Branch:** `feature/pr6-export-mp4`

- [x] Create `/src/features/export/` folder structure
- [x] Implement `ExportDialog.tsx` with output path selector
- [x] Add export button to main UI
- [x] Create Tauri command `export_video` in Rust (`src-tauri/src/main.rs`)
- [x] Install/bundle FFmpeg binary or document installation
- [x] Build FFmpeg command string with clip inputs
- [x] Implement concat demuxer for sequential clips
- [x] Apply trim filters (`-ss` and `-t`) for each clip
- [x] Set output codec (`-c:v libx264 -c:a aac`)
- [x] Execute FFmpeg command from Rust
- [x] Parse FFmpeg progress output (timeout handling)
- [x] Implement `ExportProgress.tsx` with progress bar
- [x] Send progress updates from Rust to frontend
- [x] Handle FFmpeg errors and display to user
- [x] Save exported video to user-selected path
- [x] Test export with single clip
- [x] Test export with multiple clips
- [x] Test export with trimmed clips
- [x] Verify exported video plays in external players (VLC, QuickTime)
- [x] Test error handling (invalid paths, FFmpeg not found)
- [x] Commit and push branch

---

## PR#7: Build & Package ✅ COMPLETE
**Branch:** `feature/pr7-build-package`

- [x] Configure `tauri.conf.json` for production build
- [x] Set app version, identifier, and metadata
- [x] Add app icon assets (PNG files in various sizes)
- [x] Configure bundle settings for target platform (Windows/Mac)
- [x] Decide FFmpeg bundling strategy (include or instructions)
- [x] Test production build: `npm run tauri build`
- [x] Run packaged app on development machine
- [x] Test all features in production build (import, timeline, preview, trim, export)
- [x] Verify no console errors in production
- [x] Test app on clean machine (no dev environment)
- [x] Create README.md with installation instructions
- [x] Document system requirements
- [x] Add quick start guide to README
- [x] Include FFmpeg setup instructions if not bundled
- [x] Upload distributable to GitHub Releases or cloud storage
- [x] Test installer/executable on target platform
- [x] Commit and push branch
- [x] Merge final PR to main

---

## PR#8: Screen Recording ✅ COMPLETE
**Branch:** `feature/pr8-screen-recording`

- [x] Create `/src/features/recording/` folder structure
- [x] Implement `RecordingPanel.tsx` with tabbed interface
- [x] Create `ScreenRecording.tsx` component
- [x] Enumerate available screen sources (displays, windows)
- [x] Create Rust module `screen_capture.rs`
- [x] Implement Windows gdigrab screen capture
- [x] Add WASAPI loopback for system audio
- [x] Handle audio/video sync timing offsets
- [x] Add recording indicator UI
- [x] Show elapsed time during recording
- [x] Save screen recordings to temp directory
- [x] Generate thumbnails for recordings
- [x] Add recordings to media library
- [x] Automatic timeline integration option
- [x] Test screen recording on multiple displays
- [x] Test system audio capture
- [x] Verify audio/video synchronization
- [x] Test recording stop/save flow
- [x] Commit and push branch

---

## PR#9: Webcam Recording ✅ COMPLETE
**Branch:** `feature/pr9-webcam-recording`

- [x] Create `WebcamRecording.tsx` component
- [x] Enumerate available camera devices
- [x] Implement live camera preview
- [x] Add resolution selector (480p, 720p, 1080p)
- [x] Add mirror preview toggle
- [x] Use MediaRecorder API for recording
- [x] Capture microphone audio with video
- [x] Save WebM recordings to temp directory
- [x] Create Rust command for WebM to MP4 conversion
- [x] Convert recordings to MP4 using FFmpeg
- [x] Generate thumbnails for webcam recordings
- [x] Add recordings to media library
- [x] Automatic timeline integration option
- [x] Test with multiple camera devices
- [x] Test different resolutions
- [x] Test audio recording
- [x] Verify WebM to MP4 conversion
- [x] Commit and push branch

---

## PR#10: Combined PiP Recording ✅ COMPLETE
**Branch:** `feature/pr10-combined-recording`

- [x] Create `CombinedRecording.tsx` component
- [x] Add screen source selector
- [x] Add camera selector with live preview
- [x] Implement PiP position selector (4 corners)
- [x] Add PiP size selector (small, medium, large)
- [x] Add padding configuration
- [x] Add audio options (system audio, mic audio, both)
- [x] Add save options (screen, webcam, composite, all)
- [x] Coordinate screen and webcam recording start
- [x] Track screen recording start time offset
- [x] Create `composite_pip_video` Rust command
- [x] Implement FFmpeg filter_complex for overlay
- [x] Calculate PiP position based on config
- [x] Scale webcam video for PiP
- [x] Mix audio tracks with amix filter
- [x] Handle audio delay with adelay filter
- [x] Add webcam latency compensation (100ms buffer)
- [x] Handle screen start offset for A/V sync
- [x] Generate thumbnails for composite videos
- [x] Support all save options (split videos, composite, all)
- [x] Test all PiP positions
- [x] Test all PiP sizes
- [x] Test audio options (system, mic, both)
- [x] Verify audio/video synchronization
- [x] Test all save options
- [x] Commit and push branch

---

## PR#11: UI Improvements & Video Management ✅ COMPLETE
**Branch:** `main` (direct commits)

- [x] Improve timeline trim UI visibility
- [x] Add dedicated ruler section above clips
- [x] Increase trim handle size to 14px
- [x] Add gradient and shadow effects to handles
- [x] Implement grip lines for visual affordance
- [x] Add hover effects on trim handles
- [x] Change cursor to ew-resize on hover
- [x] Add diagonal hatching for trimmed regions
- [x] Create `ConfirmDialog.tsx` reusable component
- [x] Add delete button to media library items
- [x] Implement video deletion with confirmation
- [x] Create `removeVideo` function in VideoContext
- [x] Create `removeClipsByVideoId` function in TimelineContext
- [x] Handle playhead repositioning after deletion
- [x] Support both data URLs and file paths in MediaLibrary
- [x] Support both data URLs and file paths in VideoPlayer
- [x] Test timeline trim improvements
- [x] Test video deletion flow
- [x] Test confirmation dialog
- [x] Verify clips are removed with video
- [x] Commit and push changes

---

## PR#12: Production Build Fixes ✅ COMPLETE
**Branch:** `main` (direct commits)

- [x] Fix FFmpeg console windows appearing in production
- [x] Create `create_hidden_command()` helper function
- [x] Add CREATE_NO_WINDOW flag for Windows
- [x] Implement `find_ffmpeg_binary()` function
- [x] Add `get_bundled_ffmpeg_path()` function
- [x] Check bundled binaries first
- [x] Fall back to system PATH
- [x] Check common Windows FFmpeg locations
- [x] Update all FFmpeg commands to use helper
- [x] Update screen_capture.rs with same fixes
- [x] Fix Content Security Policy in tauri.conf.json
- [x] Add data: URL support for img-src and media-src
- [x] Add asset: URL support for img-src and media-src
- [x] Add resources: ["binaries/*"] to bundle config
- [x] Fix unique ID generation for imported videos
- [x] Add array index to video ID generation
- [x] Fix discard button in CombinedRecording
- [x] Reset recordingType and recordedVideoPath explicitly
- [x] Fix audio sync in composite_pip_video
- [x] Add webcam latency buffer (100ms)
- [x] Replace -vsync 2 with fps_mode vfr
- [x] Fix aresample=async=1 placement in filter_complex
- [x] Improve thumbnail generation for PiP videos
- [x] Change -ss to 00:00:00.5 for reliability
- [x] Add -q:v 2 for higher quality thumbnails
- [x] Add detailed logging for thumbnail generation
- [x] Update .gitignore for FFmpeg binaries
- [x] Test production build with all fixes
- [x] Verify all video types display correctly
- [x] Verify thumbnails generate for all videos
- [x] Verify audio sync in composite videos
- [x] Commit and push changes

---

## PR#13: Code Refactoring & Optimization ✅ COMPLETE
**Branch:** `main` (direct commits)

- [x] Create `src/utils/format.ts` with shared utilities
- [x] Implement `formatTime()` function
- [x] Implement `formatDuration()` function
- [x] Implement `formatFileSize()` function
- [x] Create `src/utils/constants.ts` with shared constants
- [x] Define TIMELINE_CONSTANTS object
- [x] Define RECORDING_RESOLUTIONS array
- [x] Define DRAG_THRESHOLD constant
- [x] Define TRIM_THROTTLE_MS constant
- [x] Define DRAG_THROTTLE_MS constant
- [x] Create `src/utils/index.ts` barrel export
- [x] Create `src/hooks/useCameraPreview.ts` custom hook
- [x] Implement camera stream management
- [x] Add automatic lifecycle cleanup
- [x] Add error and loading states
- [x] Update TimelineCanvas.tsx with optimizations
- [x] Add useMemo for maxDuration calculation
- [x] Add useMemo for canvasWidth calculation
- [x] Convert handlers to useCallback
- [x] Replace magic numbers with constants
- [x] Update Timeline.tsx to use shared formatTime
- [x] Update MediaLibrary.tsx to use shared utilities
- [x] Update CombinedRecording.tsx with shared utilities
- [x] Fix handleDiscardRecording implementation
- [x] Update ScreenRecording.tsx with shared utilities
- [x] Update WebcamRecording.tsx with shared utilities
- [x] Update resolution selector to use constants
- [x] Update ExportDialog.tsx with shared utilities
- [x] Create REFACTORING_SUMMARY.md documentation
- [x] Test all components compile without errors
- [x] Verify no linter errors introduced
- [x] Test timeline performance improvements
- [x] Verify all features work identically
- [x] Run production build test
- [x] Commit and push changes

---

## Final MVP Verification ✅ COMPLETE

- [x] All 13 PRs completed
- [x] Desktop app launches successfully
- [x] Import video files via drag & drop
- [x] Import video files via file picker
- [x] Delete imported videos from media library
- [x] Timeline displays imported clips correctly
- [x] Preview player plays clips
- [x] Playhead scrubbing works smoothly
- [x] Trim functionality works on clips
- [x] Timeline trim UI is intuitive and visible
- [x] Export to MP4 completes successfully
- [x] Exported video contains all clips in correct order
- [x] Exported video respects trim points
- [x] Screen recording with system audio works
- [x] Webcam recording with microphone works
- [x] Combined PiP recording works (screen + webcam)
- [x] All PiP configurations work (position, size, padding)
- [x] Audio synchronization maintained in all recordings
- [x] Packaged app works in production
- [x] FFmpeg discovery system functional
- [x] No console windows in production build
- [x] All video types display correctly (imported and recorded)
- [x] Thumbnails generate for all video types
- [x] Code refactored and optimized
- [x] Performance improved with memoization
- [x] Shared utilities and constants created
- [x] Documentation complete (README, REFACTORING_SUMMARY)
- [x] GitHub repository updated
- [x] MVP delivered by Tuesday, October 28th at 10:59 PM CT ✅

---

## Additional Features Beyond MVP

**Completed:**
- ✅ Screen Recording (PR#8)
- ✅ Webcam Recording (PR#9)
- ✅ Combined PiP Recording (PR#10)
- ✅ Video Deletion (PR#11)
- ✅ Enhanced Timeline UI (PR#11)
- ✅ Production Build Hardening (PR#12)
- ✅ Code Refactoring & Optimization (PR#13)

---

## Notes

- Check off tasks as they are completed
- If blocked on a task, note the blocker and continue with other tasks
- Update this file regularly to track progress
- Use git commit messages to reference completed tasks

