# VibeClips
## Desktop Video Editor Built with Tauri + React

A modern desktop video editor that enables you to import, edit, and export videos with an intuitive timeline interface.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

## 🎯 Project Overview

VibeClips is a desktop video editor built with **Tauri** (Rust backend) and **React** (TypeScript frontend). This project demonstrates building a production-ready video editing application with modern web technologies and native desktop performance.

### Current Status: MVP Development

This project is under active development following an MVP-first approach with numbered PRs:

- ✅ **PR#1:** Desktop App Setup & Launch
- 🚧 **PR#2:** Video Import System  
- ⏳ **PR#3:** Timeline View
- ⏳ **PR#4:** Video Preview Player
- ⏳ **PR#5:** Trim Functionality
- ⏳ **PR#6:** Export to MP4
- ⏳ **PR#7:** Build & Package

---

## ✨ Features

### MVP Features (In Development)
- 🖥️ **Desktop App** - Native desktop application with Tauri
- 📁 **Video Import** - Drag & drop or file picker for MP4/MOV files
- 🎬 **Timeline Editor** - Visual timeline with clip arrangement
- ▶️ **Video Preview** - Real-time playback of imported clips
- ✂️ **Trim Functionality** - Adjust in/out points on clips
- 📤 **Export to MP4** - FFmpeg-powered video export

### Planned Features
- 🎥 Screen recording
- 📹 Webcam capture
- 🎞️ Multiple tracks support
- 🎨 Text overlays
- ✨ Transitions & effects
- 🎚️ Audio controls
- 💾 Auto-save projects

---

## 🛠️ Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **HTML5 Canvas** - Timeline rendering
- **HTML5 Video** - Preview playback

### Backend
- **Tauri 2.x** - Desktop framework
- **Rust** - Native backend
- **FFmpeg** - Video processing

### Development
- **Node.js 18+** - JavaScript runtime
- **Rust 1.77+** - Rust compiler

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Rust 1.77+** installed ([Install](https://www.rust-lang.org/tools/install))
- **Git** for version control
- **FFmpeg** for video processing ([Install FFmpeg](https://ffmpeg.org/download.html))

### Installing FFmpeg

**Windows:**

**Option 1 - Manual Installation (Recommended):**
1. Download FFmpeg from [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
2. Download the latest build (e.g., `ffmpeg-release-full.7z`)
3. Extract to `C:\ffmpeg\` (or any location you prefer)
4. Add `C:\ffmpeg\bin` to your System PATH:
   - Open System Properties → Environment Variables
   - Edit "Path" variable
   - Add: `C:\ffmpeg\bin`
   - Click OK to save
5. Verify: Open a new terminal and run `ffmpeg -version`

**Option 2 - Package Manager:**
```bash
# Using Chocolatey (run as Administrator)
choco install ffmpeg -y

# Or using winget
winget install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

---

## 🚀 Getting Started

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/vibe-clips.git
cd vibe-clips
```

2. **Install dependencies**
```bash
npm install
```

3. **Run in development mode**
```bash
npm run tauri:dev
```

The app will launch with hot-reload enabled. Changes to React code will automatically refresh.

### Building for Production

```bash
npm run tauri:build
```

This will create a distributable in `src-tauri/target/release/bundle/`:
- **Windows:** `.msi` installer or `.exe`
- **macOS:** `.dmg` or `.app`
- **Linux:** `.deb` or `.AppImage`

**⚠️ Important:** The built application requires FFmpeg to be installed and accessible in the system PATH for video processing features to work (thumbnails, playback, export, recording). Make sure FFmpeg is installed on the target system as described in the [Installing FFmpeg](#installing-ffmpeg) section above.

---

## 📁 Project Structure

```
vibe-clips/
├── src/                          # React frontend
│   ├── features/                  # Feature-based modules
│   │   ├── import/               # Video import functionality
│   │   ├── timeline/             # Timeline editor
│   │   ├── preview/              # Video preview player
│   │   └── export/               # Video export functionality
│   ├── components/                # Shared React components
│   ├── hooks/                     # Custom React hooks
│   ├── utils/                     # Utility functions
│   └── types/                     # TypeScript type definitions
├── src-tauri/                     # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry point
│   │   └── lib.rs                # Application logic
│   ├── tauri.conf.json           # Tauri configuration
│   └── Cargo.toml                 # Rust dependencies
├── dist/                          # Frontend build output
├── README.md                      # This file
├── PRD.md                         # Product requirements document
├── TASKS.md                       # Task checklist
├── ARCHITECTURE.md                # Technical architecture
└── package.json                   # Node.js dependencies
```

---

## 🎮 Usage

### Importing Videos
1. Click the "Import" section or use the drag & drop area
2. Select MP4 or MOV files from your computer
3. Files appear in the media library with metadata

### Editing on Timeline
1. Drag clips from the media library to the timeline
2. Arrange clips in sequence
3. Trim clips by dragging the edges
4. Use the playhead to scrub through the timeline

### Previewing
- Click play to preview your composition
- Drag the playhead to jump to any point
- Audio plays synchronized with video

### Exporting
1. Click the "Export" button
2. Choose output location and settings
3. Wait for FFmpeg to process your video
4. Your exported MP4 is ready!

---

## 🧪 Development

### Running Tests
```bash
npm test
```

### Code Formatting
```bash
npm run format
```

### Linting
```bash
npm run lint
```

---

## 📖 Documentation

- **[PRD.md](PRD.md)** - Detailed product requirements for each PR
- **[TASKS.md](TASKS.md)** - Task checklist with progress tracking
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture and design decisions

---

## 🤝 Contributing

This is a learning project. Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built following the [VibeClips Project Challenge](RUBRIC.md)
- Powered by [Tauri](https://tauri.app/) and [React](https://react.dev/)
- Video processing by [FFmpeg](https://ffmpeg.org/)

---

## 📞 Support

For questions, issues, or feature requests, please [open an issue](https://github.com/yourusername/vibe-clips/issues).

---

**Happy Editing! 🎬**

