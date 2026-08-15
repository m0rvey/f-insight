// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AutoActionsEngine } from '../src/content/autoActions';
import { ExtensionSettings } from '../src/types/settings';
import { MatchStatus } from '../src/types/faceit';

const RECT = { width: 120, height: 30, top: 0, left: 0, bottom: 30, right: 120, x: 0, y: 0, toJSON: () => ({}) };

function makeButton(text: string, className = '', attrs: Record<string, string> = {}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  if (className) btn.className = className;
  for (const [k, v] of Object.entries(attrs)) btn.setAttribute(k, v);
  btn.getBoundingClientRect = () => RECT as DOMRect;
  return btn;
}

function spyClick(btn: HTMLElement) {
  const spy = vi.fn();
  btn.addEventListener('click', spy);
  return spy;
}

const baseSettings: ExtensionSettings = {
  autoReadyUp: true,
  autoAcceptParty: true,
  autoDismissAfk: true,
  autoContinueQueue: true,
  autoDismissCaptain: true,
  autoHideClientBanner: true,
  autoVetoMaps: true,
  autoCopyConnectIp: false,
  enableVetoHelper: true,
  riskThreshold: 'MEDIUM',
};

describe('AutoActionsEngine', () => {
  let engine: AutoActionsEngine;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new AutoActionsEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('match status gating', () => {
    it('does not click ready/veto buttons when match is not in VOTING phase', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('CHECK IN');
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      for (const status of ['CONFIGURING', 'READY', 'ON_GOING', 'FINISHED', 'CANCELLED'] as MatchStatus[]) {
        engine.checkAndExecute(baseSettings, undefined, [], status);
      }

      expect(spy).not.toHaveBeenCalled();
    });

    it('clicks ready button only during VOTING phase', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('CHECK IN');
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('ready context guards', () => {
    it('does not click an "ACCEPT" button outside a match room (e.g. party invite)', () => {
      const partyInvite = makeButton('ACCEPT', 'party-invite');
      document.body.appendChild(partyInvite);

      const spy = spyClick(partyInvite);

      engine.checkAndExecute({ ...baseSettings, autoAcceptParty: false }, undefined, [], 'VOTING');

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not click disabled ready buttons', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('READY');
      readyBtn.disabled = true;
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');

      expect(spy).not.toHaveBeenCalled();
    });

    it('accepts a party invite via autoAcceptParty', () => {
      const inviteBtn = makeButton('ACCEPT', 'party-invite');
      document.body.appendChild(inviteBtn);

      const spy = spyClick(inviteBtn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, [], undefined);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('respects per-action cooldown: no second click within 5s for ready', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('CHECK IN');
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');
      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('queue continue context', () => {
    it('only clicks "CONTINUE" inside a dialog', () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      const contBtn = makeButton('CONTINUE');
      dialog.appendChild(contBtn);
      document.body.appendChild(dialog);

      const looseBtn = makeButton('CONTINUE');
      document.body.appendChild(looseBtn);

      const spyDialog = spyClick(contBtn);
      const spyLoose = spyClick(looseBtn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, [], undefined);

      expect(spyDialog).toHaveBeenCalledTimes(1);
      expect(spyLoose).not.toHaveBeenCalled();
    });
  });

  describe('auto veto', () => {
    const rankedMaps = [
      { mapName: 'de_dust2', rank: 1, winRate: 55, recommendation: 'PICK' as const },
      { mapName: 'de_mirage', rank: 2, winRate: 40, recommendation: 'RISK_BAN' as const },
    ];

    function addTurnIndicator(teamText: string) {
      const ind = document.createElement('div');
      ind.className = 'active-team voting-turn';
      ind.textContent = teamText;
      ind.getBoundingClientRect = () => RECT as DOMRect;
      document.body.appendChild(ind);
      return ind;
    }

    function buildVoteButton(mapName: string, extraClass = '') {
      const mapContainer = document.createElement('div');
      mapContainer.className = `map-entity ${extraClass}`;
      mapContainer.textContent = mapName;
      const btn = makeButton('BAN', 'vote-button');
      mapContainer.appendChild(btn);
      document.body.appendChild(mapContainer);
      return { btn, mapContainer };
    }

    it('bans the lowest ranked recommended map during VOTING when it is our turn', () => {
      addTurnIndicator('Team Alpha is banning');
      const { btn, mapContainer } = buildVoteButton('de_mirage');
      buildVoteButton('de_dust2');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', 'Team Alpha');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(mapContainer.textContent).toContain('de_mirage');
    });

    it('does not veto when no active turn indicator is present', () => {
      const { btn } = buildVoteButton('de_mirage');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', 'Team Alpha');

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not veto when the enemy team is on the active turn', () => {
      addTurnIndicator('Team Bravo is banning');
      const { btn } = buildVoteButton('de_mirage');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', 'Team Alpha');

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not veto when the user team name is unknown', () => {
      addTurnIndicator('Team Alpha is banning');
      const { btn } = buildVoteButton('de_mirage');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', undefined);

      expect(spy).not.toHaveBeenCalled();
    });

    it('auto-vetoes only once per match', () => {
      addTurnIndicator('Team Alpha is banning');
      const { btn } = buildVoteButton('de_mirage');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', 'Team Alpha');
      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', 'Team Alpha');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not click a vote button that was already voted/banned', () => {
      addTurnIndicator('Team Alpha is banning');
      const { btn } = buildVoteButton('de_mirage', 'voted');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'VOTING', 'Team Alpha');

      expect(spy).not.toHaveBeenCalled();
    });

    it('does not veto outside VOTING phase', () => {
      addTurnIndicator('Team Alpha is banning');
      const { btn } = buildVoteButton('de_mirage');
      const spy = spyClick(btn);

      engine.checkAndExecute({ ...baseSettings, autoReadyUp: false }, undefined, rankedMaps, 'READY', 'Team Alpha');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('user activity lock', () => {
    it('does not click anything shortly after user interaction', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('CHECK IN');
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      engine.noteUserActivity();
      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');

      expect(spy).not.toHaveBeenCalled();
    });

    it('acts again once the lock window has passed', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('CHECK IN');
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      engine.noteUserActivity();
      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');
      expect(spy).not.toHaveBeenCalled();

      vi.setSystemTime(new Date('2026-01-01T00:00:03Z'));
      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');
      expect(spy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('ready popover guard', () => {
    it('does not click a ready button inside a popover/modal', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const popover = document.createElement('div');
      popover.className = 'popover';
      const btn = makeButton('READY');
      popover.appendChild(btn);
      matchRoom.appendChild(popover);
      document.body.appendChild(matchRoom);

      const spy = spyClick(btn);

      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('resetForNewMatch', () => {
    it('clears cooldowns so clicks can fire again', () => {
      const matchRoom = document.createElement('div');
      matchRoom.className = 'MatchRoom';
      const readyBtn = makeButton('CHECK IN');
      matchRoom.appendChild(readyBtn);
      document.body.appendChild(matchRoom);

      const spy = spyClick(readyBtn);

      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');
      engine.resetForNewMatch();
      engine.checkAndExecute(baseSettings, undefined, [], 'VOTING');

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});