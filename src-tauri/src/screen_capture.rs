use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenSource {
    pub id: String,
    pub name: String,
    pub is_primary: bool,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone)]
pub struct RecordingSession {
    pub is_recording: bool,
    pub output_path: Option<String>,
    pub start_time: Option<std::time::SystemTime>,
}

lazy_static::lazy_static! {
    static ref RECORDING_SESSION: Arc<Mutex<RecordingSession>> = Arc::new(Mutex::new(RecordingSession {
        is_recording: false,
        output_path: None,
        start_time: None,
    }));
}

#[cfg(windows)]
pub fn list_screen_sources() -> Result<Vec<ScreenSource>, String> {
    // For now, return a simple list of available displays
    // Full Windows.Graphics.Capture enumeration requires more complex setup
    let mut sources = Vec::new();
    
    // Get primary monitor info using basic Windows API
    unsafe {
        use windows::Win32::Graphics::Gdi::{
            EnumDisplayMonitors, GetMonitorInfoW, HMONITOR, MONITORINFO,
        };
        use windows::Win32::Foundation::{LPARAM, RECT, TRUE};
        
        extern "system" fn monitor_enum_proc(
            monitor: HMONITOR,
            _: windows::Win32::Graphics::Gdi::HDC,
            _: *mut RECT,
            data: LPARAM,
        ) -> windows::Win32::Foundation::BOOL {
            unsafe {
                let sources = &mut *(data.0 as *mut Vec<ScreenSource>);
                
                let mut info = MONITORINFO {
                    cbSize: std::mem::size_of::<MONITORINFO>() as u32,
                    ..Default::default()
                };
                
                if GetMonitorInfoW(monitor, &mut info).as_bool() {
                    let width = (info.rcMonitor.right - info.rcMonitor.left) as u32;
                    let height = (info.rcMonitor.bottom - info.rcMonitor.top) as u32;
                    let is_primary = info.dwFlags == 1;
                    
                    sources.push(ScreenSource {
                        id: format!("{:?}", monitor.0),
                        name: if is_primary {
                            format!("Primary Display ({}x{})", width, height)
                        } else {
                            format!("Display {} ({}x{})", sources.len() + 1, width, height)
                        },
                        is_primary,
                        width,
                        height,
                    });
                }
                
                TRUE
            }
        }
        
        let sources_ptr = &mut sources as *mut Vec<ScreenSource>;
        EnumDisplayMonitors(
            None,
            None,
            Some(monitor_enum_proc),
            LPARAM(sources_ptr as isize),
        );
    }
    
    if sources.is_empty() {
        sources.push(ScreenSource {
            id: "primary".to_string(),
            name: "Primary Display".to_string(),
            is_primary: true,
            width: 1920,
            height: 1080,
        });
    }
    
    Ok(sources)
}

#[cfg(not(windows))]
pub fn list_screen_sources() -> Result<Vec<ScreenSource>, String> {
    Err("Screen capture is only supported on Windows".to_string())
}

#[cfg(windows)]
pub fn start_screen_recording(_source_id: String, output_path: String) -> Result<String, String> {
    let mut session = RECORDING_SESSION.lock().unwrap();
    
    if session.is_recording {
        return Err("Recording already in progress".to_string());
    }
    
    // Validate output path
    if !output_path.ends_with(".mp4") {
        return Err("Output path must end with .mp4".to_string());
    }
    
    session.is_recording = true;
    session.output_path = Some(output_path.clone());
    session.start_time = Some(std::time::SystemTime::now());
    
    // Note: Actual screen capture implementation would go here
    // For MVP, we'll use FFmpeg to capture the screen
    // This is a placeholder that confirms the setup works
    
    Ok(format!("Recording started to {}", output_path))
}

#[cfg(not(windows))]
pub fn start_screen_recording(_source_id: String, _output_path: String) -> Result<String, String> {
    Err("Screen capture is only supported on Windows".to_string())
}

pub fn stop_screen_recording() -> Result<String, String> {
    let mut session = RECORDING_SESSION.lock().unwrap();
    
    if !session.is_recording {
        return Err("No recording in progress".to_string());
    }
    
    let output_path = session.output_path.clone().unwrap_or_default();
    
    session.is_recording = false;
    session.output_path = None;
    session.start_time = None;
    
    Ok(output_path)
}

pub fn get_recording_status() -> Result<bool, String> {
    let session = RECORDING_SESSION.lock().unwrap();
    Ok(session.is_recording)
}

#[cfg(windows)]
pub fn capture_screen_with_ffmpeg(
    output_path: String,
    duration_secs: Option<u64>,
) -> Result<String, String> {
    use std::process::{Command, Stdio};
    
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y"); // Overwrite output file
    cmd.arg("-f").arg("gdigrab"); // Windows screen capture
    cmd.arg("-framerate").arg("30");
    cmd.arg("-i").arg("desktop"); // Capture entire desktop
    
    if let Some(duration) = duration_secs {
        cmd.arg("-t").arg(duration.to_string());
    }
    
    cmd.arg("-c:v").arg("libx264");
    cmd.arg("-preset").arg("ultrafast");
    cmd.arg("-crf").arg("23");
    cmd.arg("-pix_fmt").arg("yuv420p");
    cmd.arg(&output_path);
    
    cmd.arg("-hide_banner");
    cmd.arg("-loglevel").arg("error");
    
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute FFmpeg: {}. Make sure FFmpeg is installed.", e))?;
    
    if output.status.success() {
        Ok(output_path)
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg error: {}", error))
    }
}

#[cfg(not(windows))]
pub fn capture_screen_with_ffmpeg(
    _output_path: String,
    _duration_secs: Option<u64>,
) -> Result<String, String> {
    Err("Screen capture is only supported on Windows".to_string())
}

