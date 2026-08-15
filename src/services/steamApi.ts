import { SteamFullData, SteamPlayerSummary, SteamBanStatus } from '../types/steam';

export class SteamApiService {
  async getPlayerFullData(steamId64: string): Promise<SteamFullData> {
    if (!steamId64) {
      return { isPrivate: true, fetchedAt: Date.now() };
    }

    try {
      const res = await fetch(`https://steamcommunity.com/profiles/${steamId64}/?xml=1`);
      if (res.ok) {
        const xmlText = await res.text();
        const isPrivate = xmlText.includes('<privacyState>private</privacyState>') || !xmlText.includes('<privacyState>public</privacyState>');
        const personaNameMatch = xmlText.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
        const avatarMatch = xmlText.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
        const vacBannedMatch = xmlText.match(/<vacBanned>(.*?)<\/vacBanned>/);

        const summary: SteamPlayerSummary = {
          steamId64,
          personaName: personaNameMatch ? personaNameMatch[1] : 'Steam User',
          profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
          avatar: avatarMatch ? avatarMatch[1] : '',
          communityVisibilityState: isPrivate ? 1 : 3,
        };

        const bans: SteamBanStatus = {
          steamId64,
          communityBanned: false,
          vacBanned: vacBannedMatch ? vacBannedMatch[1] === '1' : false,
          numberOfVACBans: vacBannedMatch && vacBannedMatch[1] === '1' ? 1 : 0,
          daysSinceLastBan: 0,
          numberOfGameBans: 0,
          economyBan: 'none',
        };

        return {
          summary,
          bans,
          isPrivate,
          fetchedAt: Date.now(),
        };
      }
    } catch (err) {
      // Graceful fallback to private state
    }

    return {
      isPrivate: true,
      summary: {
        steamId64,
        personaName: 'Steam User',
        profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
        avatar: '',
        communityVisibilityState: 1,
      },
      fetchedAt: Date.now(),
    };
  }
}

export const steamApi = new SteamApiService();
