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

export interface FaceitMatchDetails {
  match_id: string;
  game: string;
  region: string;
  status: 'VOTING' | 'CONFIGURING' | 'READY' | 'ON_GOING' | 'CANCELLED' | 'FINISHED';
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
  hsPercent: number;
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
  overallAdr: number;
  currentStreak: {
    type: 'W' | 'L' | 'NONE';
    count: number;
  };
  recentMatches: PlayerRecentMatch[];
  mapStats: Record<string, MapSpecificStats>;
  registrationDate?: string;
  membershipType?: string;
  formStatus: PlayerFormStatus;
  recentKd: number; // Avg KD over last 5 matches
  recentAdr: number; // Avg ADR over last 5 matches
  fcrContributionPercent?: number; // Calculated team firepower contribution %
}
