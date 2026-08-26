// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { DomObserver } from '../src/content/domObserver';

function addRosterRow(nick: string, parent: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'RosterPlayer';
  const a = document.createElement('a');
  a.setAttribute('href', `https://www.faceit.com/en/players/${nick}/stats/cs2`);
  a.textContent = nick;
  row.appendChild(a);
  parent.appendChild(row);
  return row;
}

describe('DomObserver.findPlayerElements', () => {
  let observer: DomObserver;

  beforeEach(() => {
    document.body.innerHTML = '';
    observer = new DomObserver();
  });

  it('locates roster rows via primary selectors and dedupes duplicates in one context', () => {
    const page = document.createElement('div');
    document.body.appendChild(page);
    addRosterRow('s1mple', page);
    addRosterRow('s1mple', page); // same player rendered twice on the page
    addRosterRow('device', page);

    const targets = observer.findPlayerElements();
    expect(targets.map((t) => t.nickname).sort()).toEqual(['device', 's1mple']);
  });

  it('returns BOTH the roster copy and the profile-popup copy of the same player', () => {
    const page = document.createElement('div');
    document.body.appendChild(page);
    addRosterRow('s1mple', page);

    // FACEIT profile popup — a dialog containing the same player link
    const popup = document.createElement('div');
    popup.setAttribute('role', 'dialog');
    popup.className = 'players-modal-root';
    document.body.appendChild(popup);

    const modalRow = document.createElement('div');
    modalRow.className = 'RosterPlayer';
    const modalLink = document.createElement('a');
    modalLink.setAttribute('href', '/en/players-modal/s1mple/');
    modalLink.textContent = 's1mple';
    modalRow.appendChild(modalLink);
    popup.appendChild(modalRow);

    const targets = observer.findPlayerElements();
    expect(targets).toHaveLength(2);
    expect(targets.filter((t) => t.nickname === 's1mple')).toHaveLength(2);
  });

  it('extracts a UUID playerId when profile links carry an id instead of a nickname', () => {
    const page = document.createElement('div');
    document.body.appendChild(page);

    const uuid = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
    const row = document.createElement('div');
    row.className = 'MatchTeamMember';
    const a = document.createElement('a');
    a.setAttribute('href', `/players/${uuid}`);
    a.textContent = 'SomePlayer';
    row.appendChild(a);
    page.appendChild(row);

    const targets = observer.findPlayerElements(['SomePlayer']);
    expect(targets).toHaveLength(1);
    expect(targets[0].playerId).toBe(uuid);
  });

  it('recovers roster rows by nickname text when markup selectors miss them (redesign fallback)', () => {
    // Plain anchors with no roster classes and no /players/ href — primary
    // selectors find nothing, the text-based fallback must kick in.
    const list = document.createElement('ul');
    for (const nick of ['device', 'magisk']) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.setAttribute('href', '/some/other/page');
      a.textContent = nick;
      li.appendChild(a);
      list.appendChild(li);
    }
    document.body.appendChild(list);

    const targets = observer.findPlayerElements(['device', 'magisk', 'ghost-player']);
    expect(targets.map((t) => t.nickname).sort()).toEqual(['device', 'magisk']);
  });

  it('returns an empty list when neither selectors nor roster nicknames match anything', () => {
    document.body.textContent = 'no players here';
    const targets = observer.findPlayerElements(['nobody', 'nothing']);
    expect(targets).toHaveLength(0);
  });
});
