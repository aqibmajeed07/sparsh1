'use client';
import { useEffect, useRef, useState } from 'react';
import { Radio, Users, RefreshCw, ExternalLink, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DailyCallProps {
  roomUrl: string;
  onLeave?: () => void;
  captionsEnabled?: boolean;
  islEnabled?: boolean;
  userName?: string;
  isHost?: boolean;
}

export default function DailyCall({
  roomUrl,
  onLeave,
  captionsEnabled,
  islEnabled,
  userName,
  isHost = false,
}: DailyCallProps) {
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [callState, setCallState] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [participantCount, setParticipantCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [retryIndex, setRetryIndex] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === 'joined') {
      timer = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    if (!containerRef.current || !roomUrl) return;

    let callFrame: any;
    let destroyed = false;

    const initCall = async () => {
      setCallState('joining');
      setErrorMessage('');

      try {
        const DailyIframe = (await import('@daily-co/daily-js')).default;

        if (destroyed) return;

        // Destroy any existing instance safely
        try {
          const existing = DailyIframe.getCallInstance();
          if (existing) await existing.destroy();
        } catch (_) {}

        if (destroyed) return;

        callFrame = DailyIframe.createFrame(containerRef.current!, {
          showLeaveButton: true,
          showFullscreenButton: true,
          showUserNameChangeUI: true,
          theme: {
            colors: {
              accent: '#6C63FF',
              accentText: '#FFFFFF',
              background: '#0a0d1b',
              backgroundAccent: '#16192e',
              baseText: '#FFFFFF',
              border: '#2a2f4c',
              mainAreaBg: '#05070f',
              mainAreaBgAccent: '#0c0f20',
              mainAreaText: '#FFFFFF',
              supportiveText: '#94A3B8',
            },
          },
          iframeStyle: {
            position: 'absolute',
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '16px',
            backgroundColor: '#05070f',
          },
        });

        callFrameRef.current = callFrame;

        callFrame
          .on('joined-meeting', (evt: any) => {
            if (!destroyed) {
              setCallState('joined');
              const participants = callFrame.participants?.() || {};
              setParticipantCount(Object.keys(participants).length);
            }
          })
          .on('left-meeting', () => {
            if (!destroyed) {
              setCallState('idle');
              onLeave?.();
            }
          })
          .on('error', (err: any) => {
            if (!destroyed) {
              console.error('Daily frame error:', err);
              setErrorMessage(err?.errorMsg || 'Failed to connect to video session');
              setCallState('error');
            }
          })
          .on('participant-joined', () => {
            if (!destroyed) {
              const participants = callFrame?.participants?.() || {};
              setParticipantCount(Object.keys(participants).length);
            }
          })
          .on('participant-left', () => {
            if (!destroyed) {
              const participants = callFrame?.participants?.() || {};
              setParticipantCount(Math.max(1, Object.keys(participants).length));
            }
          });

        await callFrame.join({
          url: roomUrl,
          userName: userName || (isHost ? 'Teacher (Host)' : 'Student'),
          startVideoOff: false,
          startAudioOff: false,
        });
      } catch (err: any) {
        console.error('Daily join error:', err);
        if (!destroyed) {
          setErrorMessage(err?.message || 'Connection could not be established');
          setCallState('error');
        }
      }
    };

    initCall();

    return () => {
      destroyed = true;
      callFrame?.destroy().catch(() => {});
    };
  }, [roomUrl, retryIndex, userName, isHost]);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleLeave = async () => {
    try {
      await callFrameRef.current?.leave();
    } catch (_) {}
    onLeave?.();
  };

  return (
    <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden bg-[#05070f] border border-white/10 shadow-2xl relative">
      {/* Top Session Ribbon */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0d1b]/95 backdrop-blur-md border-b border-white/10 shrink-0 z-20">
        <div className="flex items-center gap-3">
          {callState === 'joined' && (
            <>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-xs font-bold tracking-wide">LIVE</span>
              </span>
              <span className="text-white/60 text-xs font-mono font-medium">{formatDuration(duration)}</span>
              <span className="flex items-center gap-1 text-white/60 text-xs bg-white/5 px-2 py-0.5 rounded-md">
                <Users className="w-3.5 h-3.5 text-[#00C9A7]" />
                <span>{participantCount || 1} in class</span>
              </span>
            </>
          )}
          {callState === 'joining' && (
            <span className="text-yellow-400 text-xs font-medium flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              Connecting to Sparsh Live Room…
            </span>
          )}
          {callState === 'error' && (
            <span className="text-red-400 text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Connection Warning
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {captionsEnabled && (
            <span className="px-2 py-0.5 bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30 text-[10px] font-bold rounded-md">
              CC ON
            </span>
          )}
          {islEnabled && (
            <span className="px-2 py-0.5 bg-[#6C63FF]/20 text-[#6C63FF] border border-[#6C63FF]/30 text-[10px] font-bold rounded-md">
              ISL 3D ON
            </span>
          )}
          <button
            onClick={handleLeave}
            className="px-3.5 py-1 bg-red-500/90 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition active:scale-95 shadow-md shadow-red-500/20"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Embedded Daily Meeting Video Frame */}
      <div className="flex-1 relative w-full h-full min-h-0 bg-[#05070f]" ref={containerRef}>
        {callState === 'joining' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0d1b]/95 backdrop-blur-md">
            <div className="text-center p-6 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6C63FF] to-[#00C9A7] mx-auto flex items-center justify-center mb-4 shadow-xl shadow-[#6C63FF]/30 animate-pulse">
                <Radio className="w-8 h-8 text-white animate-spin" />
              </div>
              <h4 className="text-white font-bold text-base">Joining Live Classroom</h4>
              <p className="text-white/50 text-xs mt-1">
                Connecting audio, multi-person video grid, and accessible channels…
              </p>
            </div>
          </div>
        )}

        {callState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0d1b] p-6">
            <div className="text-center max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 mx-auto flex items-center justify-center mb-4 text-amber-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Live Class Reconnect</h3>
              <p className="text-white/60 text-xs mb-4 leading-relaxed">
                {errorMessage || 'The video connection encountered an interruption. You can retry immediately or open the secure meeting room directly.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setRetryIndex(i => i + 1)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-semibold text-xs hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Connection</span>
                </button>
                {roomUrl && (
                  <a
                    href={roomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition flex items-center justify-center gap-2 border border-white/15"
                  >
                    <span>Open in New Window</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
