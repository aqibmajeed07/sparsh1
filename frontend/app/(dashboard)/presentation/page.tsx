'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Play, Cpu, Zap, Heart, Brain,
    BookOpen, Sparkles, CheckCircle, ShieldAlert, Activity, Users,
    Globe, Layers, Award, FileText
} from 'lucide-react';
import Link from 'next/link';

const SLIDES = [
    {
        id: 1,
        title: "SPARSH (स्पर्श) AI Platform",
        subtitle: "Multimodal Inclusive Education & Assistive Hardware Ecosystem",
        tag: "PROJECT OVERVIEW",
        badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        content: (
            <div className="space-y-6 text-center py-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#6C63FF]/20 to-pink-500/20 border border-[#6C63FF]/40">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <span className="text-sm font-semibold text-white">Empowering 30M+ Special Needs Students</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-400 leading-tight">
                    SPARSH AI Platform
                </h1>
                <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg">
                    An end-to-end assistive education system connecting ESP32 Braille Keyboards, ESP32 SenseBand Haptic Wearables, 3D Articulated ISL Sign Avatars, and Ollama Cloud AI.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-4">
                    {[
                        { label: "Hardware Cost", val: "< ₹1,500", icon: <Cpu className="w-4 h-4 text-[#00C9A7]" /> },
                        { label: "Modalities", val: "Touch + Sight + Sound", icon: <Zap className="w-4 h-4 text-pink-400" /> },
                        { label: "AI Latency", val: "< 1.5s Ollama Cloud", icon: <Brain className="w-4 h-4 text-purple-400" /> },
                        { label: "ISL Gestures", val: "500+ Tokens", icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
                    ].map((item, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                            <div className="flex justify-center mb-1">{item.icon}</div>
                            <p className="text-white font-bold text-lg">{item.val}</p>
                            <p className="text-white/40 text-xs mt-0.5">{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 2,
        title: "The Problem Statement",
        subtitle: "Severe Access & Cost Barriers in Assistive Education",
        tag: "THE CHALLENGE",
        badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
        content: (
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            title: "Prohibitive Hardware Costs",
                            desc: "Traditional refreshable Braille displays cost $1,500 - $3,500 (₹1.2L - ₹2.8L), making them completely inaccessible for 95% of Indian schools.",
                            icon: "💰",
                            color: "border-red-500/30 bg-red-500/10"
                        },
                        {
                            title: "Scarcity of Sign Interpreters",
                            desc: "Deaf students face severe learning isolation due to the acute shortage of certified Indian Sign Language (ISL) human interpreters.",
                            icon: "🤟",
                            color: "border-amber-500/30 bg-amber-500/10"
                        },
                        {
                            title: "Lack of Tactile Feedback",
                            desc: "Visually impaired and DeafBlind learners lack real-time sensory feedback for quiz corrections, emotional states, and digital notifications.",
                            icon: "⌚",
                            color: "border-purple-500/30 bg-purple-500/10"
                        },
                        {
                            title: "Static Non-Inclusive Curricula",
                            desc: "Standard NCERT textbooks are distributed as static PDFs without screen-reader accessibility or interactive AI tutoring.",
                            icon: "📚",
                            color: "border-blue-500/30 bg-blue-500/10"
                        }
                    ].map((p, idx) => (
                        <div key={idx} className={`p-5 rounded-2xl border ${p.color} space-y-2`}>
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{p.icon}</span>
                                <h3 className="text-white font-bold text-base">{p.title}</h3>
                            </div>
                            <p className="text-white/70 text-xs leading-relaxed">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    },
    {
        id: 3,
        title: "The SPARSH Solution Architecture",
        subtitle: "Hardware-Software-AI Integrated Ecosystem",
        tag: "SOLUTION",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        content: (
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-5 border border-purple-500/30 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold">1</div>
                        <h3 className="text-white font-bold text-base">ESP32 Hardware Layer</h3>
                        <p className="text-white/60 text-xs leading-relaxed">
                            SPARSH Braille Keyboard + SenseBand BLE Wearable with GPIO 34 battery monitoring & tactile ERM vibration driver.
                        </p>
                    </div>
                    <div className="glass-card p-5 border border-pink-500/30 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-300 font-bold">2</div>
                        <h3 className="text-white font-bold text-base">Ollama AI & NCERT Engine</h3>
                        <p className="text-white/60 text-xs leading-relaxed">
                            FastAPI Python backend with Ollama Cloud API (gpt-oss:120b) for sentiment translation, dynamic quiz generation, and book indexing.
                        </p>
                    </div>
                    <div className="glass-card p-5 border border-[#00C9A7]/30 space-y-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00C9A7]/20 flex items-center justify-center text-[#00C9A7] font-bold">3</div>
                        <h3 className="text-white font-bold text-base">3D Articulated ISL Avatar</h3>
                        <p className="text-white/60 text-xs leading-relaxed">
                            Three.js web canvas rendering 5-digit finger articulation, micro-saccades, eyelid blinking, and real-time lip-sync.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 4,
        title: "Hardware Engineering & SenseBand",
        subtitle: "Custom ESP32 Wearable & Braille Keyboard Firmware",
        tag: "HARDWARE",
        badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        content: (
            <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-card p-5 space-y-3">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-purple-400" /> SPARSH Smart Braille Keyboard
                        </h3>
                        <ul className="text-white/70 text-xs space-y-2 list-disc list-inside">
                            <li>ESP32 Dual-Core 240MHz Processor</li>
                            <li>6-Key Ergonomic Braille Matrix + Function Keys</li>
                            <li>BLE GATT Protocol + Web Serial USB (Baud 115200)</li>
                            <li>Sub-10ms keypress response time</li>
                        </ul>
                    </div>
                    <div className="glass-card p-5 space-y-3">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <Heart className="w-4 h-4 text-pink-400" /> SenseBand BLE Haptic Wearable
                        </h3>
                        <ul className="text-white/70 text-xs space-y-2 list-disc list-inside">
                            <li>ESP32-C3 / BLE Microcontroller</li>
                            <li>GPIO 34 ADC1 Battery Divider Monitoring (100k/100k)</li>
                            <li>30-Second Telemetry Notification (BATTERY:XX%)</li>
                            <li>ERM Haptic Vibration Motor Driver</li>
                        </ul>
                    </div>
                </div>
            </div>
        )
    },
    {
        id: 5,
        title: "AI Emotion to Haptic Vibration Matrix",
        subtitle: "Translating Human Sentiment into Tactile Haptic Rhythms",
        tag: "AI HAPTICS",
        badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
        content: (
            <div className="space-y-4 py-2">
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white/10 text-white/50 uppercase tracking-wider">
                            <tr>
                                <th className="p-3 font-semibold">Mood / Emotion</th>
                                <th className="p-3 font-semibold">BLE Command</th>
                                <th className="p-3 font-semibold">Tactile Vibration Rhythm</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-white/80 font-mono">
                            <tr>
                                <td className="p-3 text-emerald-400 font-bold">😊 Joy & Celebration</td>
                                <td className="p-3 text-white/70">SUCCESS</td>
                                <td className="p-3 text-white/50">3 rapid upbeat high-intensity pulses</td>
                            </tr>
                            <tr>
                                <td className="p-3 text-blue-400 font-bold">🧘 Calm & Focus</td>
                                <td className="p-3 text-white/70">FORWARD</td>
                                <td className="p-3 text-white/50">Slow rhythmic wave pulse (1s fade)</td>
                            </tr>
                            <tr>
                                <td className="p-3 text-purple-400 font-bold">💡 AI Eureka / Insight</td>
                                <td className="p-3 text-white/70">AI_READY</td>
                                <td className="p-3 text-white/50">Double crisp readiness tick</td>
                            </tr>
                            <tr>
                                <td className="p-3 text-pink-400 font-bold">🤗 Gentle Comfort</td>
                                <td className="p-3 text-white/70">MESSAGE</td>
                                <td className="p-3 text-white/50">Gentle double-pulsing soft vibration</td>
                            </tr>
                            <tr>
                                <td className="p-3 text-amber-400 font-bold">🚨 Urgent Alert</td>
                                <td className="p-3 text-white/70">EMERGENCY</td>
                                <td className="p-3 text-white/50">Continuous 3-second alert burst</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        )
    },
    {
        id: 6,
        title: "Software & Technology Stack",
        subtitle: "Modern Scalable Web & Cloud Architecture",
        tag: "TECH STACK",
        badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        content: (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                {[
                    { cat: "Frontend", items: ["Next.js 14", "React 18", "TailwindCSS", "Framer Motion"], color: "text-[#6C63FF]" },
                    { cat: "3D & Web Canvas", items: ["Three.js", "React Three Fiber", "Drei Controls", "Web Speech API"], color: "text-pink-400" },
                    { cat: "Backend & AI", items: ["FastAPI (Python)", "Ollama Cloud API", "NVIDIA NIM", "PyMuPDF NCERT"], color: "text-[#00C9A7]" },
                    { cat: "Hardware & DB", items: ["Web Bluetooth API", "Web Serial API", "Supabase DB", "WebSockets"], color: "text-amber-400" },
                ].map((s, idx) => (
                    <div key={idx} className="glass-card p-4 space-y-2 border border-white/10">
                        <h4 className={`font-bold text-sm ${s.color}`}>{s.cat}</h4>
                        <ul className="text-white/60 text-xs space-y-1">
                            {s.items.map((item, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-current" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        )
    },
    {
        id: 7,
        title: "Future Roadmap & Scalability",
        subtitle: "Expansion Goals for Special Education Across India",
        tag: "FUTURE ROADMAP",
        badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        content: (
            <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { title: "Indoor Haptic Wayfinding", desc: "Integrating Bluetooth RSSI beacons into SenseBand to guide visually impaired students across campus corridors.", tag: "Phase 2 (Q4 2026)" },
                        { title: "Heart Rate & Stress Sensors", desc: "Adding PPG heart rate sensors to monitor student anxiety levels in real time during quizzes.", tag: "Phase 2 (Q1 2027)" },
                        { title: "20+ Regional ISL Languages", desc: "Expanding 3D avatar gesture mappings to support regional Indian Sign Languages (Hindi, Tamil, Bengali).", tag: "Phase 3 (Q2 2027)" },
                        { title: "Government School Pilots", desc: "Deploying low-cost SPARSH kits under Samagra Shiksha Abhiyan across special education institutes.", tag: "Phase 3 (Q3 2027)" },
                    ].map((item, idx) => (
                        <div key={idx} className="glass-card p-4 border border-white/10 space-y-1">
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">{item.tag}</span>
                            <h4 className="text-white font-bold text-sm mt-1">{item.title}</h4>
                            <p className="text-white/60 text-xs">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
];

export default function PresentationPage() {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);

    const slide = SLIDES[currentSlide];

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-[#6C63FF]" /> SPARSH Executive Presentation Deck
                    </h1>
                    <p className="text-white/50 text-xs mt-1">Interactive review slides for reviewers and judges</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevSlide}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-mono text-white/60 px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                        {currentSlide + 1} / {SLIDES.length}
                    </span>
                    <button
                        onClick={nextSlide}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Slide Stage */}
            <div className="glass-card p-6 sm:p-10 border border-white/15 min-h-[480px] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Sparkles className="w-48 h-48 text-white" />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${slide.badgeColor}`}>
                                {slide.tag}
                            </span>
                            <span className="text-white/30 text-xs font-mono">SLIDE 0{slide.id}</span>
                        </div>

                        <div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{slide.title}</h2>
                            <p className="text-white/50 text-xs sm:text-sm mt-0.5">{slide.subtitle}</p>
                        </div>

                        <div className="pt-2">{slide.content}</div>
                    </motion.div>
                </AnimatePresence>

                {/* Footer Controls & Slide Dots */}
                <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-6">
                    <div className="flex items-center gap-1.5">
                        {SLIDES.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-2 rounded-full transition-all ${idx === currentSlide ? 'w-8 bg-[#6C63FF]' : 'w-2 bg-white/20 hover:bg-white/40'}`}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Link href="/student/senseband">
                            <button className="px-4 py-2 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-xl text-xs font-semibold hover:bg-pink-500/30 transition">
                                SenseBand Demo
                            </button>
                        </Link>
                        <Link href="/teacher">
                            <button className="px-4 py-2 bg-[#6C63FF] text-white rounded-xl text-xs font-semibold hover:bg-[#5b54e6] transition">
                                Teacher Dashboard
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
