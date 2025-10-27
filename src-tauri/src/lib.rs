#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let app_handle = app.handle().clone();
      
      // Listen for file drop events
      app.listen("tauri://file-drop", move |event| {
        if let Some(payload) = event.payload() {
          println!("Files dropped: {:?}", payload);
        }
      });
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
