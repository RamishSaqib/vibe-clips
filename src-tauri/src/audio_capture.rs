use std::sync::{Arc, Mutex};
use std::thread;
use std::sync::mpsc::{channel, Sender};

struct AudioCaptureState {
    is_recording: bool,
    stop_signal: Option<Sender<()>>,
    recording_thread: Option<thread::JoinHandle<()>>,
}

lazy_static::lazy_static! {
    static ref AUDIO_STATE: Arc<Mutex<AudioCaptureState>> = Arc::new(Mutex::new(AudioCaptureState {
        is_recording: false,
        stop_signal: None,
        recording_thread: None,
    }));
}

#[cfg(windows)]
pub fn start_audio_capture(output_path: String) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use hound::{WavWriter, WavSpec};
    use std::sync::mpsc::Receiver;
    
    let mut state = AUDIO_STATE.lock().unwrap();
    
    if state.is_recording {
        return Err("Audio capture already in progress".to_string());
    }
    
    let (stop_tx, stop_rx): (Sender<()>, Receiver<()>) = channel();
    
    // Spawn thread to handle the audio stream
    let recording_thread = thread::spawn(move || {
        println!("Audio capture thread started");
        
        // Get the default output device (what's playing to speakers)
        let host = cpal::default_host();
        let device = match host.default_output_device() {
            Some(d) => d,
            None => {
                eprintln!("No default output device available");
                return;
            }
        };
        
        println!("Using audio device: {}", device.name().unwrap_or_else(|_| "Unknown".to_string()));
        
        // Get the default output config
        let config = match device.default_output_config() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to get default output config: {}", e);
                return;
            }
        };
        
        println!("Audio config: {:?}", config);
        
        let sample_rate = config.sample_rate().0;
        let channels = config.channels() as u16;
        
        // Create channel for audio data
        let (audio_tx, audio_rx) = channel::<Vec<f32>>();
        
        // Build input stream in loopback mode
        let stream_result = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                let config: cpal::StreamConfig = config.into();
                device.build_input_stream(
                    &config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let _ = audio_tx.send(data.to_vec());
                    },
                    move |err| {
                        eprintln!("Audio stream error: {}", err);
                    },
                    None
                )
            },
            cpal::SampleFormat::I16 => {
                let config: cpal::StreamConfig = config.into();
                device.build_input_stream(
                    &config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let float_data: Vec<f32> = data.iter()
                            .map(|&sample| sample as f32 / i16::MAX as f32)
                            .collect();
                        let _ = audio_tx.send(float_data);
                    },
                    move |err| {
                        eprintln!("Audio stream error: {}", err);
                    },
                    None
                )
            },
            cpal::SampleFormat::U16 => {
                let config: cpal::StreamConfig = config.into();
                device.build_input_stream(
                    &config,
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        let float_data: Vec<f32> = data.iter()
                            .map(|&sample| (sample as f32 / u16::MAX as f32) * 2.0 - 1.0)
                            .collect();
                        let _ = audio_tx.send(float_data);
                    },
                    move |err| {
                        eprintln!("Audio stream error: {}", err);
                    },
                    None
                )
            },
            _ => {
                eprintln!("Unsupported sample format");
                return;
            }
        };
        
        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to build input stream: {}", e);
                return;
            }
        };
        
        // Start the stream
        if let Err(e) = stream.play() {
            eprintln!("Failed to start audio stream: {}", e);
            return;
        }
        
        println!("Audio stream started");
        
        // Create WAV writer
        let spec = WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        
        let mut writer = match WavWriter::create(&output_path, spec) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create WAV writer: {}", e);
                return;
            }
        };
        
        // Recording loop
        let samples_per_timeout = (sample_rate as f64 * 0.1) as usize * channels as usize; // 100ms worth of samples
        
        loop {
            // Check for stop signal (non-blocking)
            match stop_rx.try_recv() {
                Ok(_) | Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    println!("Stop signal received");
                    break;
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {
                    // Continue recording
                }
            }
            
            // Receive audio data with timeout
            match audio_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                Ok(samples) => {
                    // Write actual audio samples
                    for sample in samples {
                        let sample_i16 = (sample * i16::MAX as f32) as i16;
                        if let Err(e) = writer.write_sample(sample_i16) {
                            eprintln!("Failed to write audio sample: {}", e);
                            break;
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // No audio data received - write silence to maintain timing
                    for _ in 0..samples_per_timeout {
                        if let Err(e) = writer.write_sample(0i16) {
                            eprintln!("Failed to write silence sample: {}", e);
                            break;
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    eprintln!("Audio channel disconnected");
                    break;
                }
            }
        }
        
        // Finalize the WAV file
        if let Err(e) = writer.finalize() {
            eprintln!("Failed to finalize WAV file: {}", e);
        }
        
        // Drop stream to stop it
        drop(stream);
        
        println!("Audio capture thread finished");
    });
    
    state.is_recording = true;
    state.stop_signal = Some(stop_tx);
    state.recording_thread = Some(recording_thread);
    
    Ok(())
}

#[cfg(not(windows))]
pub fn start_audio_capture(_output_path: String) -> Result<(), String> {
    Err("WASAPI audio capture is only supported on Windows".to_string())
}

pub fn stop_audio_capture() -> Result<(), String> {
    let mut state = AUDIO_STATE.lock().unwrap();
    
    if !state.is_recording {
        return Err("No audio capture session active".to_string());
    }
    
    // Send stop signal
    if let Some(stop_signal) = state.stop_signal.take() {
        let _ = stop_signal.send(());
    }
    
    // Wait for thread to finish
    if let Some(thread) = state.recording_thread.take() {
        // Release lock before joining
        drop(state);
        
        thread.join().map_err(|_| "Failed to join audio recording thread")?;
        
        // Re-acquire lock to update state
        let mut state = AUDIO_STATE.lock().unwrap();
        state.is_recording = false;
    } else {
        state.is_recording = false;
    }
    
    println!("Audio capture stopped");
    Ok(())
}

pub fn is_audio_capturing() -> bool {
    let state = AUDIO_STATE.lock().unwrap();
    state.is_recording
}
