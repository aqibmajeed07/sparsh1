'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function SuperAdminConfig() {
  const [config, setConfig] = useState<any>({
    maintenance_mode: false,
    stripe_sandbox: true,
    openai_api_key: '',
    agora_app_id: '',
    brand_primary_color: '#6C63FF'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from('system_config').select('*').single();
    if (data) setConfig(data);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('system_config').update({
      maintenance_mode: config.maintenance_mode,
      stripe_sandbox: config.stripe_sandbox,
      openai_api_key: config.openai_api_key,
      agora_app_id: config.agora_app_id,
      brand_primary_color: config.brand_primary_color
    }).eq('id', config.id || '');

    setSaving(false);
    if (!error) alert('Configuration saved successfully!');
  };

  if (loading) return <div className="text-white mt-10 text-center animate-pulse">Loading configurations...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Application Configuration</h1>
        <p className="text-white/60 mt-1">Manage global platform settings, API keys, and payments</p>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white border-b border-white/10 pb-2">Global Settings</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Maintenance Mode</p>
            <p className="text-white/40 text-sm">Disable access for non-admin users.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={config.maintenance_mode} onChange={e => setConfig({ ...config, maintenance_mode: e.target.checked })} />
            <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
        </div>

        <div className="space-y-3">
          <label className="text-white font-medium block">Brand Primary Color Hex</label>
          <div className="flex items-center gap-4">
            <input 
              type="color" 
              value={config.brand_primary_color || '#6C63FF'} 
              onChange={e => setConfig({ ...config, brand_primary_color: e.target.value })}
              className="w-12 h-12 rounded cursor-pointer bg-transparent border-0"
            />
            <input 
              type="text" 
              value={config.brand_primary_color || '#6C63FF'} 
              onChange={e => setConfig({ ...config, brand_primary_color: e.target.value })}
              className="glass-input flex-1 max-w-[200px]"
            />
          </div>
        </div>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white border-b border-white/10 pb-2">Payment Integration</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Stripe Sandbox Mode</p>
            <p className="text-white/40 text-sm">Use test API keys for transactions.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={config.stripe_sandbox} onChange={e => setConfig({ ...config, stripe_sandbox: e.target.checked })} />
            <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00C9A7]"></div>
          </label>
        </div>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white border-b border-white/10 pb-2">API Integrations</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-white/80 text-sm mb-1 block">OpenAI API Key</label>
            <input 
              type="password" 
              value={config.openai_api_key || ''} 
              onChange={e => setConfig({ ...config, openai_api_key: e.target.value })}
              className="glass-input w-full font-mono text-sm"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="text-white/80 text-sm mb-1 block">Daily.co API Key (Live Classes Engine)</label>
            <input 
              type="password" 
              value={config.daily_api_key || config.agora_app_id || ''} 
              onChange={e => setConfig({ ...config, daily_api_key: e.target.value })}
              className="glass-input w-full font-mono text-sm"
              placeholder="Enter Daily.co REST API Key"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

    </div>
  );
}
