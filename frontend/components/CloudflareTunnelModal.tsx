'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, Sparkles, CheckCircle2, AlertCircle, RefreshCw, X, Copy, Check } from 'lucide-react';
import { CURRENT_ACTIVE_TUNNEL, getPrimaryBackendUrl } from '@/lib/backendUrl';

export function CloudflareTunnelBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let saved = localStorage.getItem('sparsh_tunnel_url');
      if (!saved || saved.includes('club-recreational') || saved.includes('output-available') || saved.includes('spare-nato')) {
        saved = CURRENT_ACTIVE_TUNNEL;
        localStorage.setItem('sparsh_tunnel_url', CURRENT_ACTIVE_TUNNEL);
      }
      setTunnelUrl(saved);
    }
  }, []);

  const handleSave = () => {
    const clean = tunnelUrl.trim().replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      if (clean) {
        localStorage.setItem('sparsh_tunnel_url', clean);
        window.dispatchEvent(new CustomEvent('sparsh:tunnel-updated', { detail: { url: clean } }));
      } else {
        localStorage.removeItem('sparsh_tunnel_url');
        window.dispatchEvent(new CustomEvent('sparsh:tunnel-updated', { detail: { url: '' } }));
      }
    }
    setIsOpen(false);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Testing connection to Local Ollama & Glasses Backend...');
    const testUrl = tunnelUrl.trim() || CURRENT_ACTIVE_TUNNEL;

    // 1. Try health via serverless proxy (bypasses browser CORS & mixed content)
    try {
      const proxyRes = await fetch(`/api/glasses/config?tunnel_url=${encodeURIComponent(testUrl)}`);
      if (proxyRes.ok) {
        setTestStatus('success');
        setTestMessage('Connected to Sparsh AI Backend. Local Ollama & Glasses Ready!');
        return;
      }
    } catch (_) {}

    // 2. Direct fetch with bypass header
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${testUrl}/health`, {
        method: 'GET',
        headers: {
          'bypass-tunnel-reminder': 'true',
          'User-Agent': 'SparshClient',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        setTestStatus('success');
        setTestMessage(`Connected to Sparsh AI Backend (${data.version || 'v2.2'}). Local Ollama & Glasses Ready!`);
      } else {
        setTestStatus('error');
        setTestMessage(`Backend responded with status ${res.status}. Check if cloudflared is running.`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage('Could not reach tunnel. Run: cloudflared tunnel --url http://localhost:8000');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          handleTestConnection();
        }}
        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer bg-gradient-to-r from-emerald-500/15 to-[#00C9A7]/15 text-[#00C9A7] border-[#00C9A7]/40 hover:border-[#00C9A7] hover:bg-[#00C9A7]/25 shadow-sm"
        title="Local Ollama AI & Smart Glasses Cloudflare Connection"
      >
        <span className="w-2 h-2 rounded-full bg-[#00C9A7] animate-pulse"></span>
        <span className="hidden sm:inline">Local Ollama &amp; Glasses</span>
        <span className="sm:hidden">AI Tunnel</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="glass-card w-full max-w-md p-5 sm:p-6 rounded-2xl border border-white/20 bg-[#0f0c29]/95 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <h3 className="font-bold text-sm text-white">Cloudflare AI &amp; Glasses Tunnel</h3>
                  <p className="text-[11px] text-white/50">Bridges your local laptop Ollama &amp; Glasses to the production app</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/50 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-white/60 flex items-center justify-between">
                <span>Active Backend Tunnel URL</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tunnelUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </label>

              <input
                type="url"
                value={tunnelUrl}
                onChange={(e) => setTunnelUrl(e.target.value)}
                placeholder="https://xxxx.trycloudflare.com"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-[#00C9A7]"
              />

              <div className="text-[10px] text-white/50 space-y-1 bg-white/5 p-2.5 rounded-xl border border-white/10">
                <p className="text-white/80 font-semibold">Running on your laptop:</p>
                <code className="text-[#00C9A7] block font-mono">cloudflared tunnel --url http://localhost:8000</code>
                <code className="text-sky-300 block font-mono">ollama run llama3.2</code>
              </div>
            </div>

            {testStatus !== 'idle' && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testStatus === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : testStatus === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-white/5 border-white/15 text-white/70'
                }`}
              >
                {testStatus === 'testing' ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
                ) : testStatus === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{testMessage}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition"
              >
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white font-bold text-xs shadow-md active:scale-95 transition"
              >
                Save &amp; Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
