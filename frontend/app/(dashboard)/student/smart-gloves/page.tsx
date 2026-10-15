'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bluetooth,
  BluetoothOff,
  Wifi,
  WifiOff,
  Usb,
  Cpu,
  Zap,
  Activity,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Plus,
  Trash2,
  Copy,
  Terminal,
  Info,
  Layers,
  Sparkles,
  ArrowRight,
  Hand,
  Settings,
  HelpCircle,
  Eye,
  MessageSquare,
  Mic,
  MicOff,
} from 'lucide-react';

import {
  smartGloves,
  GloveStatus,
  GloveTransport,
  GloveTelemetry,
  GloveCalibrationConfig,
} from '@/lib/smartGloves';
import {
  gestureEngine,
  RecognitionResult,
  StaticGestureTemplate,
  GestureSampleData,
} from '@/lib/gestureEngine';
import { tokenizeForSigning, resolveToken } from '@/lib/isl/signMap';

// Dynamically import 3D ISL Avatar with SSR disabled
const SignAvatarOverlay = dynamic(
  () => import('@/components/live/SignAvatarOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/10 text-white/40">
        <Sparkles className="w-8 h-8 animate-spin text-[#6C63FF] mb-2" />
        <p className="text-xs">Loading 3D Sign Avatar...</p>
      </div>
    ),
  }
);

const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const;
const FINGER_COLORS = [
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-indigo-500',
  'from-pink-400 to-rose-500',
];

export default function SmartGlovesDashboard() {
  // ── Connection State ──
  const [status, setStatus] = useState<GloveStatus>('disconnected');
  const [transport, setTransport] = useState<GloveTransport>('none');
  const [telemetry, setTelemetry] = useState<GloveTelemetry | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [wifiHost, setWifiHost] = useState('127.0.0.1:8000');

  // ── Active View / Tabs ──
  const [activeTab, setActiveTab] = useState<
    'live' | 'communication' | 'calibration' | 'trainer' | 'hardware'
  >('live');

  // ── Gesture Recognition State ──
  const [currentRecognition, setCurrentRecognition] = useState<RecognitionResult | null>(null);
  const [confirmedGesture, setConfirmedGesture] = useState<RecognitionResult | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.65);
  const [holdDurationMs, setHoldDurationMs] = useState<number>(320);
  const [gestureHistory, setGestureHistory] = useState<
    Array<{ text: string; confidence: number; time: string; icon?: string }>
  >([]);

  // ── Sentence Composer & TTS ──
  const [composedSentence, setComposedSentence] = useState<string>('');
  const [isAutoSpeak, setIsAutoSpeak] = useState<boolean>(false);
  const [ttsPitch, setTtsPitch] = useState<number>(1.0);
  const [ttsRate, setTtsRate] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeakingNow, setIsSpeakingNow] = useState<boolean>(false);

  // ── Flow B: Avatar Two-Way Communication State ──
  const [avatarInputText, setAvatarInputText] = useState<string>('HELLO THANK YOU');
  const [avatarQueue, setAvatarQueue] = useState<string[]>([]);
  const [currentAvatarWord, setCurrentAvatarWord] = useState<string>('');
  const [avatarTokensAnalysis, setAvatarTokensAnalysis] = useState<
    Array<{ word: string; hasSign: boolean; confidence: number }>
  >([]);
  const [isListeningForSpeech, setIsListeningForSpeech] = useState<boolean>(false);

  // ── Guided Calibration State ──
  const [calStep, setCalStep] = useState<number>(1);
  const [calStraightReadings, setCalStraightReadings] = useState<number[]>([70, 70, 70, 70, 70]);
  const [calBentReadings, setCalBentReadings] = useState<number[]>([200, 200, 200, 200, 200]);
  const [calInverted, setCalInverted] = useState<boolean[]>([false, false, false, false, false]);
  const [calSaveSuccess, setCalSaveSuccess] = useState<boolean>(false);

  // ── Dataset & Training Studio State ──
  const [sampleLabel, setSampleLabel] = useState<string>('HELLO');
  const [samplesList, setSamplesList] = useState<GestureSampleData[]>([]);
  const [showAddCustomModal, setShowAddCustomModal] = useState<boolean>(false);
  const [customGestureName, setCustomGestureName] = useState<string>('');
  const [customGestureText, setCustomGestureText] = useState<string>('');

  // ── Web Speech Synthesis Initialization ──
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoice) {
          const defaultVoice =
            voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google')) ||
            voices.find((v) => v.lang.startsWith('en')) ||
            voices[0];
          setSelectedVoice(defaultVoice.name);
        }
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [selectedVoice]);

  // ── Smart Glove Manager Subscriptions ──
  useEffect(() => {
    const unsubStatus = smartGloves.onStatus((s, t) => {
      setStatus(s);
      setTransport(t);
    });

    const unsubLog = smartGloves.onLog((msg) => {
      setLogs((prev) => [msg, ...prev.slice(0, 49)]);
    });

    const unsubTelemetry = smartGloves.onTelemetry((t) => {
      setTelemetry(t);

      // Process temporal gesture recognition
      const result = gestureEngine.processTemporal(t.vector, (confirmed) => {
        setConfirmedGesture(confirmed);

        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setGestureHistory((prev) => [
          {
            text: confirmed.text,
            confidence: Math.round(confirmed.confidence * 100),
            time: timeStr,
            icon: confirmed.gesture?.icon || '✋',
          },
          ...prev.slice(0, 14),
        ]);

        // Auto append to sentence builder
        if (confirmed.text && !confirmed.isUnknown) {
          setComposedSentence((prev) => {
            const next = prev ? `${prev} ${confirmed.text}` : confirmed.text;
            return next;
          });

          // Auto-speak if enabled
          if (isAutoSpeak) {
            speakText(confirmed.text);
          }
        }
      });

      setCurrentRecognition(result);
    });

    // Load initial samples
    setSamplesList(gestureEngine.getSamples());

    return () => {
      unsubStatus();
      unsubLog();
      unsubTelemetry();
    };
  }, [isAutoSpeak]);

  // Sync engine settings
  useEffect(() => {
    gestureEngine.setConfidenceThreshold(confidenceThreshold);
    gestureEngine.setHoldDuration(holdDurationMs);
  }, [confidenceThreshold, holdDurationMs]);

  // ── Text-to-Speech Function ──
  const speakText = useCallback(
    (textToSpeak: string) => {
      if (!textToSpeak.trim()) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = ttsRate;
        utterance.pitch = ttsPitch;

        if (selectedVoice) {
          const v = availableVoices.find((x) => x.name === selectedVoice);
          if (v) utterance.voice = v;
        }

        utterance.onstart = () => setIsSpeakingNow(true);
        utterance.onend = () => setIsSpeakingNow(false);
        utterance.onerror = () => setIsSpeakingNow(false);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech synthesis error:', err);
        setIsSpeakingNow(false);
      }
    },
    [ttsRate, ttsPitch, selectedVoice, availableVoices]
  );

  // ── Two-Way Communication: Tokenize and Play to 3D Avatar ──
  const handlePlayToAvatar = useCallback(() => {
    if (!avatarInputText.trim()) return;

    const tokens = tokenizeForSigning(avatarInputText);
    const analysis = tokens.map((tok) => {
      const res = resolveToken(tok);
      return {
        word: tok,
        hasSign: res.confidence > 60,
        confidence: res.confidence,
      };
    });

    setAvatarTokensAnalysis(analysis);
    setAvatarQueue(tokens);
    setCurrentAvatarWord(tokens[0] || '');
  }, [avatarInputText]);

  // Handle Speech Recognition for Flow B (Speech -> Avatar)
  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    if (isListeningForSpeech) {
      setIsListeningForSpeech(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => setIsListeningForSpeech(true);
      rec.onresult = (ev: any) => {
        const transcript = ev.results[0][0].transcript;
        setAvatarInputText(transcript);
        setIsListeningForSpeech(false);
      };
      rec.onerror = () => setIsListeningForSpeech(false);
      rec.onend = () => setIsListeningForSpeech(false);

      rec.start();
    } catch (e) {
      console.error(e);
      setIsListeningForSpeech(false);
    }
  };

  // ── Guided Calibration Actions ──
  const recordStraightCalibration = () => {
    if (!telemetry) return;
    const raw = [
      telemetry.fingers.thumb.raw,
      telemetry.fingers.index.raw,
      telemetry.fingers.middle.raw,
      telemetry.fingers.ring.raw,
      telemetry.fingers.little.raw,
    ];
    setCalStraightReadings(raw);
    setCalStep(3);
  };

  const recordBentCalibration = () => {
    if (!telemetry) return;
    const raw = [
      telemetry.fingers.thumb.raw,
      telemetry.fingers.index.raw,
      telemetry.fingers.middle.raw,
      telemetry.fingers.ring.raw,
      telemetry.fingers.little.raw,
    ];
    setCalBentReadings(raw);

    // Auto-detect polarity inversion (if bent value is significantly lower than straight value)
    const inv = raw.map((bentVal, idx) => bentVal < calStraightReadings[idx]);
    setCalInverted(inv);
    setCalStep(4);
  };

  const handleSaveCalibration = async () => {
    const config: GloveCalibrationConfig = {
      straight: calStraightReadings as [number, number, number, number, number],
      bent: calBentReadings as [number, number, number, number, number],
      inverted: calInverted as [boolean, boolean, boolean, boolean, boolean],
      calibrated: true,
      updatedAt: new Date().toISOString(),
    };

    smartGloves.saveCalibration(config);

    // Sync to backend API as well
    try {
      await fetch('/api/smart-gloves/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch (err) {
      console.warn('Backend sync warning:', err);
    }

    setCalSaveSuccess(true);
    setTimeout(() => {
      setCalSaveSuccess(false);
      setCalStep(6);
    }, 1200);
  };

  // ── Dataset Sample Recorder ──
  const handleRecordSample = () => {
    if (!telemetry) return;
    const sample = gestureEngine.recordSample(
      sampleLabel,
      telemetry.vector,
      [
        telemetry.fingers.thumb.raw,
        telemetry.fingers.index.raw,
        telemetry.fingers.middle.raw,
        telemetry.fingers.ring.raw,
        telemetry.fingers.little.raw,
      ]
    );
    setSamplesList(gestureEngine.getSamples());
  };

  const handleDownloadCsv = () => {
    const csv = gestureEngine.exportSamplesAsCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sparsh_glove_dataset_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const json = gestureEngine.exportSamplesAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sparsh_glove_dataset_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddCustomTemplate = () => {
    if (!telemetry || !customGestureName.trim()) return;
    gestureEngine.addCustomTemplate({
      name: customGestureName.trim(),
      text: customGestureText.trim() || customGestureName.trim(),
      category: 'word',
      vector: [...telemetry.vector],
      tolerance: 0.28,
      description: `Custom pose created from live telemetry`,
      icon: '✨',
      enabled: true,
    });
    setShowAddCustomModal(false);
    setCustomGestureName('');
    setCustomGestureText('');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧤</span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              SPARSH AI Smart Gloves
            </h1>
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#6C63FF]/20 text-[#a29bfe] border border-[#6C63FF]/40">
              ESP32 Flex Module
            </span>
          </div>
          <p className="text-white/60 text-xs md:text-sm mt-1">
            Real-time 5-Finger Flex Telemetry • Bluetooth BLE &amp; Wi-Fi • Static &amp; Dynamic Gestures • 3D ISL Avatar
          </p>
        </div>

        {/* Global Connection Status Pill */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-md ${
              status === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                : status === 'simulated'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse'
                : status === 'connecting'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 animate-pulse'
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-400 animate-ping'
                  : status === 'simulated'
                  ? 'bg-amber-400'
                  : status === 'connecting'
                  ? 'bg-blue-400'
                  : 'bg-white/30'
              }`}
            />
            <span className="uppercase tracking-wider">
              {status === 'simulated' ? 'SIMULATOR ACTIVE' : status}
            </span>
            {transport !== 'none' && (
              <span className="text-[10px] uppercase font-bold text-white/50 bg-black/40 px-1.5 py-0.5 rounded">
                {transport}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Device Connection Bar ── */}
      <div className="glass-card p-4 rounded-2xl border border-white/10 bg-[#161626]/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bluetooth BLE Button */}
          <button
            onClick={() => smartGloves.connectBluetooth()}
            disabled={status === 'connecting'}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-50"
            title="Connect via Web Bluetooth (BLE Nordic UART)"
          >
            <Bluetooth className="w-4 h-4 text-blue-400" />
            <span>Connect Bluetooth (BLE)</span>
          </button>

          {/* Wi-Fi Button */}
          <button
            onClick={() => smartGloves.connectWiFi(wifiHost)}
            disabled={status === 'connecting'}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 disabled:opacity-50"
            title="Connect via Wi-Fi WebSocket"
          >
            <Wifi className="w-4 h-4 text-purple-400" />
            <span>Connect Wi-Fi</span>
          </button>

          {/* USB Serial Button */}
          <button
            onClick={() => smartGloves.connectSerial()}
            disabled={status === 'connecting'}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-50"
            title="Connect via USB Serial (115200 Baud)"
          >
            <Usb className="w-4 h-4 text-emerald-400" />
            <span>USB Serial</span>
          </button>

          {/* Interactive Simulator Toggle Button */}
          <button
            onClick={() => {
              if (status === 'simulated') {
                smartGloves.disconnect();
              } else {
                smartGloves.startSimulator();
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
              status === 'simulated'
                ? 'bg-amber-500 text-black border border-amber-400'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
            }`}
            title="Toggle Synthetic 5-Channel Simulator"
          >
            <Sparkles className="w-4 h-4" />
            <span>{status === 'simulated' ? 'Stop Simulator' : 'Test Simulator (Demo)'}</span>
          </button>

          {/* Disconnect Control */}
          {(status === 'connected' || status === 'simulated' || status === 'connecting') && (
            <button
              onClick={() => smartGloves.disconnect()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>

        {/* Live Metrics Quick Badges */}
        <div className="flex items-center gap-3 text-xs text-white/60">
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Activity className="w-3.5 h-3.5 text-[#00C9A7]" />
            <span>
              Sampling: <strong className="text-white">{telemetry?.sampleRateHz || 0} Hz</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Layers className="w-3.5 h-3.5 text-[#6C63FF]" />
            <span>
              Seq: <strong className="text-white">#{telemetry?.seq || 0}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Calibrated:{' '}
              <strong className={telemetry?.calibrated ? 'text-emerald-400' : 'text-amber-400'}>
                {telemetry?.calibrated ? 'YES' : 'DEFAULT'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Simulator Preset Drawer (Only shown when Simulator is active) ── */}
      {status === 'simulated' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧪</span>
              <h4 className="text-sm font-bold text-amber-300">
                Interactive Flex Hardware Simulator
              </h4>
              <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full border border-amber-500/30">
                SYNTHETIC DATA WITH REALISTIC MICRO-TREMOR
              </span>
            </div>
            <p className="text-xs text-white/50">
              Click any sign preset or drag finger sliders to test real-time recognition.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/50 font-semibold mr-1">Quick Poses:</span>
            {[
              { id: 'open', label: 'Open Hand (Hello)', icon: '👋' },
              { id: 'fist', label: 'Fist (Yes)', icon: '✊' },
              { id: 'peace', label: 'Peace / V', icon: '✌️' },
              { id: 'ok', label: 'OK Sign', icon: '👌' },
              { id: 'iloveyou', label: 'I Love You', icon: '🤟' },
              { id: 'point', label: 'Point / Look', icon: '👉' },
              { id: 'water', label: 'Water (W)', icon: '💧' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => smartGloves.setSimulatorPreset(p.id as any)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition active:scale-95 flex items-center gap-1.5"
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Individual Finger Sliders */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {FINGER_NAMES.map((name, idx) => {
              const currentVal = telemetry ? telemetry.vector[idx] : 0;
              return (
                <div key={name} className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-white/70">
                    <span>{name}</span>
                    <span className="text-amber-400 font-mono">{Math.round(currentVal * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={currentVal}
                    onChange={(e) =>
                      smartGloves.setSimulatorFinger(idx as any, parseFloat(e.target.value))
                    }
                    className="w-full accent-amber-400 h-1.5 bg-white/20 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-white/30">
                    <span>Straight</span>
                    <span>Curled</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'live', label: 'Live Telemetry & Recognizer', icon: Activity },
          { id: 'communication', label: 'Two-Way Communication Hub', icon: MessageSquare },
          { id: 'calibration', label: 'Guided Calibration Wizard', icon: Sliders },
          { id: 'trainer', label: 'Gesture Trainer & Datasets', icon: Layers },
          { id: 'hardware', label: 'ESP32 Hardware & Circuit', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white shadow-lg shadow-[#6C63FF]/30'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: LIVE TELEMETRY & HAND VISUALIZER                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Column: 5-Finger Anatomical Visualizer (7 cols) ── */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Hand className="w-5 h-5 text-[#00C9A7]" />
                  <h3 className="text-white font-bold text-base">
                    5-Channel Flex Sensor Visualizer
                  </h3>
                </div>
                <span className="text-xs text-white/40">ESP32 ADC1 (12-bit, 0..4095)</span>
              </div>

              {/* Hand Graphic / Anatomical Representation */}
              <div className="p-4 bg-gradient-to-b from-[#10101c] to-[#18182a] rounded-2xl border border-white/5 relative overflow-hidden flex flex-col items-center">
                {/* Visual Bars for all 5 fingers */}
                <div className="w-full grid grid-cols-5 gap-3 text-center pt-2 pb-4">
                  {FINGER_NAMES.map((name, idx) => {
                    const fingerKey = name.toLowerCase() as keyof NonNullable<typeof telemetry>['fingers'];
                    const finger = telemetry?.fingers[fingerKey];
                    const pct = finger ? finger.percentage : 0;
                    const raw = finger ? finger.raw : 0;
                    const state = finger ? finger.state : 'straight';

                    return (
                      <div key={name} className="flex flex-col items-center space-y-2">
                        {/* Finger name & state badge */}
                        <span className="text-[11px] font-bold text-white/80">{name}</span>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                            state === 'bent'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : state === 'partial'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {state}
                        </span>

                        {/* Vertical Flex Height Gauge */}
                        <div className="w-12 h-44 bg-white/5 rounded-2xl border border-white/10 p-1 flex flex-col justify-end relative overflow-hidden shadow-inner">
                          <motion.div
                            className={`w-full rounded-xl bg-gradient-to-t ${FINGER_COLORS[idx]}`}
                            style={{ height: `${pct}%` }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          />
                          {/* Inner Percentage Marker */}
                          <div className="absolute inset-x-0 bottom-2 text-center pointer-events-none">
                            <span className="text-[11px] font-black text-white drop-shadow-md">
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Raw ADC Counts */}
                        <div className="text-center font-mono">
                          <span className="text-[10px] text-white/40 block">ADC Raw</span>
                          <span className="text-xs font-bold text-white/90">
                            {telemetry ? raw : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!telemetry && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                    <Hand className="w-12 h-12 text-white/20 mb-3 animate-pulse" />
                    <h4 className="text-white font-bold text-base">No Glove Telemetry</h4>
                    <p className="text-white/50 text-xs max-w-sm mt-1">
                      Connect via Bluetooth (BLE), Wi-Fi, USB Serial, or launch the Demo Simulator to begin receiving 5-channel data.
                    </p>
                  </div>
                )}
              </div>

              {/* Channel Diagnostics List */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {[
                  { pin: 'GPIO 34', finger: 'Thumb' },
                  { pin: 'GPIO 35', finger: 'Index' },
                  { pin: 'GPIO 32', finger: 'Middle' },
                  { pin: 'GPIO 33', finger: 'Ring' },
                  { pin: 'GPIO 36', finger: 'Little' },
                ].map((item, i) => (
                  <div
                    key={item.pin}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between text-xs"
                  >
                    <span className="text-[10px] font-mono text-white/40">{item.pin}</span>
                    <span className="font-bold text-white/90">{item.finger}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">ADC1 OK</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Gesture Recognition Panel ── */}
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-white font-bold text-base">
                    Real-Time Gesture Matcher
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/40">Threshold:</span>
                  <span className="font-bold text-amber-300">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>
              </div>

              {/* Current Match Display */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-[#6C63FF]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#6C63FF]/20 border border-[#6C63FF]/40 flex items-center justify-center text-3xl shrink-0">
                    {currentRecognition?.isUnknown
                      ? '❓'
                      : currentRecognition?.gesture?.icon || '✋'}
                  </div>
                  <div>
                    <span className="text-xs text-white/40 uppercase tracking-wider block font-semibold">
                      Recognized Sign
                    </span>
                    <h2 className="text-2xl font-black text-white">
                      {currentRecognition?.isUnknown
                        ? 'Unknown Gesture'
                        : currentRecognition?.text}
                    </h2>
                    <p className="text-xs text-white/50 mt-0.5">
                      {currentRecognition?.gesture?.description ||
                        'Move hand into a trained sign pose'}
                    </p>
                  </div>
                </div>

                {/* Match Confidence Gauge */}
                <div className="flex flex-col items-center sm:items-end">
                  <span className="text-xs text-white/40">Confidence</span>
                  <span
                    className={`text-2xl font-black ${
                      (currentRecognition?.confidence || 0) >= 0.8
                        ? 'text-emerald-400'
                        : (currentRecognition?.confidence || 0) >= 0.65
                        ? 'text-amber-400'
                        : 'text-white/30'
                    }`}
                  >
                    {Math.round((currentRecognition?.confidence || 0) * 100)}%
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    Euclidean dist: {currentRecognition?.distance || '1.0'}
                  </span>
                </div>
              </div>

              {/* Engine Tuning Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                  <div className="flex justify-between text-xs text-white/70">
                    <span>Min. Confidence Threshold</span>
                    <span className="font-bold text-[#00C9A7]">
                      {Math.round(confidenceThreshold * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="0.9"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full accent-[#00C9A7] h-1.5 bg-white/20 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-white/40 block">
                    Higher = fewer false positives, requires exact hand shape
                  </span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                  <div className="flex justify-between text-xs text-white/70">
                    <span>Hold Debounce Time</span>
                    <span className="font-bold text-[#6C63FF]">{holdDurationMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="800"
                    step="50"
                    value={holdDurationMs}
                    onChange={(e) => setHoldDurationMs(parseInt(e.target.value, 10))}
                    className="w-full accent-[#6C63FF] h-1.5 bg-white/20 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-white/40 block">
                    Duration hand must hold pose to confirm recognition
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Sentence Builder, TTS, & History (5 cols) ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Sentence Composer Card */}
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-[#6C63FF]" />
                  <h3 className="text-white font-bold text-base">Sentence Composer &amp; TTS</h3>
                </div>
                <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAutoSpeak}
                    onChange={(e) => setIsAutoSpeak(e.target.checked)}
                    className="accent-[#6C63FF] rounded"
                  />
                  <span>Auto-Speak</span>
                </label>
              </div>

              {/* Composed Sentence Text Box */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 min-h-[90px] flex flex-col justify-between">
                <p className="text-white text-base md:text-lg font-bold leading-relaxed">
                  {composedSentence || (
                    <span className="text-white/30 italic">
                      Perform glove gestures to compose a sentence here...
                    </span>
                  )}
                </p>
                <div className="flex justify-end gap-1.5 pt-2">
                  <button
                    onClick={() => {
                      if (composedSentence) navigator.clipboard.writeText(composedSentence);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
                    title="Copy text"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setComposedSentence((prev) => {
                        const words = prev.trim().split(' ');
                        words.pop();
                        return words.join(' ');
                      });
                    }}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold hover:text-white transition"
                    title="Backspace last word"
                  >
                    ⌫ Word
                  </button>
                  <button
                    onClick={() => setComposedSentence('')}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-red-400 hover:text-red-300 transition"
                    title="Clear sentence"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* TTS Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => speakText(composedSentence)}
                  disabled={!composedSentence.trim() || isSpeakingNow}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-xs md:text-sm shadow-md shadow-[#6C63FF]/30 active:scale-95 disabled:opacity-50 transition"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isSpeakingNow ? 'Speaking...' : 'Speak Full Sentence'}</span>
                </button>

                {currentRecognition?.text && !currentRecognition.isUnknown && (
                  <button
                    onClick={() => speakText(currentRecognition.text)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition active:scale-95"
                    title="Speak current gesture word"
                  >
                    Speak &quot;{currentRecognition.text}&quot;
                  </button>
                )}
              </div>

              {/* Voice & Speech Tuning */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                <div>
                  <span className="text-white/50 block text-[11px] mb-1">Voice</span>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-white/5 text-white border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.name} value={v.name} className="bg-[#1e1e32] text-white">
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-white/50 block text-[11px] mb-1">
                    Rate: {ttsRate}x • Pitch: {ttsPitch}x
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.1"
                      value={ttsRate}
                      onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                      className="w-full accent-[#6C63FF] h-1.5 bg-white/20 rounded-lg"
                      title="Speech Rate"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recognition History Card */}
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">Recognition History</h3>
                <button
                  onClick={() => setGestureHistory([])}
                  className="text-[11px] text-white/40 hover:text-white transition"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {gestureHistory.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-6 italic">
                    Recognized gestures will appear here as you sign.
                  </p>
                ) : (
                  gestureHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs hover:bg-white/10 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.icon || '✋'}</span>
                        <span className="font-bold text-white">{item.text}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-mono text-[11px] font-bold">
                          {item.confidence}%
                        </span>
                        <span className="text-white/30 text-[10px]">{item.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: TWO-WAY COMMUNICATION HUB                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'communication' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Side: Flow A (Glove Gesture to Speech) ── */}
          <div className="lg:col-span-6 space-y-5">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-xs">
                  FLOW A
                </span>
                <h3 className="text-white font-bold text-base">
                  Sign Gesture → Spoken Speech
                </h3>
              </div>

              <p className="text-xs text-white/60">
                1. Perform a gesture using your physical smart glove or the simulator.
                <br />
                2. SPARSH normalizes the flex readings and resolves the gesture.
                <br />
                3. The recognized word is vocalized aloud using speech synthesis.
              </p>

              {/* Live Gesture Card in Flow A */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-white/40 block">Live Glove Sign:</span>
                  <p className="text-xl font-bold text-white mt-1">
                    {currentRecognition?.isUnknown
                      ? 'Hold hand in sign pose...'
                      : currentRecognition?.text}
                  </p>
                </div>
                <button
                  onClick={() =>
                    currentRecognition?.text && speakText(currentRecognition.text)
                  }
                  disabled={!currentRecognition?.text || currentRecognition.isUnknown}
                  className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-xs font-bold transition disabled:opacity-30"
                >
                  <Volume2 className="w-4 h-4 inline mr-1" />
                  Speak Sign
                </button>
              </div>

              {/* Accumulated Sentence */}
              <div className="space-y-2">
                <span className="text-xs text-white/60 font-semibold">
                  Glove Conversation Stream:
                </span>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-white min-h-[70px]">
                  {composedSentence || (
                    <span className="text-white/30 italic text-xs">
                      Sentence is currently empty. Hold glove gestures to add words.
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => speakText(composedSentence)}
                    disabled={!composedSentence.trim()}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md disabled:opacity-40"
                  >
                    Speak Full Stream
                  </button>
                  <button
                    onClick={() => setComposedSentence('')}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Side: Flow B (Speech/Text to 3D Sign Avatar) ── */}
          <div className="lg:col-span-6 space-y-5">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                  FLOW B
                </span>
                <h3 className="text-white font-bold text-base">
                  Speech / Text → 3D Sign Avatar
                </h3>
              </div>

              {/* Input for Avatar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Enter text or speak into microphone:</span>
                  <button
                    onClick={toggleSpeechRecognition}
                    className={`flex items-center gap-1 font-semibold ${
                      isListeningForSpeech ? 'text-red-400 animate-pulse' : 'text-[#00C9A7]'
                    }`}
                  >
                    {isListeningForSpeech ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isListeningForSpeech ? 'Listening...' : 'Voice Input'}</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={avatarInputText}
                    onChange={(e) => setAvatarInputText(e.target.value)}
                    placeholder="Type words (e.g. HELLO, THANK YOU, WATER)..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#00C9A7]"
                  />
                  <button
                    onClick={handlePlayToAvatar}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00C9A7] to-teal-600 text-white font-bold text-xs md:text-sm shadow-md active:scale-95"
                  >
                    <Play className="w-4 h-4 inline mr-1" />
                    Play Signs
                  </button>
                </div>
              </div>

              {/* Honest Reporting of Signs vs Procedural Sign */}
              {avatarTokensAnalysis.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {avatarTokensAnalysis.map((tok, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        tok.hasSign
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                      title={
                        tok.hasSign
                          ? 'Predefined anatomical animation'
                          : 'Synthesized procedural gesture'
                      }
                    >
                      {tok.word}{' '}
                      {tok.hasSign ? '✓' : '(procedural)'}
                    </span>
                  ))}
                </div>
              )}

              {/* Embedded 3D ISL Avatar View */}
              <div className="w-full h-80 rounded-2xl overflow-hidden bg-gradient-to-b from-[#141424] to-[#0c0c18] border border-white/10 relative">
                <SignAvatarOverlay
                  queue={avatarQueue}
                  onSignComplete={(finishedWord) => {
                    setAvatarQueue((prev) => {
                      const next = prev.slice(1);
                      setCurrentAvatarWord(next[0] || '');
                      return next;
                    });
                  }}
                  className="w-full h-full"
                />

                {/* Overlay Badge for Current Sign */}
                {currentAvatarWord && (
                  <div className="absolute bottom-3 inset-x-3 p-2 bg-black/70 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#00C9A7] animate-spin" />
                      <span className="text-white/60">Now Signing:</span>
                      <strong className="text-white uppercase">{currentAvatarWord}</strong>
                    </div>
                    <span className="text-white/40 text-[10px]">
                      {avatarQueue.length} remaining
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: GUIDED 6-STEP CALIBRATION WIZARD                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'calibration' && (
        <div className="max-w-4xl mx-auto glass-card p-6 md:p-8 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">
                Guided Flex Sensor Calibration Wizard
              </h2>
              <p className="text-xs text-white/50 mt-1">
                Calibrate straight and bent endpoints to achieve precise 0.0–1.0 normalization with automatic inverted polarity handling.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#6C63FF]/20 text-[#a29bfe] font-bold text-xs self-start md:self-auto">
              Step {calStep} of 6
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-6 gap-2">
            {[
              '1. Device Check',
              '2. Open Hand',
              '3. Bent Hand',
              '4. Validate',
              '5. Save & Sync',
              '6. Test Live',
            ].map((stepName, i) => (
              <div
                key={stepName}
                className={`text-center py-2 px-1 rounded-xl text-[10px] md:text-xs font-bold transition-all ${
                  calStep === i + 1
                    ? 'bg-[#6C63FF] text-white shadow-md shadow-[#6C63FF]/30'
                    : calStep > i + 1
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 text-white/30'
                }`}
              >
                {stepName}
              </div>
            ))}
          </div>

          {/* STEP 1: Device Check */}
          {calStep === 1 && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Step 1: Sensor Signal Verification
              </h3>
              <p className="text-xs text-white/60">
                Ensure all 5 flex sensor channels are actively producing analog ADC values (typically below 100 straight, up to 200 when bent).
              </p>

              <div className="grid grid-cols-5 gap-3 pt-2">
                {FINGER_NAMES.map((name, i) => {
                  const raw = telemetry
                    ? telemetry.fingers[name.toLowerCase() as keyof NonNullable<typeof telemetry>['fingers']].raw
                    : 0;
                  const isValid = raw > 10 && raw < 4000;
                  return (
                    <div key={name} className="p-3 bg-black/40 rounded-xl border border-white/5 text-center space-y-1">
                      <span className="text-xs font-semibold text-white/70 block">{name}</span>
                      <span className="text-lg font-mono font-bold text-white">{raw || '—'}</span>
                      <span className={`text-[10px] block font-bold ${isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isValid ? 'Signal OK' : 'Checking...'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  onClick={() => {
                    const lowCal = {
                      straight: [70, 70, 70, 70, 70] as [number, number, number, number, number],
                      bent: [200, 200, 200, 200, 200] as [number, number, number, number, number],
                      inverted: [false, false, false, false, false] as [boolean, boolean, boolean, boolean, boolean],
                      calibrated: true,
                      updatedAt: new Date().toISOString()
                    };
                    smartGloves.saveCalibration(lowCal);
                    setCalStraightReadings([70, 70, 70, 70, 70]);
                    setCalBentReadings([200, 200, 200, 200, 200]);
                    setCalSaveSuccess(true);
                    setCalStep(6);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-2"
                >
                  <Sliders className="w-4 h-4" /> Quick Set: Low-Range (&lt;100 to 200)
                </button>
                <button
                  onClick={() => setCalStep(2)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-xs md:text-sm shadow-md"
                >
                  Proceed to Open Hand →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Open-Hand Calibration */}
          {calStep === 2 && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Hand className="w-5 h-5 text-blue-400" />
                Step 2: Record Open Hand Baseline (Straight Fingers)
              </h3>
              <p className="text-xs text-white/60">
                Hold your hand in a relaxed, flat, open position. All five fingers should be extended straight. When steady, click Record Baseline.
              </p>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-300 font-semibold block">Live Raw Snapshot:</span>
                  <span className="text-sm font-mono text-white font-bold mt-1 block">
                    Thumb: {telemetry?.fingers.thumb.raw || 0} • Index: {telemetry?.fingers.index.raw || 0} • Middle: {telemetry?.fingers.middle.raw || 0} • Ring: {telemetry?.fingers.ring.raw || 0} • Little: {telemetry?.fingers.little.raw || 0}
                  </span>
                </div>
                <button
                  onClick={recordStraightCalibration}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md active:scale-95 transition"
                >
                  Capture Straight Baseline
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Bent-Finger Calibration */}
          {calStep === 3 && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-400" />
                Step 3: Record Bent Hand Position (Curled Fingers)
              </h3>
              <p className="text-xs text-white/60">
                Curl all five fingers into a firm closed fist. Hold the bent position steadily, then click Capture Bent Position.
              </p>

              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-purple-300 font-semibold block">Live Raw Snapshot:</span>
                  <span className="text-sm font-mono text-white font-bold mt-1 block">
                    Thumb: {telemetry?.fingers.thumb.raw || 0} • Index: {telemetry?.fingers.index.raw || 0} • Middle: {telemetry?.fingers.middle.raw || 0} • Ring: {telemetry?.fingers.ring.raw || 0} • Little: {telemetry?.fingers.little.raw || 0}
                  </span>
                </div>
                <button
                  onClick={recordBentCalibration}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md active:scale-95 transition"
                >
                  Capture Bent Position
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Validation */}
          {calStep === 4 && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                Step 4: Calibration Validation &amp; Polarity Check
              </h3>
              <p className="text-xs text-white/60">
                Review the recorded values. The system automatically detects inverted sensor polarity (when bending lowers ADC values).
              </p>

              <div className="space-y-2">
                {FINGER_NAMES.map((name, i) => {
                  const s = calStraightReadings[i];
                  const b = calBentReadings[i];
                  const delta = Math.abs(b - s);
                  const isInv = calInverted[i];
                  const isHealthy = delta >= 25;

                  return (
                    <div
                      key={name}
                      className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white w-16">{name}</span>
                        <span className="text-white/60 font-mono">
                          Straight: <strong className="text-white">{s}</strong> → Bent:{' '}
                          <strong className="text-white">{b}</strong> (Δ {delta})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isInv && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                            Inverted Polarity
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isHealthy
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {isHealthy ? 'Valid Delta' : 'Delta Low (<25)'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setCalStep(2)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white text-xs"
                >
                  ← Re-record
                </button>
                <button
                  onClick={() => setCalStep(5)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-xs shadow-md"
                >
                  Confirm &amp; Proceed to Save →
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Save & Sync */}
          {calStep === 5 && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 text-center">
              <h3 className="text-base font-bold text-white">Step 5: Save Calibration Profile</h3>
              <p className="text-xs text-white/60 max-w-md mx-auto">
                Save these baselines to local browser storage and sync them to your SPARSH student profile on the backend server.
              </p>

              <button
                onClick={handleSaveCalibration}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 active:scale-95 transition"
              >
                {calSaveSuccess ? 'Saved Successfully! ✓' : 'Save Calibration Profile'}
              </button>
            </div>
          )}

          {/* STEP 6: Test Live Normalization */}
          {calStep === 6 && (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Step 6: Real-Time Normalized Test
              </h3>
              <p className="text-xs text-white/60">
                Your calibration profile is active! Flex your fingers and observe that straight fingers reach 0% and curled fingers reach 100%.
              </p>

              <div className="grid grid-cols-5 gap-3 pt-2">
                {FINGER_NAMES.map((name, i) => {
                  const finger = telemetry?.fingers[name.toLowerCase() as keyof NonNullable<typeof telemetry>['fingers']];
                  const pct = finger ? finger.percentage : 0;
                  return (
                    <div key={name} className="p-3 bg-black/40 rounded-xl border border-white/5 text-center space-y-2">
                      <span className="text-xs font-semibold text-white/70">{name}</span>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-75"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setActiveTab('live')}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-xs md:text-sm shadow-md"
                >
                  Complete &amp; Return to Dashboard →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: GESTURE TRAINER & DATASET STUDIO                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trainer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Column: Sample Recorder & Dataset Controls ── */}
          <div className="lg:col-span-7 space-y-5">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#6C63FF]" />
                  <h3 className="text-white font-bold text-base">
                    Labelled Dataset Capture Studio
                  </h3>
                </div>
                <span className="text-xs text-white/40">{samplesList.length} Samples</span>
              </div>

              <p className="text-xs text-white/60">
                Hold a specific hand sign, assign a gesture label, and capture snapshot telemetry.
                Collected datasets can be exported to CSV or JSON for training machine learning models or defining custom templates.
              </p>

              {/* Sample Capture Bar */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sampleLabel}
                    onChange={(e) => setSampleLabel(e.target.value)}
                    placeholder="Gesture Label (e.g. HELLO, A, WATER)..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs md:text-sm text-white uppercase font-bold focus:outline-none focus:border-[#6C63FF]"
                  />
                  <button
                    onClick={handleRecordSample}
                    disabled={!telemetry}
                    className="px-5 py-2.5 rounded-xl bg-[#6C63FF] hover:bg-[#5b52e0] text-white font-bold text-xs md:text-sm shadow-md active:scale-95 disabled:opacity-50 transition"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Record Sample
                  </button>
                </div>

                {/* Current Vector Preview */}
                <div className="text-[11px] font-mono text-white/50 bg-black/30 p-2 rounded-lg">
                  Vector Snapshot: [
                  {telemetry?.vector.map((v) => v.toFixed(2)).join(', ') || '0, 0, 0, 0, 0'}]
                </div>
              </div>

              {/* Dataset Export Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadCsv}
                    disabled={samplesList.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 disabled:opacity-40 transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    disabled={samplesList.length === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 disabled:opacity-40 transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    gestureEngine.clearSamples();
                    setSamplesList([]);
                  }}
                  disabled={samplesList.length === 0}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                >
                  Clear Dataset
                </button>
              </div>

              {/* Recorded Samples Table */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {samplesList.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-6 italic">
                    No samples recorded yet. Enter a label and click &quot;Record Sample&quot;.
                  </p>
                ) : (
                  samplesList.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <span className="font-bold text-white font-sans">{s.label}</span>
                      <span className="text-white/50 text-[11px]">
                        [{s.vector.map((v) => v.toFixed(2)).join(', ')}]
                      </span>
                      <span className="text-white/30 text-[10px]">
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right Column: Template Library & Custom Gestures ── */}
          <div className="lg:col-span-5 space-y-5">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-white font-bold text-base">Active Gesture Library</h3>
                <button
                  onClick={() => setShowAddCustomModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30 text-xs font-bold hover:bg-[#00C9A7]/30 transition"
                >
                  + Add Custom Sign
                </button>
              </div>

              {/* Templates List */}
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {gestureEngine.getTemplates().map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">{tpl.icon || '✋'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{tpl.name}</span>
                          <span className="text-[10px] text-white/40 uppercase bg-black/40 px-1.5 py-0.5 rounded">
                            {tpl.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 mt-0.5">{tpl.description}</p>
                        <span className="text-[10px] font-mono text-[#a29bfe] block mt-1">
                          Ref: [{tpl.vector.join(', ')}]
                        </span>
                      </div>
                    </div>
                    {tpl.id.startsWith('custom_') && (
                      <button
                        onClick={() => {
                          gestureEngine.deleteCustomTemplate(tpl.id);
                          gestureEngine.loadTemplates();
                        }}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Delete custom template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: ESP32 HARDWARE & CIRCUIT DIAGNOSTICS                            */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hardware' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left Column: ESP32 ADC Pinout Table & Schematics ── */}
          <div className="lg:col-span-7 space-y-5">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h3 className="text-white font-bold text-base">
                  ESP32 ADC1 Pin Mapping &amp; Voltage Divider
                </h3>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
                <strong>CRITICAL HARDWARE CONSTRAINT:</strong>
                <p>
                  On the classic ESP32-WROOM-32, <strong>ADC2 pins are disabled</strong> whenever Wi-Fi or Bluetooth BLE is actively transmitting.
                  Therefore, all 5 flex sensors <strong>MUST</strong> connect exclusively to <strong>ADC1 pins</strong> (GPIO 32, 33, 34, 35, 36).
                </p>
              </div>

              {/* Pin Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="py-2.5 px-3">Finger</th>
                      <th className="py-2.5 px-3">ESP32 Pin</th>
                      <th className="py-2.5 px-3">ADC Channel</th>
                      <th className="py-2.5 px-3">Pin Type</th>
                      <th className="py-2.5 px-3">Circuit Junction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-white/80">
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">Thumb</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GPIO 34</td>
                      <td className="py-2.5 px-3 font-mono">ADC1_CH6</td>
                      <td className="py-2.5 px-3 text-white/50">Input Only</td>
                      <td className="py-2.5 px-3">Flex 1 + 10kΩ GND</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">Index</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GPIO 35</td>
                      <td className="py-2.5 px-3 font-mono">ADC1_CH7</td>
                      <td className="py-2.5 px-3 text-white/50">Input Only</td>
                      <td className="py-2.5 px-3">Flex 2 + 10kΩ GND</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">Middle</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GPIO 32</td>
                      <td className="py-2.5 px-3 font-mono">ADC1_CH4</td>
                      <td className="py-2.5 px-3 text-white/50">RTC / GPIO</td>
                      <td className="py-2.5 px-3">Flex 3 + 10kΩ GND</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">Ring</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GPIO 33</td>
                      <td className="py-2.5 px-3 font-mono">ADC1_CH5</td>
                      <td className="py-2.5 px-3 text-white/50">RTC / GPIO</td>
                      <td className="py-2.5 px-3">Flex 4 + 10kΩ GND</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-white">Little (Pinky)</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">GPIO 36</td>
                      <td className="py-2.5 px-3 font-mono">ADC1_CH0 (VP)</td>
                      <td className="py-2.5 px-3 text-white/50">Input Only</td>
                      <td className="py-2.5 px-3">Flex 5 + 10kΩ GND</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Voltage Divider Schematic Explanation */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <span className="text-xs font-bold text-white block">
                  Voltage Divider Schematic (Per Finger):
                </span>
                <pre className="text-[11px] font-mono text-[#00C9A7] leading-relaxed overflow-x-auto">
{`3.3V Power Rail (ESP32)
       │
  [Flex Sensor (~10kΩ - 30kΩ)]
       │
       ├─── Signal Junction ───> ESP32 ADC1 Pin (e.g. GPIO 34)
       │
  [10kΩ Fixed Pull-Down Resistor]
       │
GND Ground Rail (ESP32 Common)`}
                </pre>
                <p className="text-[11px] text-white/50">
                  Power sensors from the ESP32 3.3V pin ONLY. Never connect flex sensors to the 5V rail as it will damage the ADC inputs.
                </p>
              </div>
            </div>
          </div>

          {/* ── Right Column: Live Terminal Console ── */}
          <div className="lg:col-span-5 space-y-5">
            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-[#161626]/90 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-white font-bold text-sm">Diagnostic Telemetry Console</h3>
                </div>
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-white/40 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="bg-black/60 p-3 rounded-xl border border-white/10 h-80 overflow-y-auto font-mono text-[11px] text-emerald-400/90 space-y-1">
                {logs.length === 0 ? (
                  <p className="text-white/30 italic">No device log messages yet.</p>
                ) : (
                  logs.map((log, i) => <div key={i}>{log}</div>)
                )}
              </div>

              <div className="pt-2 text-xs text-white/50 space-y-1">
                <p>
                  <strong>Firmware Location:</strong>{' '}
                  <code className="text-[#a29bfe]">firmware/sparsh-smart-glove/</code>
                </p>
                <p>
                  <strong>Serial Baud Rate:</strong> 115200 bps
                </p>
                <p>
                  <strong>BLE Service UUID:</strong>{' '}
                  <code className="text-[10px]">6e400001-b5a3-f393-e0a9-e50e24dcca9e</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Custom Gesture Template ── */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-2xl border border-white/10 bg-[#1e1e32] max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create Custom Gesture Template</h3>
            <p className="text-xs text-white/60">
              Your glove&apos;s current 5-finger bend vector will be recorded as the reference for this new sign.
            </p>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-white/60 block mb-1">Gesture Name</span>
                <input
                  type="text"
                  value={customGestureName}
                  onChange={(e) => setCustomGestureName(e.target.value)}
                  placeholder="e.g. PEACE, EMERGENCY, MY_NAME"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <span className="text-xs text-white/60 block mb-1">Spoken / Output Text</span>
                <input
                  type="text"
                  value={customGestureText}
                  onChange={(e) => setCustomGestureText(e.target.value)}
                  placeholder="Text spoken aloud by TTS"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 text-xs font-mono text-emerald-400">
                Vector: [{telemetry?.vector.map((v) => v.toFixed(2)).join(', ') || '0, 0, 0, 0, 0'}]
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddCustomModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomTemplate}
                disabled={!customGestureName.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-xs shadow-md disabled:opacity-40"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
