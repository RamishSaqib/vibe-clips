use tauri::{Emitter, Listener};
use serde::{Deserialize, Serialize};
use std::process::Command;

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

    println!("Exporting {} clips to {}", clips.len(), output_path);
    
    // Sort clips by start_time to maintain order
    let mut sorted_clips = clips.clone();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    // Build FFmpeg command with filters
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("warning");
    
    // If only one clip, use simple trimming
    if sorted_clips.len() == 1 {
        let clip = &sorted_clips[0];
        let path = clip.file_path.replace("\\", "/");
        
        cmd.arg("-i").arg(&path);
        cmd.arg("-ss").arg(&format!("{:.6}", clip.trim_start));
        cmd.arg("-t").arg(&format!("{:.6}", clip.duration));
        
        // Codecs
        cmd.arg("-c:v").arg("libx264");
        cmd.arg("-preset").arg("medium");
        cmd.arg("-c:a").arg("copy");
        
        cmd.arg("-y");
        cmd.arg(&output_path);
        
        println!("Single clip export command: {:?}", cmd);
        
        let output = cmd.output()
            .map_err(|e| format!("Failed to execute FFmpeg: {}. Make sure FFmpeg is installed and in your PATH.", e))?;
        
        if output.status.success() {
            return Ok(format!("Video exported successfully to {}", output_path));
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            println!("FFmpeg stderr: {}", error);
            return Err(format!("FFmpeg export failed: {}", error));
        }
    }
    
    // Multiple clips: use filter_complex for trimming and concatenating
    let mut filter_parts = Vec::new();
    let mut filter_inputs = String::new();
    
    for (i, clip) in sorted_clips.iter().enumerate() {
        let path = clip.file_path.replace("\\", "/");
        
        cmd.arg("-i").arg(&path);
        
        // Trim filters
        let trim_start = clip.trim_start;
        let duration = clip.duration;
        filter_parts.push(format!(
            "[{}:v]trim=start={:.6}:duration={:.6},setpts=PTS-STARTPTS[v{}];[{}:a]atrim=start={:.6}:duration={:.6},asetpts=PTS-STARTPTS[a{}]",
            i, trim_start, duration, i, i, trim_start, duration, i
        ));
        
        // Add to concat inputs
        filter_inputs.push_str(&format!("[v{}][a{}]", i, i));
        if i < sorted_clips.len() - 1 {
            filter_inputs.push_str(":");
        }
    }
    
    // Final concat filter
    filter_parts.push(format!("{}concat=n={}:v=1:a=1[outv][outa]", filter_inputs, sorted_clips.len()));
    
    let filter_complex = filter_parts.join(";");
    
    cmd.arg("-filter_complex").arg(&filter_complex);
    cmd.arg("-map").arg("[outv]");
    cmd.arg("-map").arg("[outa]");
    
    // Codecs
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("medium");
    cmd.arg("-c:a").arg("aac");
    cmd.arg("-b:a").arg("192k");
    
    cmd.arg("-y");
    cmd.arg(&output_path);
    
    println!("Filter complex: {}", filter_complex);
    println!("Running FFmpeg with multiple clips...");
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}. Make sure FFmpeg is installed and in your PATH.", e))?;
    
    if output.status.success() {
        Ok(format!("Video exported successfully to {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        println!("FFmpeg stderr: {}", error);
        Err(format!("FFmpeg export failed: {}", error))
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
        let payload_str = event.payload() as &str;
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
        let payload_str = event.payload() as &str;
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
