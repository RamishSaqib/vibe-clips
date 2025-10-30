use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
// transcription module is available via mod transcription above

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

mod screen_capture;
mod audio_capture;
mod transcription;

const KEYRING_SERVICE: &str = "com.vibeclips.app";
const KEYRING_USERNAME: &str = "openai_api_key";

// Helper function to get bundled FFmpeg path
fn get_bundled_ffmpeg_path(app_handle: &tauri::AppHandle, program: &str) -> Option<std::path::PathBuf> {
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        #[cfg(target_os = "windows")]
        let binary_name = format!("{}.exe", program);
        #[cfg(not(target_os = "windows"))]
        let binary_name = program.to_string();
        
        let bundled_path = resource_dir.join("binaries").join(&binary_name);
        if bundled_path.exists() {
            println!("Found bundled {}: {:?}", program, bundled_path);
            return Some(bundled_path);
        }
    }
    None
}

// Helper function to find ffmpeg/ffprobe executable
fn find_ffmpeg_binary(app_handle: Option<&tauri::AppHandle>, program: &str) -> String {
    // First, try bundled binaries if app_handle is available
    if let Some(handle) = app_handle {
        if let Some(bundled_path) = get_bundled_ffmpeg_path(handle, program) {
            return bundled_path.to_string_lossy().to_string();
        }
    }
    
    // Then try the program name directly (will work if in PATH)
    if std::process::Command::new(program)
        .arg("-version")
        .output()
        .is_ok()
    {
        return program.to_string();
    }

    // Common Windows installation locations
    #[cfg(target_os = "windows")]
    {
        let common_paths = vec![
            format!("C:\\ffmpeg\\bin\\{}.exe", program),
            format!("C:\\Program Files\\ffmpeg\\bin\\{}.exe", program),
            format!("{}\\ffmpeg\\bin\\{}.exe", std::env::var("LOCALAPPDATA").unwrap_or_default(), program),
            format!("{}\\ffmpeg\\bin\\{}.exe", std::env::var("PROGRAMFILES").unwrap_or_default(), program),
        ];

        for path in common_paths {
            if std::path::Path::new(&path).exists() {
                return path;
            }
        }
    }

    // If all else fails, return the program name and let it fail with a useful error
    program.to_string()
}

// Helper function to create a Command that won't show a console window on Windows
fn create_hidden_command(app_handle: Option<&tauri::AppHandle>, program: &str) -> Command {
    let ffmpeg_path = find_ffmpeg_binary(app_handle, program);
    let mut cmd = Command::new(ffmpeg_path);
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClipFilters {
    brightness: Option<i32>,  // -100 to 100
    contrast: Option<i32>,    // -100 to 100
    saturation: Option<i32>,  // -100 to 100
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClipData {
    file_path: String,
    trim_start: f64,
    duration: f64,
    start_time: f64,
    track: i32, // Track number: 0 = main video, 1 = overlay 1, 2 = overlay 2
    filters: Option<ClipFilters>, // Optional filters applied to clip
}

#[tauri::command]
fn test_export() -> Result<String, String> {
    println!("\n\nTEST COMMAND CALLED\n\n");
    Ok("Test successful".to_string())
}

#[tauri::command]
fn save_temp_video(data_url: String) -> Result<String, String> {
    use std::io::Write;
    use base64::{Engine as _, engine::general_purpose};
    
    // Extract base64 data from data URL
    if !data_url.starts_with("data:") {
        return Err("Not a valid data URL".to_string());
    }
    
    let base64_data = data_url.split(',').nth(1)
        .ok_or("Invalid data URL format")?;
    
    // Decode base64
    let bytes = general_purpose::STANDARD.decode(base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Create temp file
    use std::env;
    let temp_dir = env::temp_dir();
    let video_path = temp_dir.join(format!("video_{}.mp4", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    
    // Write file
    std::fs::File::create(&video_path)
        .and_then(|mut f| f.write_all(&bytes))
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    Ok(video_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_temp_dir() -> Result<String, String> {
    let temp = std::env::temp_dir();
    Ok(temp.to_string_lossy().to_string())
}

#[tauri::command]
fn write_srt_file(srt_content: String) -> Result<String, String> {
    use std::fs;
    
    println!("Writing SRT file...");
    println!("SRT content length: {} bytes", srt_content.len());
    println!("SRT content preview:\n{}", &srt_content.chars().take(300).collect::<String>());
    
    let temp_dir = std::env::temp_dir();
    let srt_path = temp_dir.join(format!("subtitles_{}.srt", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()));
    
    fs::write(&srt_path, &srt_content)
        .map_err(|e| format!("Failed to write SRT file: {}", e))?;
    
    println!("SRT file written to: {:?}", srt_path);
    
    // Verify file was written
    if let Ok(metadata) = fs::metadata(&srt_path) {
        println!("SRT file size: {} bytes", metadata.len());
    }
    
    Ok(srt_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_file_size(file_path: String) -> Result<u64, String> {
    use std::fs;
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to get file size: {}", e))?;
    Ok(metadata.len())
}

#[tauri::command]
fn get_video_duration_from_file(app_handle: tauri::AppHandle, video_path: String) -> Result<f64, String> {
    let output = create_hidden_command(Some(&app_handle), "ffprobe")
        .arg("-v").arg("error")
        .arg("-show_entries").arg("format=duration")
        .arg("-of").arg("default=noprint_wrappers=1:nokey=1")
        .arg(&video_path)
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to get video duration".to_string());
    }
    
    let duration_str = String::from_utf8_lossy(&output.stdout);
    duration_str.trim().parse::<f64>()
        .map_err(|e| format!("Failed to parse duration: {}", e))
}

#[tauri::command]
fn generate_video_thumbnail(app_handle: tauri::AppHandle, video_path: String, output_path: String) -> Result<String, String> {
    println!("Generating thumbnail for: {}", video_path);
    println!("Output path: {}", output_path);
    
    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-i").arg(&video_path);
    cmd.arg("-ss").arg("00:00:00.5"); // Take frame at 0.5 seconds (more reliable)
    cmd.arg("-vframes").arg("1"); // Extract 1 frame
    cmd.arg("-vf").arg("scale=160:90"); // Thumbnail size
    cmd.arg("-q:v").arg("2"); // High quality JPEG
    cmd.arg(&output_path);
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("info"); // Changed from error to info for debugging
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
    
    if output.status.success() {
        println!("Thumbnail generated successfully");
        Ok(output_path)
    } else {
        let error_str = String::from_utf8_lossy(&output.stderr);
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        println!("FFmpeg stderr: {}", error_str);
        println!("FFmpeg stdout: {}", stdout_str);
        Err(format!("FFmpeg thumbnail error: {}", error_str))
    }
}

#[tauri::command]
fn list_screen_sources() -> Result<Vec<screen_capture::ScreenSource>, String> {
    screen_capture::list_screen_sources()
}

#[tauri::command]
fn list_audio_devices(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    // List available audio devices using FFmpeg
    let output = create_hidden_command(Some(&app_handle), "ffmpeg")
        .arg("-list_devices").arg("true")
        .arg("-f").arg("dshow")
        .arg("-i").arg("dummy")
        .output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
    
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut audio_devices = Vec::new();
    
    // Parse FFmpeg output for audio devices
    let mut in_audio_section = false;
    for line in stderr.lines() {
        if line.contains("DirectShow audio devices") {
            in_audio_section = true;
            continue;
        }
        if in_audio_section {
            if line.contains("DirectShow video devices") {
                break;
            }
            // Extract device name from lines like: [dshow @ ...] "Device Name"
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start+1..].find('"') {
                    let device_name = &line[start+1..start+1+end];
                    audio_devices.push(device_name.to_string());
                }
            }
        }
    }
    
    Ok(audio_devices)
}

#[tauri::command]
fn test_ffmpeg(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Test if FFmpeg is available and working
    let output = create_hidden_command(Some(&app_handle), "ffmpeg")
        .arg("-version")
        .output()
        .map_err(|e| format!("FFmpeg not found or not executable: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().take(1).collect::<Vec<&str>>().join(""))
}

#[tauri::command]
fn start_screen_recording_async(output_path: String) -> Result<String, String> {
    screen_capture::start_screen_recording_process(output_path)
}

#[tauri::command]
fn stop_screen_recording_async() -> Result<String, String> {
    screen_capture::stop_screen_recording_process()
}

#[tauri::command]
fn get_recording_status() -> Result<bool, String> {
    screen_capture::get_recording_status()
}

#[tauri::command]
fn mux_video_audio(app_handle: tauri::AppHandle, video_path: String, audio_path: String, output_path: String) -> Result<String, String> {
    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-i").arg(&video_path);
    cmd.arg("-i").arg(&audio_path);
    cmd.arg("-c:v").arg("copy");
    cmd.arg("-c:a").arg("aac");
    cmd.arg("-b:a").arg("192k");
    cmd.arg(&output_path);
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("error");
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
    
    if output.status.success() {
        Ok(output_path)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg mux error: {}", error))
    }
}

#[tauri::command]
fn convert_webm_to_mp4(app_handle: tauri::AppHandle, input_path: String, output_path: String) -> Result<String, String> {
    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-i").arg(&input_path);
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("fast");
    cmd.arg("-crf").arg("23");
    cmd.arg("-c:a").arg("aac");
    cmd.arg("-b:a").arg("192k");
    cmd.arg("-movflags").arg("faststart");
    cmd.arg(&output_path);
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("error");
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
    
    if output.status.success() {
        // Clean up the WebM file
        let _ = std::fs::remove_file(&input_path);
        Ok(output_path)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg conversion error: {}", error))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PiPConfig {
    position: String, // "top-left" | "top-right" | "bottom-left" | "bottom-right"
    size: String,     // "small" | "medium" | "large"
    padding: u32,     // Padding from edges in pixels
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AudioOptions {
    #[serde(rename = "includeSystemAudio")]
    include_system_audio: bool,
    #[serde(rename = "includeMicAudio")]
    include_mic_audio: bool,
}

#[tauri::command]
fn composite_pip_video(
    app_handle: tauri::AppHandle,
    screen_path: String, 
    webcam_path: String, 
    pip_config: PiPConfig,
    audio_options: AudioOptions,
    output_path: String,
    screen_start_offset: Option<f64>, // Seconds to delay screen audio/video
) -> Result<String, String> {
    // First, probe the input files to see which streams they actually have
    let screen_has_audio = check_has_audio_stream(&screen_path);
    let webcam_has_audio = check_has_audio_stream(&webcam_path);
    
    // Adjust audio options based on what's actually available
    let use_screen_audio = audio_options.include_system_audio && screen_has_audio;
    let use_webcam_audio = audio_options.include_mic_audio && webcam_has_audio;
    
    // Calculate PiP dimensions based on size
    let (pip_width, pip_height) = match pip_config.size.as_str() {
        "small" => (320, 180),   // ~16.7% of 1920x1080
        "medium" => (480, 270),  // ~25% of 1920x1080
        "large" => (640, 360),   // ~33% of 1920x1080
        _ => (320, 180),         // Default to small
    };

    // Calculate overlay position based on corner
    let overlay_position = match pip_config.position.as_str() {
        "top-left" => format!("{}:{}", pip_config.padding, pip_config.padding),
        "top-right" => format!("W-w-{}:{}", pip_config.padding, pip_config.padding),
        "bottom-left" => format!("{}:H-h-{}", pip_config.padding, pip_config.padding),
        "bottom-right" => format!("W-w-{}:H-h-{}", pip_config.padding, pip_config.padding),
        _ => format!("W-w-{}:H-h-{}", pip_config.padding, pip_config.padding), // Default to bottom-right
    };

    // Get screen video duration (master timeline)
    let screen_duration = match get_video_duration_from_file(app_handle.clone(), screen_path.clone()) {
        Ok(dur) => {
            println!("Screen recording duration: {:.2}s", dur);
            dur
        },
        Err(e) => {
            println!("Warning: Could not get screen duration: {}", e);
            0.0
        }
    };

    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-i").arg(&screen_path);    // Input 0: screen recording (master timeline)
    cmd.arg("-i").arg(&webcam_path);    // Input 1: webcam recording
    
    // Use screen recording as master timeline
    cmd.arg("-map_metadata").arg("0");
    cmd.arg("-fflags").arg("+genpts");
    
    let mut delay_offset = screen_start_offset.unwrap_or(0.0);
    
    // Add a small buffer (100ms) to account for webcam processing latency
    // Webcams typically have 50-150ms inherent delay compared to screen capture
    delay_offset += 0.100;
    
    println!("Compositing with screen delay offset: {:.3}s (includes 100ms webcam latency buffer)", delay_offset);
    
    // Ensure proper A/V sync
    cmd.arg("-fps_mode").arg("vfr");
    
    // Handle different audio combinations WITH PROPER DELAY
    // Note: aresample=async=1 is built into the filter_complex to fix sync issues
    if use_screen_audio && use_webcam_audio {
        // Both system audio and mic audio
        // Always apply delay since we now always have at least the 100ms buffer
        let delay_ms = (delay_offset * 1000.0) as i32;
        let screen_audio_filter = format!("[0:a]adelay={}|{},aresample=async=1,apad[a0]", delay_ms, delay_ms);
        
        let filter_complex = format!(
            "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout];{};[1:a]aresample=async=1,apad[a1];[a0][a1]amix=inputs=2:duration=longest[aout]",
            pip_width, pip_height, overlay_position, screen_audio_filter
        );
        cmd.arg("-filter_complex").arg(&filter_complex);
        cmd.arg("-map").arg("[vout]");
        cmd.arg("-map").arg("[aout]");
    } else if use_screen_audio {
        // System audio only - always apply delay (includes webcam latency buffer)
        let delay_ms = (delay_offset * 1000.0) as i32;
        let filter_complex = format!(
            "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout];[0:a]adelay={}|{},aresample=async=1,apad[aout]",
            pip_width, pip_height, overlay_position, delay_ms, delay_ms
        );
        cmd.arg("-filter_complex").arg(&filter_complex);
        cmd.arg("-map").arg("[vout]");
        cmd.arg("-map").arg("[aout]");
    } else if use_webcam_audio {
        // Mic audio only - pad to match video duration
        let filter_complex = format!(
            "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout];[1:a]aresample=async=1,apad[aout]",
            pip_width, pip_height, overlay_position
        );
        cmd.arg("-filter_complex").arg(&filter_complex);
        cmd.arg("-map").arg("[vout]");
        cmd.arg("-map").arg("[aout]");
    } else {
        // No audio
        let filter_complex = format!(
            "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}",
            pip_width, pip_height, overlay_position
        );
        cmd.arg("-filter_complex").arg(&filter_complex);
    }
    
    // Video and audio encoding - use ultrafast for speed
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("ultrafast");
    cmd.arg("-crf").arg("23");
    
    if use_screen_audio || use_webcam_audio {
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
    }
    
    // Set output duration to match screen recording (master timeline)
    if screen_duration > 0.0 {
        cmd.arg("-t").arg(format!("{:.3}", screen_duration));
    }
    
    // Don't use -shortest when we have delayed audio
    // Instead, let the video determine the duration (via -t)
    // The adelay filter will pad with silence, so audio won't be cut short
    
    cmd.arg("-movflags").arg("faststart");
    cmd.arg(&output_path);
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("info");
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
    
    if output.status.success() {
        Ok(output_path)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg composite error: {}", error))
    }
}

// Helper function to check if a video file has an audio stream
fn check_has_audio_stream(file_path: &str) -> bool {
    let output = create_hidden_command(None, "ffmpeg")
        .arg("-i")
        .arg(file_path)
        .arg("-hide_banner")
        .output();
    
    if let Ok(output) = output {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Look for "Audio:" in the output which indicates an audio stream
        stderr.contains("Audio:")
    } else {
        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OverlayPositions {
    track1: Option<String>, // "bottom-left" | "bottom-right" | "top-left" | "top-right" | "center"
    track2: Option<String>,
}

#[tauri::command]
async fn export_video(
    app_handle: tauri::AppHandle,
    clips: Vec<ClipData>,
    #[allow(non_snake_case)] outputPath: String,
    width: u32,
    height: u32,
    crf: String,
    preset: String,
    overlay_positions: Option<OverlayPositions>,
    #[allow(non_snake_case)] subtitleSrtPath: Option<String>,
) -> Result<String, String> {
    // Write to log FIRST THING to verify function is called
    let log_path = std::path::Path::new("src-tauri/export_debug.log");
    let _ = std::fs::write(log_path, "=== FUNCTION CALLED ===\n");
    
    println!("=== EXPORT_VIDEO CALLED ===");
    println!("Clips: {}", clips.len());
    println!("Output path: {}", outputPath);
    println!("Width: {}, Height: {}", width, height);
    println!("CRF: {}, Preset: {}", crf, preset);
    println!("Overlay positions: {:?}", overlay_positions);
    println!("Subtitle SRT path: {:?}", subtitleSrtPath);
    println!("==========================");
    
    // Log to file to avoid terminal spam
    let mut log = format!("Clips count: {}\nOutput path: {}\n", 
                          clips.len(), outputPath);
    
    if clips.is_empty() {
        log.push_str("ERROR: No clips\n");
        let log_path = std::path::Path::new("src-tauri/export_debug.log");
        let _ = std::fs::write(log_path, &log);
        return Err("No clips to export".to_string());
    }
    
    log.push_str("Got clips, starting export...\n");
    log.push_str(&format!("Exporting {} clips to '{}'\n", clips.len(), outputPath));
    
    // Validate output path has a filename
    if !outputPath.ends_with(".mp4") && !outputPath.ends_with(".mov") {
        let error_msg = format!("Output path must end with .mp4 or .mov, got: '{}'", outputPath);
        log.push_str(&format!("ERROR: {}\n", error_msg));
        let log_path = std::path::Path::new("src-tauri/export_debug.log");
        let _ = std::fs::write(log_path, &log);
        return Err(error_msg);
    }
    
    log.push_str(&format!("Output path validated: {}\n", outputPath));
    
    for (i, clip) in clips.iter().enumerate() {
        log.push_str(&format!("Clip {}: path={}, trim_start={}, duration={}\n", 
                 i, clip.file_path, clip.trim_start, clip.duration));
    }
    
    let _ = std::fs::write("src-tauri/export_debug.log", &log);
    
    // Sort clips by start_time to maintain order
    let mut sorted_clips = clips.clone();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    // Clone variables for the blocking task
    let output_path_clone = outputPath.clone();
    let app_handle_clone = app_handle.clone();
    
    let overlay_positions_clone = overlay_positions.clone();
    let subtitle_srt_path_clone = subtitleSrtPath.clone();
    
    // Run the export in a blocking task to avoid freezing the UI
    let result = tokio::task::spawn_blocking(move || {
        export_video_blocking(app_handle_clone, sorted_clips, output_path_clone, width, height, crf, preset, overlay_positions_clone, subtitle_srt_path_clone)
    }).await.map_err(|e| format!("Task join error: {}", e))??;
    
    Ok(result)
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    use keyring::Entry;
    
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.set_password(&api_key)
        .map_err(|e| format!("Failed to save API key: {}", e))?;
    
    println!("API key saved securely to system keyring");
    Ok(())
}

#[tauri::command]
fn get_api_key() -> Result<String, String> {
    use keyring::Entry;
    
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.get_password()
        .map_err(|_| "No API key found. Please set your OpenAI API key in Settings.".to_string())
}

#[tauri::command]
fn delete_api_key() -> Result<(), String> {
    use keyring::Entry;
    
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.delete_password()
        .map_err(|e| format!("Failed to delete API key: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn transcribe_clip(
    app_handle: tauri::AppHandle,
    video_path: String,
    trim_start: f64,
    trim_end: f64,
    api_key: Option<String>, // Optional - will use keyring if not provided
) -> Result<transcription::TranscriptionResponse, String> {
    use std::env;
    use keyring::Entry;
    
    // Get API key from parameter, keyring, or fallback to .env (for development)
    let final_api_key = match api_key {
        Some(key) if !key.is_empty() => key,
        _ => {
            // Try keyring first
            let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
                .map_err(|e| format!("Failed to access keyring: {}", e))?;
            
            match entry.get_password() {
                Ok(key) => key,
                Err(_) => {
                    // Fallback to .env for development
                    let _ = dotenv::dotenv();
                    env::var("OPENAI_API_KEY")
                        .map_err(|_| "OpenAI API key not found. Please set your API key in Settings.".to_string())?
                }
            }
        }
    };
    
    // Create temp directory for audio extraction
    let temp_dir = env::temp_dir();
    let audio_path = temp_dir.join(format!("audio_{}.mp3", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()));
    
    // Extract the trimmed audio segment from the video
    let ffmpeg_path = find_ffmpeg_binary(Some(&app_handle), "ffmpeg");
    let mut cmd = Command::new(&ffmpeg_path);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    
    let duration = trim_end - trim_start;
    
    cmd.arg("-i")
        .arg(&video_path)
        .arg("-ss")
        .arg(&trim_start.to_string())
        .arg("-t")
        .arg(&duration.to_string())
        .arg("-vn") // No video
        .arg("-acodec")
        .arg("libmp3lame")
        .arg("-ar")
        .arg("16000") // 16kHz sample rate for Whisper
        .arg("-ac")
        .arg("1") // Mono
        .arg("-y") // Overwrite
        .arg(audio_path.to_str().unwrap());
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to extract audio: {}", error_msg));
    }
    
    // Transcribe using Whisper API
    let result = transcription::transcribe_audio_whisper(
        audio_path.to_str().unwrap(),
        &final_api_key,
    ).await?;
    
    // Clean up temp audio file
    let _ = std::fs::remove_file(&audio_path);
    
    Ok(result)
}

// Helper function to build FFmpeg eq filter string from ClipFilters
fn build_eq_filter(filters: &Option<ClipFilters>) -> Option<String> {
    let filters = filters.as_ref()?;
    
    let mut parts = Vec::new();
    
    if let Some(brightness) = filters.brightness {
        // Convert -100 to 100 to brightness value between -1.0 and 1.0
        let brightness_val = brightness as f64 / 100.0;
        parts.push(format!("brightness={:.3}", brightness_val));
    }
    
    if let Some(contrast) = filters.contrast {
        // Convert -100 to 100 to contrast value between 0.0 and 2.0
        let contrast_val = 1.0 + (contrast as f64 / 100.0);
        parts.push(format!("contrast={:.3}", contrast_val));
    }
    
    if let Some(saturation) = filters.saturation {
        // Convert -100 to 100 to saturation value between 0.0 and 2.0
        let saturation_val = 1.0 + (saturation as f64 / 100.0);
        parts.push(format!("saturation={:.3}", saturation_val));
    }
    
    if parts.is_empty() {
        None
    } else {
        Some(format!("eq={}", parts.join(":")))
    }
}

// Blocking export function that does the actual FFmpeg work
fn calculate_overlay_pos(position: &str, base_w: u32, base_h: u32, overlay_w: u32, overlay_h: u32, padding: u32) -> (u32, u32) {
    match position {
        "bottom-left" => (padding, base_h - overlay_h - padding),
        "bottom-right" => (base_w - overlay_w - padding, base_h - overlay_h - padding),
        "top-left" => (padding, padding),
        "top-right" => (base_w - overlay_w - padding, padding),
        "center" => ((base_w - overlay_w) / 2, (base_h - overlay_h) / 2),
        _ => (base_w - overlay_w - padding, base_h - overlay_h - padding), // default to bottom-right
    }
}

// Helper function to convert SRT to ASS format for better FFmpeg compatibility
fn convert_srt_to_ass(srt_path: &str, _app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use std::fs;
    
    println!("🎬 Processing subtitles from: {}", srt_path);
    
    // Verify source SRT exists
    if !std::path::Path::new(srt_path).exists() {
        return Err(format!("Subtitle file not found: {}", srt_path));
    }
    
    // Read SRT content
    let srt_content = fs::read_to_string(srt_path)
        .map_err(|e| format!("Failed to read SRT: {}", e))?;
    
    println!("SRT content ({} bytes):\n{}", srt_content.len(), 
        &srt_content.chars().take(300).collect::<String>());
    
    // Parse SRT and convert to ASS format
    let temp_dir = std::env::temp_dir();
    let ass_file = temp_dir.join("vibesubtitles.ass");
    
    println!("Converting SRT to ASS format...");
    
    // Simple SRT to ASS conversion
    let ass_content = convert_srt_to_ass_content(&srt_content);
    
    fs::write(&ass_file, ass_content)
        .map_err(|e| format!("Failed to write ASS file: {}", e))?;
    
    println!("✓ Converted to ASS: {:?}", ass_file);
    
    Ok(ass_file)
}

// Convert SRT content to ASS format
fn convert_srt_to_ass_content(srt_content: &str) -> String {
    let mut ass = String::from("[Script Info]\n");
    ass.push_str("Title: VibeClips Subtitles\n");
    ass.push_str("ScriptType: v4.00+\n\n");
    ass.push_str("[V4+ Styles]\n");
    ass.push_str("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n");
    ass.push_str("Style: Default,Arial,24,&Hffffff,&Hffffff,&H0,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1\n\n");
    ass.push_str("[Events]\n");
    ass.push_str("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");
    
    // Parse SRT entries
    let blocks: Vec<&str> = srt_content.split("\n\n").collect();
    
    for block in blocks {
        let lines: Vec<&str> = block.trim().lines().collect();
        if lines.len() < 3 {
            continue;
        }
        
        // Skip subtitle number (first line)
        if let Some(time_line) = lines.get(1) {
            // Parse time: "00:00:00,000 --> 00:00:02,799"
            if let Some((start, end)) = parse_srt_time(time_line) {
                // Get text (rest of lines)
                let text = lines[2..].join("\\N");
                
                // Escape ASS special characters
                let text_escaped = text
                    .replace("\\", "\\\\")
                    .replace("{", "\\{")
                    .replace("}", "\\}");
                
                ass.push_str(&format!("Dialogue: 0,{},{}Default,,0,0,0,,{}\n", start, end, text_escaped));
            }
        }
    }
    
    ass
}

// Parse SRT time format: "00:00:00,000 --> 00:00:02,799" to ASS format: "0:00:00.00"
fn parse_srt_time(time_line: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = time_line.split(" --> ").collect();
    if parts.len() != 2 {
        return None;
    }
    
    let start = srt_to_ass_time(parts[0].trim())?;
    let end = srt_to_ass_time(parts[1].trim())?;
    
    Some((start, end))
}

// Convert SRT time "00:00:00,000" to ASS time "0:00:00.00"
fn srt_to_ass_time(srt_time: &str) -> Option<String> {
    // Replace comma with dot for ASS format
    let ass_time = srt_time.replace(",", ".");
    Some(ass_time)
}

fn export_video_blocking(
    app_handle: tauri::AppHandle,
    sorted_clips: Vec<ClipData>,
    #[allow(non_snake_case)] outputPath: String,
    width: u32,
    height: u32,
    crf: String,
    preset: String,
    overlay_positions: Option<OverlayPositions>,
    #[allow(non_snake_case)] subtitleSrtPath: Option<String>,
) -> Result<String, String> {
    
    println!("=== EXPORT VIDEO BLOCKING STARTED ===");
    println!("Clips count: {}", sorted_clips.len());
    println!("Output path: {}", outputPath);
    println!("Subtitle SRT path: {:?}", subtitleSrtPath);
    
    // Separate clips by track
    let mut track_0_clips: Vec<&ClipData> = sorted_clips.iter().filter(|c| c.track == 0).collect();
    let track_1_clips: Vec<&ClipData> = sorted_clips.iter().filter(|c| c.track == 1).collect();
    let track_2_clips: Vec<&ClipData> = sorted_clips.iter().filter(|c| c.track == 2).collect();
    
    let has_overlays = !track_1_clips.is_empty() || !track_2_clips.is_empty();
    
    // If only track 0 clips and no overlays, use simple concatenation
    if !has_overlays {
        track_0_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
        // If only one clip total and no overlays, use simple trimming
        if track_0_clips.len() == 1 {
            let clip = &track_0_clips[0];
        
            // Validate input file exists
            if !std::path::Path::new(&clip.file_path).exists() {
                return Err(format!("Input video file not found: {}", clip.file_path));
            }
            
            let path = clip.file_path.replace("\\", "/");
            
            let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
            cmd.arg("-y");
            
            // Only add trim if needed
            if clip.trim_start > 0.0 {
                cmd.arg("-ss").arg(&format!("{:.3}", clip.trim_start));
            }
            
            cmd.arg("-i").arg(&path);
            
            // Only add duration if trimmed
            if clip.trim_start > 0.0 || clip.duration > 0.0 {
                cmd.arg("-t").arg(&format!("{:.3}", clip.duration));
            }
            
            // Use configured preset and quality
            cmd.arg("-c:v").arg("libx264");
            cmd.arg("-preset").arg(&preset);
            cmd.arg("-crf").arg(&crf);
            cmd.arg("-c:a").arg("aac"); // Re-encode audio for compatibility
            cmd.arg("-b:a").arg("192k"); // Audio bitrate
            cmd.arg("-pix_fmt").arg("yuv420p"); // Compatible pixel format
            cmd.arg("-movflags").arg("faststart"); // Web-friendly
            
            // Build video filter (scale + filters + optional subtitles)
            let mut vf_parts = Vec::new();
            
            // Add scale filter first
            if width > 0 && height > 0 {
                vf_parts.push(format!("scale={}:{}", width, height));
            }
            
            // Add eq filter for brightness/contrast/saturation if present
            if let Some(eq_filter) = build_eq_filter(&clip.filters) {
                println!("🎨 Applying filters: {}", eq_filter);
                vf_parts.push(eq_filter);
            }
            
            // Add subtitles if provided - use relative path workaround to avoid Windows colon issues
            if let Some(ref srt_path) = subtitleSrtPath {
                println!("🎬 Burning subtitles from: {}", srt_path);
                
                if !std::path::Path::new(srt_path).exists() {
                    return Err(format!("Subtitle file not found: {}", srt_path));
                }
                
                // Read SRT content
                let srt_content = std::fs::read_to_string(srt_path)
                    .map_err(|e| format!("Failed to read SRT: {}", e))?;
                
                println!("SRT content ({} bytes)", srt_content.len());
                
                // WORKAROUND: Copy SRT to current directory (no drive letter path issues)
                let simple_srt = std::path::PathBuf::from("./temp_subtitles.srt");
                
                std::fs::copy(srt_path, &simple_srt)
                    .map_err(|e| format!("Failed to copy SRT: {}", e))?;
                
                println!("Copied SRT to: {:?}", simple_srt);
                
                // Use relative path - no drive letter issues!
                let subtitle_filter = "subtitles=./temp_subtitles.srt".to_string();
                
                println!("Subtitle filter: {}", subtitle_filter);
                
                vf_parts.push(subtitle_filter);
            }
            
            if !vf_parts.is_empty() {
                let vf_filter = vf_parts.join(",");
                println!("=== APPLYING VIDEO FILTER ===");
                println!("Video filter: {}", vf_filter);
                cmd.arg("-vf").arg(vf_filter);
            } else {
                println!("WARNING: No video filters applied (no scale, no subtitles)");
            }
            
            // Add flags - use error level if subtitles are present for debugging
            cmd.arg("-hide_banner");
            if subtitleSrtPath.is_some() {
                cmd.arg("-loglevel").arg("error"); // Show errors when subtitles are involved
                cmd.stdout(Stdio::piped());
                cmd.stderr(Stdio::piped());
            } else {
                cmd.arg("-loglevel").arg("quiet");
                cmd.arg("-nostats");
                cmd.stdout(Stdio::null());
                cmd.stderr(Stdio::null());
            }
            
            cmd.arg(&outputPath);
            
            let output = if subtitleSrtPath.is_some() {
                cmd.output()
                    .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?
            } else {
                // For non-subtitle exports, use status() for better performance
                let status = cmd.status()
                    .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
                return if status.success() {
                    if std::path::Path::new(&outputPath).exists() {
                        let _ = std::fs::write("src-tauri/export_debug.log", "=== EXPORT SUCCESS ===\n");
                        Ok(format!("Video exported successfully to {}", outputPath))
                    } else {
                        let _ = std::fs::write("src-tauri/export_debug.log", "=== EXPORT FAILED: File not created ===\n");
                        Err("FFmpeg completed but output file was not created".to_string())
                    }
                } else {
                    let _ = std::fs::write("src-tauri/export_debug.log", format!("=== EXPORT FAILED: exit code {:?} ===\n", status.code()).as_str());
                    Err(format!("FFmpeg failed with exit code: {:?}", status.code()))
                };
            };
            
            if !output.status.success() {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                let stdout_msg = String::from_utf8_lossy(&output.stdout);
                println!("=== FFMPEG SINGLE CLIP ERROR ===");
                println!("Exit code: {:?}", output.status.code());
                println!("Stderr: {}", error_msg);
                println!("Stdout: {}", stdout_msg);
                let _ = std::fs::write("src-tauri/export_debug.log", &format!("=== FFMPEG SINGLE CLIP ERROR ===\nExit code: {:?}\nStderr: {}\nStdout: {}\n", output.status.code(), error_msg, stdout_msg));
                return Err(format!("FFmpeg failed: {}", error_msg));
            }
            
            let status = output.status;
            
            // Log success even if there might have been warnings
            if status.success() {
                println!("=== FFMPEG SINGLE CLIP EXPORT SUCCESS ===");
                if subtitleSrtPath.is_some() {
                    let stdout_msg = String::from_utf8_lossy(&output.stdout);
                    let stderr_msg = String::from_utf8_lossy(&output.stderr);
                    println!("Stdout: {}", stdout_msg);
                    println!("Stderr: {}", stderr_msg);
                }
            }
            
            // Check if output file was created
            if std::path::Path::new(&outputPath).exists() {
                let log_msg = if subtitleSrtPath.is_some() {
                    "=== EXPORT SUCCESS (with subtitles) ===\n"
                } else {
                    "=== EXPORT SUCCESS ===\n"
                };
                let _ = std::fs::write("src-tauri/export_debug.log", log_msg);
                return Ok(format!("Video exported successfully to {}", outputPath));
            } else if status.success() {
                let _ = std::fs::write("src-tauri/export_debug.log", "=== EXPORT FAILED: File not created despite success code ===\n");
                return Err("FFmpeg completed but output file was not created".to_string());
            } else {
                let _ = std::fs::write("src-tauri/export_debug.log", format!("=== EXPORT FAILED: exit code {:?} ===\n", status.code()).as_str());
                return Err(format!("FFmpeg failed with exit code: {:?}", status.code()));
            }
        }
        
        // Multiple clips on track 0: create temporary trimmed files then concat them
        use std::env;
        let temp_dir = env::temp_dir();
        
        let mut temp_files = Vec::new();
        
        // Step 1: Trim each clip to a temp file
        for (i, clip) in track_0_clips.iter().enumerate() {
        let temp_file = temp_dir.join(format!("clip_{}.mp4", i));
        temp_files.push(temp_file.clone());
        
        let path = clip.file_path.replace("\\", "/");
        
        let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
        cmd.arg("-y");
        
        if clip.trim_start > 0.0 {
            cmd.arg("-ss").arg(&format!("{:.3}", clip.trim_start));
        }
        
        cmd.arg("-i").arg(&path);
        
        if clip.duration > 0.0 {
            cmd.arg("-t").arg(&format!("{:.3}", clip.duration));
        }
        
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg(&preset);
        cmd.arg("-crf").arg(&crf);
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        cmd.arg("-pix_fmt").arg("yuv420p");
        
        // Build video filter (scale + filters)
        let mut vf_parts = Vec::new();
        if width > 0 && height > 0 {
            vf_parts.push(format!("scale={}:{}", width, height));
        }
        
        // Add eq filter for brightness/contrast/saturation if present
        if let Some(eq_filter) = build_eq_filter(&clip.filters) {
            println!("🎨 Applying filters to clip {}: {}", i, eq_filter);
            vf_parts.push(eq_filter);
        }
        
        if !vf_parts.is_empty() {
            cmd.arg("-vf").arg(vf_parts.join(","));
        }
        
        // Add flags to suppress ALL output
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("quiet");
        cmd.arg("-nostats");
        
        cmd.arg(temp_file.to_str().unwrap());
        
        // Suppress all output
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        
        let status = cmd.status()
            .map_err(|e| format!("Failed to execute FFmpeg for clip {}: {}", i, e))?;
        
        if !status.success() {
            return Err(format!("Failed to trim clip {}: exit code {:?}", i, status.code()));
        }
    }
    
    // Step 2: Create concat file list
    let concat_file = temp_dir.join("concat_list.txt");
    let concat_content: String = temp_files
        .iter()
        .map(|f| format!("file '{}'\n", f.to_str().unwrap()))
        .collect();
    
    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;
    
    // Step 3: Concat all temp files (with optional subtitles)
    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-f").arg("concat");
    cmd.arg("-safe").arg("0");
    cmd.arg("-i").arg(concat_file.to_str().unwrap());
    
    // Build video filter (re-encode + optional subtitles)
    // Note: Individual clip filters are already applied when processing each clip
    let mut vf_parts = Vec::new();
    if width > 0 && height > 0 {
        vf_parts.push(format!("scale={}:{}", width, height));
    }
    
    // Add subtitles if provided - use relative path workaround to avoid Windows colon issues
    if let Some(ref srt_path) = subtitleSrtPath {
        println!("🎬 Burning subtitles from: {}", srt_path);
        
        if !std::path::Path::new(srt_path).exists() {
            return Err(format!("Subtitle file not found: {}", srt_path));
        }
        
        // Read SRT content
        let srt_content = std::fs::read_to_string(srt_path)
            .map_err(|e| format!("Failed to read SRT: {}", e))?;
        
        println!("SRT content ({} bytes)", srt_content.len());
        
        // WORKAROUND: Copy SRT to current directory (no drive letter path issues)
        let simple_srt = std::path::PathBuf::from("./temp_subtitles.srt");
        
        std::fs::copy(srt_path, &simple_srt)
            .map_err(|e| format!("Failed to copy SRT: {}", e))?;
        
        println!("Copied SRT to: {:?}", simple_srt);
        
        // Use relative path - no drive letter issues!
        let subtitle_filter = "subtitles=./temp_subtitles.srt".to_string();
        
        println!("Subtitle filter: {}", subtitle_filter);
        
        vf_parts.push(subtitle_filter);
    }
    
    if !vf_parts.is_empty() {
        let vf_filter = vf_parts.join(",");
        println!("Video filter: {}", vf_filter);
        cmd.arg("-vf").arg(vf_filter);
        // Re-encode video when applying filters
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg(&preset);
        cmd.arg("-crf").arg(&crf);
        cmd.arg("-pix_fmt").arg("yuv420p");
    } else {
        cmd.arg("-c").arg("copy");
    }
    cmd.arg("-c:a").arg("aac");
    cmd.arg("-b:a").arg("192k");
    
    // Add flags - use error level if subtitles are present for debugging
    cmd.arg("-hide_banner");
    if subtitleSrtPath.is_some() {
        cmd.arg("-loglevel").arg("error");
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
    } else {
        cmd.arg("-loglevel").arg("quiet");
        cmd.arg("-nostats");
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
    }
    
    cmd.arg(&outputPath);
    
    let output = if subtitleSrtPath.is_some() {
        cmd.output()
            .map_err(|e| format!("Failed to execute FFmpeg concat: {}", e))?
    } else {
        // For non-subtitle exports, use status()
        let status = cmd.status()
            .map_err(|e| format!("Failed to execute FFmpeg concat: {}", e))?;
        if status.success() {
                let _ = std::fs::write("src-tauri/export_debug.log", "=== EXPORT SUCCESS ===\n");
            // Cleanup temp files
            for temp_file in &temp_files {
                let _ = std::fs::remove_file(temp_file);
            }
            let _ = std::fs::remove_file(&concat_file);
            return Ok(format!("Video exported successfully to {}", outputPath))
        } else {
            // Cleanup temp files on failure
            for temp_file in &temp_files {
                let _ = std::fs::remove_file(temp_file);
            }
            let _ = std::fs::remove_file(&concat_file);
                let _ = std::fs::write("src-tauri/export_debug.log", format!("=== EXPORT FAILED: exit code {:?} ===\n", status.code()).as_str());
            return Err(format!("Concatenation failed with exit code: {:?}", status.code()))
        }
    };
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        println!("=== FFMPEG CONCAT ERROR ===");
        println!("Exit code: {:?}", output.status.code());
        println!("Stderr: {}", error_msg);
        println!("Stdout: {}", stdout_msg);
        let _ = std::fs::write("src-tauri/export_debug.log", &format!("=== FFMPEG CONCAT ERROR ===\nExit code: {:?}\nStderr: {}\nStdout: {}\n", output.status.code(), error_msg, stdout_msg));
        // Cleanup temp files
        for temp_file in &temp_files {
            let _ = std::fs::remove_file(temp_file);
        }
        let _ = std::fs::remove_file(&concat_file);
        return Err(format!("FFmpeg concat failed: {}", error_msg));
    }
    
    let status = output.status;
    
    // Cleanup temp files
    for temp_file in &temp_files {
        let _ = std::fs::remove_file(temp_file);
    }
    let _ = std::fs::remove_file(&concat_file);
    
    if status.success() {
                let _ = std::fs::write("src-tauri/export_debug.log", "=== EXPORT SUCCESS ===\n");
            Ok(format!("Video exported successfully to {}", outputPath))
        } else {
                let _ = std::fs::write("src-tauri/export_debug.log", format!("=== EXPORT FAILED: exit code {:?} ===\n", status.code()).as_str());
            Err(format!("Concatenation failed with exit code: {:?}", status.code()))
        }
    } else {
        // Has overlays - complex multi-track export
        // Strategy:
        // 1. Build base video from Track 0 clips (concatenated)
        // 2. Overlay Track 1 clips on top using overlay filter with time-based enable
        // 3. Overlay Track 2 clips on top of that
        
        use std::env;
        let temp_dir = env::temp_dir();
        
        // Step 1: Build base video from Track 0
        track_0_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
        
        if track_0_clips.is_empty() {
            return Err("Track 0 (Main Video) must have at least one clip".to_string());
        }
        
        // Calculate total duration
        let max_duration = track_0_clips.iter()
            .map(|c| c.start_time + c.duration)
            .fold(0.0, f64::max);
        
        // Create base video from Track 0 clips
        let mut track_0_temp_files = Vec::new();
        for (i, clip) in track_0_clips.iter().enumerate() {
            let temp_file = temp_dir.join(format!("track0_clip_{}.mp4", i));
            track_0_temp_files.push(temp_file.clone());
            
            let path = clip.file_path.replace("\\", "/");
            let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
            cmd.arg("-y");
            
            if clip.trim_start > 0.0 {
                cmd.arg("-ss").arg(&format!("{:.3}", clip.trim_start));
            }
            
            cmd.arg("-i").arg(&path);
            
            if clip.duration > 0.0 {
                cmd.arg("-t").arg(&format!("{:.3}", clip.duration));
            }
            
            cmd.arg("-c:v").arg("libx264");
            cmd.arg("-preset").arg(&preset);
            cmd.arg("-crf").arg(&crf);
            cmd.arg("-c:a").arg("aac");
            cmd.arg("-b:a").arg("192k");
            cmd.arg("-pix_fmt").arg("yuv420p");
            
            // Build video filter (scale + filters)
            let mut vf_parts = Vec::new();
            if width > 0 && height > 0 {
                vf_parts.push(format!("scale={}:{}", width, height));
            }
            
            // Add eq filter for brightness/contrast/saturation if present
            if let Some(eq_filter) = build_eq_filter(&clip.filters) {
                println!("🎨 Applying filters to Track 0 clip {}: {}", i, eq_filter);
                vf_parts.push(eq_filter);
            }
            
            if !vf_parts.is_empty() {
                cmd.arg("-vf").arg(vf_parts.join(","));
            }
            
            cmd.arg("-hide_banner");
            cmd.arg("-loglevel").arg("error");
            cmd.arg(temp_file.to_str().unwrap()); // Output file - this was missing!
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
            
            let output = cmd.output()
                .map_err(|e| format!("Failed to execute FFmpeg for Track 0 clip {}: {}", i, e))?;
            
            if !output.status.success() {
                let error_msg = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Failed to process Track 0 clip {}: FFmpeg error: {}", i, error_msg));
            }
            
            // Verify file was created
            if !temp_file.exists() {
                return Err(format!("Track 0 clip {} output file was not created: {:?}", i, temp_file));
            }
        }
        
        // Create concat file for Track 0
        let track0_concat = temp_dir.join("track0_concat.txt");
        let concat_content: String = track_0_temp_files
            .iter()
            .map(|f| format!("file '{}'\n", f.to_str().unwrap()))
            .collect();
        
        std::fs::write(&track0_concat, concat_content)
            .map_err(|e| format!("Failed to write concat file: {}", e))?;
        
        // Create base video
        let base_video = temp_dir.join("base_track0.mp4");
        let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
        cmd.arg("-y");
        cmd.arg("-f").arg("concat");
        cmd.arg("-safe").arg("0");
        cmd.arg("-i").arg(track0_concat.to_str().unwrap());
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg(&preset);
        cmd.arg("-crf").arg(&crf);
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        cmd.arg("-pix_fmt").arg("yuv420p");
        
        // Pad base video to max duration if needed
        if max_duration > 0.0 {
            cmd.arg("-t").arg(&format!("{:.3}", max_duration));
        }
        
        if width > 0 && height > 0 {
            cmd.arg("-vf").arg(format!("scale={}:{},pad={}:{}:0:0:black", width, height, width, height));
        }
        
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("error");
        cmd.arg(base_video.to_str().unwrap()); // Output file - this was missing!
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        
        let output = cmd.output()
            .map_err(|e| format!("Failed to execute FFmpeg for base video: {}", e))?;
        
        if !output.status.success() {
            // Cleanup
            for f in &track_0_temp_files {
                let _ = std::fs::remove_file(f);
            }
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to create base video from Track 0: FFmpeg error: {}", error_msg));
        }
        
        // Verify base video was created
        if !base_video.exists() {
            // Cleanup
            for f in &track_0_temp_files {
                let _ = std::fs::remove_file(f);
            }
            return Err("Base video file was not created".to_string());
        }
        
        // Step 2: Build overlay video from Track 1
        let mut overlay1_video: Option<std::path::PathBuf> = None;
        // For now, handle single overlay clip on Track 1
        // TODO: Handle multiple overlay clips on same track (need to chain overlays with proper timing)
        if track_1_clips.len() == 1 {
                let clip = &track_1_clips[0];
                let overlay_path = clip.file_path.replace("\\", "/");
                let overlay_temp = temp_dir.join("overlay1.mp4");
                
                // Scale overlay to be 30% of base size
                let overlay_w = if width > 0 { (width as f64 * 0.3) as u32 } else { 320 };
                let overlay_h = if height > 0 { (height as f64 * 0.3) as u32 } else { 180 };
                
                // Create overlay video padded to full timeline duration with clip at correct offset
                let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
                cmd.arg("-y");
                // Create black background for full duration
                cmd.arg("-f").arg("lavfi");
                cmd.arg("-i").arg(format!("color=c=black:s={}x{}:d={:.3}", overlay_w, overlay_h, max_duration));
                // Add the source video
                cmd.arg("-ss").arg(&format!("{:.3}", clip.trim_start));
                cmd.arg("-i").arg(&overlay_path);
                cmd.arg("-t").arg(&format!("{:.3}", clip.duration));
                
                // Filter to scale overlay and position it at the clip's timeline offset
                let offset = clip.start_time;
                let filter = format!(
                    "[1:v]scale={}:{}[scaled];[0:v][scaled]overlay=enable='between(t,{:.3},{:.3})'[vout]",
                    overlay_w, overlay_h, offset, offset + clip.duration
                );
                
                cmd.arg("-filter_complex").arg(&filter);
                cmd.arg("-map").arg("[vout]");
                cmd.arg("-c:v").arg("libx264");
                cmd.arg("-preset").arg(&preset);
                cmd.arg("-crf").arg(&crf);
                cmd.arg("-pix_fmt").arg("yuv420p");
                cmd.arg("-t").arg(&format!("{:.3}", max_duration));
                cmd.arg("-hide_banner");
                cmd.arg("-loglevel").arg("error");
                cmd.arg(overlay_temp.to_str().unwrap()); // Output file
                cmd.stdout(Stdio::piped());
                cmd.stderr(Stdio::piped());
                
                let output = cmd.output()
                    .map_err(|e| format!("Failed to execute FFmpeg for overlay 1: {}", e))?;
                
                if output.status.success() && overlay_temp.exists() {
                    overlay1_video = Some(overlay_temp);
                } else {
                    let error_msg = String::from_utf8_lossy(&output.stderr);
                    return Err(format!("Failed to create overlay 1 video file: FFmpeg error: {}", error_msg));
                }
        }
        
        // Step 3: Build final composite
        let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
        cmd.arg("-y");
        cmd.arg("-i").arg(base_video.to_str().unwrap());
        
        let mut filter_parts = Vec::new();
        
        // Add Track 1 overlay
        if let Some(ref overlay1) = overlay1_video {
            cmd.arg("-i").arg(overlay1.to_str().unwrap());
            
            // Calculate overlay position from configuration
            let overlay_w = (width.max(640) as f64 * 0.3) as u32;
            let overlay_h = (height.max(480) as f64 * 0.3) as u32;
            let position_str = overlay_positions.as_ref()
                .and_then(|p| p.track1.as_deref())
                .unwrap_or("bottom-right");
            let (x_pos, y_pos) = calculate_overlay_pos(position_str, width.max(640), height.max(480), overlay_w, overlay_h, 20);
            
            if track_1_clips.len() == 1 {
                // Overlay is already positioned and timed in the overlay video itself
                // Just overlay it at bottom-right position
                filter_parts.push(format!(
                    "[0:v][1:v]overlay={}:{}[vout]",
                    x_pos, y_pos
                ));
            }
        } else {
            filter_parts.push("[0:v]copy[vout]".to_string());
        }
        
        // TODO: Add Track 2 overlay similarly
        
        // Add subtitle burn-in if SRT file provided
        let mut final_filter_complex = if !filter_parts.is_empty() {
            filter_parts.join(";")
        } else {
            String::new()
        };
        
        if let Some(ref srt_path) = subtitleSrtPath {
            println!("🎬 Burning subtitles from: {}", srt_path);
            
            if !std::path::Path::new(srt_path).exists() {
                return Err(format!("Subtitle file not found: {}", srt_path));
            }
            
            // Read SRT content
            let srt_content = std::fs::read_to_string(srt_path)
                .map_err(|e| format!("Failed to read SRT: {}", e))?;
            
            println!("SRT content ({} bytes)", srt_content.len());
            
            // WORKAROUND: Copy SRT to current directory (no drive letter path issues)
            let simple_srt = std::path::PathBuf::from("./temp_subtitles.srt");
            
            std::fs::copy(srt_path, &simple_srt)
                .map_err(|e| format!("Failed to copy SRT: {}", e))?;
            
            println!("Copied SRT to: {:?}", simple_srt);
            
            // Use relative path - no drive letter issues!
            let subtitle_filter_str = "subtitles=./temp_subtitles.srt".to_string();
            
            println!("Subtitle filter: {}", subtitle_filter_str);
            
            if !final_filter_complex.is_empty() {
                // Add subtitles filter after overlay processing
                final_filter_complex = format!("{};[vout]{}[vsub]", 
                    final_filter_complex, subtitle_filter_str);
                println!("Filter complex with subtitles: {}", final_filter_complex);
                cmd.arg("-filter_complex").arg(&final_filter_complex);
                cmd.arg("-map").arg("[vsub]");
            } else {
                // No overlays, just subtitles
                println!("Video filter with subtitles: {}", subtitle_filter_str);
                cmd.arg("-vf").arg(&subtitle_filter_str);
            }
        } else if !final_filter_complex.is_empty() {
            cmd.arg("-filter_complex").arg(&final_filter_complex);
            cmd.arg("-map").arg("[vout]");
            cmd.arg("-map").arg("0:a?"); // Map audio from base video if present
        }
        
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg(&preset);
        cmd.arg("-crf").arg(&crf);
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        cmd.arg("-pix_fmt").arg("yuv420p");
        cmd.arg("-t").arg(&format!("{:.3}", max_duration));
        cmd.arg("-movflags").arg("faststart");
        cmd.arg("-hide_banner");
        // Use error level if subtitles are present for debugging
        if subtitleSrtPath.is_some() {
            cmd.arg("-loglevel").arg("error");
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
        } else {
            cmd.arg("-loglevel").arg("quiet");
            cmd.stdout(Stdio::null());
            cmd.stderr(Stdio::null());
        }
        cmd.arg(&outputPath);
        
        let output = if subtitleSrtPath.is_some() {
            cmd.output()
                .map_err(|e| format!("Failed to composite video: {}", e))?
        } else {
            // For non-subtitle exports, use status()
            let status = cmd.status()
                .map_err(|e| format!("Failed to composite video: {}", e))?;
            if status.success() {
                // Cleanup temp files
                for f in &track_0_temp_files {
                    let _ = std::fs::remove_file(f);
                }
                let _ = std::fs::remove_file(&track0_concat);
                let _ = std::fs::remove_file(&base_video);
                if let Some(overlay1) = overlay1_video {
                    let _ = std::fs::remove_file(overlay1);
                }
                let _ = std::fs::write("src-tauri/export_debug.log", "=== MULTI-TRACK EXPORT SUCCESS ===\n");
                return Ok(format!("Multi-track video exported successfully to {}", outputPath));
            } else {
                // Cleanup temp files on failure
                for f in &track_0_temp_files {
                    let _ = std::fs::remove_file(f);
                }
                let _ = std::fs::remove_file(&track0_concat);
                let _ = std::fs::remove_file(&base_video);
                if let Some(overlay1) = overlay1_video {
                    let _ = std::fs::remove_file(overlay1);
                }
                let _ = std::fs::write("src-tauri/export_debug.log", "=== MULTI-TRACK EXPORT FAILED ===\n");
                return Err("Failed to composite multi-track video".to_string());
            }
        };
        
        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            println!("FFmpeg multi-track error output: {}", error_msg);
            let _ = std::fs::write("src-tauri/export_debug.log", &format!("=== FFMPEG MULTI-TRACK ERROR ===\n{}\n", error_msg));
            // Cleanup temp files
            for f in &track_0_temp_files {
                let _ = std::fs::remove_file(f);
            }
            let _ = std::fs::remove_file(&track0_concat);
            let _ = std::fs::remove_file(&base_video);
            if let Some(overlay1) = overlay1_video {
                let _ = std::fs::remove_file(overlay1);
            }
            return Err(format!("FFmpeg multi-track failed: {}", error_msg));
        }
        
        let status = output.status;
        
        // Cleanup temp files
        for f in &track_0_temp_files {
            let _ = std::fs::remove_file(f);
        }
        let _ = std::fs::remove_file(&track0_concat);
        let _ = std::fs::remove_file(&base_video);
        if let Some(overlay1) = overlay1_video {
            let _ = std::fs::remove_file(overlay1);
        }
        
        if status.success() {
            // Log success with subtitle info
            if subtitleSrtPath.is_some() {
                let stdout_msg = String::from_utf8_lossy(&output.stdout);
                let stderr_msg = String::from_utf8_lossy(&output.stderr);
                println!("=== FFMPEG MULTI-TRACK EXPORT SUCCESS (with subtitles) ===");
                println!("Stdout: {}", stdout_msg);
                println!("Stderr: {}", stderr_msg);
                let _ = std::fs::write("src-tauri/export_debug.log", "=== MULTI-TRACK EXPORT SUCCESS (with subtitles) ===\n");
            } else {
                let _ = std::fs::write("src-tauri/export_debug.log", "=== MULTI-TRACK EXPORT SUCCESS ===\n");
            }
            Ok(format!("Multi-track video exported successfully to {}", outputPath))
        } else {
            let _ = std::fs::write("src-tauri/export_debug.log", "=== MULTI-TRACK EXPORT FAILED ===\n");
            Err("Failed to composite multi-track video".to_string())
        }
    }
}

#[tauri::command]
fn import_video_file(
    app_handle: tauri::AppHandle,
    file_path: String
) -> Result<String, String> {
    // Check if it's a MOV file
    if file_path.to_lowercase().ends_with(".mov") {
        println!("MOV file detected, converting for compatibility...");
        
        // Create a temporary MP4 version
        let temp_dir = std::env::temp_dir();
        let file_name = std::path::Path::new(&file_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("converted");
        let output_path = temp_dir.join(format!("{}_converted.mp4", file_name));
        let output_path_str = output_path.to_string_lossy().to_string();
        
        let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
        cmd.arg("-y");
        cmd.arg("-i").arg(&file_path);
        
        // Force re-encode to ensure compatibility
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg("medium"); // Better compatibility than "fast"
        cmd.arg("-crf").arg("23");
        cmd.arg("-pix_fmt").arg("yuv420p"); // Ensure compatible pixel format
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        cmd.arg("-movflags").arg("faststart");
        cmd.arg(&output_path_str);
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("warning");
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::piped());
        
        let output = cmd.output()
            .map_err(|e| format!("Failed to convert MOV: {}", e))?;
        
        if output.status.success() {
            // Wait for file to be fully written and flushed
            std::thread::sleep(std::time::Duration::from_millis(500));
            
            // Verify the file exists and has content
            if let Ok(metadata) = std::fs::metadata(&output_path_str) {
                if metadata.len() > 0 {
                    println!("Successfully converted MOV to: {} (size: {} bytes)", output_path_str, metadata.len());
                    return Ok(output_path_str);
                } else {
                    println!("Converted file is empty, using original");
                    return Ok(file_path);
                }
            }
            
            println!("Converted file not found, using original");
            Ok(file_path)
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("Conversion failed: {}", error);
            // Fall back to original file if conversion fails
            Ok(file_path)
        }
    } else {
        // Not a MOV, use as-is
        Ok(file_path)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Load .env file if it exists (silently ignore errors if file doesn't exist)
  let _ = dotenv::dotenv();
  
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
        test_export, 
        save_temp_video, 
        export_video,
        get_temp_dir,
        get_file_size,
        get_video_duration_from_file,
        generate_video_thumbnail,
        list_screen_sources,
        list_audio_devices,
        test_ffmpeg,
        start_screen_recording_async,
        stop_screen_recording_async,
        get_recording_status,
        mux_video_audio,
        convert_webm_to_mp4,
        composite_pip_video,
        import_video_file,
        transcribe_clip,
        save_api_key,
        get_api_key,
        delete_api_key,
        write_srt_file
    ])
    .setup(|_app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}