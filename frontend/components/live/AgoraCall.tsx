'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import SignAvatarOverlay from './SignAvatarOverlay';
import { convertTextToSigns } from '@/lib/isl/textToSigns';
import { supabase } from '@/lib/supabase';

interface AgoraCallProps {
  channelName: string;
  onLeave?: () => void;
  captionsEnabled?: boolean;
  islEnabled?: boolean;
  userName?: string;
  uid?: number;
  onRecordingReady?: (url: string) => void;
}

interface RemoteUser { uid: string | number; videoTrack?: any; audioTrack?: any; }

export default function AgoraCall({ channelName, onLeave, captionsEnabled, islEnabled, userName, uid = 0, onRecordingReady }: AgoraCallProps) {
  const clientRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [callState, setCallState] = useState<'joining' | 'joined' | 'left' | 'error'>('joining');
  const [errorMsg, setErrorMsg] = useState('');
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [duration, setDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  // Camera Selection
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Real-time Avatar Queue
  const [islQueue, setIslQueue] = useState<string[]>([]);
  const [isProcessingCaption, setIsProcessingCaption] = useState(false);

  // Vision AI (ISL to Speech)
  const [visionActive, setVisionActive] = useState(false);
  const [visionPhrase, setVisionPhrase] = useState('');
  const visionIntervalRef = useRef<any>(null);

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

  // Fetch available cameras and avoid OBS Virtual Camera
  useEffect(() => {
    AgoraRTC.getCameras().then(devices => {
      setCameras(devices);
      if (devices.length > 0) {
        const realCam = devices.find(d => !d.label.toLowerCase().includes('virtual') && !d.label.toLowerCase().includes('obs'));
        setSelectedCameraId(realCam ? realCam.deviceId : devices[0].deviceId);
      } else {
        setSelectedCameraId('none');
      }
    }).catch(err => {
      console.warn('Failed to get cameras', err);
      setSelectedCameraId('none');
    });
  }, []);

  const switchCamera = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    if (localVideoTrackRef.current) {
      try {
        await localVideoTrackRef.current.setDevice(deviceId);
      } catch (e) {
        console.error("Failed to switch camera device:", e);
      }
    }
  };

  useEffect(() => {
    if (callState !== 'joined') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  // ─── Real-time ISL Pipeline: Web Speech API → Avatar Queue ───
  useEffect(() => {
    if (!islEnabled || callState !== 'joined') {
      setIslQueue([]);
      return;
    }

    // Web Speech API — works in Chrome/Edge (live STT, no server cost)
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Browser doesn’t support STT — show a short placeholder sign
      console.warn('[ISL] Web Speech API not supported, using demo mode');
      setIslQueue(['welcome', 'class']);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;   // keep listening
    recognition.interimResults = false;  // only fire on final sentence
    recognition.lang = 'en-IN'; // Indian English
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('[ISL STT Original]', transcript);

      setIsProcessingCaption(true);

      let finalTokens: string[] = [];
      try {
        // Send spoken text to AI backend for ISL Grammar Simplification
        const res = await fetch('/api/isl-grammar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.isl_text && data.isl_text.length > 0) {
            finalTokens = data.isl_text;
            console.log('[ISL STT Simplified]', data.isl_text);
            setIslQueue(prev => {
              const existing = new Set(prev);
              const fresh = data.isl_text.filter((t: string) => !existing.has(t));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        }
      } catch (err) {
        console.error('[ISL AI Translation Error]', err);
        // Fallback to local conversion if backend is unreachable
        const tokens = convertTextToSigns(transcript);
        finalTokens = tokens;
        if (tokens.length > 0) {
          setIslQueue(prev => {
            const existing = new Set(prev);
            const fresh = tokens.filter(t => !existing.has(t));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
      } finally {
        if (channelName && transcript) {
          // 1. Universal Supabase Realtime Broadcast (instant delivery to all devices)
          try {
            const rtChan = supabase.channel(`live_room_${channelName}`);
            rtChan.send({
              type: 'broadcast',
              event: 'TEACHER_SPEECH',
              payload: {
                speech: {
                  text: transcript,
                  speaker: userName || 'Teacher',
                  sign_tokens: finalTokens
                }
              }
            });
          } catch (_) {}

          // 2. Also record on backend API
          fetch(`/api/live-classes/${channelName}/speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: transcript,
              speaker: userName || 'Teacher',
              sign_tokens: finalTokens
            })
          }).catch(() => {});
        }
        setTimeout(() => setIsProcessingCaption(false), 600);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.warn('[ISL STT error]', e.error);
    };

    // Restart on end to keep listening continuously
    recognition.onend = () => {
      if (callState === 'joined' && islEnabled) {
        try { recognition.start(); } catch (_) { }
      }
    };

    try { recognition.start(); } catch (e) { console.warn('[ISL] STT start error', e); }

    return () => {
      try { recognition.abort(); } catch (_) { }
    };
  }, [islEnabled, callState]);

  const toggleVisionAI = () => {
    if (visionActive) {
      setVisionActive(false);
      clearInterval(visionIntervalRef.current);
      setVisionPhrase('');
    } else {
      setVisionActive(true);

      visionIntervalRef.current = setInterval(async () => {
        if (!localVideoRef.current) return;
        // Find the video element created by Agora
        const videoEl = localVideoRef.current.querySelector('video');
        if (!videoEl || videoEl.readyState !== 4) return;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = 224;
          canvas.height = 224;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(videoEl, 0, 0, 224, 224);
          const b64 = canvas.toDataURL('image/jpeg', 0.8);

          const res = await fetch('/api/predict-sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: b64 }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.sign && data.is_confident) {
              // Capitalize sign name and format it
              const detectedWord = (data.clean_sign || data.sign.replace(/^\d+_/, '')).replace(/_/g, ' ').toUpperCase();
              setVisionPhrase(detectedWord);

              // Let the avatar mirror the detected sign
              setIslQueue(prev => [...prev, detectedWord.toLowerCase()]);

              if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(detectedWord);
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
              }

              setTimeout(() => setVisionPhrase(''), 3000);
            }
          }
        } catch (err) {
          console.error("[Vision AI] Error predicting sign:", err);
        }
      }, 2000); // Poll every 2 seconds
    }
  };

  useEffect(() => {
    return () => {
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
    };
  }, []);

  // Callback from 3D Avatar when an animation finishes playing
  const handleSignComplete = useCallback((completedWord: string) => {
    setIslQueue(prevQueue => {
      const newQueue = [...prevQueue];
      if (newQueue[0] === completedWord) {
        newQueue.shift(); // Remove the finished word to trigger the next queue item
      }
      return newQueue;
    });
  }, []);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = () => {
    if (!localVideoTrackRef.current || !localAudioTrackRef.current) return;
    try {
      const videoTrack: MediaStreamTrack = localVideoTrackRef.current.getMediaStreamTrack();
      const audioTrack: MediaStreamTrack = localAudioTrackRef.current.getMediaStreamTrack();
      const stream = new MediaStream([videoTrack, audioTrack]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        onRecordingReady?.(url);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      console.error('Recording error:', e);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const downloadRecording = () => {
    if (!recordingUrl) return;
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `sparsh-class-${channelName}-${Date.now()}.webm`;
    a.click();
  };

  const leave = useCallback(async () => {
    if (isRecording) stopRecording();
    try {
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localVideoTrackRef.current?.stop();
      await clientRef.current?.leave();
    } catch (_) { }
    localAudioTrackRef.current = null;
    localVideoTrackRef.current = null;
    setRemoteUsers([]);
    setCallState('left');
    onLeave?.();
  }, [onLeave, isRecording]);

  const toggleMic = async () => {
    if (!localAudioTrackRef.current) return;
    await localAudioTrackRef.current.setMuted(!micMuted);
    setMicMuted(!micMuted);
  };

  const toggleCam = async () => {
    if (!localVideoTrackRef.current) return;
    await localVideoTrackRef.current.setMuted(!camOff);
    setCamOff(!camOff);
  };

  // Play local video when DOM is ready
  useEffect(() => {
    if (callState === 'joined' && localVideoRef.current && localVideoTrackRef.current) {
      try {
        localVideoTrackRef.current.play(localVideoRef.current);
      } catch (e) {
        console.error('Local video play err', e);
      }
    }
  }, [callState]);

  // Play remote video
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack) {
        const el = document.getElementById(`remote-${user.uid}`);
        if (el) user.videoTrack.play(el);
      }
    });
  }, [remoteUsers]);

  // Main join effect
  useEffect(() => {
    if (!selectedCameraId) return; // Wait for camera device selection

    let canceled = false;

    const safeJoin = async () => {
      if (!appId) {
        setErrorMsg('INVALID_APP_ID');
        setCallState('error');
        return;
      }
      if (canceled) return;

      try {
        AgoraRTC.setLogLevel(4);
        if (canceled) return;

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('user-published', async (user: any, mediaType: 'audio' | 'video' | 'datachannel') => {
          await client.subscribe(user, mediaType as 'audio' | 'video');
          if (canceled) return;
          setRemoteUsers(prev => {
            const exists = prev.find(u => u.uid === user.uid);
            return exists
              ? prev.map(u => u.uid === user.uid ? { ...u, [mediaType + 'Track']: user[mediaType + 'Track'] } : u)
              : [...prev, { uid: user.uid, [mediaType + 'Track']: user[mediaType + 'Track'] }];
          });
          if (mediaType === 'audio') user.audioTrack?.play();
        });

        client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video' | 'datachannel') => {
          if (mediaType === 'audio') user.audioTrack?.stop();
          if (mediaType === 'video') setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, videoTrack: undefined } : u));
        });

        client.on('user-left', (user: any) => setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid)));

        if (canceled) return;

        let audioTrack = null;
        let videoTrack = null;

        try {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        } catch (e) {
          console.warn("Could not initialize microphone:", e);
          setMicMuted(true);
        }

        try {
          if (selectedCameraId !== 'none') {
            videoTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: '720p_1',
              cameraId: selectedCameraId
            });
          }
        } catch (e) {
          console.warn("Could not initialize camera:", e);
          setCamOff(true);
        }

        if (canceled) {
          audioTrack?.close();
          videoTrack?.close();
          return;
        }

        localAudioTrackRef.current = audioTrack;
        localVideoTrackRef.current = videoTrack;

        // 2. Now join network channel
        await client.join(appId, channelName, null, uid || null);
        if (canceled) { await client.leave().catch(() => { }); return; }

        // 3. Publish tracks safely
        const tracksToPublish = [audioTrack, videoTrack].filter(Boolean) as any[];
        if (tracksToPublish.length > 0) {
          try {
            await client.publish(tracksToPublish);
          } catch (pubErr: any) {
            console.error("Publish error (safe):", pubErr);
            if (!canceled && pubErr?.message?.includes('P2PChannel')) {
              // Internal Agora race condition when connection is still initializing vs tracks unmuting
              // It's benign, the local tracks just won't be sent until re-published.
            }
          }
        }

        if (!canceled) setCallState('joined');

      } catch (err: any) {
        if (canceled) return;
        console.error('Agora join error:', err);
        const msg: string = err?.message || err?.toString() || '';
        if (msg.includes('dynamic use static key') || msg.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
          setErrorMsg('TOKEN_REQUIRED');
        } else if (msg.includes('INVALID_APP_ID')) {
          setErrorMsg('INVALID_APP_ID');
        } else if (msg.includes('OPERATION_ABORTED') || msg.includes('cancel')) {
          setTimeout(() => { if (!canceled) safeJoin(); }, 1500);
          return;
        } else if (msg.includes('Permission denied') || msg.includes('NotAllowed')) {
          setErrorMsg('PERMISSION_DENIED');
        } else {
          setErrorMsg(msg || 'Unknown Agora error');
        }
        setCallState('error');
      }
    };

    safeJoin();

    return () => {
      canceled = true;
      const cleanupClient = async () => {
        try {
          if (localAudioTrackRef.current) localAudioTrackRef.current.close();
          if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
            localVideoTrackRef.current.close();
          }
          if (clientRef.current && clientRef.current.connectionState !== 'DISCONNECTED') {
            await clientRef.current.leave();
          }
        } catch (e) {
          console.error("Agora cleanup error:", e);
        }
        localAudioTrackRef.current = null;
        localVideoTrackRef.current = null;
      };
      cleanupClient();
    };
  }, [channelName, appId, uid, selectedCameraId]); // Added dependencies

  return (
    <div className="flex flex-col h-full bg-[#0a0a1a]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f0c29]/90 border-b border-white/10 shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          {callState === 'joining' && <span className="text-yellow-400 text-xs animate-pulse">Connecting...</span>}
          {callState === 'joined' && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-xs font-bold">LIVE</span>
              </span>
              <span className="text-white/40 text-xs font-mono">{formatDuration(duration)}</span>
              <span className="text-white/40 text-xs">👥 {remoteUsers.length + 1}</span>
            </>
          )}
          {callState === 'error' && <span className="text-red-400 text-xs">⚠ Error</span>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {captionsEnabled && <span className="px-2 py-0.5 bg-[#00C9A7]/20 text-[#00C9A7] text-[10px] rounded-full">CC</span>}
          {islEnabled && <span className="px-2 py-0.5 bg-[#6C63FF]/20 text-[#6C63FF] text-[10px] rounded-full">ISL</span>}

          {callState === 'joined' && (
            <>
              <button onClick={toggleVisionAI} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${visionActive ? 'bg-[#6C63FF] text-white shadow-[0_0_10px_#6C63FF]' : 'bg-white/10 text-white/70 hover:bg-[#6C63FF]/20'}`}>
                <span className="text-sm">👁️</span> {visionActive ? 'Vision AI: ON' : 'Vision AI: OFF'}
              </button>
              <button onClick={toggleMic} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${micMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70'}`}>
                {micMuted ? '🔇' : '🎙'}
              </button>
              <button onClick={toggleCam} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${camOff ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/70'}`}>
                {camOff ? '📷' : '📹'}
              </button>
              {/* Recording */}
              {!isRecording ? (
                <button onClick={startRecording} className="px-2.5 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium hover:bg-yellow-500/30 transition">
                  ⏺ Record
                </button>
              ) : (
                <button onClick={stopRecording} className="px-2.5 py-1.5 bg-red-500/30 text-red-300 rounded-lg text-xs font-medium animate-pulse">
                  ⏹ Stop
                </button>
              )}
              {recordingUrl && (
                <button onClick={downloadRecording} className="px-2.5 py-1.5 bg-[#00C9A7]/20 text-[#00C9A7] rounded-lg text-xs font-medium hover:bg-[#00C9A7]/30 transition">
                  ⬇ Save
                </button>
              )}
              {/* Camera Switcher Dropdown */}
              {cameras.length > 1 && (
                <select
                  className="bg-white/10 text-white text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer max-w-[120px] truncate"
                  value={selectedCameraId}
                  onChange={(e) => switchCamera(e.target.value)}
                >
                  {cameras.map(cam => (
                    <option key={cam.deviceId} value={cam.deviceId} className="bg-[#1e1e32]">
                      {cam.label || 'Camera'}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          <button onClick={leave} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition">Leave</button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 min-h-0 p-3 relative">
        {callState === 'joining' && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] mx-auto flex items-center justify-center mb-4 animate-pulse">
                <span className="text-2xl">🎥</span>
              </div>
              <p className="text-white font-medium">Joining Sparsh Live Engine...</p>
              <p className="text-white/40 text-sm mt-1">Please allow camera & microphone access</p>
            </div>
          </div>
        )}

        {callState === 'error' && (
          <div className="h-full flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <span className="text-5xl block mb-4">⚠️</span>
              {errorMsg === 'TOKEN_REQUIRED' && (
                <>
                  <h3 className="text-white font-bold mb-2">Network Configuration Required</h3>
                  <p className="text-white/60 text-sm mb-4">A critical network parameter is missing. Please contact an administrator to verify the configuration.</p>
                </>
              )}
              {errorMsg === 'PERMISSION_DENIED' && (
                <>
                  <h3 className="text-white font-bold mb-2">Camera / Mic Access Denied</h3>
                  <p className="text-white/60 text-sm mb-4">Click the 🔒 lock icon in your browser address bar → Allow Camera and Microphone → Refresh the page.</p>
                </>
              )}
              {!['TOKEN_REQUIRED', 'PERMISSION_DENIED', 'INVALID_APP_ID'].includes(errorMsg) && (
                <>
                  <h3 className="text-white font-bold mb-2">Connection Error</h3>
                  <p className="text-white/60 text-sm mb-4">{errorMsg}</p>
                </>
              )}
            </div>
          </div>
        )}

        {callState === 'joined' && (
          <div className={`grid gap-3 h-full w-full place-content-center p-2
            ${remoteUsers.length === 0 ? 'grid-cols-1 max-w-4xl mx-auto' :
              remoteUsers.length <= 3 ? 'grid-cols-1 md:grid-cols-2' :
                remoteUsers.length <= 8 ? 'grid-cols-2 md:grid-cols-3' :
                  'grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
            }`}>
            {/* Local Video */}
            <div className="relative bg-[#111] rounded-xl overflow-hidden shadow-lg border border-white/10" style={{ minHeight: remoteUsers.length === 0 ? '400px' : '200px', maxHeight: '100%' }}>
              <div
                ref={localVideoRef}
                className="w-full h-full object-cover"
                style={{ position: 'absolute', inset: 0 }}
              />
              {camOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white text-2xl font-bold">
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-lg text-xs text-white flex items-center gap-1">
                {userName || 'You'} {micMuted && '🔇'}
              </div>
              {isRecording && (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-red-500/80 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-[10px] font-bold">REC</span>
                </div>
              )}
              {visionActive && !camOff && (
                <div className="absolute inset-0 border-[2px] border-[#6C63FF]/50 m-2 rounded-xl flex items-center justify-center pointer-events-none">
                  <div className="absolute w-full h-full">
                    <div className="absolute top-[30%] left-[45%] w-1.5 h-1.5 bg-[#00C9A7] rounded-full shadow-[0_0_8px_#00C9A7] animate-pulse" />
                    <div className="absolute top-[40%] left-[30%] w-1.5 h-1.5 bg-[#00C9A7] rounded-full shadow-[0_0_8px_#00C9A7] animate-pulse delay-100" />
                    <div className="absolute top-[40%] left-[60%] w-1.5 h-1.5 bg-[#00C9A7] rounded-full shadow-[0_0_8px_#00C9A7] animate-pulse delay-200" />
                  </div>
                  <span className="bg-black/60 backdrop-blur-sm text-[#00C9A7] text-[8px] font-mono px-2 py-0.5 rounded absolute top-2 right-2 flex items-center gap-1 border border-[#00C9A7]/30">
                    <span className="w-1 h-1 bg-[#00C9A7] rounded-full animate-ping" />
                    VISION AI
                  </span>
                </div>
              )}
            </div>

            {/* Remote Videos */}
            {remoteUsers.map(user => (
              <div key={user.uid} className="relative bg-[#111] rounded-xl overflow-hidden shadow-lg border border-white/10 aspect-video flex-1" style={{ minHeight: '200px' }}>
                {user.videoTrack ? (
                  <div id={`remote-${user.uid}`} className="w-full h-full object-cover" style={{ position: 'absolute', inset: 0 }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center min-h-[200px]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center text-white text-2xl font-bold">
                      {String(user.uid).charAt(0)}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-lg text-xs text-white">User {user.uid}</div>
              </div>
            ))}

            {remoteUsers.length === 0 && (
              <div className="hidden md:flex items-center justify-center bg-white/3 rounded-xl border border-dashed border-white/10">
                <div className="text-center p-6">
                  <span className="text-4xl block mb-2">👥</span>
                  <p className="text-white/40 text-sm">Waiting for others to join...</p>
                  <p className="text-white/20 text-xs mt-1">{channelName}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global Vision AI Text Overlay */}
        {visionPhrase && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-4">
            <div className="bg-[#1e1e32]/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-[#6C63FF]/50 shadow-[0_0_30px_rgba(108,99,255,0.4)] flex items-center gap-4">
              <span className="text-3xl animate-bounce">🤟</span>
              <div>
                <p className="text-[#00C9A7] text-[10px] font-bold uppercase tracking-wider mb-0.5">ISL Vision Translation</p>
                <p className="text-white font-bold text-xl">&quot;{visionPhrase}&quot;</p>
              </div>
              <span className="text-2xl ml-2 opacity-50">🔊</span>
            </div>
          </div>
        )}

        {/* Real-Time 3D ISL Avatar */}
        {callState === 'joined' && islEnabled && (
          <div className="absolute bottom-4 right-4 z-50 w-[220px] h-[300px] md:w-[280px] md:h-[380px] transition-all transform duration-500 ease-out animate-in slide-in-from-right-8 fade-in">
            <SignAvatarOverlay
              queue={islQueue}
              isProcessing={isProcessingCaption}
              onSignComplete={handleSignComplete}
              className="w-full h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
