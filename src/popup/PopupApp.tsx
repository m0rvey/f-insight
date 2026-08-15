import React, { useState, useEffect } from 'react';
import { ExtensionSettings, DEFAULT_SETTINGS } from '../types/settings';
import { MessageResponse } from '../types/messages';
import {
  Zap,
  CheckCircle2,
  Sliders,
  Database,
  Trash2,
  Shield,
  Layers,
  Users,
  Compass,
  Play,
  Volume2,
  Copy,
  UserCheck,
} from 'lucide-react';

export const PopupApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'status' | 'automation' | 'modules' | 'cache'>('status');
  const [settings, setSettings] = useState<ExtensionSettings>({ ...DEFAULT_SETTINGS });
  const [cacheStats, setCacheStats] = useState<{ totalEntries: number; bytesInUse: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadCacheStats();
  }, []);

  const loadSettings = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res: MessageResponse<ExtensionSettings> = await chrome.runtime.sendMessage({
          type: 'GET_SETTINGS',
        });
        if (res?.success && res.data) {
          setSettings(res.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load settings:', err);
    }
  };

  const loadCacheStats = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res: MessageResponse<{ totalEntries: number; bytesInUse: number }> = await chrome.runtime.sendMessage({
          type: 'GET_CACHE_STATS',
        });
        if (res?.success && res.data) {
          setCacheStats(res.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load cache stats:', err);
    }
  };

  const handleSaveSettings = async (partial?: Partial<ExtensionSettings>) => {
    const updated = { ...settings, ...(partial || {}) };
    setSettings(updated);

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res: MessageResponse<ExtensionSettings> = await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: updated,
        });

        if (res?.success) {
          showStatus('Settings saved');
        }
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleClearCache = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
        showStatus('Cache cleared successfully');
        loadCacheStats();
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
    }
  };

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-[370px] min-h-[460px] bg-faceit-dark text-white font-sans flex flex-col selection:bg-faceit-orange selection:text-black">
      {/* Header */}
      <div className="p-3.5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border-b border-faceit-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-faceit-orange/20 border border-faceit-orange/50 flex items-center justify-center shadow-glow-orange">
            <Zap className="w-4 h-4 text-faceit-orange fill-faceit-orange" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wide text-white">f-insight</span>
            <p className="text-[11px] text-faceit-muted">FACEIT CS2 Extension</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Auto Ready
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border-b border-faceit-border/80 bg-zinc-900/80 text-xs text-center">
        <button
          onClick={() => setActiveTab('status')}
          className={`py-2.5 px-1 font-semibold border-b-2 transition flex items-center justify-center gap-1 ${
            activeTab === 'status'
              ? 'border-faceit-orange text-faceit-orange bg-white/[0.02]'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`py-2.5 px-1 font-semibold border-b-2 transition flex items-center justify-center gap-1 ${
            activeTab === 'automation'
              ? 'border-faceit-orange text-faceit-orange bg-white/[0.02]'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          <span>Auto QoL</span>
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`py-2.5 px-1 font-semibold border-b-2 transition flex items-center justify-center gap-1 ${
            activeTab === 'modules'
              ? 'border-faceit-orange text-faceit-orange bg-white/[0.02]'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Modules</span>
        </button>
        <button
          onClick={() => setActiveTab('cache')}
          className={`py-2.5 px-1 font-semibold border-b-2 transition flex items-center justify-center gap-1 ${
            activeTab === 'cache'
              ? 'border-faceit-orange text-faceit-orange bg-white/[0.02]'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Cache</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 flex-1 space-y-3.5 max-h-[380px] overflow-y-auto">
        {statusMessage && (
          <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* TAB 1: STATUS & OVERVIEW */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            {/* Status Banner */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="font-bold text-xs text-white">All Systems Operational</div>
                <p className="text-[11px] text-zinc-300 mt-0.5">
                  Real-time match room analytics, automated queue tools, multi-factor prediction logic, and tactical map overlays are active.
                </p>
              </div>
            </div>

            {/* Feature Status Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-faceit-card rounded-lg p-2.5 border border-faceit-border/80 flex items-center gap-2">
                <Shield className="w-4 h-4 text-faceit-orange flex-shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px]">Smurf Scorer</div>
                  <div className="text-[10px] text-emerald-400 font-mono">● 0-100% Risk</div>
                </div>
              </div>

              <div className="bg-faceit-card rounded-lg p-2.5 border border-faceit-border/80 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px]">Veto Helper</div>
                  <div className="text-[10px] text-emerald-400 font-mono">● 7 Active Maps</div>
                </div>
              </div>

              <div className="bg-faceit-card rounded-lg p-2.5 border border-faceit-border/80 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px]">Auto Ready-Up</div>
                  <div className="text-[10px] text-emerald-400 font-mono">{settings.autoReadyUp ? '● Enabled' : '○ Disabled'}</div>
                </div>
              </div>

              <div className="bg-faceit-card rounded-lg p-2.5 border border-faceit-border/80 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200 text-[11px]">Party Detector</div>
                  <div className="text-[10px] text-emerald-400 font-mono">● Auto Cluster</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUTOMATION & QOL */}
        {activeTab === 'automation' && (
          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Auto Ready-Up</div>
                  <div className="text-[11px] text-faceit-muted">Automatically clicks Accept when match pops</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoReadyUp}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, autoReadyUp: val });
                  handleSaveSettings({ autoReadyUp: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Auto Accept Party Invites</div>
                  <div className="text-[11px] text-faceit-muted">Accepts lobby invitations from friends</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoAcceptParty}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, autoAcceptParty: val });
                  handleSaveSettings({ autoAcceptParty: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Copy className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Auto-Copy Server IP</div>
                  <div className="text-[11px] text-faceit-muted">Copies connect IP to clipboard on server ready</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoCopyConnectIp}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, autoCopyConnectIp: val });
                  handleSaveSettings({ autoCopyConnectIp: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="text-xs font-bold text-zinc-100">Server Ready Sound Alert</div>
                  <div className="text-[11px] text-faceit-muted">Plays pleasant chime when server is ready</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.playReadySound}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, playReadySound: val });
                  handleSaveSettings({ playReadySound: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 3: MODULES & TOGGLES */}
        {activeTab === 'modules' && (
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Smurf & Risk Detector</span>
              <input
                type="checkbox"
                checked={settings.enableRedFlags}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, enableRedFlags: val });
                  handleSaveSettings({ enableRedFlags: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Veto & Map Pool Matrix</span>
              <input
                type="checkbox"
                checked={settings.enableVetoHelper}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, enableVetoHelper: val });
                  handleSaveSettings({ enableVetoHelper: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Premade & Party Detection</span>
              <input
                type="checkbox"
                checked={settings.enablePremadeDetection}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, enablePremadeDetection: val });
                  handleSaveSettings({ enablePremadeDetection: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Firepower Contribution (FCR %)</span>
              <input
                type="checkbox"
                checked={settings.showFcrRating}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, showFcrRating: val });
                  handleSaveSettings({ showFcrRating: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Player Form & Momentum (Hot/Cold)</span>
              <input
                type="checkbox"
                checked={settings.showFormIndicators}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, showFormIndicators: val });
                  handleSaveSettings({ showFormIndicators: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-faceit-card border border-faceit-border flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Floating Action Button HUD</span>
              <input
                type="checkbox"
                checked={settings.enableFloatingControls}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings({ ...settings, enableFloatingControls: val });
                  handleSaveSettings({ enableFloatingControls: val });
                }}
                className="w-4 h-4 accent-faceit-orange cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* TAB 4: CACHE & DIAGNOSTICS */}
        {activeTab === 'cache' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border space-y-2">
              <div className="text-xs font-bold text-zinc-100">Local Cache (chrome.storage)</div>
              <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
                <div className="bg-faceit-dark/70 rounded p-2 border border-zinc-700/40">
                  <div className="text-[10px] text-faceit-muted font-sans uppercase">Cached Players</div>
                  <div className="text-sm font-bold text-zinc-100 mt-0.5">{cacheStats?.totalEntries ?? 0}</div>
                </div>
                <div className="bg-faceit-dark/70 rounded p-2 border border-zinc-700/40">
                  <div className="text-[10px] text-faceit-muted font-sans uppercase">Storage Used</div>
                  <div className="text-sm font-bold text-zinc-100 mt-0.5">{formatBytes(cacheStats?.bytesInUse ?? 0)}</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-faceit-card border border-faceit-border flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-zinc-100">Purge Cached Stats</div>
                <div className="text-[11px] text-faceit-muted">Forces fresh reload on next match room open</div>
              </div>
              <button
                onClick={handleClearCache}
                className="py-1.5 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-950 border-t border-faceit-border/60 text-center text-[10px] text-zinc-500">
        f-insight • Open-Source MIT • 100% Free & Fast
      </div>
    </div>
  );
};
