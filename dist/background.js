var le = Object.defineProperty;
var he = (l, e, a) => e in l ? le(l, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : l[e] = a;
var J = (l, e, a) => he(l, typeof e != "symbol" ? e + "" : e, a);
const ie = {
  enableRedFlags: !0,
  enableVetoHelper: !0,
  enablePremadeDetection: !0,
  enableFloatingControls: !0,
  compactMode: !1,
  theme: "dark",
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
}, Q = {
  MATCH: 180 * 1e3,
  // 3 minutes
  PLAYER_STATS: 3600 * 1e3,
  // 1 hour (Aggressive caching)
  STEAM_PROFILE: 1440 * 60 * 1e3,
  // 24 hours
  SETTINGS: Number.MAX_SAFE_INTEGER
};
class de {
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
          const i = n;
          i && i.cachedAt && i.ttlMs && e - i.cachedAt >= i.ttlMs && t.push(s);
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
const $ = new de();
function fe(l, e) {
  const a = e - l, t = 1 / (1 + Math.pow(10, a / 400)), s = 1 - t, n = 50, i = Math.max(1, Math.min(49, Math.round(n * (1 - t)))), h = Math.max(1, Math.min(49, Math.round(n * t))), w = Math.max(1, Math.min(49, Math.round(n * (1 - s)))), u = Math.max(1, Math.min(49, Math.round(n * s)));
  return {
    faction1: {
      winGain: i,
      lossLoss: h
    },
    faction2: {
      winGain: w,
      lossLoss: u
    }
  };
}
function oe(l) {
  const e = {};
  if (l.length === 0) return e;
  const a = l.map((s) => {
    const n = Math.max(500, s.elo || 1e3) / 1e3, i = Math.max(0.4, s.overallKd || 1), h = 1 + ((s.overallAdr || 75) - 75) / 150, w = n * i * Math.max(0.6, h);
    return { id: s.playerId, power: w };
  }), t = a.reduce((s, n) => s + n.power, 0);
  for (const s of a) {
    const n = t > 0 ? s.power / t * 100 : 100 / l.length;
    e[s.id] = parseFloat(n.toFixed(1));
  }
  return e;
}
function me(l, e, a) {
  if (!l || l.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: e || 1,
      recentAdr: a || 75
    };
  const t = l.slice(0, 5), s = t.reduce((o, d) => o + (d.kills || 0), 0), n = t.reduce((o, d) => o + (d.deaths || 0), 0), i = n > 0 ? parseFloat((s / n).toFixed(2)) : parseFloat(s.toFixed(2)), h = t.map((o) => o.adr).filter((o) => o !== void 0 && o > 0), w = h.length > 0 ? Math.round(h.reduce((o, d) => o + d, 0) / h.length) : a || 75, u = Math.max(0.5, e || 1), m = i / u;
  let y = "STABLE";
  return m >= 1.15 || i >= 1.4 && t.filter((o) => o.result === "W").length >= 4 ? y = "HOT" : (m <= 0.82 || i <= 0.75 && t.filter((o) => o.result === "L").length >= 4) && (y = "COLD"), {
    formStatus: y,
    recentKd: i,
    recentAdr: w
  };
}
function ue(l) {
  const {
    f1AvgElo: e,
    f2AvgElo: a,
    f1Players: t,
    f2Players: s,
    selectedMap: n,
    premadeGroups: i,
    riskAnalysis: h,
    f1Fcr: w,
    f2Fcr: u
  } = l, m = a - e, y = 1 / (1 + Math.pow(10, m / 400));
  let o = 0, d;
  const f = (n || "").replace("de_", "").toLowerCase();
  if (f) {
    const A = t.reduce((V, z) => V + (z.mapStats?.[f]?.wins || 0), 0), D = t.reduce((V, z) => V + (z.mapStats?.[f]?.matches || 0), 0), C = D > 0 ? Math.round(A / D * 100) : 50, x = s.reduce((V, z) => V + (z.mapStats?.[f]?.wins || 0), 0), q = s.reduce((V, z) => V + (z.mapStats?.[f]?.matches || 0), 0), se = q > 0 ? Math.round(x / q * 100) : 50, U = C - se;
    o = Math.max(-0.12, Math.min(0.12, U / 100 * 0.25)), d = {
      leader: U >= 5 ? "faction1" : U <= -5 ? "faction2" : "balanced",
      mapName: f,
      f1WinRate: C,
      f2WinRate: se,
      deltaWinRate: Math.abs(U)
    };
  }
  const v = t.filter((A) => A.formStatus === "HOT").length, S = t.filter((A) => A.formStatus === "COLD").length, P = s.filter((A) => A.formStatus === "HOT").length, j = s.filter((A) => A.formStatus === "COLD").length, N = v - S, B = P - j, O = Math.max(-0.1, Math.min(0.1, (N - B) * 0.03)), Z = new Set(t.map((A) => A.playerId)), Y = new Set(s.map((A) => A.playerId));
  let b = 1, T = 1;
  for (const A of i) {
    const D = A.playerIds.filter((x) => Z.has(x)).length, C = A.playerIds.filter((x) => Y.has(x)).length;
    D > b && (b = D), C > T && (T = C);
  }
  const X = Math.max(-0.08, Math.min(0.08, (b - T) * 0.02)), R = t.filter((A) => {
    const D = h[A.playerId]?.level;
    return D === "HIGH" || D === "CRITICAL";
  }).length, K = s.filter((A) => {
    const D = h[A.playerId]?.level;
    return D === "HIGH" || D === "CRITICAL";
  }).length, G = Math.max(-0.06, Math.min(0.06, (R - K) * 0.02)), ee = y + o + O + X + G, p = Math.max(0.06, Math.min(0.94, ee)), r = Math.round(p * 100), M = 100 - r;
  let F = 13, _ = 9, H = !1;
  const I = Math.abs(r - 50);
  I <= 3 ? (F = r >= 50 ? 13 : 11, _ = r >= 50 ? 11 : 13, H = !0) : I <= 8 ? (F = r >= 50 ? 13 : 10, _ = r >= 50 ? 10 : 13) : I <= 16 ? (F = r >= 50 ? 13 : 8, _ = r >= 50 ? 8 : 13) : I <= 26 ? (F = r >= 50 ? 13 : 5, _ = r >= 50 ? 5 : 13) : (F = r >= 50 ? 13 : 3, _ = r >= 50 ? 3 : 13);
  const k = [];
  Math.abs(e - a) >= 60 && k.push(
    e > a ? `Team 1 holds +${Math.round(e - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - e)} avg Elo edge`
  ), d && d.deltaWinRate >= 8 && k.push(
    d.leader === "faction1" ? `Team 1 dominates ${d.mapName} (+${d.deltaWinRate}% WR)` : `Team 2 dominates ${d.mapName} (+${d.deltaWinRate}% WR)`
  ), v > P && v >= 2 ? k.push(`Team 1 on hot momentum (${v} players On Fire)`) : P > v && P >= 2 && k.push(`Team 2 on hot momentum (${P} players On Fire)`), b >= 3 && b > T ? k.push(`Team 1 has ${b}-stack coordination`) : T >= 3 && T > b && k.push(`Team 2 has ${T}-stack coordination`), Math.abs(G) >= 0.04 && R + K > 0 && (R > K ? k.push(`Team 1 likely carries flagged accounts (${R} risk flagged)`) : K > R && k.push(`Team 2 likely carries flagged accounts (${K} risk flagged)`));
  const c = k.length > 0 ? k.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", g = (A, D) => {
    let C = A[0], x = -1;
    for (const q of A) {
      const U = (D[q.playerId] || 20) * 1.5 + (q.overallKd || 1) * 10;
      U > x && (x = U, C = q);
    }
    return C ? {
      nickname: C.nickname,
      fcr: D[C.playerId] || 20,
      kd: C.overallKd || 1,
      elo: C.elo || 1e3
    } : void 0;
  }, W = g(t, w), L = g(s, u);
  return {
    winChanceF1: r,
    winChanceF2: M,
    predictedScore: {
      f1Score: F,
      f2Score: _,
      isOvertimeLikely: H
    },
    keyAdvantageText: c,
    factors: {
      eloDelta: Math.round(e - a),
      mapAdvantage: d,
      momentumAdvantage: {
        leader: N > B ? "faction1" : B > N ? "faction2" : "balanced",
        f1HotCount: v,
        f2HotCount: P,
        f1ColdCount: S,
        f2ColdCount: j
      },
      premadeAdvantage: {
        leader: b > T ? "faction1" : T > b ? "faction2" : "balanced",
        f1MaxPartySize: b,
        f2MaxPartySize: T
      },
      smurfRiskDelta: {
        f1HighRiskCount: R,
        f2HighRiskCount: K,
        impactPercent: Math.round(G * 100)
      }
    },
    starMatchup: W && L ? { f1Star: W, f2Star: L } : void 0
  };
}
const E = (l, ...e) => {
  for (const a of e) {
    const t = l?.[a];
    if (t != null && t !== "") return t;
  }
};
function ge(l, e, a, t, s, n) {
  const i = a?.games?.cs2 || a?.games?.csgo || {}, h = i.faceit_elo || 1e3, w = i.skill_level || 1, u = i.game_player_id || a?.steam_id_64, m = a?.nickname || e || "Player", y = a?.avatar || "", o = a?.country || "", d = Array.isArray(t) ? null : t, f = Array.isArray(s) ? null : s, v = d?.lifetime || f?.lifetime || {}, S = parseInt(E(v, "Total Matches", "Matches", "m1") || "0", 10), P = parseFloat(E(v, "Win Rate %", "k6") || "0"), j = parseFloat(E(v, "Average K/D Ratio", "K/D Ratio", "k5") || "1.0"), N = parseFloat(E(v, "Average Headshots %", "Headshots %", "k8") || "0"), B = parseFloat(E(v, "ADR", "adr", "c3") || "78.5"), O = {}, Z = [
    ...Array.isArray(t) ? t : t?.segments || t?.items || [],
    ...Array.isArray(s) ? s : s?.segments || s?.items || []
  ];
  for (const p of Z) {
    const M = (p._id?.segmentId || p._id?.label || p.label || p.segmentId || p.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (M) {
      const F = parseInt(E(p.stats, "Matches") ?? E(p, "m1", "matches") ?? "0", 10), _ = parseFloat(E(p.stats, "Win Rate %") ?? E(p, "k6", "winRate") ?? "0"), H = parseFloat(E(p.stats, "Average K/D Ratio", "K/D Ratio") ?? E(p, "k5", "kd") ?? "1.0"), I = parseFloat(E(p.stats, "Average Headshots %") ?? E(p, "k8", "hsPercent") ?? "0"), k = parseFloat(E(p.stats, "Average Kills") ?? E(p, "k1", "avgKills") ?? "0"), c = parseFloat(E(p.stats, "ADR") ?? E(p, "c3", "adr") ?? "78.0"), g = parseInt(E(p.stats, "Wins") ?? E(p, "m2", "wins") ?? Math.round(F * _ / 100).toString(), 10);
      (!O[M] || F > O[M].matches) && (O[M] = {
        mapName: M,
        matches: F,
        winRate: _,
        kd: H,
        hsPercent: I,
        avgKills: k,
        avgAdr: c,
        wins: g,
        losses: Math.max(0, F - g)
      });
    }
  }
  const Y = [];
  let b = 0, T = "NONE", X = !0;
  const R = {};
  if (Array.isArray(n))
    for (let p = 0; p < n.length; p++) {
      const r = n[p], M = r.i10 === "1" || r.result === "1" || r.stats?.Result === "1" || r.stats?.Win === "1", F = M ? "W" : "L";
      p === 0 ? (T = F, b = 1) : X && (F === T ? b++ : X = !1);
      const _ = (r.i1 || r.stats?.Map || r.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), H = parseInt(r.i6 || r.stats?.Kills || r.kills || "0", 10), I = parseInt(r.i8 || r.stats?.Deaths || r.deaths || "0", 10), k = parseFloat(r.c3 || r.stats?.ADR || r.adr || "78.0");
      _ && (R[_] || (R[_] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 }), R[_].matches++, M && R[_].wins++, R[_].kills += H, R[_].deaths += I, R[_].adrSum += k);
      const c = r.elo ? parseInt(r.elo.toString().replace(/,/g, ""), 10) : r.i15 ? parseInt(r.i15, 10) : void 0;
      let g;
      if (p < n.length - 1 && c) {
        const W = n[p + 1], L = W?.elo ? parseInt(W.elo.toString().replace(/,/g, ""), 10) : W?.i15 ? parseInt(W.i15, 10) : void 0;
        if (typeof L == "number" && !isNaN(L)) {
          const A = c - L;
          Math.abs(A) <= 60 && (g = A);
        }
      }
      g === void 0 && (g = M ? 25 : -25), Y.push({
        matchId: r.matchId || r.i0 || `match-${p}`,
        playedAt: r.date || r.created_at || 0,
        map: _,
        result: F,
        score: r.i18 || r.stats?.Score || "13:0",
        kills: H,
        deaths: I,
        kd: parseFloat(r.c2 || r.stats?.["K/D Ratio"] || (I > 0 ? (H / I).toFixed(2) : H.toFixed(2))),
        hsPercent: parseFloat(r.c4 || r.stats?.["Headshots %"] || "0"),
        adr: k,
        elo: c,
        eloDiff: g
      });
    }
  for (const [p, r] of Object.entries(R))
    if (!O[p] || O[p].matches === 0) {
      const M = r.matches, F = r.wins, _ = M > 0 ? Math.round(F / M * 100) : 50, H = r.deaths > 0 ? parseFloat((r.kills / r.deaths).toFixed(2)) : 1, I = M > 0 ? Math.round(r.adrSum / M) : 75;
      O[p] = {
        mapName: p,
        matches: M,
        winRate: _,
        kd: H,
        hsPercent: N,
        avgKills: M > 0 ? parseFloat((r.kills / M).toFixed(1)) : 15,
        avgAdr: I,
        wins: F,
        losses: M - F
      };
    }
  const { formStatus: K, recentKd: G, recentAdr: ee } = me(Y, j, B);
  return {
    playerId: l,
    nickname: m,
    avatar: y,
    country: o,
    steamId64: u,
    elo: h,
    skillLevel: w,
    totalMatches: S,
    overallWinRate: P,
    overallKd: j,
    overallHsPercent: N,
    overallAdr: B,
    currentStreak: {
      type: T,
      count: b
    },
    recentMatches: Y,
    mapStats: O,
    registrationDate: a?.created_at,
    formStatus: K,
    recentKd: G,
    recentAdr: ee
  };
}
class pe {
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
      return this.parseMatchPayload(s);
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
      const [t, s, n, i] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=50`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let h = null;
      if (t.status === "fulfilled" && t.value.ok) {
        const y = await t.value.json();
        h = y.payload || y;
      }
      let w = null;
      if (s.status === "fulfilled" && s.value.ok) {
        const y = await s.value.json();
        w = y.payload || y;
      }
      let u = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const y = await i.value.json();
        u = y.payload || y;
      }
      let m = [];
      if (n.status === "fulfilled" && n.value.ok) {
        const y = await n.value.json(), o = y.payload || y;
        m = Array.isArray(o) ? o : o?.items || o?.segments || [];
      }
      return ge(e, a, h, w, u, m);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
  parseMatchPayload(e) {
    const a = e.teams?.faction1 || e.faction1 || {}, t = e.teams?.faction2 || e.faction2 || {}, s = e.voting?.map?.pick || [], n = s.length > 0 ? s[0] : e.voting?.map?.entities?.find((u) => u.status === "pick")?.name, i = e.configured_server_ip || e.server_ip, h = i && /^[a-zA-Z0-9.\-]+:\d+$/.test(i) ? i : void 0, w = (u) => (u || []).map((m) => ({
      player_id: m.id || m.player_id,
      nickname: m.nickname || "Player",
      avatar: m.avatar || "",
      game_player_id: m.game_player_id || m.gameId || m.steam_id_64,
      game_player_name: m.game_player_name || m.gameName,
      game_skill_level: m.skill_level || m.game_skill_level || 1,
      elo: m.elo || 1e3,
      membership: m.membership,
      party_id: m.party_id || m.partyId
    }));
    return {
      match_id: e.id || e.match_id,
      game: e.game || "cs2",
      region: e.region || "EU",
      status: e.status?.toUpperCase() || "VOTING",
      configured_at: e.configured_at,
      started_at: e.started_at,
      finished_at: e.finished_at,
      teams: {
        faction1: {
          faction_id: a.id || a.faction_id || "faction1",
          name: a.name || "Team 1",
          avatar: a.avatar,
          leader: a.leader,
          roster: w(a.roster)
        },
        faction2: {
          faction_id: t.id || t.faction_id || "faction2",
          name: t.name || "Team 2",
          avatar: t.avatar,
          leader: t.leader,
          roster: w(t.roster)
        }
      },
      voting: e.voting,
      selected_map: n,
      server_ip: h
    };
  }
}
const ne = new pe();
function ye(l, e) {
  const a = !l.includes("<privacyState>public</privacyState>"), t = l.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), s = l.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: t ? t[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: s ? s[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let i = 0, h = 0;
  const w = l.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (w) {
    const d = w[1].split("</mostPlayedGame>");
    for (const f of d)
      if (f.includes("Counter-Strike 2") || f.includes("Counter-Strike: Global Offensive")) {
        const v = f.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        v && (i = parseFloat(v[1].replace(/,/g, "")));
        const S = f.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        S && (h = parseFloat(S[1].replace(/,/g, "")), i === 0 && (i = h));
        break;
      }
  }
  const u = l.match(/<memberSince>(.*?)<\/memberSince>/);
  if (u) {
    const d = new Date(u[1]);
    isNaN(d.getTime()) || (n.timeCreated = d.getTime() / 1e3, n.accountAgeYears = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const m = l.match(/<communityBanned>(.*?)<\/communityBanned>/), y = l.match(/<vacBanned>(.*?)<\/vacBanned>/), o = {
    steamId64: e,
    communityBanned: m ? m[1] === "1" : !1,
    vacBanned: y ? y[1] === "1" : !1,
    numberOfVACBans: parseInt(l.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(l.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(l.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: l.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: i,
      cs2HoursLast2Weeks: h
    },
    bans: o,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
class we {
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
const re = new we();
function ce(l, e) {
  const a = [];
  let t = 0;
  const s = l.totalMatches || 0, n = l.elo || 1e3, i = l.overallKd || 1, h = l.overallWinRate || 50, w = l.recentKd || i;
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
  })) : s >= 800 && (t -= 15), i >= 2 ? (t += 30, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${i.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : i >= 1.6 && s < 200 ? (t += 20, a.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${i.toFixed(2)} with ${s} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : i >= 1.4 && s < 150 ? (t += 12, a.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${i.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : i < 0.95 && s >= 50 && (t -= 10), h >= 80 && s >= 10 ? (t += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${h.toFixed(0)}% across ${s} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : h >= 70 && s >= 15 ? (t += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${h.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : h >= 62 && s >= 25 && (t += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${h.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), w >= 1.75 && w >= i * 1.35 && s >= 10 && (t += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${w.toFixed(2)}) is significantly higher than lifetime baseline (${i.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let u = !0;
  if (e?.fetchError)
    u = !1;
  else if (e && !e.isPrivate && e.summary) {
    u = !1;
    const f = e.playtime?.cs2HoursTotal ?? 0;
    f > 0 && f < 150 && n >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo Rating",
      description: `Only ${f}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : f > 0 && f < 350 && n >= 2e3 ? (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${f}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : f >= 2500 && (t -= 15);
    const v = e.summary.accountAgeYears;
    if (v !== void 0 && v < 1 && n >= 1400 && (t += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${v.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    })), e.bans?.vacBanned || e.bans?.numberOfGameBans) {
      const S = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), P = 25;
      t += P, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${S} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
        weight: P,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else
    u = !0, s < 100 && n >= 1600 ? (t += 15, a.push({
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
    });
  const m = Math.min(100, Math.max(0, Math.round(t)));
  let y = "LOW", o = "#10B981", d = "Legit";
  return m >= 70 ? (y = "CRITICAL", o = "#DC2626", d = "High Risk") : m >= 45 ? (y = "HIGH", o = "#EF4444", d = "Likely Smurf") : m >= 25 && (y = "MEDIUM", o = "#F59E0B", d = "Suspicious"), {
    score: m,
    level: y,
    flags: a,
    isPrivateSteam: u,
    summary: `${m}% Smurf Risk (${y})`,
    color: o,
    badgeText: d
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
function ve(l, e) {
  const a = [];
  let t = 0;
  const s = [l.teams.faction1, l.teams.faction2];
  for (const n of s) {
    if (!n || !n.roster) continue;
    const i = /* @__PURE__ */ new Map();
    for (const o of n.roster)
      if (o.party_id) {
        const d = i.get(o.party_id) || [];
        d.push(o.player_id), i.set(o.party_id, d);
      }
    const h = /* @__PURE__ */ new Set();
    for (const [, o] of i.entries())
      if (o.length >= 2) {
        const d = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${d} (${o.length})`,
          color: te[t % te.length],
          playerIds: o
        }), t++, o.forEach((f) => h.add(f));
      }
    const w = n.roster.map((o) => o.player_id).filter((o) => !h.has(o)), u = /* @__PURE__ */ new Map();
    for (const o of w) {
      const d = e[o];
      d?.recentMatches && u.set(o, new Set(d.recentMatches.map((f) => f.matchId)));
    }
    const m = /* @__PURE__ */ new Set(), y = (o, d) => {
      const f = u.get(o), v = u.get(d);
      if (!f || !v) return !1;
      let S = 0;
      for (const P of f)
        if (v.has(P) && S++, S >= 2) return !0;
      return !1;
    };
    for (const o of w) {
      if (m.has(o)) continue;
      const d = [], f = [o];
      for (m.add(o); f.length > 0; ) {
        const v = f.shift();
        d.push(v);
        for (const S of w)
          !m.has(S) && y(v, S) && (m.add(S), f.push(S));
      }
      if (d.length >= 2) {
        d.forEach((S) => h.add(S));
        const v = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${v} (${d.length})`,
          color: te[t % te.length],
          playerIds: d
        }), t++;
      }
    }
  }
  return a;
}
class Ae {
  constructor() {
    J(this, "settings", { ...ie });
    J(this, "initialized", !1);
  }
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0);
  }
  async loadSettings() {
    const e = await $.get("settings");
    return e && (this.settings = { ...ie, ...e }), this.settings;
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
        case "FETCH_PLAYER_INSIGHT":
          return this.handleFetchPlayerInsight(e.payload);
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
    return this.settings = { ...this.settings, ...e }, await $.set("settings", this.settings, Q.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: s } = e, n = `match_analysis:${t}`;
    if (!s) {
      const h = await $.get(n);
      if (h && !h.isPartial)
        return { success: !0, data: h };
    }
    const i = await ne.getMatchDetails(t);
    return i ? (this.streamLobbyData(t, i, s, a).catch((h) => console.error("[f-insight:Stream] Error:", h)), { success: !0, data: { match: i, isPartial: !0 } }) : { success: !1, error: `Could not fetch match details for ${t}` };
  }
  async streamLobbyData(e, a, t, s) {
    const n = `match_analysis:${e}`, i = a.teams?.faction1?.roster || [], h = a.teams?.faction2?.roster || [], w = [...i, ...h], u = {}, m = {}, y = {};
    await Promise.all(
      w.map(async (c) => {
        const g = c.player_id;
        if (!g) return;
        const W = `player_stats:${g}`;
        let L = null;
        if (t || (L = await $.get(W)), L || (L = await ne.getPlayerStats(g, c.nickname), L && await $.set(W, L, Q.PLAYER_STATS)), L) {
          u[g] = L;
          const A = L.steamId64 || c.game_player_id;
          if (A) {
            const D = `steam_data:${A}`;
            let C = null;
            t || (C = await $.get(D)), C || (C = await re.getPlayerFullData(A), await $.set(D, C, Q.STEAM_PROFILE)), C && (m[g] = C);
          }
          y[g] = ce(L, m[g]), s?.tab?.id && this.safeSendToTab(s.tab.id, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: g, stats: L, steam: m[g], risk: y[g] }
          });
        }
      })
    );
    const o = i.map((c) => u[c.player_id]?.elo || c.elo || 1e3), d = h.map((c) => u[c.player_id]?.elo || c.elo || 1e3), f = o.reduce((c, g) => c + g, 0), v = d.reduce((c, g) => c + g, 0), S = o.length > 0 ? Math.round(f / o.length) : 1e3, P = d.length > 0 ? Math.round(v / d.length) : 1e3, j = S - P, N = fe(S, P), B = i.map((c) => u[c.player_id]?.overallKd || 1), O = h.map((c) => u[c.player_id]?.overallKd || 1), Z = B.length > 0 ? parseFloat((B.reduce((c, g) => c + g, 0) / B.length).toFixed(2)) : 1, Y = O.length > 0 ? parseFloat((O.reduce((c, g) => c + g, 0) / O.length).toFixed(2)) : 1, b = i.map((c) => u[c.player_id]?.overallHsPercent || 0), T = h.map((c) => u[c.player_id]?.overallHsPercent || 0), X = b.length > 0 ? Math.round(b.reduce((c, g) => c + g, 0) / b.length) : 0, R = T.length > 0 ? Math.round(T.reduce((c, g) => c + g, 0) / T.length) : 0, K = i.map((c) => u[c.player_id]?.overallAdr || 75), G = h.map((c) => u[c.player_id]?.overallAdr || 75), ee = K.length > 0 ? Math.round(K.reduce((c, g) => c + g, 0) / K.length) : 75, p = G.length > 0 ? Math.round(G.reduce((c, g) => c + g, 0) / G.length) : 75, r = i.map((c) => u[c.player_id]).filter(Boolean), M = h.map((c) => u[c.player_id]).filter(Boolean), F = oe(r), _ = oe(M);
    for (const [c, g] of Object.entries(F))
      u[c] && (u[c].fcrContributionPercent = g);
    for (const [c, g] of Object.entries(_))
      u[c] && (u[c].fcrContributionPercent = g);
    const H = ve(a, u), I = ue({
      f1AvgElo: S,
      f2AvgElo: P,
      f1Players: r,
      f2Players: M,
      selectedMap: a.selected_map,
      premadeGroups: H,
      riskAnalysis: y,
      f1Fcr: F,
      f2Fcr: _
    }), k = {
      match: a,
      playersStats: u,
      steamData: m,
      riskAnalysis: y,
      premadeGroups: H,
      teamSummary: {
        faction1: {
          totalElo: f,
          avgElo: S,
          winChancePercent: I.winChanceF1,
          avgKd: Z,
          avgHsPercent: X,
          avgAdr: ee,
          projectedElo: N.faction1
        },
        faction2: {
          totalElo: v,
          avgElo: P,
          winChancePercent: I.winChanceF2,
          avgKd: Y,
          avgHsPercent: R,
          avgAdr: p,
          projectedElo: N.faction2
        },
        eloDifference: Math.abs(j)
      },
      prediction: I,
      isPartial: !1
    };
    await $.set(n, k, Q.MATCH), s?.tab?.id && this.safeSendToTab(s.tab.id, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: k
    });
  }
  safeSendToTab(e, a) {
    chrome.tabs.sendMessage(e, a).catch((t) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", t?.message || t);
    });
  }
  async handleFetchPlayerInsight(e) {
    const { playerId: a, steamId64: t, forceRefresh: s } = e, n = `player_stats:${a}`;
    let i = s ? null : await $.get(n);
    if (i || (i = await ne.getPlayerStats(a), i && await $.set(n, i, Q.PLAYER_STATS)), !i)
      return { success: !1, error: "Player stats not found" };
    let h;
    const w = t || i.steamId64;
    if (w) {
      const m = `steam_data:${w}`;
      h = s ? void 0 : await $.get(m) || void 0, h || (h = await re.getPlayerFullData(w), await $.set(m, h, Q.STEAM_PROFILE));
    }
    const u = ce(i, h);
    return {
      success: !0,
      data: {
        stats: i,
        steam: h,
        risk: u
      }
    };
  }
  async handleGetCacheStats() {
    return { success: !0, data: await $.getStats() };
  }
  async handleClearCache() {
    return await $.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const ae = new Ae();
chrome.runtime.onInstalled.addListener(async (l) => {
  console.log("[f-insight:Background] Extension installed/updated:", l.reason), await ae.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), await ae.init();
});
chrome.runtime.onMessage.addListener((l, e, a) => (ae.init().then(() => ae.handleMessage(l, e)).then(a), !0));
chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (l) => {
  l.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await $.cleanup());
});
