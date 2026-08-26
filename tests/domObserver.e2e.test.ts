// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DomObserver } from '../src/content/domObserver';

/** Realistic FACEIT room snapshot — roster (anchor + span), scoreboard, chat, popup */
const ROOM_HTML = `
  <div class="MatchRoom__Container">
    <div class="MatchTeamMember"><a href="/en/players/PlayerOne">PlayerOne</a></div>
    <div class="MatchTeamMember"><a href="/en/players/PlayerTwo">PlayerTwo</a></div>
    <div class="TeamMember"><span>PlayerThree</span></div>
    <div class="RosterPlayer"><a href="/players/0a1b2c3d-1234-5678-90ab-cdef12345678">UUID_Player</a></div>
  </div>
  <div class="Scoreboard">
    <tr><td><span>PlayerOne</span></td></tr>
    <tr><td><span>PlayerTwo</span></td></tr>
  </div>
  <div class="chat"><span>gg</span><span>PlayerOne</span><div>connect 1.2.3.4:27015</div></div>
  <div class="players-modal"><a href="/players/PlayerOne">PlayerOne</a></div>
`;

describe('domObserver e2e — real FACEIT markup', () => {
  let observer: DomObserver;

  beforeEach(() => {
    document.body.innerHTML = ROOM_HTML;
    observer = new DomObserver();
  });
  afterEach(() => {
    observer.stopObserving();
    document.body.innerHTML = '';
  });

  it('finds roster rows via primary selectors (anchor + span) but not chat', () => {
    const targets = observer.findPlayerElements(['PlayerOne', 'PlayerTwo', 'PlayerThree']);
    const nicks = targets.map((t) => t.nickname);
    expect(nicks).toContain('PlayerOne');
    expect(nicks).toContain('PlayerTwo');
    // PlayerThree is span without href — fallback should find it
    expect(nicks).toContain('PlayerThree');
    // Chat "PlayerOne" must not create extra target beyond roster/scoreboard/modal
    // Chat container itself should be ignored
    const chatSpan = document.querySelector('.chat span');
    expect(targets.some((t) => t.element === chatSpan)).toBe(false);
  });

  it('recovers anchor-less rows via text fallback (span/div)', () => {
    // Remove hrefs to force fallback
    document.body.innerHTML = `
      <div class="MatchRoom__Container">
        <div class="member"><span>FallbackNick</span></div>
      </div>`;
    const o2 = new DomObserver();
    const targets = o2.findPlayerElements(['FallbackNick']);
    expect(targets.some((t) => t.nickname === 'FallbackNick')).toBe(true);
  });

  it('ignores short nick collisions in chat (P1-07)', () => {
    document.body.innerHTML = `
      <div class="MatchRoom__Container"><a href="/players/gg">gg</a></div>
      <div class="chat"><span>gg</span></div>
    `;
    const o3 = new DomObserver();
    const targets = o3.findPlayerElements(['gg']);
    // Should find exactly one — roster, not chat
    const ggTargets = targets.filter((t) => t.nickname.toLowerCase() === 'gg');
    expect(ggTargets).toHaveLength(1);
    expect(ggTargets[0].element.closest('.chat')).toBeNull();
  });

  it('extracts UUID from profile link', () => {
    document.body.innerHTML = `<a href="/players/0a1b2c3d-1234-5678-90ab-cdef12345678">x</a>`;
    const o4 = new DomObserver();
    const targets = o4.findPlayerElements([]);
    expect(targets[0]?.playerId).toBe('0a1b2c3d-1234-5678-90ab-cdef12345678');
  });

  it('findServerIpFromDom ignores chat code', () => {
    document.body.innerHTML = `
      <div class="MatchRoom__Container"><a href="steam://connect/5.6.7.8:27015">connect</a></div>
      <div class="chat"><code>connect 1.1.1.1:27015</code></div>
    `;
    const ip = observer.findServerIpFromDom();
    expect(ip).toBe('5.6.7.8:27015');
  });

  it('findServerIpFromDom rejects domain and returns strict IPv4 only', () => {
    document.body.innerHTML = `<div class="MatchRoom__Container"><code>connect evil.com:27015</code></div>`;
    const o5 = new DomObserver();
    expect(o5.findServerIpFromDom()).toBeNull();
  });
});
