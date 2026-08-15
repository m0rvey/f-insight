import { SteamFullData, SteamPlayerSummary, SteamBanStatus } from '../types/steam';

export function parseSteamProfileXml(xmlText: string, steamId64: string): SteamFullData {
  const isPrivate = !xmlText.includes('<privacyState>public</privacyState>');
  const personaNameMatch = xmlText.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
  const avatarMatch = xmlText.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);

  const summary: SteamPlayerSummary = {
    steamId64,
    personaName: personaNameMatch ? personaNameMatch[1] : 'Steam User',
    profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
    avatar: avatarMatch ? avatarMatch[1] : '',
    communityVisibilityState: isPrivate ? 1 : 3,
  };

  let cs2HoursTotal = 0;
  let cs2HoursLast2Weeks = 0;

  // Search for CS2 in mostPlayedGames block
  const mostPlayedMatch = xmlText.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (mostPlayedMatch) {
    const games = mostPlayedMatch[1].split('</mostPlayedGame>');
    for (const game of games) {
      if (game.includes('Counter-Strike 2') || game.includes('Counter-Strike: Global Offensive')) {
        // Extract total hours and recent hours
        const totalHoursMatch = game.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        if (totalHoursMatch) {
          cs2HoursTotal = parseFloat(totalHoursMatch[1].replace(/,/g, ''));
        }
        const recentHoursMatch = game.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        if (recentHoursMatch) {
          cs2HoursLast2Weeks = parseFloat(recentHoursMatch[1].replace(/,/g, ''));
          if (cs2HoursTotal === 0) {
            cs2HoursTotal = cs2HoursLast2Weeks; // Fallback if hoursOnRecord is missing
          }
        }
        break;
      }
    }
  }

  const memberSinceMatch = xmlText.match(/<memberSince>(.*?)<\/memberSince>/);
  if (memberSinceMatch) {
    const memberDate = new Date(memberSinceMatch[1]);
    if (!isNaN(memberDate.getTime())) {
      summary.timeCreated = memberDate.getTime() / 1000;
      summary.accountAgeYears = (Date.now() - memberDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  const communityBannedMatch = xmlText.match(/<communityBanned>(.*?)<\/communityBanned>/);
  const vacBannedMatch = xmlText.match(/<vacBanned>(.*?)<\/vacBanned>/);

  const bans: SteamBanStatus = {
    steamId64,
    communityBanned: communityBannedMatch ? communityBannedMatch[1] === '1' : false,
    vacBanned: vacBannedMatch ? vacBannedMatch[1] === '1' : false,
    numberOfVACBans: parseInt(xmlText.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || '0', 10),
    daysSinceLastBan: parseInt(xmlText.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || '0', 10),
    numberOfGameBans: parseInt(xmlText.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || '0', 10),
    economyBan: xmlText.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || 'none',
  };

  return {
    summary,
    playtime: {
      cs2HoursTotal,
      cs2HoursLast2Weeks,
    },
    bans,
    isPrivate,
    fetchedAt: Date.now(),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class SteamApiService {
  private inFlightSteam = new Map<string, Promise<SteamFullData>>();

  async getPlayerFullData(steamId64: string): Promise<SteamFullData> {
    if (!steamId64 || !/^\d{5,25}$/.test(steamId64)) {
      return { isPrivate: true, fetchedAt: Date.now() };
    }

    if (this.inFlightSteam.has(steamId64)) {
      return this.inFlightSteam.get(steamId64)!;
    }

    const promise = this.fetchSteamDataInternal(steamId64).finally(() => {
      this.inFlightSteam.delete(steamId64);
    });

    this.inFlightSteam.set(steamId64, promise);
    return promise;
  }

  private async fetchSteamDataInternal(steamId64: string): Promise<SteamFullData> {
    try {
      const res = await fetchWithTimeout(`https://steamcommunity.com/profiles/${steamId64}/?xml=1`);
      if (!res.ok) {
        return { isPrivate: true, fetchError: true, fetchedAt: Date.now() };
      }
      const xmlText = await res.text();
      if (!xmlText.includes('<steamID>')) {
        return { isPrivate: true, fetchError: true, fetchedAt: Date.now() };
      }
      return parseSteamProfileXml(xmlText, steamId64);
    } catch (err) {
      return { isPrivate: true, fetchError: true, fetchedAt: Date.now() };
    }
  }
}

export const steamApi = new SteamApiService();
