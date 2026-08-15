import { FaceitMatchDetails, FaceitPlayerFullStats } from '../types/faceit';
import { PremadeGroup } from '../types/settings';

const PARTY_COLORS = [
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F97316', // Orange
];

export function detectPremades(
  match: FaceitMatchDetails,
  playersStats: Record<string, FaceitPlayerFullStats>
): PremadeGroup[] {
  const groups: PremadeGroup[] = [];
  let groupIndex = 0;

  const factions = [match.teams.faction1, match.teams.faction2];

  for (const faction of factions) {
    if (!faction || !faction.roster) continue;

    // 1. First check party_id from FACEIT internal roster data
    const partyMap = new Map<string, string[]>();
    for (const p of faction.roster) {
      if (p.party_id) {
        const list = partyMap.get(p.party_id) || [];
        list.push(p.player_id);
        partyMap.set(p.party_id, list);
      }
    }

    const identifiedPartyPlayers = new Set<string>();

    for (const [, pIds] of partyMap.entries()) {
      if (pIds.length >= 2) {
        const letter = String.fromCharCode(65 + (groupIndex % 26));
        groups.push({
          id: `party-${groupIndex}`,
          tag: `Party ${letter} (${pIds.length})`,
          color: PARTY_COLORS[groupIndex % PARTY_COLORS.length],
          playerIds: pIds,
        });
        groupIndex++;
        pIds.forEach((id) => identifiedPartyPlayers.add(id));
      }
    }

    // 2. Fallback / Correlation check: compare recent match history between teammates
    const remainingPlayers = faction.roster
      .map((p) => p.player_id)
      .filter((id) => !identifiedPartyPlayers.has(id));

    // Build map of matchIds per player
    const playerMatchSets = new Map<string, Set<string>>();
    for (const pId of remainingPlayers) {
      const stats = playersStats[pId];
      if (stats?.recentMatches) {
        playerMatchSets.set(pId, new Set(stats.recentMatches.map((m) => m.matchId)));
      }
    }

    // Find connected components where players share >= 3 recent matches
    const visited = new Set<string>();
    for (const p1 of remainingPlayers) {
      if (visited.has(p1)) continue;
      const cluster = [p1];
      const matches1 = playerMatchSets.get(p1);
      if (!matches1 || matches1.size === 0) continue;

      for (const p2 of remainingPlayers) {
        if (p1 === p2 || visited.has(p2)) continue;
        const matches2 = playerMatchSets.get(p2);
        if (!matches2 || matches2.size === 0) continue;

        // Calculate overlap
        let overlap = 0;
        for (const mId of matches1) {
          if (matches2.has(mId)) overlap++;
        }

        if (overlap >= 2) {
          cluster.push(p2);
        }
      }

      if (cluster.length >= 2) {
        cluster.forEach((id) => {
          visited.add(id);
          identifiedPartyPlayers.add(id);
        });
        const letter = String.fromCharCode(65 + (groupIndex % 26));
        groups.push({
          id: `party-${groupIndex}`,
          tag: `Party ${letter} (${cluster.length})`,
          color: PARTY_COLORS[groupIndex % PARTY_COLORS.length],
          playerIds: cluster,
        });
        groupIndex++;
      }
    }
  }

  return groups;
}
