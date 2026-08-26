import { FaceitMatchDetails, FaceitPlayerFullStats } from './faceit';
import { SteamFullData } from './steam';
import { ExtensionSettings, PremadeGroup } from './settings';
import { RiskAnalysisResult } from './risk';

export interface AdvancedMatchPrediction {
  winChanceF1: number;
  winChanceF2: number;
  predictedScore: {
    f1Score: number;
    f2Score: number;
    isOvertimeLikely: boolean;
  };
  keyAdvantageText: string;
  factors: {
    eloDelta: number;
    mapAdvantage?: {
      leader: 'faction1' | 'faction2' | 'balanced';
      mapName: string;
      f1WinRate: number;
      f2WinRate: number;
      deltaWinRate: number;
    };
    momentumAdvantage: {
      leader: 'faction1' | 'faction2' | 'balanced';
      f1HotCount: number;
      f2HotCount: number;
      f1ColdCount: number;
      f2ColdCount: number;
    };
    premadeAdvantage: {
      leader: 'faction1' | 'faction2' | 'balanced';
      f1MaxPartySize: number;
      f2MaxPartySize: number;
    };
    smurfRiskDelta: {
      f1HighRiskCount: number;
      f2HighRiskCount: number;
      impactPercent: number;
    };
    adrAdvantage?: {
      leader: 'faction1' | 'faction2' | 'balanced';
      f1AvgAdr: number;
      f2AvgAdr: number;
      delta: number;
    };
  };
  starMatchup?: {
    f1Star: { nickname: string; fcr: number; kd: number; elo: number };
    f2Star: { nickname: string; fcr: number; kd: number; elo: number };
  };
}

export interface LobbyAnalysisPayload {
  match: FaceitMatchDetails;
  playersStats?: Record<string, FaceitPlayerFullStats>;
  steamData?: Record<string, SteamFullData>;
  riskAnalysis?: Record<string, RiskAnalysisResult>;
  premadeGroups?: PremadeGroup[];
  teamSummary?: {
    faction1: {
      totalElo: number;
      avgElo: number;
      winChancePercent: number;
      avgKd: number;
      avgHsPercent: number;
      avgAdr: number;
    };
    faction2: {
      totalElo: number;
      avgElo: number;
      winChancePercent: number;
      avgKd: number;
      avgHsPercent: number;
      avgAdr: number;
    };
    eloDifference: number;
  };
  prediction?: AdvancedMatchPrediction;
  isPartial?: boolean;
}

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<ExtensionSettings> }
  | { type: 'FETCH_LOBBY_INSIGHT'; payload: { matchId: string; forceRefresh?: boolean } }
  /**
   * Match payload intercepted from FACEIT's own page traffic by the MAIN-world
   * network hook. The background parses and caches it so the next
   * FETCH_LOBBY_INSIGHT for this match resolves without any request of ours.
   */
  | { type: 'INTERCEPTED_MATCH_PAYLOAD'; payload: { matchId: string; body: unknown; url?: string } }
  | { type: 'GET_CACHE_STATS' }
  | { type: 'CLEAR_CACHE' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
