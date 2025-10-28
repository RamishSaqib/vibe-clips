use tauri::{Emitter, Listener, Manager};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

mod screen_capture;
mod audio_capture;

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
struct ClipData {
    file_path: String,
    trim_start: f64,
    duration: f64,
    start_time: f64,
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
    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-i").arg(&video_path);
    cmd.arg("-ss").arg("00:00:01"); // Take frame at 1 second
    cmd.arg("-vframes").arg("1"); // Extract 1 frame
    cmd.arg("-vf").arg("scale=160:90"); // Thumbnail size
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
        Err(format!("FFmpeg thumbnail error: {}", error))
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
    
    let delay_offset = screen_start_offset.unwrap_or(0.0);
    println!("Compositing with screen delay offset: {:.3}s", delay_offset);
    
    // Handle different audio combinations WITH PROPER DELAY
    if use_screen_audio && use_webcam_audio {
        // Both system audio and mic audio
        let screen_audio_filter = if delay_offset > 0.01 {
            // Delay screen audio AND pad the end so it doesn't get cut short
            let delay_ms = (delay_offset * 1000.0) as i32;
            format!("[0:a]adelay={}|{},apad[a0]", delay_ms, delay_ms)
        } else {
            String::from("[0:a]acopy[a0]")
        };
        
        let filter_complex = format!(
            "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout];{};[1:a]apad[a1];[a0][a1]amix=inputs=2:duration=longest[aout]",
            pip_width, pip_height, overlay_position, screen_audio_filter
        );
        cmd.arg("-filter_complex").arg(&filter_complex);
        cmd.arg("-map").arg("[vout]");
        cmd.arg("-map").arg("[aout]");
    } else if use_screen_audio {
        // System audio only - need to delay it and pad
        if delay_offset > 0.01 {
            let delay_ms = (delay_offset * 1000.0) as i32;
            let filter_complex = format!(
                "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout];[0:a]adelay={}|{},apad[aout]",
                pip_width, pip_height, overlay_position, delay_ms, delay_ms
            );
            cmd.arg("-filter_complex").arg(&filter_complex);
            cmd.arg("-map").arg("[vout]");
            cmd.arg("-map").arg("[aout]");
        } else {
            let filter_complex = format!(
                "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout]",
                pip_width, pip_height, overlay_position
            );
            cmd.arg("-filter_complex").arg(&filter_complex);
            cmd.arg("-map").arg("[vout]");
            cmd.arg("-map").arg("0:a");
        }
    } else if use_webcam_audio {
        // Mic audio only - pad to match video duration
        let filter_complex = format!(
            "[1:v]scale={}:{}[pip];[0:v][pip]overlay={}[vout];[1:a]apad[aout]",
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
    
    // Video and audio encoding
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("fast");
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
    cmd.arg("-loglevel").arg("error");
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

#[tauri::command]
fn export_video(
    app_handle: tauri::AppHandle,
    clips: Vec<ClipData>,
    #[allow(non_snake_case)] outputPath: String,
) -> Result<String, String> {
    // Write to log FIRST THING to verify function is called - try multiple locations
    let _ = std::fs::write("C:/export_debug.log", "=== FUNCTION CALLED ===\n");
    let _ = std::fs::write("./export_debug.log", "=== FUNCTION CALLED ===\n");
    
    // Log to file to avoid terminal spam
    let mut log = format!("Clips count: {}\nOutput path: {}\n", 
                          clips.len(), outputPath);
    
    if clips.is_empty() {
        log.push_str("ERROR: No clips\n");
        let _ = std::fs::write("C:/export_debug.log", &log);
        return Err("No clips to export".to_string());
    }
    
    log.push_str("Got clips, starting export...\n");
    log.push_str(&format!("Exporting {} clips to '{}'\n", clips.len(), outputPath));
    
    // Validate output path has a filename
    if !outputPath.ends_with(".mp4") && !outputPath.ends_with(".mov") {
        let error_msg = format!("Output path must end with .mp4 or .mov, got: '{}'", outputPath);
        log.push_str(&format!("ERROR: {}\n", error_msg));
        let _ = std::fs::write("C:/export_debug.log", &log);
        return Err(error_msg);
    }
    
    log.push_str(&format!("Output path validated: {}\n", outputPath));
    
    for (i, clip) in clips.iter().enumerate() {
        log.push_str(&format!("Clip {}: path={}, trim_start={}, duration={}\n", 
                 i, clip.file_path, clip.trim_start, clip.duration));
    }
    
    let _ = std::fs::write("C:/export_debug.log", &log);
    
    // Sort clips by start_time to maintain order
    let mut sorted_clips = clips.clone();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    // If only one clip, use simple trimming
    if sorted_clips.len() == 1 {
        let clip = &sorted_clips[0];
        
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
        
        // Use fast preset with proper encoding
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg("ultrafast");
        cmd.arg("-crf").arg("23"); // Better quality
        cmd.arg("-c:a").arg("aac"); // Re-encode audio for compatibility
        cmd.arg("-b:a").arg("192k"); // Audio bitrate
        cmd.arg("-pix_fmt").arg("yuv420p"); // Compatible pixel format
        cmd.arg("-movflags").arg("faststart"); // Web-friendly
        
        // Add flags to suppress ALL output
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("quiet");
        cmd.arg("-nostats");
        
        cmd.arg(&outputPath);
        
        // Redirect ALL output to null to prevent spam
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        
        let status = cmd.status()
            .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
        
        // Check if output file was created
        if std::path::Path::new(&outputPath).exists() {
            let _ = std::fs::write("C:/export_debug.log", "=== EXPORT SUCCESS ===\n");
            return Ok(format!("Video exported successfully to {}", outputPath));
        } else if status.success() {
            let _ = std::fs::write("C:/export_debug.log", "=== EXPORT FAILED: File not created despite success code ===\n");
            return Err("FFmpeg completed but output file was not created".to_string());
        } else {
            let _ = std::fs::write("C:/export_debug.log", format!("=== EXPORT FAILED: exit code {:?} ===\n", status.code()).as_str());
            return Err(format!("FFmpeg failed with exit code: {:?}", status.code()));
        }
    }
    
    // Multiple clips: create temporary trimmed files then concat them
    use std::env;
    let temp_dir = env::temp_dir();
    
    let mut temp_files = Vec::new();
    
    // Step 1: Trim each clip to a temp file
    for (i, clip) in sorted_clips.iter().enumerate() {
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
        cmd.arg("-preset").arg("ultrafast");
        cmd.arg("-crf").arg("23");
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        cmd.arg("-pix_fmt").arg("yuv420p");
        
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
    
    // Step 3: Concat all temp files
    let mut cmd = create_hidden_command(Some(&app_handle), "ffmpeg");
    cmd.arg("-y");
    cmd.arg("-f").arg("concat");
    cmd.arg("-safe").arg("0");
    cmd.arg("-i").arg(concat_file.to_str().unwrap());
    cmd.arg("-c").arg("copy");
    
    // Add flags to suppress ALL output
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("quiet");
    cmd.arg("-nostats");
    
    cmd.arg(&outputPath);
    
    // Suppress all output
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    
    let status = cmd.status()
        .map_err(|e| format!("Failed to execute FFmpeg concat: {}", e))?;
    
    // Cleanup temp files
    for temp_file in &temp_files {
        let _ = std::fs::remove_file(temp_file);
    }
    let _ = std::fs::remove_file(&concat_file);
    
    if status.success() {
        let _ = std::fs::write("C:/export_debug.log", "=== EXPORT SUCCESS ===\n");
        Ok(format!("Video exported successfully to {}", outputPath))
    } else {
        let _ = std::fs::write("C:/export_debug.log", format!("=== EXPORT FAILED: exit code {:?} ===\n", status.code()).as_str());
        Err(format!("Concatenation failed with exit code: {:?}", status.code()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        composite_pip_video
    ])
    .setup(|app| {
      let app_handle = app.handle().clone();
      
      // Listen for file-drop events from the OS
      app.handle().listen("tauri://file-drop", move |event| {
        println!("Rust: File drop event received");
        let payload_str = event.payload();
        println!("Rust: payload_str = {}", payload_str);
        
        let payload: Vec<String> = serde_json::from_str(payload_str)
            .unwrap_or_else(|e| {
                println!("Rust: Failed to parse payload: {:?}", e);
                vec![]
            });
        
        println!("Rust: Parsed {} file paths", payload.len());
        
        if !payload.is_empty() {
            println!("Rust: Emitting file-drop event to frontend with {} files", payload.len());
            // Emit the file paths to the frontend
            let _ = app_handle.emit("file-drop", &payload);
        }
      });
      
      // Listen for file-drop-hover
      app.handle().listen("tauri://file-drop-hover", move |event| {
        println!("Rust: File drag over window");
        let payload_str = event.payload();
        if let Ok(paths) = serde_json::from_str::<Vec<String>>(payload_str) {
          println!("Rust: Hover payload = {:?}", paths);
        }
      });
      
      // Listen for file-drop-cancelled
      app.handle().listen("tauri://file-drop-cancelled", move |_event| {
        println!("Rust: File drag cancelled");
      });
      
      println!("Rust: File-drop listeners registered successfully");
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}