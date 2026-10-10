'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AccessibilityContextType {
    highContrast: boolean;
    largeText: boolean;
    dyslexicFont: boolean;
    voiceNav: boolean;
    profileMode: string;
    setProfileMode: (mode: string) => void;
    toggleHighContrast: () => void;
    toggleLargeText: () => void;
    toggleDyslexicFont: () => void;
    toggleVoiceNav: () => void;
    speak: (text: string) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType>({
    highContrast: false,
    largeText: false,
    dyslexicFont: false,
    voiceNav: false,
    profileMode: 'general',
    setProfileMode: () => { },
    toggleHighContrast: () => { },
    toggleLargeText: () => { },
    toggleDyslexicFont: () => { },
    toggleVoiceNav: () => { },
    speak: () => { },
});

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
    const [highContrast, setHighContrast] = useState(false);
    const [largeText, setLargeText] = useState(false);
    const [dyslexicFont, setDyslexicFont] = useState(false);
    const [voiceNav, setVoiceNav] = useState(false);
    const [profileMode, setProfileModeState] = useState('general');
    const router = useRouter();

    // Handle TTS
    const speak = (text: string) => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-IN';
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
        }
    };

    const toggleHighContrast = () => setHighContrast(prev => !prev);
    const toggleLargeText = () => setLargeText(prev => !prev);
    const toggleDyslexicFont = () => setDyslexicFont(prev => !prev);
    const toggleVoiceNav = () => {
        setVoiceNav(prev => {
            const next = !prev;
            speak(next ? "Voice navigation activated. Say lessons, sign lab, or ai tutor to navigate." : "Voice navigation turned off.");
            return next;
        });
    };

    const setProfileMode = (mode: string) => {
        setProfileModeState(mode);
        if (mode === 'visual') {
            setHighContrast(true);
            setLargeText(true);
            setVoiceNav(true);
            speak("Visually impaired accessibility profile applied. Voice navigation and high contrast enabled.");
        } else if (mode === 'hearing') {
            setHighContrast(false);
            setLargeText(false);
            setVoiceNav(false);
            speak("Deaf and hard of hearing accessibility profile applied.");
        } else if (mode === 'dyslexia') {
            setDyslexicFont(true);
            setLargeText(true);
            speak("Dyslexia friendly profile applied. High legibility font enabled.");
        } else if (mode === 'motor') {
            setLargeText(true);
            speak("Motor accessibility profile applied. Large click targets enabled.");
        } else {
            setHighContrast(false);
            setLargeText(false);
            setDyslexicFont(false);
            setVoiceNav(false);
            speak("Standard accessibility profile active.");
        }
    };

    // Voice Navigation sync with global AI Voice Assistant
    useEffect(() => {
        if (voiceNav) {
            speak("Voice navigation mode enabled. Click the AI Voice Assistant button at the bottom left to command the app.");
        }
    }, [voiceNav]);


    return (
        <AccessibilityContext.Provider
            value={{
                highContrast,
                largeText,
                dyslexicFont,
                voiceNav,
                profileMode,
                setProfileMode,
                toggleHighContrast,
                toggleLargeText,
                toggleDyslexicFont,
                toggleVoiceNav,
                speak,
            }}
        >
            <div
                className={`${highContrast ? 'contrast-200 bg-black text-yellow-300' : ''} ${largeText ? 'text-lg' : ''
                    } ${dyslexicFont ? 'font-serif tracking-wide leading-loose' : ''} min-h-screen transition-all`}
            >
                {children}
            </div>
        </AccessibilityContext.Provider>
    );
};

const defaultContext: AccessibilityContextType = {
    highContrast: false,
    largeText: false,
    dyslexicFont: false,
    voiceNav: false,
    profileMode: 'general',
    setProfileMode: () => { },
    toggleHighContrast: () => { },
    toggleLargeText: () => { },
    toggleDyslexicFont: () => { },
    toggleVoiceNav: () => { },
    speak: () => { },
};

export const useAccessibility = () => {
    try {
        const ctx = useContext(AccessibilityContext);
        return ctx || defaultContext;
    } catch (e) {
        return defaultContext;
    }
};
