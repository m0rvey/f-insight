export interface SteamPlayerSummary {
  steamId64: string;
  personaName: string;
  profileUrl: string;
  avatar: string;
  communityVisibilityState: number; // 1 = Private, 3 = Public
  profileState?: number;
  timeCreated?: number; // Unix timestamp
  accountAgeYears?: number;
  countryCode?: string;
}

export interface SteamCs2Playtime {
  cs2HoursTotal: number;
  cs2HoursLast2Weeks: number;
}

export interface SteamBanStatus {
  steamId64: string;
  communityBanned: boolean;
  vacBanned: boolean;
  numberOfVACBans: number;
  daysSinceLastBan: number;
  numberOfGameBans: number;
  economyBan: string;
}

export interface SteamFullData {
  summary?: SteamPlayerSummary;
  playtime?: SteamCs2Playtime;
  bans?: SteamBanStatus;
  isPrivate: boolean;
  fetchedAt: number;
}
