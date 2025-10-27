#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|_app| {
      // App initialization logic can go here
      // File drops in Tauri 2.x are handled by standard web APIs
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
