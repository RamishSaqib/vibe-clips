use tauri::{Emitter, Listener};
use serde_json::Value;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      let app_handle = app.handle().clone();
      
      // Listen for file-drop events from the OS
      app.handle().listen("tauri://file-drop", move |event| {
        let payload_str = event.payload() as &str;
        let payload: Vec<String> = serde_json::from_str(payload_str)
            .unwrap_or_else(|_| vec![]);
        
        if !payload.is_empty() {
            // Emit the file paths to the frontend
            let _ = app_handle.emit("file-drop", &payload);
        }
      });
      
      // Listen for file-drop-hover
      app.handle().listen("tauri://file-drop-hover", move |_event| {
        println!("File drag over window");
      });
      
      // Listen for file-drop-cancelled
      app.handle().listen("tauri://file-drop-cancelled", move |_event| {
        println!("File drag cancelled");
      });
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
