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
    
    // Build filter_complex for trimming and concatenating
    let mut inputs = Vec::new();
    let mut filter_parts = Vec::new();
    let mut inputs_str = String::new();
    
    for (i, clip) in sorted_clips.iter().enumerate() {
        let path = clip.file_path.replace("\\", "/");
        
        // Add input
        inputs.push("-i".to_string());
        inputs.push(path.clone());
        
        // Trim each clip: [i:v]trim=start={trim_start}:duration={duration},setpts=PTS-STARTPTS[v{i}]
        //                 [i:a]atrim=start={trim_start}:duration={duration},asetpts=PTS-STARTPTS[a{i}]
        let trim_start = clip.trim_start;
        let duration = clip.duration;
        filter_parts.push(format!(
            "[{}:v]trim=start={:.6}:duration={:.6},setpts=PTS-STARTPTS[v{}];[{}:a]atrim=start={:.6}:duration={:.6},asetpts=PTS-STARTPTS[a{}]",
            i, trim_start, duration, i, i, trim_start, duration, i
        ));
        
        // Add to concat inputs
        inputs_str.push_str(&format!("[v{}][a{}]", i, i));
        if i < sorted_clips.len() - 1 {
            inputs_str.push_str(":");
        }
    }
    
    // Final concat filter
    filter_parts.push(format!("{}concat=n={}:v=1:a=1[outv][outa]", inputs_str, sorted_clips.len()));
    
    let filter_complex = filter_parts.join(";");
    
    println!("Filter complex: {}", filter_complex);
    
    // Build FFmpeg command
    let mut cmd = Command::new("ffmpeg");
    
    // Add inputs
    for arg in inputs {
        cmd.arg(&arg);
    }
    
    // Add filter
    cmd.arg("-filter_complex").arg(&filter_complex);
    
    // Map outputs
    cmd.arg("-map").arg("[outv]");
    cmd.arg("-map").arg("[outa]");
    
    // Codec options
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("medium");
    cmd.arg("-c:a").arg("aac");
    cmd.arg("-b:a").arg("192k");
    
    // Overwrite output
    cmd.arg("-y");
    cmd.arg(&output_path);
    
    println!("Running FFmpeg...");
    let ffmpeg_cmd = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}. Make sure FFmpeg is installed and in your PATH.", e))?;
    
    if ffmpeg_cmd.status.success() {
        Ok(format!("Video exported successfully to {}", output_path))
    } else {
        let error = String::from_utf8_lossy(&ffmpeg_cmd.stderr);
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
