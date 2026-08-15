var ce = Object.defineProperty;
var le = (i, e, a) => e in i ? ce(i, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : i[e] = a;
var J = (i, e, a) => le(i, typeof e != "symbol" ? e + "" : e, a);
const ne = {
  enableRedFlags: !0,
  enableVetoHelper: !0,
  enablePremadeDetection: !0,
  enableFloatingControls: !0,
  compactMode: !1,
  // Automation defaults
  autoReadyUp: !0,
  autoAcceptParty: !0,
  autoCopyConnectIp: !0,
  autoDismissAfk: !0,
  autoContinueQueue: !0,
  autoDismissCaptain: !0,
  autoHideClientBanner: !0,
  autoVetoMaps: !1,
  // Tactical Analytics defaults
  showFcrRating: !0,
  showFormIndicators: !0
}, ee = {
  MATCH: 180 * 1e3,
  // 3 minutes
  PLAYER_STATS: 3600 * 1e3,
  // 1 hour (Aggressive caching)
  STEAM_PROFILE: 1440 * 60 * 1e3,
  // 24 hours
  SETTINGS: Number.MAX_SAFE_INTEGER
};
class he {
  constructor() {
    J(this, "memoryCache", /* @__PURE__ */ new Map());
  }
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  async get(e) {
    const a = Date.now(), t = this.memoryCache.get(e);
    if (t) {
      if (a - t.cachedAt < t.ttlMs)
        return t.value;
      this.memoryCache.delete(e);
    }
    if (this.isChromeStorageAvailable())
      try {
        const n = (await chrome.storage.local.get([e]))[e];
        if (n && n.cachedAt && n.ttlMs) {
          if (a - n.cachedAt < n.ttlMs)
            return this.memoryCache.set(e, n), n.value;
          await chrome.storage.local.remove([e]);
        }
      } catch (s) {
        console.warn(`[f-insight:Cache] Failed to read ${e} from storage`, s);
      }
    return null;
  }
  async set(e, a, t) {
    const s = {
      value: a,
      cachedAt: Date.now(),
      ttlMs: t
    };
    if (this.memoryCache.set(e, s), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [e]: s });
      } catch (n) {
        console.warn(`[f-insight:Cache] Failed to save ${e} to storage`, n);
      }
  }
  async remove(e) {
    if (this.memoryCache.delete(e), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.remove([e]);
      } catch (a) {
        console.warn(`[f-insight:Cache] Failed to remove ${e}`, a);
      }
  }
  async clear() {
    if (this.memoryCache.clear(), this.isChromeStorageAvailable())
      try {
        const e = await chrome.storage.local.get(null), a = Object.keys(e).filter((t) => t !== "settings");
        a.length > 0 && await chrome.storage.local.remove(a);
      } catch (e) {
        console.warn("[f-insight:Cache] Failed to clear storage", e);
      }
  }
  async cleanup() {
    const e = Date.now();
    for (const [a, t] of this.memoryCache.entries())
      e - t.cachedAt >= t.ttlMs && this.memoryCache.delete(a);
    if (this.isChromeStorageAvailable())
      try {
        const a = await chrome.storage.local.get(null), t = [];
        for (const [s, n] of Object.entries(a)) {
          if (s === "settings") continue;
          const o = n;
          o && o.cachedAt && o.ttlMs && e - o.cachedAt >= o.ttlMs && t.push(s);
        }
        t.length > 0 && await chrome.storage.local.remove(t);
      } catch (a) {
        console.warn("[f-insight:Cache] Failed to cleanup storage", a);
      }
  }
  async getStats() {
    if (this.isChromeStorageAvailable())
      try {
        const e = await chrome.storage.local.get(null), a = Object.keys(e), t = await chrome.storage.local.getBytesInUse(null);
        return {
          totalEntries: a.length,
          bytesInUse: t,
          keys: a
        };
      } catch (e) {
        console.warn("[f-insight:Cache] Failed to get stats", e);
      }
    return {
      totalEntries: this.memoryCache.size,
      bytesInUse: 0,
      keys: Array.from(this.memoryCache.keys())
    };
  }
}
const B = new he();
function de(i, e) {
  const a = e - i, t = 1 / (1 + Math.pow(10, a / 400)), s = 1 - t, n = 50, o = Math.max(1, Math.min(49, Math.round(n * (1 - t)))), f = Math.max(1, Math.min(49, Math.round(n * t))), w = Math.max(1, Math.min(49, Math.round(n * (1 - s)))), c = Math.max(1, Math.min(49, Math.round(n * s)));
  return {
    faction1: {
      winGain: o,
      lossLoss: f
    },
    faction2: {
      winGain: w,
      lossLoss: c
    }
  };
}
function ie(i) {
  const e = {};
  if (i.length === 0) return e;
  const a = i.map((s) => {
    const n = Math.max(500, s.elo || 1e3) / 1e3, o = Math.max(0.4, s.overallKd || 1), f = 1 + ((s.overallAdr || 75) - 75) / 150, w = n * o * Math.max(0.6, f);
    return { id: s.playerId, power: w };
  }), t = a.reduce((s, n) => s + n.power, 0);
  for (const s of a) {
    const n = t > 0 ? s.power / t * 100 : 100 / i.length;
    e[s.id] = parseFloat(n.toFixed(1));
  }
  return e;
}
function fe(i, e, a) {
  if (!i || i.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: e || 1,
      recentAdr: a || 75
    };
  const t = i.slice(0, 5), s = t.reduce((g, l) => g + (l.kills || 0), 0), n = t.reduce((g, l) => g + (l.deaths || 0), 0), o = n > 0 ? parseFloat((s / n).toFixed(2)) : parseFloat((e || 1).toFixed(2)), f = t.map((g) => g.adr).filter((g) => g !== void 0 && g > 0), w = f.length > 0 ? Math.round(f.reduce((g, l) => g + l, 0) / f.length) : a || 75, c = Math.max(0.5, e || 1), A = o / c;
  let u = "STABLE";
  return A >= 1.15 || o >= 1.4 && t.filter((g) => g.result === "W").length >= 4 ? u = "HOT" : (A <= 0.82 || o <= 0.75 && t.filter((g) => g.result === "L").length >= 4) && (u = "COLD"), {
    formStatus: u,
    recentKd: o,
    recentAdr: w
  };
}
function me(i) {
  const {
    f1AvgElo: e,
    f2AvgElo: a,
    f1Players: t,
    f2Players: s,
    selectedMap: n,
    premadeGroups: o,
    riskAnalysis: f,
    f1Fcr: w,
    f2Fcr: c
  } = i, A = a - e, u = 1 / (1 + Math.pow(10, A / 400));
  let g = 0, l;
  const d = (n || "").replace("de_", "").toLowerCase();
  if (d) {
    const v = t.reduce((V, z) => V + (z.mapStats?.[d]?.wins || 0), 0), D = t.reduce((V, z) => V + (z.mapStats?.[d]?.matches || 0), 0), E = D > 0 ? Math.round(v / D * 100) : 50, j = s.reduce((V, z) => V + (z.mapStats?.[d]?.wins || 0), 0), q = s.reduce((V, z) => V + (z.mapStats?.[d]?.matches || 0), 0), se = q > 0 ? Math.round(j / q * 100) : 50, U = E - se;
    g = Math.max(-0.12, Math.min(0.12, U / 100 * 0.25)), l = {
      leader: U >= 5 ? "faction1" : U <= -5 ? "faction2" : "balanced",
      mapName: d,
      f1WinRate: E,
      f2WinRate: se,
      deltaWinRate: Math.abs(U)
    };
  }
  const y = t.filter((v) => v.formStatus === "HOT").length, _ = t.filter((v) => v.formStatus === "COLD").length, S = s.filter((v) => v.formStatus === "HOT").length, N = s.filter((v) => v.formStatus === "COLD").length, G = y - _, K = S - N, H = Math.max(-0.1, Math.min(0.1, (G - K) * 0.03)), Q = new Set(t.map((v) => v.playerId)), Y = new Set(s.map((v) => v.playerId));
  let P = 1, T = 1;
  for (const v of o) {
    const D = v.playerIds.filter((j) => Q.has(j)).length, E = v.playerIds.filter((j) => Y.has(j)).length;
    D > P && (P = D), E > T && (T = E);
  }
  const X = Math.max(-0.08, Math.min(0.08, (P - T) * 0.02)), R = t.filter((v) => {
    const D = f[v.playerId]?.level;
    return D === "HIGH" || D === "CRITICAL";
  }).length, O = s.filter((v) => {
    const D = f[v.playerId]?.level;
    return D === "HIGH" || D === "CRITICAL";
  }).length, x = Math.max(-0.06, Math.min(0.06, (R - O) * 0.02)), Z = u + g + H + X + x, p = Math.max(0.06, Math.min(0.94, Z)), r = Math.round(p * 100), F = 100 - r;
  let C = 13, M = 9, $ = !1;
  const L = Math.abs(r - 50);
  L <= 3 ? (C = r >= 50 ? 13 : 11, M = r >= 50 ? 11 : 13, $ = !0) : L <= 8 ? (C = r >= 50 ? 13 : 10, M = r >= 50 ? 10 : 13) : L <= 16 ? (C = r >= 50 ? 13 : 8, M = r >= 50 ? 8 : 13) : L <= 26 ? (C = r >= 50 ? 13 : 5, M = r >= 50 ? 5 : 13) : (C = r >= 50 ? 13 : 3, M = r >= 50 ? 3 : 13);
  const k = [];
  Math.abs(e - a) >= 60 && k.push(
    e > a ? `Team 1 holds +${Math.round(e - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - e)} avg Elo edge`
  ), l && l.deltaWinRate >= 8 && k.push(
    l.leader === "faction1" ? `Team 1 dominates ${l.mapName} (+${l.deltaWinRate}% WR)` : `Team 2 dominates ${l.mapName} (+${l.deltaWinRate}% WR)`
  ), y > S && y >= 2 ? k.push(`Team 1 on hot momentum (${y} players On Fire)`) : S > y && S >= 2 && k.push(`Team 2 on hot momentum (${S} players On Fire)`), P >= 3 && P > T ? k.push(`Team 1 has ${P}-stack coordination`) : T >= 3 && T > P && k.push(`Team 2 has ${T}-stack coordination`), Math.abs(x) >= 0.04 && R + O > 0 && (R > O ? k.push(`Team 1 likely carries flagged accounts (${R} risk flagged)`) : O > R && k.push(`Team 2 likely carries flagged accounts (${O} risk flagged)`));
  const h = k.length > 0 ? k.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", m = (v, D) => {
    let E = v[0], j = -1;
    for (const q of v) {
      const U = (D[q.playerId] || 20) * 1.5 + (q.overallKd || 1) * 10;
      U > j && (j = U, E = q);
    }
    return E ? {
      nickname: E.nickname,
      fcr: D[E.playerId] || 20,
      kd: E.overallKd || 1,
      elo: E.elo || 1e3
    } : void 0;
  }, W = m(t, w), I = m(s, c);
  return {
    winChanceF1: r,
    winChanceF2: F,
    predictedScore: {
      f1Score: C,
      f2Score: M,
      isOvertimeLikely: $
    },
    keyAdvantageText: h,
    factors: {
      eloDelta: Math.round(e - a),
      mapAdvantage: l,
      momentumAdvantage: {
        leader: G > K ? "faction1" : K > G ? "faction2" : "balanced",
        f1HotCount: y,
        f2HotCount: S,
        f1ColdCount: _,
        f2ColdCount: N
      },
      premadeAdvantage: {
        leader: P > T ? "faction1" : T > P ? "faction2" : "balanced",
        f1MaxPartySize: P,
        f2MaxPartySize: T
      },
      smurfRiskDelta: {
        f1HighRiskCount: R,
        f2HighRiskCount: O,
        impactPercent: Math.round(x * 100)
      }
    },
    starMatchup: W && I ? { f1Star: W, f2Star: I } : void 0
  };
}
const b = (i, ...e) => {
  for (const a of e) {
    const t = i?.[a];
    if (t != null && t !== "") return t;
  }
};
function ue(i, e, a, t, s, n) {
  const o = a?.games?.cs2 || a?.games?.csgo || {}, f = o.faceit_elo || 1e3, w = o.skill_level || 1, c = o.game_player_id || a?.steam_id_64, A = a?.nickname || e || "Player", u = a?.avatar || "", g = a?.country || "", l = Array.isArray(t) ? null : t, d = Array.isArray(s) ? null : s, y = l?.lifetime || d?.lifetime || {}, _ = parseInt(b(y, "Total Matches", "Matches", "m1") || "0", 10), S = parseFloat(b(y, "Win Rate %", "k6") || "0"), N = parseFloat(b(y, "Average K/D Ratio", "K/D Ratio", "k5") || "1.0"), G = parseFloat(b(y, "Average Headshots %", "Headshots %", "k8") || "0"), K = parseFloat(b(y, "ADR", "adr", "c3") || "78.5"), H = {}, Q = [
    ...Array.isArray(t) ? t : t?.segments || t?.items || [],
    ...Array.isArray(s) ? s : s?.segments || s?.items || []
  ];
  for (const p of Q) {
    const F = (p._id?.segmentId || p._id?.label || p.label || p.segmentId || p.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (F) {
      const C = parseInt(b(p.stats, "Matches") ?? b(p, "m1", "matches") ?? "0", 10), M = parseFloat(b(p.stats, "Win Rate %") ?? b(p, "k6", "winRate") ?? "0"), $ = parseFloat(b(p.stats, "Average K/D Ratio", "K/D Ratio") ?? b(p, "k5", "kd") ?? "1.0"), L = parseFloat(b(p.stats, "Average Headshots %") ?? b(p, "k8", "hsPercent") ?? "0"), k = parseFloat(b(p.stats, "Average Kills") ?? b(p, "k1", "avgKills") ?? "0"), h = parseFloat(b(p.stats, "ADR") ?? b(p, "c3", "adr") ?? "78.0"), m = parseInt(b(p.stats, "Wins") ?? b(p, "m2", "wins") ?? Math.round(C * M / 100).toString(), 10);
      (!H[F] || C > H[F].matches) && (H[F] = {
        mapName: F,
        matches: C,
        winRate: M,
        kd: $,
        hsPercent: L,
        avgKills: k,
        avgAdr: h,
        wins: m,
        losses: Math.max(0, C - m)
      });
    }
  }
  const Y = [];
  let P = 0, T = "NONE", X = !0;
  const R = {};
  if (Array.isArray(n))
    for (let p = 0; p < n.length; p++) {
      const r = n[p], F = r.i10 === "1" || r.result === "1" || r.stats?.Result === "1" || r.stats?.Win === "1", C = F ? "W" : "L";
      p === 0 ? (T = C, P = 1) : X && (C === T ? P++ : X = !1);
      const M = (r.i1 || r.stats?.Map || r.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), $ = parseInt(r.i6 || r.stats?.Kills || r.kills || "0", 10), L = parseInt(r.i8 || r.stats?.Deaths || r.deaths || "0", 10), k = parseFloat(r.c3 || r.stats?.ADR || r.adr || "78.0");
      M && (R[M] || (R[M] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 }), R[M].matches++, F && R[M].wins++, R[M].kills += $, R[M].deaths += L, R[M].adrSum += k);
      const h = r.elo ? parseInt(r.elo.toString().replace(/,/g, ""), 10) : r.i15 ? parseInt(r.i15, 10) : void 0;
      let m;
      if (p < n.length - 1 && h) {
        const W = n[p + 1], I = W?.elo ? parseInt(W.elo.toString().replace(/,/g, ""), 10) : W?.i15 ? parseInt(W.i15, 10) : void 0;
        if (typeof I == "number" && !isNaN(I)) {
          const v = h - I;
          Math.abs(v) <= 60 && (m = v);
        }
      }
      m === void 0 && (m = F ? 25 : -25), Y.push({
        matchId: r.matchId || r.i0 || `match-${p}`,
        playedAt: r.date || r.created_at || 0,
        map: M,
        result: C,
        score: r.i18 || r.stats?.Score || "13:0",
        kills: $,
        deaths: L,
        kd: parseFloat(r.c2 || r.stats?.["K/D Ratio"] || (L > 0 ? ($ / L).toFixed(2) : $.toFixed(2))),
        hsPercent: parseFloat(r.c4 || r.stats?.["Headshots %"] || "0"),
        adr: k,
        elo: h,
        eloDiff: m
      });
    }
  for (const [p, r] of Object.entries(R))
    if (!H[p] || H[p].matches === 0) {
      const F = r.matches, C = r.wins, M = F > 0 ? Math.round(C / F * 100) : 50, $ = r.deaths > 0 ? parseFloat((r.kills / r.deaths).toFixed(2)) : 1, L = F > 0 ? Math.round(r.adrSum / F) : 75;
      H[p] = {
        mapName: p,
        matches: F,
        winRate: M,
        kd: $,
        hsPercent: G,
        avgKills: F > 0 ? parseFloat((r.kills / F).toFixed(1)) : 15,
        avgAdr: L,
        wins: C,
        losses: F - C
      };
    }
  const { formStatus: O, recentKd: x, recentAdr: Z } = fe(Y, N, K);
  return {
    playerId: i,
    nickname: A,
    avatar: u,
    country: g,
    steamId64: c,
    elo: f,
    skillLevel: w,
    totalMatches: _,
    overallWinRate: S,
    overallKd: N,
    overallHsPercent: G,
    overallAdr: K,
    currentStreak: {
      type: T,
      count: P
    },
    recentMatches: Y,
    mapStats: H,
    registrationDate: a?.created_at,
    formStatus: O,
    recentKd: x,
    recentAdr: Z
  };
}
class ge {
  constructor() {
    J(this, "inFlightMatch", /* @__PURE__ */ new Map());
    J(this, "inFlightPlayer", /* @__PURE__ */ new Map());
  }
  async getMatchDetails(e) {
    if (!e) return null;
    if (this.inFlightMatch.has(e))
      return this.inFlightMatch.get(e);
    const a = this.fetchMatchDetailsInternal(e).finally(() => {
      this.inFlightMatch.delete(e);
    });
    return this.inFlightMatch.set(e, a), a;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const a = await fetch(`https://api.faceit.com/match/v2/match/${e}`, {
        headers: { Accept: "application/json" }
      });
      if (!a.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${a.status}`), null;
      const t = await a.json(), s = t.payload || t;
      return pe(s);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, a), null;
    }
  }
  async getPlayerStats(e, a) {
    if (!e) return null;
    const t = `${e}_${a || ""}`;
    if (this.inFlightPlayer.has(t))
      return this.inFlightPlayer.get(t);
    const s = this.fetchPlayerStatsInternal(e, a).finally(() => {
      this.inFlightPlayer.delete(t);
    });
    return this.inFlightPlayer.set(t, s), s;
  }
  async fetchPlayerStatsInternal(e, a) {
    try {
      const [t, s, n, o] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=50`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let f = null;
      if (t.status === "fulfilled" && t.value.ok) {
        const u = await t.value.json();
        f = u.payload || u;
      }
      let w = null;
      if (s.status === "fulfilled" && s.value.ok) {
        const u = await s.value.json();
        w = u.payload || u;
      }
      let c = null;
      if (o.status === "fulfilled" && o.value.ok) {
        const u = await o.value.json();
        c = u.payload || u;
      }
      let A = [];
      if (n.status === "fulfilled" && n.value.ok) {
        const u = await n.value.json(), g = u.payload || u;
        A = Array.isArray(g) ? g : g?.items || g?.segments || [];
      }
      return ue(e, a, f, w, c, A);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
}
function pe(i) {
  const e = i.teams?.faction1 || i.faction1 || {}, a = i.teams?.faction2 || i.faction2 || {}, t = i.voting?.map?.pick || [], s = t.length > 0 ? t[t.length - 1] : [...i.voting?.map?.entities || []].reverse().find((w) => w.status === "pick")?.name, n = i.configured_server_ip || i.server_ip, o = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, f = (w) => (w || []).map((c) => ({
    player_id: c.id || c.player_id,
    nickname: c.nickname || "Player",
    avatar: c.avatar || "",
    game_player_id: c.game_player_id || c.gameId || c.steam_id_64,
    game_player_name: c.game_player_name || c.gameName,
    game_skill_level: c.skill_level || c.game_skill_level || 1,
    elo: c.elo || 1e3,
    membership: c.membership,
    party_id: c.party_id || c.partyId
  }));
  return {
    match_id: i.id || i.match_id,
    game: i.game || "cs2",
    region: i.region || "EU",
    status: i.status?.toUpperCase() || "VOTING",
    configured_at: i.configured_at,
    started_at: i.started_at,
    finished_at: i.finished_at,
    teams: {
      faction1: {
        faction_id: e.id || e.faction_id || "faction1",
        name: e.name || "Team 1",
        avatar: e.avatar,
        leader: e.leader,
        roster: f(e.roster)
      },
      faction2: {
        faction_id: a.id || a.faction_id || "faction2",
        name: a.name || "Team 2",
        avatar: a.avatar,
        leader: a.leader,
        roster: f(a.roster)
      }
    },
    voting: i.voting,
    selected_map: s,
    server_ip: o
  };
}
const oe = new ge();
function ye(i, e) {
  const a = !i.includes("<privacyState>public</privacyState>"), t = i.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), s = i.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: t ? t[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: s ? s[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let o = 0, f = 0;
  const w = i.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (w) {
    const l = w[1].split("</mostPlayedGame>");
    for (const d of l)
      if (d.includes("Counter-Strike 2") || d.includes("Counter-Strike: Global Offensive")) {
        const y = d.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        y && (o = parseFloat(y[1].replace(/,/g, "")));
        const _ = d.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        _ && (f = parseFloat(_[1].replace(/,/g, "")), o === 0 && (o = f));
        break;
      }
  }
  const c = i.match(/<memberSince>(.*?)<\/memberSince>/);
  if (c) {
    const l = new Date(c[1]);
    isNaN(l.getTime()) || (n.timeCreated = l.getTime() / 1e3, n.accountAgeYears = (Date.now() - l.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const A = i.match(/<communityBanned>(.*?)<\/communityBanned>/), u = i.match(/<vacBanned>(.*?)<\/vacBanned>/), g = {
    steamId64: e,
    communityBanned: A ? A[1] === "1" : !1,
    vacBanned: u ? u[1] === "1" : !1,
    numberOfVACBans: parseInt(i.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(i.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(i.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: i.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: o,
      cs2HoursLast2Weeks: f
    },
    bans: g,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
class ve {
  constructor() {
    J(this, "inFlightSteam", /* @__PURE__ */ new Map());
  }
  async getPlayerFullData(e) {
    if (!e)
      return { isPrivate: !0, fetchedAt: Date.now() };
    if (this.inFlightSteam.has(e))
      return this.inFlightSteam.get(e);
    const a = this.fetchSteamDataInternal(e).finally(() => {
      this.inFlightSteam.delete(e);
    });
    return this.inFlightSteam.set(e, a), a;
  }
  async fetchSteamDataInternal(e) {
    try {
      const a = await fetch(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!a.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const t = await a.text();
      return t.includes("<steamID>") ? ye(t, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const we = new ve();
function Ae(i, e) {
  const a = [];
  let t = 0;
  const s = i.totalMatches || 0, n = i.elo || 1e3, o = i.overallKd || 1, f = i.overallWinRate || 50, w = i.recentKd || o;
  n >= 2200 && s < 100 ? (t += 45, a.push({
    id: "lvl10_extreme_low_matches",
    title: "High Elo on Very Fresh Account",
    description: `${n} Elo achieved in only ${s} matches`,
    weight: 45,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 2e3 && s < 150 ? (t += 35, a.push({
    id: "lvl10_low_matches",
    title: "Level 10 with Low Matches",
    description: `Level 10 (${n} Elo) in only ${s} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 1600 && s < 80 ? (t += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${n} Elo achieved in only ${s} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : n >= 1350 && s < 40 ? (t += 18, a.push({
    id: "mid_elo_fresh_account",
    title: "Level 7+ on New Account",
    description: `${n} Elo with only ${s} matches`,
    weight: 18,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : s < 20 ? (t += 10, a.push({
    id: "fresh_faceit_account",
    title: "New FACEIT Account",
    description: `Only ${s} total matches on record`,
    weight: 10,
    severity: "info",
    category: "MATCHES_ELO"
  })) : s >= 800 && (t -= 15), o >= 2 ? (t += 30, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${o.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : o >= 1.6 && s < 200 ? (t += 20, a.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${o.toFixed(2)} with ${s} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : o >= 1.4 && s < 150 ? (t += 12, a.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${o.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : o < 0.95 && s >= 50 && (t -= 10), f >= 80 && s >= 10 ? (t += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${f.toFixed(0)}% across ${s} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : f >= 70 && s >= 15 ? (t += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${f.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : f >= 62 && s >= 25 && (t += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${f.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), w >= 1.75 && w >= o * 1.35 && s >= 10 && (t += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${w.toFixed(2)}) is significantly higher than lifetime baseline (${o.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let c = !0;
  if (e?.fetchError)
    c = !1;
  else if (e && !e.isPrivate && e.summary) {
    c = !1;
    const d = e.playtime?.cs2HoursTotal ?? 0;
    d > 0 && d < 150 && n >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo Rating",
      description: `Only ${d}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : d > 0 && d < 350 && n >= 2e3 ? (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${d}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : d >= 2500 && (t -= 15);
    const y = e.summary.accountAgeYears;
    if (y !== void 0 && y < 1 && n >= 1400 && (t += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${y.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    })), e.bans?.vacBanned || e.bans?.numberOfGameBans) {
      const _ = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), S = 25;
      t += S, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${_} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
        weight: S,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else e?.isPrivate ? (c = !0, s < 100 && n >= 1600 ? (t += 15, a.push({
    id: "private_steam_fresh_high_elo",
    title: "Hidden Account with High Elo",
    description: `Private Steam profile on fresh account with ${n} Elo`,
    weight: 15,
    severity: "warning",
    category: "PRIVATE_PROFILE"
  })) : a.push({
    id: "private_steam",
    title: "Hidden Account (Private Steam)",
    description: "Steam hours and profile details are hidden by user privacy settings",
    weight: 0,
    severity: "info",
    category: "PRIVATE_PROFILE"
  })) : c = !1;
  const A = Math.min(100, Math.max(0, Math.round(t)));
  let u = "LOW", g = "#10B981", l = "Legit";
  return A >= 70 ? (u = "CRITICAL", g = "#DC2626", l = "High Risk") : A >= 45 ? (u = "HIGH", g = "#EF4444", l = "Likely Smurf") : A >= 25 && (u = "MEDIUM", g = "#F59E0B", l = "Suspicious"), {
    score: A,
    level: u,
    flags: a,
    isPrivateSteam: c,
    summary: `${A}% Smurf Risk (${u})`,
    color: g,
    badgeText: l
  };
}
const te = [
  "#8B5CF6",
  // Purple
  "#06B6D4",
  // Cyan
  "#EC4899",
  // Pink
  "#10B981",
  // Emerald
  "#F97316"
  // Orange
];
function Se(i, e) {
  const a = [];
  let t = 0;
  const s = [i.teams.faction1, i.teams.faction2];
  for (const n of s) {
    if (!n || !n.roster) continue;
    const o = /* @__PURE__ */ new Map();
    for (const l of n.roster)
      if (l.party_id) {
        const d = o.get(l.party_id) || [];
        d.push(l.player_id), o.set(l.party_id, d);
      }
    const f = /* @__PURE__ */ new Set();
    for (const [, l] of o.entries())
      if (l.length >= 2) {
        const d = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${d} (${l.length})`,
          color: te[t % te.length],
          playerIds: l
        }), t++, l.forEach((y) => f.add(y));
      }
    const w = n.roster.map((l) => l.player_id).filter((l) => !f.has(l)), c = 15, A = /* @__PURE__ */ new Map();
    for (const l of w) {
      const d = e[l];
      d?.recentMatches && A.set(l, new Set(d.recentMatches.slice(0, c).map((y) => y.matchId)));
    }
    const u = /* @__PURE__ */ new Set(), g = (l, d) => {
      const y = A.get(l), _ = A.get(d);
      if (!y || !_) return !1;
      let S = 0;
      for (const N of y)
        if (_.has(N) && S++, S >= 2) return !0;
      return !1;
    };
    for (const l of w) {
      if (u.has(l)) continue;
      const d = [], y = [l];
      for (u.add(l); y.length > 0; ) {
        const _ = y.shift();
        d.push(_);
        for (const S of w)
          !u.has(S) && g(_, S) && (u.add(S), y.push(S));
      }
      if (d.length >= 2) {
        d.forEach((S) => f.add(S));
        const _ = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${_} (${d.length})`,
          color: te[t % te.length],
          playerIds: d
        }), t++;
      }
    }
  }
  return a;
}
class _e {
  constructor() {
    J(this, "settings", { ...ne });
    J(this, "initialized", !1);
  }
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0);
  }
  async loadSettings() {
    const e = await B.get("settings");
    return e && (this.settings = { ...ne, ...e }), this.settings;
  }
  async handleMessage(e, a) {
    try {
      switch (e.type) {
        case "GET_SETTINGS":
          return this.handleGetSettings();
        case "SAVE_SETTINGS":
          return this.handleSaveSettings(e.payload);
        case "FETCH_LOBBY_INSIGHT":
          return this.handleFetchLobbyInsight(e.payload, a);
        case "GET_CACHE_STATS":
          return this.handleGetCacheStats();
        case "CLEAR_CACHE":
          return this.handleClearCache();
        default:
          return { success: !1, error: "Unknown message type" };
      }
    } catch (t) {
      return console.error("[f-insight:Background] Message handler error:", t), { success: !1, error: t.message || "Internal error" };
    }
  }
  async handleGetSettings() {
    return { success: !0, data: await this.loadSettings() };
  }
  async handleSaveSettings(e) {
    return this.settings = { ...this.settings, ...e }, await B.set("settings", this.settings, ee.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: s } = e, n = `match_analysis:${t}`;
    if (!s) {
      const f = await B.get(n);
      if (f && !f.isPartial)
        return { success: !0, data: f };
    }
    const o = await oe.getMatchDetails(t);
    return o ? (this.streamLobbyData(t, o, s, a).catch((f) => console.error("[f-insight:Stream] Error:", f)), { success: !0, data: { match: o, isPartial: !0 } }) : { success: !1, error: `Could not fetch match details for ${t}` };
  }
  async streamLobbyData(e, a, t, s) {
    try {
      await this.streamLobbyDataInner(e, a, t, s);
    } catch (n) {
      console.error("[f-insight:Stream] Error:", n), s?.tab?.id && this.safeSendToTab(s.tab.id, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: e, error: n?.message || "Match analysis stream failed" }
      });
    }
  }
  async streamLobbyDataInner(e, a, t, s) {
    const n = `match_analysis:${e}`, o = a.teams?.faction1?.roster || [], f = a.teams?.faction2?.roster || [], w = [...o, ...f], c = {}, A = {}, u = {};
    await Promise.all(
      w.map(async (h) => {
        const m = h.player_id;
        if (!m) return;
        const W = `player_stats:${m}`;
        let I = null;
        if (t || (I = await B.get(W)), I || (I = await oe.getPlayerStats(m, h.nickname), I && await B.set(W, I, ee.PLAYER_STATS)), I) {
          c[m] = I;
          const v = I.steamId64 || h.game_player_id;
          if (v) {
            const D = `steam_data:${v}`;
            let E = null;
            t || (E = await B.get(D)), E || (E = await we.getPlayerFullData(v), E && !E.fetchError && await B.set(D, E, ee.STEAM_PROFILE)), E && (A[m] = E);
          }
          u[m] = Ae(I, A[m]), s?.tab?.id && this.safeSendToTab(s.tab.id, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: m, stats: I, steam: A[m], risk: u[m] }
          });
        }
      })
    );
    const g = o.map((h) => c[h.player_id]?.elo || h.elo || 1e3), l = f.map((h) => c[h.player_id]?.elo || h.elo || 1e3), d = g.reduce((h, m) => h + m, 0), y = l.reduce((h, m) => h + m, 0), _ = g.length > 0 ? Math.round(d / g.length) : 1e3, S = l.length > 0 ? Math.round(y / l.length) : 1e3, N = _ - S, G = de(_, S), K = o.map((h) => c[h.player_id]?.overallKd || 1), H = f.map((h) => c[h.player_id]?.overallKd || 1), Q = K.length > 0 ? parseFloat((K.reduce((h, m) => h + m, 0) / K.length).toFixed(2)) : 1, Y = H.length > 0 ? parseFloat((H.reduce((h, m) => h + m, 0) / H.length).toFixed(2)) : 1, P = o.map((h) => c[h.player_id]?.overallHsPercent || 0), T = f.map((h) => c[h.player_id]?.overallHsPercent || 0), X = P.length > 0 ? Math.round(P.reduce((h, m) => h + m, 0) / P.length) : 0, R = T.length > 0 ? Math.round(T.reduce((h, m) => h + m, 0) / T.length) : 0, O = o.map((h) => c[h.player_id]?.overallAdr || 75), x = f.map((h) => c[h.player_id]?.overallAdr || 75), Z = O.length > 0 ? Math.round(O.reduce((h, m) => h + m, 0) / O.length) : 75, p = x.length > 0 ? Math.round(x.reduce((h, m) => h + m, 0) / x.length) : 75, r = o.map((h) => c[h.player_id]).filter(Boolean), F = f.map((h) => c[h.player_id]).filter(Boolean), C = ie(r), M = ie(F);
    for (const [h, m] of Object.entries(C))
      c[h] && (c[h].fcrContributionPercent = m);
    for (const [h, m] of Object.entries(M))
      c[h] && (c[h].fcrContributionPercent = m);
    const $ = Se(a, c), L = me({
      f1AvgElo: _,
      f2AvgElo: S,
      f1Players: r,
      f2Players: F,
      selectedMap: a.selected_map,
      premadeGroups: $,
      riskAnalysis: u,
      f1Fcr: C,
      f2Fcr: M
    }), k = {
      match: a,
      playersStats: c,
      steamData: A,
      riskAnalysis: u,
      premadeGroups: $,
      teamSummary: {
        faction1: {
          totalElo: d,
          avgElo: _,
          winChancePercent: L.winChanceF1,
          avgKd: Q,
          avgHsPercent: X,
          avgAdr: Z,
          projectedElo: G.faction1
        },
        faction2: {
          totalElo: y,
          avgElo: S,
          winChancePercent: L.winChanceF2,
          avgKd: Y,
          avgHsPercent: R,
          avgAdr: p,
          projectedElo: G.faction2
        },
        eloDifference: Math.abs(N)
      },
      prediction: L,
      isPartial: !1
    };
    await B.set(n, k, ee.MATCH), s?.tab?.id && this.safeSendToTab(s.tab.id, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: k
    });
  }
  safeSendToTab(e, a) {
    chrome.tabs.sendMessage(e, a).catch((t) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", t?.message || t);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await B.getStats() };
  }
  async handleClearCache() {
    return await B.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const ae = new _e(), re = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (i) => {
  console.log("[f-insight:Background] Extension installed/updated:", i.reason), re(), await ae.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), re(), await ae.init();
});
chrome.runtime.onMessage.addListener((i, e, a) => (ae.init().then(() => ae.handleMessage(i, e)).then(a), !0));
chrome.alarms.onAlarm.addListener(async (i) => {
  i.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await B.cleanup());
});
