import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSteamProfileXml, steamApi } from '../src/services/steamApi';

const STEAM_ID = '76561198000000000';

const PUBLIC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<profile>
  <steamID><![CDATA[PlayerX]]></steamID>
  <privacyState>public</privacyState>
  <avatarFull><![CDATA[https://cdn.akamai.steamstatic.com/steamcommunity/public/images/avatars/ab/avatar.png]]></avatarFull>
  <memberSince>2015-01-01T00:00:00Z</memberSince>
  <mostPlayedGames>
    <mostPlayedGame>
      <gameName>Counter-Strike 2</gameName>
      <hoursOnRecord>1200</hoursOnRecord>
      <hoursPlayed>10</hoursPlayed>
    </mostPlayedGame>
  </mostPlayedGames>
  <communityBanned>0</communityBanned>
  <vacBanned>1</vacBanned>
  <numberOfVACBans>1</numberOfVACBans>
  <daysSinceLastBan>120</daysSinceLastBan>
  <numberOfGameBans>2</numberOfGameBans>
  <economyBan>none</economyBan>
</profile>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseSteamProfileXml', () => {
  it('should parse a public profile', () => {
    const result = parseSteamProfileXml(PUBLIC_XML, STEAM_ID);

    expect(result.isPrivate).toBe(false);
    expect(result.summary?.personaName).toBe('PlayerX');
    expect(result.summary?.profileUrl).toBe(`https://steamcommunity.com/profiles/${STEAM_ID}`);
    expect(result.summary?.communityVisibilityState).toBe(3);
    expect(result.playtime?.cs2HoursTotal).toBe(1200);
    expect(result.playtime?.cs2HoursLast2Weeks).toBe(10);
    expect(result.bans?.vacBanned).toBe(true);
    expect(result.bans?.communityBanned).toBe(false);
    expect(result.bans?.numberOfVACBans).toBe(1);
    expect(result.bans?.daysSinceLastBan).toBe(120);
    expect(result.bans?.numberOfGameBans).toBe(2);
    expect(result.bans?.economyBan).toBe('none');
    expect(result.summary?.accountAgeYears).toBeGreaterThan(10);
    expect(result.summary?.timeCreated).toBeDefined();
    expect(result.summary?.timeCreated).toBe(new Date('2015-01-01T00:00:00Z').getTime() / 1000);
  });

  it('should mark a profile as private when privacyState is not public', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<profile>
  <steamID><![CDATA[PrivateUser]]></steamID>
  <privacyState>private</privacyState>
</profile>`;

    const result = parseSteamProfileXml(xml, STEAM_ID);

    expect(result.isPrivate).toBe(true);
    expect(result.summary?.communityVisibilityState).toBe(1);
    expect(result.bans?.vacBanned).toBe(false);
    expect(result.bans?.numberOfGameBans).toBe(0);
    expect(result.bans?.economyBan).toBe('none');
  });

  it('should return fetchError for non-XML responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('this is not xml', { status: 200 })));

    const result = await steamApi.getPlayerFullData(STEAM_ID);

    expect(result.isPrivate).toBe(true);
    expect(result.fetchError).toBe(true);
    expect(result.summary).toBeUndefined();
  });

  it('should return fetchError when the HTTP request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 })));

    const result = await steamApi.getPlayerFullData(STEAM_ID);

    expect(result.isPrivate).toBe(true);
    expect(result.fetchError).toBe(true);
  });
});
