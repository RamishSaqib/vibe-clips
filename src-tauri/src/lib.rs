use tauri::{Emitter, Listener};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::fs;

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
    
    // Create a temporary concat file for FFmpeg
    let concat_file = format!("{}.concat.txt", output_path);
    let mut concat_content = String::new();
    
    // Sort clips by start_time to maintain order
    let mut sorted_clips = clips.clone();
    sorted_clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
    
    for clip in &sorted_clips {
        // Format: file '/path/to/file'
        // inpoint and outpoint are the trim boundaries
        concat_content.push_str(&format!(
            "file '{}'\ninpoint {:.6}\noutpoint {:.6}\n",
            clip.file_path.replace("\\", "/"),
            clip.trim_start,
            clip.trim_start + clip.duration
        ));
    }
    
    // Write concat file
    fs::write(&concat_file, concat_content)
        .map_err(|e| format!("Failed to write concat file: {}", e))?;
    
    // Build FFmpeg command
    let ffmpeg_cmd = Command::new("ffmpeg")
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(&concat_file)
        .arg("-c")
        .arg("copy")
        .arg("-y")
        .arg(&output_path)
        .output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}. Make sure FFmpeg is installed and in your PATH.", e))?;
    
    // Clean up concat file
    let _ = fs::remove_file(&concat_file);
    
    if ffmpeg_cmd.status.success() {
        Ok(format!("Video exported successfully to {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&ffmpeg_cmd.stderr);
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
