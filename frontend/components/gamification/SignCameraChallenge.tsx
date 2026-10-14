'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Volume2 } from 'lucide-react';
import { duoAudio } from '@/lib/duoAudio';

interface SignCameraChallengeProps {
  targetSign: string;
  targetChar: string;
  description: string;
  hints: string[];
  onSuccess: () => void;
  disabled?: boolean;
}

export default function SignCameraChallenge({
  targetSign,
  targetChar,
  description,
  hints,
  onSuccess,
  disabled = false,
}: SignCameraChallengeProps) {
  const webcamRef = useRef<Webcam>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [detectedSign, setDetectedSign] = useState<string>('Align hand in camera');
  const [confidence, setConfidence] = useState<number>(0);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Trigger audio explanation
  const speakInstructions = () => {
    duoAudio.speakPrompt(`Show hand sign for ${targetChar}. ${description}`);
  };

  // Live recognition evaluation loop
  const checkFrame = useCallback(async () => {
    if (disabled || isVerifying || !webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsVerifying(true);
    try {
      const res = await fetch('/api/gamification/verify-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageSrc,
          target_sign: targetSign || targetChar,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDetectedSign(data.detected || 'Hand detected');
        setConfidence(data.confidence || 0);
        const matched = Boolean(data.match);
        setIsMatching(matched);

        if (matched) {
          // Increment hold progress
          setHoldProgress((prev) => {
            const next = prev + 35;
            if (next >= 100) {
              duoAudio.playSuccessChime();
              onSuccess();
              return 100;
            }
            return next;
          });
        } else {
          // Slowly decay hold progress if hand slips
          setHoldProgress((prev) => Math.max(0, prev - 20));
        }
      }
    } catch {
      // Network hiccup ignored
    } finally {
      setIsVerifying(false);
    }
  }, [disabled, isVerifying, targetSign, targetChar, onSuccess]);

  useEffect(() => {
    if (disabled) return;
    const interval = setInterval(checkFrame, 650);
    return () => clearInterval(interval);
  }, [disabled, checkFrame]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto">
      {/* Target Sign Prompt Card */}
      <div className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              {targetChar}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Target Hand Sign
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {targetChar}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={speakInstructions}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 border border-slate-200 dark:border-slate-600 shadow-sm transition active:scale-95"
            title="Read instructions aloud"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2.5">
          {description}
        </p>

        {hints && hints.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Hint: {hints[0]}</span>
          </div>
        )}
      </div>

      {/* Live Camera Viewport */}
      <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-slate-950 border-4 border-slate-700 shadow-2xl flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 text-center text-slate-400 flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-semibold">{cameraError}</p>
            <p className="text-xs text-slate-500">Please enable camera permissions in your browser.</p>
          </div>
        ) : (
          <>
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode,
                width: 640,
                height: 480,
              }}
              onUserMediaError={(err) => setCameraError(err.toString())}
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Target Crosshairs / Alignment Guide */}
            <div className="absolute inset-8 border-2 border-dashed border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
              <span className="text-[11px] font-mono text-white/50 tracking-wider uppercase bg-black/40 px-2.5 py-1 rounded-full">
                Hold hand in box
              </span>
            </div>

            {/* Flip Camera Button */}
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur border border-white/20 transition active:scale-95"
              title="Flip camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Hold to Confirm Progress Ring */}
            {isMatching && holdProgress > 0 && (
              <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] flex flex-col items-center justify-center transition-all">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#10B981"
                      strokeWidth="8"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (264 * holdProgress) / 100}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-200"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold mt-1">HOLD STILL</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Real-time Status & AI Recognition Pill */}
      <div className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isMatching ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
            }`}
          />
          <span className="text-slate-400">AI Detected:</span>
          <span className="font-bold text-white uppercase">{detectedSign}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-slate-400">
          <span>Match:</span>
          <span className={isMatching ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}
