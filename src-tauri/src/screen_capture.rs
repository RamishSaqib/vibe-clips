use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::process::{Child, Command, Stdio};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenSource {
    pub id: String,
    pub name: String,
    pub is_primary: bool,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug)]
pub struct RecordingSession {
    pub is_recording: bool,
    pub output_path: Option<String>,
    pub start_time: Option<std::time::SystemTime>,
    pub ffmpeg_process: Option<u32>, // Store process ID
    pub audio_start_time: Option<std::time::Instant>, // When audio capture actually started
    pub video_start_time: Option<std::time::Instant>, // When video capture actually started
}

lazy_static::lazy_static! {
    static ref RECORDING_SESSION: Arc<Mutex<RecordingSession>> = Arc::new(Mutex::new(RecordingSession {
        is_recording: false,
        output_path: None,
        start_time: None,
        ffmpeg_process: None,
        audio_start_time: None,
        video_start_time: None,
    }));
    static ref FFMPEG_CHILD: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
}

#[cfg(windows)]
pub fn list_screen_sources() -> Result<Vec<ScreenSource>, String> {
    // For now, return a simple list of available displays
    // Full Windows.Graphics.Capture enumeration requires more complex setup
    let mut sources = Vec::new();
    
    // Get primary monitor info using basic Windows API
    unsafe {
        use windows::Win32::Graphics::Gdi::{
            EnumDisplayMonitors, GetMonitorInfoW, HMONITOR, MONITORINFO,
        };
        use windows::Win32::Foundation::{LPARAM, RECT, TRUE};
        
        extern "system" fn monitor_enum_proc(
            monitor: HMONITOR,
            _: windows::Win32::Graphics::Gdi::HDC,
            _: *mut RECT,
            data: LPARAM,
        ) -> windows::Win32::Foundation::BOOL {
            unsafe {
                let sources = &mut *(data.0 as *mut Vec<ScreenSource>);
                
                let mut info = MONITORINFO {
                    cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                    ..Default::default()
                };
                
                if GetMonitorInfoW(monitor, &mut info).as_bool() {
                    let width = (info.rcMonitor.right - info.rcMonitor.left) as u32;
                    let height = (info.rcMonitor.bottom - info.rcMonitor.top) as u32;
                    let is_primary = info.dwFlags == 1;
                    
                    sources.push(ScreenSource {
                        id: format!("{:?}", monitor.0),
                        name: if is_primary {
                            format!("Primary Display ({}x{})", width, height)
                        } else {
                            format!("Display {} ({}x{})", sources.len() + 1, width, height)
                        },
                        is_primary,
                        width,
                        height,
                    });
                }
                
                TRUE
            }
        }
        
        let sources_ptr = &mut sources as *mut Vec<ScreenSource>;
        EnumDisplayMonitors(
            None,
            None,
            Some(monitor_enum_proc),
            LPARAM(sources_ptr as isize),
        );
    }
    
    if sources.is_empty() {
        sources.push(ScreenSource {
            id: "primary".to_string(),
            name: "Primary Display".to_string(),
            is_primary: true,
            width: 1920,
            height: 1080,
        });
    }
    
    Ok(sources)
}

#[cfg(not(windows))]
pub fn list_screen_sources() -> Result<Vec<ScreenSource>, String> {
    Err("Screen capture is only supported on Windows".to_string())
}

#[cfg(windows)]
pub fn start_screen_recording_process(output_path: String) -> Result<String, String> {
    let mut session = RECORDING_SESSION.lock().unwrap();
    
    if session.is_recording {
        return Err("Recording already in progress".to_string());
    }
    
    // Validate output path
    if !output_path.ends_with(".mp4") {
        return Err("Output path must end with .mp4".to_string());
    }
    
    // Start video recording FIRST (before audio)
    // This way we minimize the delay between them
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y");
    cmd.arg("-f").arg("gdigrab");
    cmd.arg("-draw_mouse").arg("0");
    cmd.arg("-framerate").arg("30");
    cmd.arg("-i").arg("desktop");
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("ultrafast");
    cmd.arg("-crf").arg("23");
    cmd.arg("-pix_fmt").arg("yuv420p");
    cmd.arg("-movflags").arg("faststart");
    
    // Store video-only path temporarily
    let video_only_path = output_path.replace(".mp4", "_video.mp4");
    cmd.arg(&video_only_path);
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("warning");
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());
    
    // Record when we spawn FFmpeg
    let video_start = std::time::Instant::now();
    
    let child = cmd.spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}. Make sure FFmpeg is installed and in PATH.", e))?;
    
    let pid = child.id();
    
    // Give FFmpeg a moment to initialize (critical for sync!)
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    // NOW start audio capture after FFmpeg has initialized
    let audio_start = std::time::Instant::now();
    
    let audio_path = output_path.replace(".mp4", "_audio.wav");
    let audio_result = super::audio_capture::start_audio_capture(audio_path.clone());
    
    let has_audio = audio_result.is_ok();
    if let Err(e) = audio_result {
        println!("Failed to start WASAPI audio capture: {}. Recording video only.", e);
    }
    
    // Store the child process
    let mut ffmpeg_child = FFMPEG_CHILD.lock().unwrap();
    *ffmpeg_child = Some(child);
    
    session.is_recording = true;
    session.output_path = Some(output_path.clone());
    session.start_time = Some(std::time::SystemTime::now());
    session.ffmpeg_process = Some(pid);
    session.audio_start_time = if has_audio { Some(audio_start) } else { None };
    session.video_start_time = Some(video_start);
    
    // Calculate and log the delay
    let delay_ms = audio_start.duration_since(video_start).as_millis();
    println!("Video started first, then audio {}ms later", delay_ms);
    
    let audio_status = if has_audio {
        "with WASAPI system audio"
    } else {
        "video only (no audio)"
    };
    
    Ok(format!("Recording started (PID: {}, {})", pid, audio_status))
}

#[cfg(not(windows))]
pub fn start_screen_recording_process(_output_path: String) -> Result<String, String> {
    Err("Screen capture is only supported on Windows".to_string())
}

pub fn stop_screen_recording_process() -> Result<String, String> {
    use std::io::Write;
    
    let mut session = RECORDING_SESSION.lock().unwrap();
    
    if !session.is_recording {
        return Err("No recording in progress".to_string());
    }
    
    let output_path = session.output_path.clone().unwrap_or_default();
    let video_only_path = output_path.replace(".mp4", "_video.mp4");
    let audio_path = output_path.replace(".mp4", "_audio.wav");
    
    // Calculate audio offset
    // Positive value = trim from start of audio (audio started first)
    // Negative value = pad start of audio with silence (video started first)
    let audio_offset_secs = if let (Some(audio_start), Some(video_start)) = 
        (session.audio_start_time, session.video_start_time) {
        if audio_start < video_start {
            // Audio started before video - trim audio
            video_start.duration_since(audio_start).as_secs_f64()
        } else {
            // Video started before audio - negative offset (we'll pad with silence or delay audio)
            -(audio_start.duration_since(video_start).as_secs_f64())
        }
    } else {
        0.0
    };
    
    if audio_offset_secs > 0.0 {
        println!("Audio offset: {:.3}s (will be trimmed from audio start)", audio_offset_secs);
    } else if audio_offset_secs < 0.0 {
        println!("Audio offset: {:.3}s (audio started AFTER video, will delay audio)", -audio_offset_secs);
    } else {
        println!("Audio and video started simultaneously");
    }
    
    // Send 'q' to FFmpeg to stop gracefully
    let mut ffmpeg_child = FFMPEG_CHILD.lock().unwrap();
    if let Some(mut child) = ffmpeg_child.take() {
        // Try to send 'q' to stdin for graceful shutdown
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(b"q");
            let _ = stdin.flush();
        }
        
        // Wait for FFmpeg to finish with timeout
        use std::time::Duration;
        
        // Wait up to 3 seconds for FFmpeg to finish
        for _ in 0..15 {
            match child.try_wait() {
                Ok(Some(_status)) => {
                    // Process finished
                    break;
                }
                Ok(None) => {
                    // Still running, wait a bit more
                    std::thread::sleep(Duration::from_millis(200));
                }
                Err(_) => {
                    // Error checking status, break
                    break;
                }
            }
        }
        
        // If still running after timeout, force kill
        let _ = child.kill();
        let _ = child.wait();
    }
    
    // Stop WASAPI audio capture
    let has_audio = super::audio_capture::is_audio_capturing();
    if has_audio {
        if let Err(e) = super::audio_capture::stop_audio_capture() {
            println!("Failed to stop audio capture: {}", e);
        }
    }
    
    session.is_recording = false;
    session.output_path = None;
    session.start_time = None;
    session.ffmpeg_process = None;
    session.audio_start_time = None;
    session.video_start_time = None;
    
    // Release lock before running FFmpeg
    drop(session);
    
    // Additional finalization time to ensure file is fully written and flushed to disk
    std::thread::sleep(std::time::Duration::from_millis(1000));
    
    // Check if audio file exists
    let audio_exists = std::path::Path::new(&audio_path).exists();
    
    // Debug: Check audio file properties
    if has_audio && audio_exists {
        match get_audio_info(&audio_path) {
            Ok(info) => println!("Audio file info: {}", info),
            Err(e) => println!("Failed to get audio info: {}", e),
        }
    }
    
    // Mux audio + video together
    if has_audio && audio_exists {
        println!("Muxing video ({}) + audio ({}) -> {}", video_only_path, audio_path, output_path);
        
        // Get durations to understand what we're working with
        let video_duration = get_video_duration(&video_only_path)?;
        let audio_duration = get_audio_duration(&audio_path)?;
        println!("Video duration: {:.2}s, Audio duration: {:.2}s", video_duration, audio_duration);
        println!("Audio offset: {:.3}s", audio_offset_secs);
        
        let mut cmd = Command::new("ffmpeg");
        cmd.arg("-y");
        
        // Input video
        cmd.arg("-i").arg(&video_only_path);
        cmd.arg("-i").arg(&audio_path);
        
        // Map video stream
        cmd.arg("-map").arg("0:v");
        
        // Handle audio with proper timing offset
        if audio_offset_secs.abs() > 0.001 {
            if audio_offset_secs > 0.0 {
                // Audio started BEFORE video - trim from the start
                let filter = format!("atrim=start={:.3},asetpts=PTS-STARTPTS,apad", audio_offset_secs);
                cmd.arg("-af").arg(filter);
            } else {
                // Video started BEFORE audio - pad silence at the beginning
                let delay_ms = (-audio_offset_secs * 1000.0) as i32;
                cmd.arg("-af").arg(format!("adelay={}|{},apad", delay_ms, delay_ms));
            }
        } else {
            // No significant offset, just pad to match video duration
            cmd.arg("-af").arg("apad");
        }
        
        cmd.arg("-map").arg("1:a");
        
        // Copy video and encode audio
        cmd.arg("-c:v").arg("copy");
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        
        // Use video duration as the authoritative length
        cmd.arg("-t").arg(format!("{:.3}", video_duration));
        
        cmd.arg("-movflags").arg("faststart");
        cmd.arg(&output_path);
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("warning");
        
        let mux_output = cmd.output()
            .map_err(|e| format!("Failed to mux audio and video: {}", e))?;
        
        if !mux_output.status.success() {
            let error = String::from_utf8_lossy(&mux_output.stderr);
            println!("FFmpeg mux error: {}", error);
            // Fall back to video-only file
            std::fs::copy(&video_only_path, &output_path)
                .map_err(|e| format!("Failed to copy video file: {}", e))?;
        } else {
            println!("Successfully muxed audio and video with {:.3}s offset", audio_offset_secs);
        }
        
        // Clean up temporary files
        let _ = std::fs::remove_file(&video_only_path);
        let _ = std::fs::remove_file(&audio_path);
    } else {
        // No audio, just rename video file
        println!("No audio captured, using video-only file");
        std::fs::rename(&video_only_path, &output_path)
            .map_err(|e| format!("Failed to rename video file: {}", e))?;
    }
    
    Ok(output_path)
}

// Helper function to get audio duration
fn get_audio_duration(audio_path: &str) -> Result<f64, String> {
    let output = Command::new("ffprobe")
        .arg("-v").arg("error")
        .arg("-show_entries").arg("format=duration")
        .arg("-of").arg("default=noprint_wrappers=1:nokey=1")
        .arg(audio_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to get audio duration".to_string());
    }
    
    let duration_str = String::from_utf8_lossy(&output.stdout);
    duration_str.trim().parse::<f64>()
        .map_err(|e| format!("Failed to parse audio duration: {}", e))
}

// Helper function to get video duration
fn get_video_duration(video_path: &str) -> Result<f64, String> {
    let output = Command::new("ffprobe")
        .arg("-v").arg("error")
        .arg("-show_entries").arg("format=duration")
        .arg("-of").arg("default=noprint_wrappers=1:nokey=1")
        .arg(video_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to get video duration".to_string());
    }
    
    let duration_str = String::from_utf8_lossy(&output.stdout);
    duration_str.trim().parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}

// Helper function to get audio info
fn get_audio_info(audio_path: &str) -> Result<String, String> {
    let output = Command::new("ffprobe")
        .arg("-v").arg("error")
        .arg("-show_entries").arg("stream=codec_type,codec_name,channels,sample_rate,duration")
        .arg("-show_entries").arg("format=duration,size")
        .arg("-of").arg("default=noprint_wrappers=1")
        .arg(audio_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe error: {}", error));
    }
    
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn get_recording_status() -> Result<bool, String> {
    let session = RECORDING_SESSION.lock().unwrap();
    Ok(session.is_recording)
}

