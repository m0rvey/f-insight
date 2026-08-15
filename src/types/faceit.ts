export interface FaceitPlayerRosterItem {
  player_id: string;
  nickname: string;
  avatar?: string;
  game_player_id?: string; // Steam ID 64
  game_player_name?: string;
  game_skill_level?: number;
  membership?: string;
  elo?: number;
  party_id?: string;
}

export interface FaceitFaction {
  faction_id: string;
  name: string;
  avatar?: string;
  leader?: string;
  roster: FaceitPlayerRosterItem[];
  stats?: {
    winRate?: number;
    rating?: number;
  };
}

export interface MapVetoPick {
  map_name: string;
  class_name?: string;
  image_sm?: string;
  image_lg?: string;
  status?: 'drop' | 'pick' | 'remaining';
  selected_by?: string;
}

export type MatchStatus = 'VOTING' | 'CONFIGURING' | 'READY' | 'ON_GOING' | 'CANCELLED' | 'FINISHED';

export interface FaceitMatchDetails {
  match_id: string;
  game: string;
  region: string;
  status: MatchStatus;
  configured_at?: number;
  started_at?: number;
  finished_at?: number;
  teams: {
    faction1: FaceitFaction;
    faction2: FaceitFaction;
  };
  voting?: {
    map?: {
      entities: Array<{
        guid: string;
        name: string;
        class_name: string;
        image_sm: string;
        image_lg: string;
      }>;
      pick: string[];
    };
    location?: {
      entities: Array<{
        guid: string;
        name: string;
      }>;
      pick: string[];
    };
  };
  selected_map?: string;
  server_ip?: string;
}

export interface MapSpecificStats {
  mapName: string;
  matches: number;
  winRate: number; // 0 to 100
  kd: number;
  hsPercent: number;
  avgKills: number;
  avgAdr?: number;
  wins: number;
  losses: number;
}

export interface PlayerRecentMatch {
  matchId: string;
  playedAt: number;
  map: string;
  result: 'W' | 'L';
  score: string;
  kills: number;
  deaths: number;
  kd: number;
  hsPercent?: number;
  adr?: number;
  elo?: number;
  eloDiff?: number;
}

export type PlayerFormStatus = 'HOT' | 'COLD' | 'STABLE';

export interface FaceitPlayerFullStats {
  playerId: string;
  nickname: string;
  avatar: string;
  country: string;
  steamId64?: string;
  elo: number;
  skillLevel: number;
  totalMatches: number;
  overallWinRate: number;
  overallKd: number;
  overallHsPercent: number;
  overallAdr?: number;
  last30Kd?: number; // Sum kills / sum deaths over last 30 matches
  last30Adr?: number; // Avg ADR over matches with real ADR data
  last30AdrMatches?: number; // How many of the last 30 matches had ADR data
  last30HsPercent?: number;
  last30WinRate?: number; // 0 to 100
  last30Matches?: number; // Actual matches used (fewer for new players)
  currentStreak: {
    type: 'W' | 'L' | 'NONE';
    count: number;
  };
  recentMatches: PlayerRecentMatch[];
  mapStats: Record<string, MapSpecificStats>;
  registrationDate?: string;
  formStatus: PlayerFormStatus;
  recentKd: number; // Avg KD over last 5 matches
  recentAdr: number; // Avg ADR over last 5 matches
  fcrContributionPercent?: number; // Calculated team firepower contribution %
}
