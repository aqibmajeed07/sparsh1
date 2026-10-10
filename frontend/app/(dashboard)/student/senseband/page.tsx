'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bluetooth, BluetoothOff, Zap, Radio, Activity, Cpu, RefreshCw,
    CheckCircle, XCircle, Loader2, AlertTriangle, Play, BarChart2,
    Waves, BookOpen, Brain, Bell, Navigation, ChevronRight, Sparkles,
    Battery, Signal, WifiOff, Info, Heart, Key, Send, Smile, MessageSquare
} from 'lucide-react';
import { senseBand, HAPTIC_PATTERNS, HapticCommand, SenseBandStatus } from '@/lib/senseband';



const AI_HAPTIC_CONCEPTS = [
    { concept: 'Earthquake', description: 'Rapid, chaotic vibrations simulate seismic waves', pattern: '▓▒░▓▒░▓▒', icon: '🌍', color: '#e17055' },
    { concept: 'Heartbeat', description: 'Lub-dub pulse pattern — perfect for biology lessons', pattern: '▓░▓░░░░', icon: '❤️', color: '#e84393' },
    { concept: 'Rain', description: 'Tiny, gentle repeated pulses like raindrops', pattern: '·····', icon: '🌧️', color: '#74b9ff' },
    { concept: 'Alarm', description: 'Continuous urgent vibration for alerts', pattern: '████████', icon: '🚨', color: '#fdcb6e' },
    { concept: 'Ocean Wave', description: 'Slow build-up, peak, and fade — rhythmic', pattern: '░▒▓█▓▒░', icon: '🌊', color: '#00C9A7' },
    { concept: 'Music Beat', description: 'Rhythmic pulse that syncs with a 4/4 time signature', pattern: '▓·▓·▓▓·', icon: '🎵', color: '#6C63FF' },
];

const PRESET_EMOTIONS = [
    { label: 'Joy & Celebration', text: 'I completed all my lessons today and scored top marks!', icon: '😊', command: 'SUCCESS', color: '#00C9A7' },
    { label: 'Calm & Grounding', text: 'I am taking slow deep breaths to stay calm and focused.', icon: '🧘', command: 'FORWARD', color: '#74b9ff' },
    { label: 'AI Eureka Moment', text: 'I finally understand the complex science topic!', icon: '💡', command: 'AI_READY', color: '#6C63FF' },
    { label: 'Gentle Comfort', text: 'I feel a bit overwhelmed and need reassuring feedback.', icon: '🤗', command: 'MESSAGE', color: '#a29bfe' },
    { label: 'High Alert', text: 'Important notification or urgent request for assistance.', icon: '🚨', command: 'EMERGENCY', color: '#fdcb6e' },
    { label: 'Victory & Pride', text: 'We solved the hard math puzzle together!', icon: '🏆', command: 'LESSON_COMPLETE', color: '#e84393' },
];

const COMMAND_GROUPS = [
    {
        title: 'Learning Feedback', icon: <BookOpen className="w-4 h-4" />, color: '#6C63FF',
        commands: ['CORRECT', 'WRONG', 'LESSON_COMPLETE', 'AI_READY'] as HapticCommand[],
    },
    {
        title: 'Notifications', icon: <Bell className="w-4 h-4" />, color: '#00C9A7',
        commands: ['ASSIGNMENT', 'MESSAGE', 'CONNECTED'] as HapticCommand[],
    },
    {
        title: 'Navigation', icon: <Navigation className="w-4 h-4" />, color: '#a29bfe',
        commands: ['NAV_NEXT', 'NAV_PREVIOUS', 'NAV_MENU'] as HapticCommand[],
    },
];

// ─── Waveform Visual ─────────────────────────────────────────────────────────
function WaveRing({ active }: { active: boolean }) {
    return (
        <div className="relative w-32 h-32 flex items-center justify-center">
            {active && (
                <>
                    <div className="absolute inset-0 rounded-full bg-[#6C63FF]/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-[#00C9A7]/20 animate-pulse" />
                </>
            )}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${active
                ? 'bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] shadow-xl shadow-[#6C63FF]/50 scale-105'
                : 'bg-white/10 border border-white/20'
                }`}>
                <Zap className={`w-9 h-9 ${active ? 'text-white animate-bounce' : 'text-white/30'}`} />
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: SenseBandStatus }) {
    const map = {
        disconnected: { label: 'Disconnected', color: 'bg-white/10 text-white/50 border-white/10' },
        searching: { label: 'Searching…', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
        connected: { label: 'Connected', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
        error: { label: 'Error', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
    };
    const s = map[status];
    return (
        <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${s.color}`}>
            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`} />
            {s.label}
        </span>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SenseBandPage() {
    const [status, setStatus] = useState<SenseBandStatus>('disconnected');
    const [logs, setLogs] = useState<string[]>([]);
    const [lastCmd, setLastCmd] = useState<string>('—');
    const [batteryPercent, setBatteryPercent] = useState<number>(senseBand.batteryPercent);
    const [fetchingBattery, setFetchingBattery] = useState(false);
    const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle');
    const [sendingCmd, setSendingCmd] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'ai-emotions' | 'commands' | 'ai-haptics' | 'analytics'>('dashboard');
    const [bluetoothSupported, setBluetoothSupported] = useState(true);

    // AI Emotions State with Secure Server-Side Ollama Key
    const [ollamaKey, setOllamaKey] = useState<string>('');
    const [ollamaModel, setOllamaModel] = useState<string>('gpt-oss:120b');
    const [emotionText, setEmotionText] = useState<string>('');
    const [analyzingEmotion, setAnalyzingEmotion] = useState<boolean>(false);
    const [emotionResult, setEmotionResult] = useState<any>(null);
    const [emotionHistory, setEmotionHistory] = useState<any[]>([]);

    useEffect(() => {
        setBluetoothSupported(senseBand.isBluetoothSupported);
    }, []);

    useEffect(() => {
        const unsubStatus = senseBand.onStatus(s => {
            setStatus(s);
            if (s === 'connected') {
                senseBand.requestBattery().catch(() => { });
            }
        });
        const unsubLog = senseBand.onLog(l => setLogs(prev => [l, ...prev].slice(0, 50)));
        const unsubBatt = senseBand.onBattery(pct => setBatteryPercent(pct));

        setBatteryPercent(senseBand.batteryPercent);

        return () => { unsubStatus(); unsubLog(); unsubBatt(); };
    }, []);

    const handleConnect = async () => {
        await senseBand.connect();
    };

    const handleDisconnect = async () => {
        await senseBand.disconnect();
        setTestResult('idle');
    };

    const handleCheckBattery = async () => {
        if (status !== 'connected') return;
        setFetchingBattery(true);
        await senseBand.requestBattery();
        setTimeout(() => setFetchingBattery(false), 800);
    };

    const handleSend = useCallback(async (cmd: HapticCommand) => {
        setSendingCmd(cmd);
        const ok = await senseBand.send(cmd);
        setLastCmd(cmd);
        setSendingCmd(null);
        return ok;
    }, []);

    const handleTest = async () => {
        const ok = await handleSend('TEST');
        setTestResult(ok ? 'success' : 'fail');
        setTimeout(() => setTestResult('idle'), 3000);
    };

    const handleAnalyzeEmotion = async (textToAnalyze?: string) => {
        const queryText = (textToAnalyze || emotionText).trim();
        if (!queryText) return;
        setAnalyzingEmotion(true);

        try {
            const payload: any = {
                text: queryText,
                ollama_model: ollamaModel
            };
            if (ollamaKey.trim()) {
                payload.ollama_api_key = ollamaKey.trim();
            }

            const res = await fetch('http://localhost:8000/api/senseband/ai-emotion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                setEmotionResult(data);
                setEmotionHistory(prev => [data, ...prev].slice(0, 10));

                if (status === 'connected' && data.haptic_command) {
                    await handleSend(data.haptic_command as HapticCommand);
                }
            }
        } catch (err) {
            console.error('Emotion AI error:', err);
        } finally {
            setAnalyzingEmotion(false);
        }
    };

    const TABS = [
        { id: 'dashboard', label: 'Dashboard', icon: <Radio className="w-4 h-4" /> },
        { id: 'ai-emotions', label: 'AI Emotions & Ollama', icon: <Heart className="w-4 h-4 text-pink-400" /> },
        { id: 'commands', label: 'Commands', icon: <Zap className="w-4 h-4" /> },
        { id: 'ai-haptics', label: 'AI Haptic Learning', icon: <Brain className="w-4 h-4" /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    ];

    // Compute battery UI properties
    let battLabel = 'Disconnected';
    let battColor = 'text-white/40';
    let battBg = 'bg-white/5';
    let battBorder = 'border-white/10';
    let battProgressColor = '#6C63FF';

    if (status === 'connected') {
        if (batteryPercent >= 0) {
            battLabel = `${batteryPercent}%`;
            if (batteryPercent > 50) {
                battColor = 'text-emerald-400';
                battBg = 'bg-emerald-500/10';
                battBorder = 'border-emerald-500/30';
                battProgressColor = '#10B981';
            } else if (batteryPercent > 20) {
                battColor = 'text-amber-400';
                battBg = 'bg-amber-500/10';
                battBorder = 'border-amber-500/30';
                battProgressColor = '#F59E0B';
            } else {
                battColor = 'text-red-400';
                battBg = 'bg-red-500/10';
                battBorder = 'border-red-500/30';
                battProgressColor = '#EF4444';
            }
        } else {
            battLabel = 'Checking…';
            battColor = 'text-purple-400';
        }
    }

    return (
        <div className="space-y-6 pb-10">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] flex items-center justify-center shadow-lg shadow-[#6C63FF]/30">
                            <Zap className="w-5 h-5 text-white" />
                        </span>
                        Sparsh SenseBand
                    </h1>
                    <p className="text-white/50 mt-1 ml-1">AI Powered Haptic Learning Companion</p>
                </div>
                <div className="flex items-center gap-3">
                    {status === 'connected' && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${battBg} ${battBorder} ${battColor}`}>
                            <Battery className="w-3.5 h-3.5" />
                            <span>{batteryPercent >= 0 ? `${batteryPercent}%` : 'Reading…'}</span>
                        </div>
                    )}
                    <StatusBadge status={status} />
                </div>
            </div>

            {/* ── Tab Nav ── */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white shadow-lg shadow-[#6C63FF]/20'
                            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {tab.icon}{tab.label}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {/* ──────────── DASHBOARD TAB ──────────── */}
                {activeTab === 'dashboard' && (
                    <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

                        {/* Bluetooth not supported warning */}
                        {!bluetoothSupported && (
                            <div className="glass-card border border-amber-500/30 p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-400 font-semibold text-sm">Web Bluetooth Not Supported</p>
                                    <p className="text-white/50 text-xs mt-1">Please use Google Chrome or Microsoft Edge (version 56+) with Bluetooth enabled to pair the SenseBand wirelessly.</p>
                                </div>
                            </div>
                        )}

                        {/* Hero connection card */}
                        <div className="glass-card overflow-hidden relative p-8">
                            {/* BG decoration */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none"
                                style={{ background: 'radial-gradient(ellipse at 70% 50%, #6C63FF 0%, transparent 70%)' }} />
                            <div className="flex flex-col lg:flex-row items-center gap-8">
                                {/* Wave ring visual */}
                                <div className="shrink-0 flex flex-col items-center gap-4">
                                    <WaveRing active={status === 'connected'} />
                                    <span className="text-white/40 text-xs font-mono">
                                        {status === 'connected' ? `ID: ${senseBand.deviceId}` : 'No Device'}
                                    </span>
                                </div>

                                {/* Info + buttons */}
                                <div className="flex-1 w-full space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {/* Status */}
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                                            <div className="flex items-center gap-2 mb-1 text-[#00C9A7]">
                                                <Radio className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Status</span>
                                            </div>
                                            <p className="text-white font-semibold text-sm truncate">{status.charAt(0).toUpperCase() + status.slice(1)}</p>
                                        </div>

                                        {/* Battery Card */}
                                        <div className={`bg-white/5 rounded-2xl p-3 border ${battBorder} relative overflow-hidden transition-all`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className={`flex items-center gap-1.5 ${battColor}`}>
                                                    <Battery className="w-4 h-4" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Battery</span>
                                                </div>
                                                {status === 'connected' && (
                                                    <button
                                                        onClick={handleCheckBattery}
                                                        disabled={fetchingBattery}
                                                        className="text-white/40 hover:text-white text-[10px] flex items-center gap-1 transition"
                                                        title="Request battery percentage"
                                                    >
                                                        <RefreshCw className={`w-3 h-3 ${fetchingBattery ? 'animate-spin' : ''}`} />
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`font-bold text-sm truncate ${battColor}`}>{battLabel}</p>
                                            {status === 'connected' && batteryPercent >= 0 && (
                                                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                                                    <div
                                                        className="h-full transition-all duration-500 rounded-full"
                                                        style={{
                                                            width: `${batteryPercent}%`,
                                                            backgroundColor: battProgressColor
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Firmware */}
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                                            <div className="flex items-center gap-2 mb-1 text-[#a29bfe]">
                                                <Cpu className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Firmware</span>
                                            </div>
                                            <p className="text-white font-semibold text-sm truncate">{senseBand.firmwareVersion}</p>
                                        </div>

                                        {/* Last Cmd */}
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
                                            <div className="flex items-center gap-2 mb-1 text-[#fdcb6e]">
                                                <Activity className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Last Cmd</span>
                                            </div>
                                            <p className="text-white font-semibold text-sm truncate">{lastCmd}</p>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex flex-wrap gap-3">
                                        {status === 'disconnected' || status === 'error' ? (
                                            <button
                                                onClick={handleConnect}
                                                disabled={!bluetoothSupported}
                                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold text-sm shadow-lg shadow-[#6C63FF]/30 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Bluetooth className="w-4 h-4" /> Pair via Bluetooth
                                            </button>
                                        ) : status === 'searching' ? (
                                            <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white/60 font-semibold text-sm">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={handleDisconnect} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/25 transition">
                                                    <BluetoothOff className="w-4 h-4" /> Disconnect
                                                </button>
                                                <button onClick={handleCheckBattery} disabled={fetchingBattery} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-semibold text-sm hover:bg-purple-500/25 transition">
                                                    <Battery className="w-4 h-4" /> {fetchingBattery ? 'Checking…' : 'Check Battery'}
                                                </button>
                                                <button onClick={handleConnect} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/10 text-white/60 font-semibold text-sm hover:bg-white/12 transition">
                                                    <RefreshCw className="w-4 h-4" /> Reconnect
                                                </button>
                                            </>
                                        )}

                                        {/* Test button */}
                                        <button
                                            onClick={handleTest}
                                            disabled={status !== 'connected' || sendingCmd === 'TEST'}
                                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition ${testResult === 'success'
                                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                                : testResult === 'fail'
                                                    ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                                                    : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed'
                                                }`}
                                        >
                                            {sendingCmd === 'TEST'
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : testResult === 'success'
                                                    ? <CheckCircle className="w-4 h-4" />
                                                    : testResult === 'fail'
                                                        ? <XCircle className="w-4 h-4" />
                                                        : <Play className="w-4 h-4" />
                                            }
                                            {testResult === 'success' ? 'Test Successful!' : testResult === 'fail' ? 'Test Failed' : 'Test Band'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Diagnostics log */}
                        <div className="glass-card p-5">
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-[#6C63FF]" /> Device Diagnostics
                            </h3>
                            <div className="bg-black/40 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs space-y-1 border border-white/5">
                                {logs.length === 0
                                    ? <p className="text-white/20">No activity yet. Connect your SenseBand to begin.</p>
                                    : logs.map((l, i) => (
                                        <p key={i} className={l.includes('→') ? 'text-[#00C9A7]' : l.includes('error') || l.includes('failed') ? 'text-red-400' : 'text-white/50'}>{l}</p>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Future features teaser */}
                        <div className="glass-card p-5">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[#6C63FF]" /> Future Roadmap
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { icon: '📡', label: 'Bluetooth BLE', sub: 'Wireless connection' },
                                    { icon: '🔋', label: 'LiPo Battery', sub: 'Active ADC monitoring' },
                                    { icon: '👋', label: 'Gesture Control', sub: 'Navigate by gesture' },
                                    { icon: '💓', label: 'Heart Rate', sub: 'Stress detection' },
                                    { icon: '🔄', label: 'OTA Updates', sub: 'Auto firmware' },
                                    { icon: '📍', label: 'Indoor Nav', sub: 'Haptic wayfinding' },
                                    { icon: '😊', label: 'Emotion AI', sub: 'Mood-sensitive alerts' },
                                    { icon: '🌙', label: 'Sleep Mode', sub: 'Sleep tracking' },
                                ].map((f, i) => (
                                    <div key={i} className="bg-white/3 border border-white/5 rounded-2xl p-3 flex items-start gap-3 opacity-60">
                                        <span className="text-2xl">{f.icon}</span>
                                        <div>
                                            <p className="text-white/70 text-xs font-semibold">{f.label}</p>
                                            <p className="text-white/30 text-[10px]">{f.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ──────────── AI EMOTIONS & OLLAMA TAB ──────────── */}
                {activeTab === 'ai-emotions' && (
                    <motion.div key="ai-emotions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                        {/* Ollama API Key Config Header */}
                        <div className="glass-card p-6 border border-pink-500/20 relative overflow-hidden">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Heart className="w-5 h-5 text-pink-400" /> AI Emotion & Tactile Sentiment Generator
                                    </h3>
                                    <p className="text-white/50 text-xs mt-1">
                                        Connect your Ollama API Key to translate human emotions into real-time tactile haptic patterns on Sparsh SenseBand.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400 text-xs font-semibold">Ollama Cloud Active</span>
                                </div>
                            </div>

                            {/* Ollama API Settings Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1 flex items-center gap-1.5">
                                        <Key className="w-3 h-3 text-pink-400" /> API Authentication Status
                                    </label>
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-white font-medium">Ollama Cloud API Key Loaded & Encrypted</span>
                                        <span className="text-white/30 text-[10px] ml-auto font-mono">••••••••••••••••</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1 flex items-center gap-1.5">
                                        <Cpu className="w-3 h-3 text-purple-400" /> Ollama Model
                                    </label>
                                    <select
                                        value={ollamaModel}
                                        onChange={e => setOllamaModel(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500/50"
                                    >
                                        <option value="gpt-oss:120b" className="bg-slate-900 text-white">gpt-oss:120b (Fast Cloud)</option>
                                        <option value="llama3" className="bg-slate-900 text-white">llama3 (Local / Fast)</option>
                                        <option value="mistral" className="bg-slate-900 text-white">mistral (7B Instruct)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Emotion Analyzer */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Input Card */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="glass-card p-6 space-y-4">
                                    <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                                        <MessageSquare className="w-4 h-4 text-[#6C63FF]" /> Analyze Mood / Text For Haptic Feedback
                                    </h4>
                                    <textarea
                                        value={emotionText}
                                        onChange={e => setEmotionText(e.target.value)}
                                        placeholder="Type how you are feeling or what you just experienced (e.g., 'I completed my assignment and feel so proud!', 'I am nervous about tomorrow's quiz')..."
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#6C63FF]"
                                    />
                                    <div className="flex items-center justify-between">
                                        <p className="text-white/40 text-xs">
                                            {status === 'connected' ? '⚡ Will auto-trigger live SenseBand haptics via BLE' : '⚠️ Connect SenseBand to feel live vibrations'}
                                        </p>
                                        <button
                                            onClick={() => handleAnalyzeEmotion()}
                                            disabled={analyzingEmotion || !emotionText.trim()}
                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-[#6C63FF] text-white font-semibold text-sm shadow-lg shadow-pink-500/20 hover:opacity-90 transition disabled:opacity-40"
                                        >
                                            {analyzingEmotion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {analyzingEmotion ? 'Analyzing AI Mood…' : 'Analyze & Send Haptics'}
                                        </button>
                                    </div>
                                </div>

                                {/* Preset Emotion Matrix */}
                                <div className="glass-card p-6">
                                    <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                                        <Smile className="w-4 h-4 text-[#00C9A7]" /> 1-Click AI Emotion Presets
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {PRESET_EMOTIONS.map((preset, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setEmotionText(preset.text);
                                                    handleAnalyzeEmotion(preset.text);
                                                }}
                                                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl p-3 text-left transition group"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-2xl">{preset.icon}</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${preset.color}20`, color: preset.color }}>
                                                        {preset.command}
                                                    </span>
                                                </div>
                                                <p className="text-white font-semibold text-xs mt-1">{preset.label}</p>
                                                <p className="text-white/40 text-[10px] line-clamp-1 mt-0.5">{preset.text}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Result & Tactile Preview Card */}
                            <div className="space-y-4">
                                <div className="glass-card p-6 border border-pink-500/30 relative overflow-hidden">
                                    <h4 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-pink-400" /> AI Emotion & Tactile Output
                                    </h4>

                                    {emotionResult ? (
                                        <div className="space-y-4">
                                            <div className="bg-pink-500/10 border border-pink-500/20 rounded-2xl p-4">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-300">Detected Mood</span>
                                                <p className="text-2xl font-extrabold text-white mt-0.5">{emotionResult.emotion}</p>
                                                <p className="text-white/60 text-xs mt-2 italic">"{emotionResult.ai_message}"</p>
                                            </div>

                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/50">BLE Command:</span>
                                                    <span className="font-mono font-bold text-[#00C9A7] bg-[#00C9A7]/10 px-2 py-0.5 rounded-lg border border-[#00C9A7]/30">{emotionResult.haptic_command}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/50">Pattern Rhythm:</span>
                                                    <span className="text-white font-semibold">{emotionResult.pattern_desc}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/50">Provider:</span>
                                                    <span className="text-purple-300 font-semibold">{emotionResult.provider}</span>
                                                </div>
                                            </div>

                                            {status === 'connected' && (
                                                <button
                                                    onClick={() => handleSend(emotionResult.haptic_command as HapticCommand)}
                                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold text-xs shadow-lg shadow-[#6C63FF]/30 hover:opacity-90 transition flex items-center justify-center gap-2"
                                                >
                                                    <Play className="w-3.5 h-3.5" /> Re-trigger Vibration
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 space-y-3">
                                            <Heart className="w-12 h-12 text-white/20 mx-auto animate-pulse" />
                                            <p className="text-white/40 text-xs">Select a preset or enter text above to test Ollama AI Emotion to Haptic generation.</p>
                                        </div>
                                    )}
                                </div>

                                {/* History Log */}
                                {emotionHistory.length > 0 && (
                                    <div className="glass-card p-4">
                                        <h5 className="text-white/60 text-xs font-semibold mb-2">Recent Emotion Triggers</h5>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[11px]">
                                            {emotionHistory.map((item, i) => (
                                                <div key={i} className="flex justify-between items-center text-white/50 bg-white/5 px-2.5 py-1.5 rounded-lg">
                                                    <span className="text-pink-300 truncate max-w-[120px]">{item.emotion}</span>
                                                    <span className="text-[#00C9A7]">{item.haptic_command}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ──────────── COMMANDS TAB ──────────── */}
                {activeTab === 'commands' && (
                    <motion.div key="commands" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                        {status !== 'connected' && (
                            <div className="glass-card border border-amber-500/20 p-4 flex items-center gap-3">
                                <WifiOff className="w-5 h-5 text-amber-400" />
                                <p className="text-amber-400/80 text-sm">Connect your SenseBand to enable haptic commands.</p>
                            </div>
                        )}

                        {COMMAND_GROUPS.map((group, gi) => (
                            <div key={gi} className="glass-card p-5">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2" style={{ color: group.color }}>
                                    {group.icon} {group.title}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {group.commands.map(cmd => {
                                        const pat = HAPTIC_PATTERNS[cmd];
                                        return (
                                            <button
                                                key={cmd}
                                                onClick={() => handleSend(cmd)}
                                                disabled={status !== 'connected' || sendingCmd === cmd}
                                                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed group"
                                            >
                                                {sendingCmd === cmd
                                                    ? <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: group.color }} />
                                                    : <Waves className="w-5 h-5 shrink-0 group-hover:scale-110 transition" style={{ color: group.color }} />
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-semibold">{pat.label}</p>
                                                    <p className="text-white/40 text-xs">{pat.description}</p>
                                                </div>
                                                <span className="font-mono text-lg tracking-widest shrink-0" style={{ color: group.color }}>{pat.pattern}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* ──────────── AI HAPTIC LEARNING TAB ──────────── */}
                {activeTab === 'ai-haptics' && (
                    <motion.div key="ai-haptics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                        <div className="glass-card p-5 border border-[#6C63FF]/20">
                            <div className="flex items-start gap-3">
                                <Brain className="w-6 h-6 text-[#6C63FF] shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-white font-bold">AI Haptic Learning</h3>
                                    <p className="text-white/50 text-sm mt-1">
                                        An experimental feature that converts real-world concepts into tactile experiences.
                                        Instead of just notifications, Gemini AI translates learning content into intelligently
                                        designed vibration patterns — enabling <span className="text-[#00C9A7] font-semibold">multisensory understanding</span>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {AI_HAPTIC_CONCEPTS.map((c, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ scale: 1.02 }}
                                    className="glass-card p-5 border border-white/10 cursor-pointer group"
                                    style={{ borderColor: `${c.color}30` }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <span className="text-3xl">{c.icon}</span>
                                        <span className="font-mono text-xl tracking-wider" style={{ color: c.color }}>{c.pattern}</span>
                                    </div>
                                    <h4 className="text-white font-bold text-lg">{c.concept}</h4>
                                    <p className="text-white/50 text-sm mt-1 leading-relaxed">{c.description}</p>
                                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: `${c.color}20`, color: c.color }}>AI Generated</span>
                                        <button
                                            onClick={() => handleSend('TEST')}
                                            disabled={status !== 'connected'}
                                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
                                            style={{ background: `${c.color}20`, color: c.color }}
                                        >
                                            <Play className="w-3 h-3" /> Feel It
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="glass-card p-5">
                            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                <Info className="w-4 h-4 text-[#00C9A7]" /> Accessibility Impact
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[
                                    { icon: '👁️', label: 'Visually Impaired', desc: 'Screen-free notifications' },
                                    { icon: '👂', label: 'Hearing Impaired', desc: 'Tactile audio替换 alerts' },
                                    { icon: '🤲', label: 'DeafBlind', desc: 'Vibration communication' },
                                    { icon: '🧠', label: 'Neurodivergent', desc: 'Calm tactile reminders' },
                                    { icon: '📚', label: 'Learning Disabilities', desc: 'Positive reinforcement' },
                                ].map((a, i) => (
                                    <div key={i} className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                        <span className="text-2xl block mb-2">{a.icon}</span>
                                        <p className="text-white/80 text-xs font-semibold leading-tight">{a.label}</p>
                                        <p className="text-white/30 text-[10px] mt-1">{a.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ──────────── ANALYTICS TAB ──────────── */}
                {activeTab === 'analytics' && (
                    <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                        {/* Summary stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {[
                                { label: 'Daily Vibrations', value: '42', sub: 'today', color: 'text-[#6C63FF]' },
                                { label: 'Study Sessions', value: '7', sub: 'this week', color: 'text-[#00C9A7]' },
                                { label: 'Quiz Signals', value: '28', sub: 'correct + wrong', color: 'text-purple-400' },
                                { label: 'Lessons Done', value: '12', sub: 'via SenseBand', color: 'text-amber-400' },
                                { label: 'Notifications', value: '54', sub: 'delivered', color: 'text-pink-400' },
                            ].map((s, i) => (
                                <div key={i} className="glass-card p-4 text-center">
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-white/80 text-xs font-medium mt-1">{s.label}</p>
                                    <p className="text-white/40 text-[10px] mt-0.5">{s.sub}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Weekly vibration chart */}
                            <div className="glass-card p-6">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-[#6C63FF]" /> Weekly Haptic Activity
                                </h3>
                                <div className="flex items-end justify-between gap-2 h-40">
                                    {WEEKLY_VIBRATIONS.map((d, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                            <p className="text-white/50 text-[10px]">{d.count}</p>
                                            <div
                                                className="w-full rounded-t-lg bg-gradient-to-t from-[#6C63FF] to-[#00C9A7] transition-all hover:opacity-80"
                                                style={{ height: `${(d.count / maxVib) * 100}%`, minHeight: '8px' }}
                                            />
                                            <p className="text-white/40 text-[10px]">{d.day}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Command usage breakdown */}
                            <div className="glass-card p-6">
                                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-[#00C9A7]" /> Command Usage This Week
                                </h3>
                                <div className="space-y-3">
                                    {[
                                        { label: 'CORRECT (Quiz)', count: 18, max: 30, color: '#00C9A7' },
                                        { label: 'AI_READY (Tutor)', count: 24, max: 30, color: '#6C63FF' },
                                        { label: 'LESSON_COMPLETE', count: 12, max: 30, color: '#a29bfe' },
                                        { label: 'WRONG (Quiz)', count: 10, max: 30, color: '#e17055' },
                                        { label: 'ASSIGNMENT', count: 6, max: 30, color: '#fdcb6e' },
                                    ].map((item, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-white/70 text-xs">{item.label}</span>
                                                <span className="text-white/40 text-xs">{item.count}x</span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-2">
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(item.count / item.max) * 100}%` }}
                                                    transition={{ duration: 0.8, delay: i * 0.1 }}
                                                    style={{ backgroundColor: item.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
