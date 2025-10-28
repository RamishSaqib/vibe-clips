use tauri::{Emitter, Listener};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};

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
async fn export_video(
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
        
        let mut cmd = Command::new("ffmpeg");
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
        
        // Use fast preset and copy audio to speed up export
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg("ultrafast");
        cmd.arg("-crf").arg("28"); // Lower quality but faster
        cmd.arg("-c:a").arg("copy"); // Copy audio, don't re-encode
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
        
        let mut cmd = Command::new("ffmpeg");
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
    let mut cmd = Command::new("ffmpeg");
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
    .invoke_handler(tauri::generate_handler![test_export, export_video])
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