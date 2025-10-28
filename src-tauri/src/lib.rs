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
async fn export_video(
    clips: Vec<ClipData>,
    output_path: String,
) -> Result<String, String> {
    if clips.is_empty() {
        return Err("No clips to export".to_string());
    }

    println!("=== EXPORT START ===");
    println!("Exporting {} clips to {}", clips.len(), output_path);
    for (i, clip) in clips.iter().enumerate() {
        println!("Clip {}: path={}, trim_start={}, duration={}", 
                 i, clip.file_path, clip.trim_start, clip.duration);
    }
    
    // Sort clips by start_time to maintain order
    let mut sorted_clips = clips.clone();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    // If only one clip, use simple trimming
    if sorted_clips.len() == 1 {
        let clip = &sorted_clips[0];
        let path = clip.file_path.replace("\\", "/");
        
        println!("Building single clip command...");
        let mut cmd = Command::new("ffmpeg");
        cmd.arg("-y");
        
        // Only add trim if needed
        if clip.trim_start > 0.0 {
            println!("Adding trim start: {}", clip.trim_start);
            cmd.arg("-ss").arg(&format!("{:.3}", clip.trim_start));
        }
        
        cmd.arg("-i").arg(&path);
        
        // Only add duration if trimmed
        if clip.trim_start > 0.0 || clip.duration > 0.0 {
            println!("Adding duration: {}", clip.duration);
            cmd.arg("-t").arg(&format!("{:.3}", clip.duration));
        }
        
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg("ultrafast");
        cmd.arg("-crf").arg("23");
        cmd.arg("-c:a").arg("aac");
        cmd.arg("-b:a").arg("192k");
        cmd.arg("-pix_fmt").arg("yuv420p");
        
        // Add flags to suppress progress output
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("error"); // Only show errors, not progress
        cmd.arg("-stats"); // Show basic stats but not the progress spam
        
        cmd.arg(&output_path);
        
        println!("Executing FFmpeg...");
        
        // Redirect stderr to null to suppress all FFmpeg output
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        
        let status = cmd.status()
            .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;
        
        println!("FFmpeg finished with status: {:?}", status.code());
        
        if status.success() {
            println!("=== EXPORT SUCCESS ===");
            return Ok(format!("Video exported successfully to {}", output_path));
        } else {
            println!("=== EXPORT FAILED ===");
            return Err(format!("FFmpeg export failed with exit code: {:?}", status.code()));
        }
    }
    
    // Multiple clips: create temporary trimmed files then concat them
    println!("Multiple clips, using temp file approach...");
    use std::env;
    let temp_dir = env::temp_dir();
    println!("Temp dir: {:?}", temp_dir);
    
    let mut temp_files = Vec::new();
    
    // Step 1: Trim each clip to a temp file
    for (i, clip) in sorted_clips.iter().enumerate() {
        let temp_file = temp_dir.join(format!("clip_{}.mp4", i));
        temp_files.push(temp_file.clone());
        
        let path = clip.file_path.replace("\\", "/");
        
        println!("Processing clip {} of {}: {}", i + 1, sorted_clips.len(), path);
        
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
        
        // Add flags to suppress progress spam
        cmd.arg("-hide_banner");
        cmd.arg("-loglevel").arg("error");
        cmd.arg("-stats");
        
        cmd.arg(temp_file.to_str().unwrap());
        
        println!("Processing clip {}...", i);
        
        // Suppress all output
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        
        let status = cmd.status()
            .map_err(|e| format!("Failed to execute FFmpeg for clip {}: {}", i, e))?;
        
        if !status.success() {
            return Err(format!("Failed to trim clip {} with exit code: {:?}", i, status.code()));
        }
        
        println!("Clip {} processed successfully", i);
    }
    
    // Step 2: Create concat file list
    let concat_file = temp_dir.join("concat_list.txt");
    let concat_content: String = temp_files
        .iter()
        .map(|f| format!("file '{}'\n", f.to_str().unwrap()))
        .collect();
    
    println!("Concat file content:\n{}", concat_content);
    
    std::fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;
    
    println!("Concatenating {} clips...", temp_files.len());
    
    // Step 3: Concat all temp files
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y");
    cmd.arg("-f").arg("concat");
    cmd.arg("-safe").arg("0");
    cmd.arg("-i").arg(concat_file.to_str().unwrap());
    cmd.arg("-c").arg("copy");
    
    // Add flags to suppress progress spam for concat too
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("error");
    cmd.arg("-stats");
    
    cmd.arg(&output_path);
    
    println!("Concatenating {} clips...", temp_files.len());
    
    // Suppress all output
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::null());
    
    let status = cmd.status()
        .map_err(|e| format!("Failed to execute FFmpeg concat: {}", e))?;
    
    // Cleanup temp files
    println!("Cleaning up temp files...");
    for temp_file in &temp_files {
        let _ = std::fs::remove_file(temp_file);
    }
    let _ = std::fs::remove_file(&concat_file);
    
    if status.success() {
        println!("=== EXPORT SUCCESS ===");
        Ok(format!("Video exported successfully to {}", output_path))
    } else {
        println!("=== EXPORT FAILED ===");
        Err(format!("Concatenation failed with exit code: {:?}", status.code()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![export_video])
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