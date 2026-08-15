import { ExtensionSettings } from '../types/settings';

export class AutoActionsEngine {
  private hasReadiedCurrentMatch = false;
  private hasPlayedServerSound = false;
  private hasCopiedServerIp = false;

  public resetForNewMatch() {
    this.hasReadiedCurrentMatch = false;
    this.hasPlayedServerSound = false;
    this.hasCopiedServerIp = false;
  }

  public checkAndExecute(settings: ExtensionSettings, serverIp?: string) {
    if (settings.autoReadyUp) {
      this.checkAutoReady();
    }

    if (settings.autoAcceptParty) {
      this.checkAutoAcceptParty();
    }

    if (serverIp) {
      this.handleServerReady(serverIp, settings);
    }
  }

  private checkAutoReady() {
    if (this.hasReadiedCurrentMatch) return;

    // Search for match ready / check-in modal buttons in FACEIT DOM
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toUpperCase() || '';
      const isReadyBtn =
        text === 'CHECK IN' ||
        text === 'ACCEPT' ||
        text === 'READY' ||
        text.includes('CHECK IN') ||
        text.includes('ACCEPT MATCH');

      // Ensure button is visible and not disabled
      if (isReadyBtn && !btn.disabled && btn.offsetParent !== null) {
        console.log('[f-insight:AutoAction] Auto-Ready button detected, accepting match...');
        this.hasReadiedCurrentMatch = true;

        // Slight randomized delay (150ms) to simulate natural click
        setTimeout(() => {
          btn.click();
        }, 150);
        break;
      }
    }
  }

  private checkAutoAcceptParty() {
    // Search for party invite popovers
    const inviteButtons = document.querySelectorAll('button[class*="party-invite"], [data-testid*="party-invite"] button');
    for (const btn of inviteButtons) {
      const text = btn.textContent?.trim().toUpperCase() || '';
      if ((text === 'ACCEPT' || text === 'JOIN') && btn instanceof HTMLButtonElement && !btn.disabled) {
        btn.click();
        break;
      }
    }
  }

  private handleServerReady(serverIp: string, settings: ExtensionSettings) {
    if (!serverIp || serverIp.length < 5) return;

    // 1. Play pleasant chime sound
    if (settings.playReadySound && !this.hasPlayedServerSound) {
      this.hasPlayedServerSound = true;
      this.playChime();
    }

    // 2. Auto-copy connect string to clipboard
    if (settings.autoCopyConnectIp && !this.hasCopiedServerIp) {
      this.hasCopiedServerIp = true;
      const connectCmd = `connect ${serverIp}`;
      try {
        navigator.clipboard.writeText(connectCmd).then(() => {
          console.log(`[f-insight:AutoAction] Copied "${connectCmd}" to clipboard`);
        });
      } catch (err) {
        console.warn('[f-insight:AutoAction] Clipboard write failed:', err);
      }
    }
  }

  private playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880.0, now + 0.12); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440.0, now); // A4
      osc2.frequency.setValueAtTime(659.25, now + 0.12); // E5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } catch (err) {
      // Ignore audio policy restrictions
    }
  }
}

export const autoActionsEngine = new AutoActionsEngine();
