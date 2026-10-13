'use client';

// SPARSH VoiceVision — Floating Accessible Control Component
// Displays real-time assistant state, last recognized transcript, spoken response,
// smart glasses camera preview, AI vision transcription, and polite ARIA live regions.

import React, { useState, useEffect, useRef } from 'react';
import { useVoiceAssistant, AssistantState } from './VoiceAssistantProvider';
import { TypedCommandInput } from './TypedCommandInput';
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  AlertCircle,
  Keyboard,
  X,
  VolumeX,
  Camera,
  Upload,
  Eye,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Wifi,
  Settings2,
  Copy,
  Check,
} from 'lucide-react';
import { fetchGlassesApi, getGlassesCaptureUrl } from '@/lib/voicevision/glassesApi';

export function VoiceAssistantControl() {
  const {
    state,
    transcript,
    lastResponse,
    errorMessage,
    lastCapturedImage,
    setLastCapturedImage,
    refreshCameraPreview,
    toggleListening,
    isAlwaysListening,
    toggleAlwaysListening,
    executeCommand,
    speak,
    stopAll,
    isSupported,
  } = useVoiceAssistant();

  // Explicit, controllable open state (fixes the bug where the tab couldn't be closed without refresh)
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'glasses'>('assistant');
  const [showTypedInput, setShowTypedInput] = useState<boolean>(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);
  const [visionTranscription, setVisionTranscription] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Smart Glasses Live Camera & Streaming State ──
  // Default isStreaming to false (On-Demand / Voice Snapshot Mode) to prevent Wi-Fi bandwidth choking & frame lag!
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [liveGlassesFrameUrl, setLiveGlassesFrameUrl] = useState<string>(getGlassesCaptureUrl());
  const [glassesIp, setGlassesIp] = useState<string>('http://10.157.174.6');
  const [tempGlassesIp, setTempGlassesIp] = useState<string>('http://10.157.174.6');
  const [showIpSettings, setShowIpSettings] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number>(98);
  const [isGlassesConnected, setIsGlassesConnected] = useState<boolean>(false);
  const [copiedTranscription, setCopiedTranscription] = useState<boolean>(false);

  // Listen for voice-triggered smart glasses snapshot events ("take image", "analyse in front of me")
  useEffect(() => {
    const handleVisionStart = () => {
      setIsOpen(true);
      setActiveTab('glasses');
      setIsAnalyzingImage(true);
    };

    const handleVisionResult = (e: any) => {
      const data = e.detail;
      setIsAnalyzingImage(false);
      if (data?.image_url) {
        setLiveGlassesFrameUrl(data.image_url);
        setLastCapturedImage(data.image_url);
      }
      if (data?.description || data?.text) {
        setVisionTranscription(data.description || data.text);
      }
    };

    window.addEventListener('sparsh:glasses-vision-start', handleVisionStart);
    window.addEventListener('sparsh:glasses-vision-result', handleVisionResult);

    return () => {
      window.removeEventListener('sparsh:glasses-vision-start', handleVisionStart);
      window.removeEventListener('sparsh:glasses-vision-result', handleVisionResult);
    };
  }, [setLastCapturedImage]);

  // Smart Glasses Live WiFi Feed & Status Management
  useEffect(() => {
    if (!isOpen || activeTab !== 'glasses') return;

    // Check connection & battery from backend
    fetchGlassesApi('status')
      .then((r) => r.json())
      .then((d) => {
        if (d.battery) setBatteryLevel(d.battery);
        setIsGlassesConnected(Boolean(d.connected));
        if (d.url) {
          setGlassesIp(d.url);
          setTempGlassesIp(d.url);
        }
      })
      .catch(() => {});

    // Periodic live preview refresh ONLY if user explicitly enabled continuous streaming
    if (isStreaming && !isAnalyzingImage) {
      const interval = setInterval(() => {
        setLiveGlassesFrameUrl(getGlassesCaptureUrl());
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab, isStreaming, isAnalyzingImage]);

  // Automatically open when user actively starts speaking or an action is triggered
  useEffect(() => {
    if (state === 'listening' || state === 'thinking') {
      setIsOpen(true);
    }
  }, [state]);

  // Support Escape key to close the modal immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setShowTypedInput(false);
    setShowIpSettings(false);
    if (state === 'speaking') {
      stopAll();
    }
  };

  const handleSaveGlassesIp = async () => {
    if (!tempGlassesIp.trim()) return;
    try {
      await fetchGlassesApi('config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tempGlassesIp.trim() }),
      });
      setGlassesIp(tempGlassesIp.trim());
      setShowIpSettings(false);
      setLiveGlassesFrameUrl(getGlassesCaptureUrl());
      speak('Updated smart glasses camera address.');
    } catch (err) {
      console.error('Error saving glasses IP:', err);
    }
  };

  const handleSnapAndTranscribe = async (mode: 'describe' | 'read' = 'describe') => {
    setIsAnalyzingImage(true);
    setActiveTab('glasses');
    speak(mode === 'read' ? 'Reading text through smart glasses.' : 'Analyzing scene through smart glasses.');

    try {
      const res = await fetchGlassesApi('vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: mode === 'read'
            ? 'Transcribe and read all visible text printed or handwritten on this page in front of me.'
            : 'Describe what is in front of me clearly and concisely for an inclusive learner.',
        }),
      });

      const data = await res.json();
      if (data.image_url) {
        setLastCapturedImage(data.image_url);
        setLiveGlassesFrameUrl(data.image_url);
      }
      const responseText = data.text || data.description || 'Processed camera frame.';
      setVisionTranscription(responseText);
      speak(responseText);
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      const errMsg = 'Could not connect to smart glasses vision service.';
      setVisionTranscription(errMsg);
      speak(errMsg);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const b64 = event.target?.result as string;
      if (!b64) return;

      setLastCapturedImage(b64);
      setIsAnalyzingImage(true);
      setActiveTab('glasses');
      speak('Analyzing uploaded photo with Ollama AI.');

      try {
        const res = await fetchGlassesApi('vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: b64,
            mode: 'describe',
            prompt: 'Transcribe any text and describe what is visible in this learning material for a student.',
          }),
        });

        const data = await res.json();
        const responseText = data.text || data.description || 'Transcribed image content.';
        setVisionTranscription(responseText);
        speak(responseText);
      } catch (err: any) {
        console.error('Image upload analysis error:', err);
        setVisionTranscription('Error analyzing uploaded image.');
        speak('Error analyzing uploaded image.');
      } finally {
        setIsAnalyzingImage(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-uploaded if desired
    e.target.value = '';
  };

  const getStateColor = (s: AssistantState) => {
    switch (s) {
      case 'listening':
        return 'from-rose-500 to-pink-600 border-pink-300 text-white shadow-rose-500/30';
      case 'thinking':
        return 'from-indigo-600 to-[#6C63FF] border-indigo-300 text-white shadow-indigo-500/30';
      case 'speaking':
        return 'from-[#00C9A7] to-emerald-600 border-emerald-300 text-white shadow-emerald-500/30';
      case 'error':
        return 'from-red-600 to-rose-700 border-red-300 text-white shadow-red-500/30';
      default:
        return 'from-[#6C63FF] to-[#00C9A7] border-white/20 text-white shadow-[#6C63FF]/20';
    }
  };

  return (
    <>
      {/* ── ARIA Live Polite Region for Screen Readers ── */}
      <div
        id="voicevision-aria-live"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {state === 'listening' && 'SPARSH is listening for your command.'}
        {state === 'thinking' && 'Processing your request.'}
        {state === 'speaking' && lastResponse && `SPARSH says: ${lastResponse}`}
        {errorMessage && `Notice: ${errorMessage}`}
      </div>

      {/* ── Floating VoiceVision Widget ── */}
      <aside
        aria-label="SPARSH VoiceVision Assistant Control"
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex flex-col items-start gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md select-none"
      >
        {/* Status / Response Modal Card (Guarded strictly by isOpen so it ALWAYS closes on clicking X) */}
        {isOpen && (
          <div className="glass-card w-84 sm:w-96 max-w-[calc(100vw-2rem)] p-4 rounded-2xl border-2 border-[#6C63FF]/70 bg-[#0f0c29]/95 text-white shadow-2xl backdrop-blur-2xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
            {/* Header with Navigation Tabs and Close Button */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('assistant')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === 'assistant'
                      ? 'bg-[#6C63FF] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00C9A7]" />
                  Assistant
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('glasses')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === 'glasses'
                      ? 'bg-[#00C9A7] text-black shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Glasses Vision
                </button>
              </div>

              {/* Action Buttons: Typed Input + Direct Close Button */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowTypedInput(!showTypedInput)}
                  className={`p-1.5 rounded-lg transition ${
                    showTypedInput
                      ? 'bg-[#6C63FF] text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  title="Toggle keyboard command terminal"
                  aria-label="Toggle keyboard command input"
                >
                  <Keyboard className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 text-white/70 hover:text-rose-400 rounded-lg hover:bg-rose-500/20 transition cursor-pointer"
                  title="Close Tab (Escape)"
                  aria-label="Close assistant card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 1: VOICE & ASSISTANT VIEW */}
            {activeTab === 'assistant' && (
              <div className="space-y-3">
                {/* State Indicator Badge */}
                <div className="flex items-center justify-between text-xs text-white/70 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        state === 'listening'
                          ? 'bg-rose-400 animate-ping'
                          : state === 'speaking'
                          ? 'bg-[#00C9A7] animate-pulse'
                          : state === 'thinking'
                          ? 'bg-indigo-400 animate-spin'
                          : 'bg-white/40'
                      }`}
                    />
                    <span className="font-semibold text-white/90">
                      {state === 'listening'
                        ? 'Listening for command...'
                        : state === 'speaking'
                        ? 'Speaking response...'
                        : state === 'thinking'
                        ? 'Thinking with Ollama AI...'
                        : 'Ready for voice or typed commands'}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">Alt+V</span>
                </div>

                {/* Error Notice */}
                {errorMessage && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Heard Transcript */}
                {transcript && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                      You Said:
                    </p>
                    <p className="text-xs sm:text-sm text-white font-medium bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10">
                      "{transcript}"
                    </p>
                  </div>
                )}

                {/* Spoken Response */}
                {lastResponse && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-[#00C9A7] uppercase tracking-wider font-bold flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" /> SPARSH AI Tutor:
                      </p>
                      {state === 'speaking' && (
                        <button
                          onClick={stopAll}
                          className="text-[10px] text-rose-300 hover:text-rose-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20"
                        >
                          <VolumeX className="w-2.5 h-2.5" /> Stop
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-white/95 leading-relaxed bg-[#6C63FF]/15 p-2.5 rounded-xl border border-[#6C63FF]/30 max-h-36 overflow-y-auto">
                      {lastResponse}
                    </p>
                  </div>
                )}

                {/* Quick Voice Command Chips */}
                <div className="pt-1 border-t border-white/10">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1.5">
                    Quick Voice Actions:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Describe Scene', cmd: 'describe what is in front of me' },
                      { label: 'Read Page', cmd: 'read this page' },
                      { label: 'Open Lessons', cmd: 'open lessons' },
                      { label: 'AI Tutor', cmd: 'open ai tutor' },
                    ].map((item) => (
                      <button
                        key={item.cmd}
                        onClick={() => executeCommand(item.cmd)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 hover:text-white transition cursor-pointer"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Typed Input Component */}
                {showTypedInput && (
                  <div className="pt-1 border-t border-white/10">
                    <TypedCommandInput showShortcuts={false} />
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SMART GLASSES & CAMERA AI TRANSCRIPTION VIEW */}
            {activeTab === 'glasses' && (
              <div className="space-y-3">
                {/* Smart Glasses Camera Title & Refresh Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white text-[12px] flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-[#00C9A7]" />
                      SPARSH Smart Glasses Camera
                    </span>
                  </div>

                  {/* Settings & Refresh Controls */}
                  <div className="flex items-center gap-1.5">
                    {/* Always-On Audio Listening Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleAlwaysListening()}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        isAlwaysListening
                          ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/20'
                          : 'bg-white/10 text-white/70 hover:text-white border border-white/10'
                      }`}
                      title="Toggle Always-On Audio: keep microphone listening continuously for 'take image' or 'analyse in front of me'"
                    >
                      <Mic className={`w-3 h-3 ${isAlwaysListening ? 'text-rose-400 animate-pulse' : 'text-white/60'}`} />
                      {isAlwaysListening ? 'Voice Always On' : 'Voice Standby'}
                    </button>

                    {/* Mode Toggle: Fast Voice Snap (Zero-Lag) vs Continuous Stream */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsStreaming(!isStreaming);
                        speak(!isStreaming ? 'Continuous camera stream enabled.' : 'Fast voice snapshot zero lag mode enabled.');
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
                        isStreaming
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                      title={isStreaming ? 'Polling every 2.5s (causes Wi-Fi lag)' : 'On-Demand Voice Snap (Zero lag)'}
                    >
                      {isStreaming ? 'Stream (2.5s)' : '⚡ Fast Snap (Zero-Lag)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLiveGlassesFrameUrl(getGlassesCaptureUrl());
                        speak('Refreshing glasses frame.');
                      }}
                      title="Refresh Live Camera Frame"
                      className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowIpSettings(!showIpSettings)}
                      title="Glasses Network Settings"
                      className={`p-1 rounded-lg transition cursor-pointer ${
                        showIpSettings ? 'bg-[#6C63FF] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Voice Trigger Guide Banner */}
                <div className="bg-gradient-to-r from-purple-500/15 via-teal-500/15 to-indigo-500/15 border border-white/15 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00C9A7] animate-ping" />
                    <span className="text-white/95 text-[11px]">
                      Just say: <span className="text-[#00C9A7] font-bold">"Take image"</span> or <span className="text-[#A5B4FC] font-bold">"Analyse in front of me"</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-white/60 bg-white/10 px-2 py-0.5 rounded-md font-mono">
                    {isAlwaysListening ? '🎙️ Mic Active' : 'Tap Voice to Start'}
                  </span>
                </div>

                {/* Optional IP Settings Drawer */}
                {showIpSettings && (
                  <div className="p-2.5 rounded-xl bg-black/60 border border-white/15 space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white/80 text-[11px]">Glasses ESP32 Address:</span>
                      <span className="text-[10px] text-[#00C9A7] font-mono">
                        {isGlassesConnected ? '● Online' : '○ Standby / Fallback'}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={tempGlassesIp}
                        onChange={(e) => setTempGlassesIp(e.target.value)}
                        placeholder="http://192.168.x.x or http://sparsh-glasses.local"
                        className="flex-1 bg-white/5 border border-white/15 px-2.5 py-1 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-[#6C63FF]"
                      />
                      <button
                        type="button"
                        onClick={handleSaveGlassesIp}
                        className="px-2.5 py-1 bg-[#6C63FF] hover:bg-[#5b52e0] text-white text-[11px] font-bold rounded-lg transition"
                      >
                        Save
                      </button>
                    </div>
                    <p className="text-[10px] text-white/50">
                      Default: <code className="text-[#A5B4FC]">http://10.157.174.6</code> or <code className="text-[#A5B4FC]">http://sparsh-glasses.local</code>
                    </p>
                  </div>
                )}

                {/* Live Camera Preview Box */}
                <div className="relative rounded-2xl overflow-hidden border-2 border-white/20 bg-black aspect-video max-h-52 flex items-center justify-center group shadow-2xl">
                  <img
                    src={lastCapturedImage || liveGlassesFrameUrl || '/glasses_demo_frame.jpg'}
                    alt="Glasses Camera Live View"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/glasses_demo_frame.jpg';
                    }}
                    className="w-full h-full object-contain bg-black"
                  />

                  {/* Real-Time Processing Scanline Overlay */}
                  {isAnalyzingImage && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white z-20">
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#00C9A7] to-transparent animate-bounce top-1/2" />
                      <Loader2 className="w-7 h-7 animate-spin text-[#00C9A7]" />
                      <span className="text-xs font-bold text-[#00C9A7]">Ollama AI Transcribing Vision Frame...</span>
                      <span className="text-[10px] text-white/60">Multimodal Llama 3.2 Analysis</span>
                    </div>
                  )}

                  {/* Top-Left Live Status Badge */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isGlassesConnected
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-[#00C9A7]'
                      }`}
                    />
                    <span className="font-semibold text-white/95">
                      {isGlassesConnected
                        ? 'Glasses Camera Stream'
                        : 'Glasses Camera Preview'}
                    </span>
                  </div>

                  {/* Top-Right Battery Badge */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 text-[10px] text-white/90">
                    <span>🔋</span>
                    <span className="font-mono">{batteryLevel}%</span>
                  </div>
                </div>

                {/* Glasses Control Buttons: Snap & Describe / Read Page */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isAnalyzingImage}
                    onClick={() => handleSnapAndTranscribe('describe')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-indigo-600 hover:from-indigo-500 hover:to-[#6C63FF] text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Snap & Describe
                  </button>

                  <button
                    type="button"
                    disabled={isAnalyzingImage}
                    onClick={() => handleSnapAndTranscribe('read')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#00C9A7] to-emerald-600 hover:from-emerald-500 hover:to-[#00C9A7] text-black text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Read Page / OCR
                  </button>
                </div>

                {/* Upload Any Picture for Transcription */}
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <span className="text-[11px] text-white/60">Upload photo/worksheet:</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzingImage}
                    className="flex items-center gap-1.5 text-xs text-[#38bdf8] hover:text-[#7dd3fc] font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    Upload Photo
                  </button>
                </div>

                {/* AI Transcription Result Box */}
                {(visionTranscription || lastResponse) && (
                  <div className="space-y-1 bg-black/50 p-3 rounded-xl border border-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#00C9A7] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI Transcription:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const textToCopy = visionTranscription || lastResponse || '';
                            if (textToCopy) {
                              navigator.clipboard?.writeText(textToCopy);
                              setCopiedTranscription(true);
                              setTimeout(() => setCopiedTranscription(false), 2000);
                            }
                          }}
                          className="text-[10px] text-white/60 hover:text-white flex items-center gap-1 cursor-pointer"
                          title="Copy text"
                        >
                          {copiedTranscription ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedTranscription ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => speak(visionTranscription || lastResponse || '')}
                          className="text-[10px] text-[#38bdf8] hover:text-[#7dd3fc] flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" /> Listen
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed max-h-32 overflow-y-auto">
                      {visionTranscription || lastResponse}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Main High-Contrast Floating Action Bar ── */}
        <div className="flex items-center gap-2">
          {/* Main VoiceVision Button */}
          <button
            id="voicevision-mic-toggle"
            onClick={() => {
              if (!isOpen) {
                setIsOpen(true);
              }
              toggleListening();
            }}
            aria-label={
              state === 'listening'
                ? 'Stop voice listening'
                : 'Start voice listening. Shortcut Alt plus V'
            }
            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-black transition-all border-2 bg-gradient-to-r transform hover:scale-105 active:scale-95 cursor-pointer ${getStateColor(
              state
            )}`}
          >
            {state === 'thinking' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : state === 'listening' ? (
              <>
                <Mic className="w-4 h-4 animate-bounce text-white" />
                <span>Listening...</span>
              </>
            ) : state === 'speaking' ? (
              <>
                <Volume2 className="w-4 h-4 animate-pulse text-white" />
                <span>Speaking...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>VoiceVision</span>
              </>
            )}
          </button>

          {/* Quick Toggle Keyboard / Open Panel Button */}
          <button
            id="voicevision-keyboard-toggle"
            type="button"
            onClick={() => {
              setIsOpen(!isOpen);
              setShowTypedInput(true);
              setActiveTab('assistant');
            }}
            aria-label="Open typed command terminal"
            title="Type command (Alt+T)"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#0f0c29]/90 hover:bg-white/10 border-2 border-white/20 flex items-center justify-center text-white/80 hover:text-white transition shadow-xl cursor-pointer"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Smart Glasses Quick Camera Snap Button */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setActiveTab('glasses');
              handleSnapAndTranscribe('describe');
            }}
            aria-label="Snap smart glasses camera view"
            title="Smart Glasses Camera View"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#00C9A7]/20 hover:bg-[#00C9A7]/30 border-2 border-[#00C9A7]/50 flex items-center justify-center text-[#00C9A7] transition shadow-xl cursor-pointer"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
