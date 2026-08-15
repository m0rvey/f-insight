import { FaceitMatchDetails, FaceitPlayerFullStats } from './faceit';
import { SteamFullData } from './steam';
import { ExtensionSettings, PremadeGroup } from './settings';
import { RiskAnalysisResult } from './risk';

export interface ProjectedElo {
  winGain: number; // e.g. +24
  lossLoss: number; // e.g. -26
}

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
    };
  };
  starMatchup?: {
    f1Star: { nickname: string; fcr: number; kd: number; elo: number };
    f2Star: { nickname: string; fcr: number; kd: number; elo: number };
  };
}

export interface LobbyAnalysisPayload {
  match: FaceitMatchDetails;
  playersStats: Record<string, FaceitPlayerFullStats>;
  steamData: Record<string, SteamFullData>;
  riskAnalysis: Record<string, RiskAnalysisResult>;
  premadeGroups: PremadeGroup[];
  teamSummary: {
    faction1: {
      totalElo: number;
      avgElo: number;
      winChancePercent: number;
      avgKd: number;
      avgHsPercent: number;
      avgAdr: number;
      projectedElo: ProjectedElo;
    };
    faction2: {
      totalElo: number;
      avgElo: number;
      winChancePercent: number;
      avgKd: number;
      avgHsPercent: number;
      avgAdr: number;
      projectedElo: ProjectedElo;
    };
    eloDifference: number;
  };
  prediction: AdvancedMatchPrediction;
}

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: Partial<ExtensionSettings> }
  | { type: 'FETCH_LOBBY_INSIGHT'; payload: { matchId: string; forceRefresh?: boolean } }
  | { type: 'FETCH_PLAYER_INSIGHT'; payload: { playerId: string; steamId64?: string; forceRefresh?: boolean } }
  | { type: 'GET_CACHE_STATS' }
  | { type: 'CLEAR_CACHE' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
