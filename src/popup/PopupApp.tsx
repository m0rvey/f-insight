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
  Copy,
  UserCheck,
} from 'lucide-react';
import { SettingToggle } from '../components/popup/SettingToggle';

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
            <SettingToggle
              title="Auto Ready-Up"
              description="Automatically clicks Accept when match pops"
              icon={Play}
              iconColorClass="text-emerald-400"
              checked={settings.autoReadyUp}
              onChange={(val) => {
                setSettings({ ...settings, autoReadyUp: val });
                handleSaveSettings({ autoReadyUp: val });
              }}
            />
            <SettingToggle
              title="Auto Accept Party Invites"
              description="Accepts lobby invitations from friends"
              icon={UserCheck}
              iconColorClass="text-blue-400"
              checked={settings.autoAcceptParty}
              onChange={(val) => {
                setSettings({ ...settings, autoAcceptParty: val });
                handleSaveSettings({ autoAcceptParty: val });
              }}
            />
            <SettingToggle
              title="Auto-Copy Server IP"
              description="Copies connect IP to clipboard on server ready"
              icon={Copy}
              iconColorClass="text-amber-400"
              checked={settings.autoCopyConnectIp}
              onChange={(val) => {
                setSettings({ ...settings, autoCopyConnectIp: val });
                handleSaveSettings({ autoCopyConnectIp: val });
              }}
            />
            <SettingToggle
              title="Auto-Dismiss AFK Checks"
              description="Auto-clicks 'I am here' on inactivity popups"
              icon={Shield}
              iconColorClass="text-cyan-400"
              checked={settings.autoDismissAfk}
              onChange={(val) => {
                setSettings({ ...settings, autoDismissAfk: val });
                handleSaveSettings({ autoDismissAfk: val });
              }}
            />
            <SettingToggle
              title="Auto-Continue Match Queuing"
              description="Resumes search if another player fails check-in"
              icon={Compass}
              iconColorClass="text-purple-400"
              checked={settings.autoContinueQueue}
              onChange={(val) => {
                setSettings({ ...settings, autoContinueQueue: val });
                handleSaveSettings({ autoContinueQueue: val });
              }}
            />
            <SettingToggle
              title="Auto-Dismiss Captain Notices"
              description="Auto-confirms captain and coin toss dialogs"
              icon={Zap}
              iconColorClass="text-yellow-400"
              checked={settings.autoDismissCaptain}
              onChange={(val) => {
                setSettings({ ...settings, autoDismissCaptain: val });
                handleSaveSettings({ autoDismissCaptain: val });
              }}
            />
            <SettingToggle
              title="Clean Interface (Hide Banners)"
              description="Hides client download banners and promos"
              icon={Sliders}
              iconColorClass="text-zinc-400"
              checked={settings.autoHideClientBanner}
              onChange={(val) => {
                setSettings({ ...settings, autoHideClientBanner: val });
                handleSaveSettings({ autoHideClientBanner: val });
              }}
            />
            <SettingToggle
              title="Auto-Veto Captain Assist"
              description="Auto-bans team worst map during live veto"
              icon={Layers}
              iconColorClass="text-faceit-orange"
              checked={settings.autoVetoMaps}
              onChange={(val) => {
                setSettings({ ...settings, autoVetoMaps: val });
                handleSaveSettings({ autoVetoMaps: val });
              }}
            />
          </div>
        )}

        {/* TAB 3: MODULES & TOGGLES */}
        {activeTab === 'modules' && (
          <div className="space-y-2">
            <SettingToggle
              title="Smurf & Risk Detector"
              variant="simple"
              checked={settings.enableRedFlags}
              onChange={(val) => {
                setSettings({ ...settings, enableRedFlags: val });
                handleSaveSettings({ enableRedFlags: val });
              }}
            />
            <SettingToggle
              title="Veto & Map Pool Matrix"
              variant="simple"
              checked={settings.enableVetoHelper}
              onChange={(val) => {
                setSettings({ ...settings, enableVetoHelper: val });
                handleSaveSettings({ enableVetoHelper: val });
              }}
            />
            <SettingToggle
              title="Premade & Party Detection"
              variant="simple"
              checked={settings.enablePremadeDetection}
              onChange={(val) => {
                setSettings({ ...settings, enablePremadeDetection: val });
                handleSaveSettings({ enablePremadeDetection: val });
              }}
            />
            <SettingToggle
              title="Firepower Contribution (FCR %)"
              variant="simple"
              checked={settings.showFcrRating}
              onChange={(val) => {
                setSettings({ ...settings, showFcrRating: val });
                handleSaveSettings({ showFcrRating: val });
              }}
            />
            <SettingToggle
              title="Player Form & Momentum (Hot/Cold)"
              variant="simple"
              checked={settings.showFormIndicators}
              onChange={(val) => {
                setSettings({ ...settings, showFormIndicators: val });
                handleSaveSettings({ showFormIndicators: val });
              }}
            />
            <SettingToggle
              title="Floating Action Button HUD"
              variant="simple"
              checked={settings.enableFloatingControls}
              onChange={(val) => {
                setSettings({ ...settings, enableFloatingControls: val });
                handleSaveSettings({ enableFloatingControls: val });
              }}
            />
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
