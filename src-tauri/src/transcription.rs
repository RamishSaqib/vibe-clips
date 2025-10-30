use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SubtitleEntry {
    pub id: u32,
    pub start_time: f64, // seconds
    pub end_time: f64,   // seconds
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionResponse {
    pub subtitles: Vec<SubtitleEntry>,
    pub raw_srt: String,
}

/// Extract audio from video file using FFmpeg
/// Note: This is a helper function, but typically audio extraction is done directly in the Tauri command
/// with access to app_handle for bundled FFmpeg support
pub fn extract_audio(video_path: &str, output_path: &str, ffmpeg_path: &str) -> Result<String, String> {
    
    let output = Command::new(ffmpeg_path)
        .arg("-i")
        .arg(video_path)
        .arg("-vn") // No video
        .arg("-acodec")
        .arg("libmp3lame") // MP3 codec
        .arg("-ar")
        .arg("16000") // 16kHz sample rate (Whisper requirement)
        .arg("-ac")
        .arg("1") // Mono
        .arg("-y") // Overwrite output file
        .arg(output_path)
        .output()
        .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error: {}", error_msg));
    }
    
    Ok(output_path.to_string())
}

/// Transcribe audio using OpenAI Whisper API
pub async fn transcribe_audio_whisper(
    audio_path: &str,
    api_key: &str,
) -> Result<TranscriptionResponse, String> {
    use std::fs::File;
    use std::io::Read;
    
    // Read audio file
    let mut file = File::open(audio_path)
        .map_err(|e| format!("Failed to open audio file: {}", e))?;
    
    let mut audio_data = Vec::new();
    file.read_to_end(&mut audio_data)
        .map_err(|e| format!("Failed to read audio file: {}", e))?;
    
    // Create multipart form data
    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-1")
        .text("response_format", "srt")
        .part("file", reqwest::multipart::Part::bytes(audio_data)
            .file_name("audio.mp3")
            .mime_str("audio/mpeg")
            .map_err(|e| format!("Failed to create multipart part: {}", e))?);
    
    // Make API request
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API error: {} - {}", status, error_text));
    }
    
    let srt_content = response.text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    // Parse SRT content into structured format
    let subtitles = parse_srt(&srt_content)?;
    
    Ok(TranscriptionResponse {
        subtitles,
        raw_srt: srt_content,
    })
}

/// Parse SRT format subtitle file
fn parse_srt(srt_content: &str) -> Result<Vec<SubtitleEntry>, String> {
    let mut subtitles = Vec::new();
    let blocks: Vec<&str> = srt_content.split("\n\n").collect();
    
    for block in blocks {
        let lines: Vec<&str> = block.trim().lines().collect();
        if lines.len() < 3 {
            continue; // Invalid block
        }
        
        // First line is ID
        let id: u32 = lines[0].trim().parse()
            .map_err(|_| format!("Invalid subtitle ID: {}", lines[0]))?;
        
        // Second line is timestamp (format: "00:00:00,000 --> 00:00:05,000")
        let time_line = lines[1];
        let (start_time, end_time) = parse_srt_timestamp(time_line)
            .map_err(|e| format!("Invalid timestamp format: {}", e))?;
        
        // Remaining lines are text
        let text = lines[2..].join("\n").trim().to_string();
        
        if !text.is_empty() {
            subtitles.push(SubtitleEntry {
                id,
                start_time,
                end_time,
                text,
            });
        }
    }
    
    Ok(subtitles)
}

/// Parse SRT timestamp format: "00:00:00,000 --> 00:00:05,000"
fn parse_srt_timestamp(timestamp_str: &str) -> Result<(f64, f64), String> {
    let parts: Vec<&str> = timestamp_str.split(" --> ").collect();
    if parts.len() != 2 {
        return Err(format!("Invalid timestamp format: {}", timestamp_str));
    }
    
    let start = parse_time_string(parts[0])?;
    let end = parse_time_string(parts[1])?;
    
    Ok((start, end))
}

/// Parse time string "HH:MM:SS,mmm" to seconds
fn parse_time_string(time_str: &str) -> Result<f64, String> {
    let time_str = time_str.trim();
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return Err(format!("Invalid time format: {}", time_str));
    }
    
    let hours: u32 = parts[0].parse()
        .map_err(|_| format!("Invalid hours: {}", parts[0]))?;
    let minutes: u32 = parts[1].parse()
        .map_err(|_| format!("Invalid minutes: {}", parts[1]))?;
    
    let seconds_part: Vec<&str> = parts[2].split(',').collect();
    if seconds_part.len() != 2 {
        return Err(format!("Invalid seconds format: {}", parts[2]));
    }
    
    let seconds: u32 = seconds_part[0].parse()
        .map_err(|_| format!("Invalid seconds: {}", seconds_part[0]))?;
    let milliseconds: u32 = seconds_part[1].parse()
        .map_err(|_| format!("Invalid milliseconds: {}", seconds_part[1]))?;
    
    let total_seconds = (hours * 3600 + minutes * 60 + seconds) as f64
        + (milliseconds as f64 / 1000.0);
    
    Ok(total_seconds)
}


#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_time_string() {
        assert_eq!(parse_time_string("00:00:05,000").unwrap(), 5.0);
        assert_eq!(parse_time_string("00:01:30,500").unwrap(), 90.5);
        assert_eq!(parse_time_string("01:02:03,123").unwrap(), 3723.123);
    }
    
    #[test]
    fn test_parse_srt_timestamp() {
        let (start, end) = parse_srt_timestamp("00:00:00,000 --> 00:00:05,000").unwrap();
        assert_eq!(start, 0.0);
        assert_eq!(end, 5.0);
    }
    
    #[test]
    fn test_parse_srt() {
        let srt_content = r#"1
00:00:00,000 --> 00:00:05,000
Hello world

2
00:00:05,000 --> 00:00:10,000
This is a test
"#;
        
        let subtitles = parse_srt(srt_content).unwrap();
        assert_eq!(subtitles.len(), 2);
        assert_eq!(subtitles[0].text, "Hello world");
        assert_eq!(subtitles[1].text, "This is a test");
    }
}

