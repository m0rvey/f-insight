var de = Object.defineProperty;
var fe = (s, e, a) => e in s ? de(s, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : s[e] = a;
var Q = (s, e, a) => fe(s, typeof e != "symbol" ? e + "" : e, a);
const re = {
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
}, ae = {
  MATCH: 180 * 1e3,
  // 3 minutes
  PLAYER_STATS: 3600 * 1e3,
  // 1 hour (Aggressive caching)
  STEAM_PROFILE: 1440 * 60 * 1e3,
  // 24 hours
  SETTINGS: Number.MAX_SAFE_INTEGER
};
class ge {
  constructor() {
    Q(this, "memoryCache", /* @__PURE__ */ new Map());
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
        const o = (await chrome.storage.local.get([e]))[e];
        if (o && o.cachedAt && o.ttlMs) {
          if (a - o.cachedAt < o.ttlMs)
            return this.memoryCache.set(e, o), o.value;
          await chrome.storage.local.remove([e]);
        }
      } catch (i) {
        console.warn(`[f-insight:Cache] Failed to read ${e} from storage`, i);
      }
    return null;
  }
  async set(e, a, t) {
    const i = {
      value: a,
      cachedAt: Date.now(),
      ttlMs: t
    };
    if (this.memoryCache.set(e, i), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [e]: i });
      } catch (o) {
        console.warn(`[f-insight:Cache] Failed to save ${e} to storage`, o);
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
        for (const [i, o] of Object.entries(a)) {
          if (i === "settings") continue;
          const c = o;
          c && c.cachedAt && c.ttlMs && e - c.cachedAt >= c.ttlMs && t.push(i);
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
const G = new ge();
function me(s, e) {
  const a = e - s, t = 1 / (1 + Math.pow(10, a / 400)), i = 1 - t, o = 50, c = Math.max(1, Math.min(49, Math.round(o * (1 - t)))), f = Math.max(1, Math.min(49, Math.round(o * t))), v = Math.max(1, Math.min(49, Math.round(o * (1 - i)))), h = Math.max(1, Math.min(49, Math.round(o * i)));
  return {
    faction1: {
      winGain: c,
      lossLoss: f
    },
    faction2: {
      winGain: v,
      lossLoss: h
    }
  };
}
function ce(s) {
  const e = {};
  if (s.length === 0) return e;
  const a = s.map((i) => {
    const o = Math.max(500, i.elo || 1e3) / 1e3, c = Math.max(0.4, i.last30Kd ?? i.overallKd ?? 1), f = 1 + ((i.last30Adr ?? i.overallAdr ?? 75) - 75) / 150, v = o * c * Math.max(0.6, f);
    return { id: i.playerId, power: v };
  }), t = a.reduce((i, o) => i + o.power, 0);
  for (const i of a) {
    const o = t > 0 ? i.power / t * 100 : 100 / s.length;
    e[i.id] = parseFloat(o.toFixed(1));
  }
  return e;
}
function ue(s, e, a) {
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: e || 1,
      recentAdr: a || 75
    };
  const t = s.slice(0, 5), i = t.reduce((p, d) => p + (d.kills || 0), 0), o = t.reduce((p, d) => p + (d.deaths || 0), 0), c = o > 0 ? parseFloat((i / o).toFixed(2)) : parseFloat((e || 1).toFixed(2)), f = t.map((p) => p.adr).filter((p) => p !== void 0 && p > 0), v = f.length > 0 ? Math.round(f.reduce((p, d) => p + d, 0) / f.length) : a || 75, h = Math.max(0.5, e || 1), S = c / h;
  let w = "STABLE";
  return S >= 1.15 || c >= 1.4 && t.filter((p) => p.result === "W").length >= 4 ? w = "HOT" : (S <= 0.82 || c <= 0.75 && t.filter((p) => p.result === "L").length >= 4) && (w = "COLD"), {
    formStatus: w,
    recentKd: c,
    recentAdr: v
  };
}
function pe(s) {
  const {
    f1AvgElo: e,
    f2AvgElo: a,
    f1Players: t,
    f2Players: i,
    selectedMap: o,
    premadeGroups: c,
    riskAnalysis: f,
    f1Fcr: v,
    f2Fcr: h
  } = s, S = a - e, w = 1 / (1 + Math.pow(10, S / 400));
  let p = 0, d;
  const y = (o || "").replace("de_", "").toLowerCase();
  if (y) {
    const g = t.reduce((x, W) => x + (W.mapStats?.[y]?.wins || 0), 0), m = t.reduce((x, W) => x + (W.mapStats?.[y]?.matches || 0), 0), u = m > 0 ? Math.round(g / m * 100) : 50, I = i.reduce((x, W) => x + (W.mapStats?.[y]?.wins || 0), 0), k = i.reduce((x, W) => x + (W.mapStats?.[y]?.matches || 0), 0), U = k > 0 ? Math.round(I / k * 100) : 50, K = u - U;
    p = Math.max(-0.12, Math.min(0.12, K / 100 * 0.25)), d = {
      leader: K >= 5 ? "faction1" : K <= -5 ? "faction2" : "balanced",
      mapName: y,
      f1WinRate: u,
      f2WinRate: U,
      deltaWinRate: Math.abs(K)
    };
  }
  const A = t.filter((g) => g.formStatus === "HOT").length, l = t.filter((g) => g.formStatus === "COLD").length, _ = i.filter((g) => g.formStatus === "HOT").length, T = i.filter((g) => g.formStatus === "COLD").length, $ = A - l, Y = _ - T, V = Math.max(-0.1, Math.min(0.1, ($ - Y) * 0.03)), N = new Set(t.map((g) => g.playerId)), ee = new Set(i.map((g) => g.playerId));
  let C = 1, b = 1;
  for (const g of c) {
    const m = g.playerIds.filter((I) => N.has(I)).length, u = g.playerIds.filter((I) => ee.has(I)).length;
    m > C && (C = m), u > b && (b = u);
  }
  const z = Math.max(-0.08, Math.min(0.08, (C - b) * 0.02)), B = t.filter((g) => {
    const m = f[g.playerId]?.level;
    return m === "HIGH" || m === "CRITICAL";
  }).length, E = i.filter((g) => {
    const m = f[g.playerId]?.level;
    return m === "HIGH" || m === "CRITICAL";
  }).length, L = Math.max(-0.06, Math.min(0.06, (B - E) * 0.02)), J = w + p + V + z + L, Z = Math.max(0.06, Math.min(0.94, J)), R = Math.round(Z * 100), X = 100 - R;
  let H = 13, O = 9, q = !1;
  const j = Math.abs(R - 50);
  j <= 3 ? (H = R >= 50 ? 13 : 11, O = R >= 50 ? 11 : 13, q = !0) : j <= 8 ? (H = R >= 50 ? 13 : 10, O = R >= 50 ? 10 : 13) : j <= 16 ? (H = R >= 50 ? 13 : 8, O = R >= 50 ? 8 : 13) : j <= 26 ? (H = R >= 50 ? 13 : 5, O = R >= 50 ? 5 : 13) : (H = R >= 50 ? 13 : 3, O = R >= 50 ? 3 : 13);
  const D = [];
  Math.abs(e - a) >= 60 && D.push(
    e > a ? `Team 1 holds +${Math.round(e - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - e)} avg Elo edge`
  ), d && d.deltaWinRate >= 8 && D.push(
    d.leader === "faction1" ? `Team 1 dominates ${d.mapName} (+${d.deltaWinRate}% WR)` : `Team 2 dominates ${d.mapName} (+${d.deltaWinRate}% WR)`
  ), A > _ && A >= 2 ? D.push(`Team 1 on hot momentum (${A} players On Fire)`) : _ > A && _ >= 2 && D.push(`Team 2 on hot momentum (${_} players On Fire)`), C >= 3 && C > b ? D.push(`Team 1 has ${C}-stack coordination`) : b >= 3 && b > C && D.push(`Team 2 has ${b}-stack coordination`), Math.abs(L) >= 0.04 && B + E > 0 && (B > E ? D.push(`Team 1 likely carries flagged accounts (${B} risk flagged)`) : E > B && D.push(`Team 2 likely carries flagged accounts (${E} risk flagged)`));
  const n = D.length > 0 ? D.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", r = (g, m) => {
    let u = g[0], I = -1;
    for (const k of g) {
      const K = (m[k.playerId] || 20) * 1.5 + (k.last30Kd ?? k.overallKd ?? 1) * 10;
      K > I && (I = K, u = k);
    }
    return u ? {
      nickname: u.nickname,
      fcr: m[u.playerId] || 20,
      kd: u.last30Kd ?? u.overallKd ?? 1,
      elo: u.elo || 1e3
    } : void 0;
  }, F = r(t, v), M = r(i, h);
  return {
    winChanceF1: R,
    winChanceF2: X,
    predictedScore: {
      f1Score: H,
      f2Score: O,
      isOvertimeLikely: q
    },
    keyAdvantageText: n,
    factors: {
      eloDelta: Math.round(e - a),
      mapAdvantage: d,
      momentumAdvantage: {
        leader: $ > Y ? "faction1" : Y > $ ? "faction2" : "balanced",
        f1HotCount: A,
        f2HotCount: _,
        f1ColdCount: l,
        f2ColdCount: T
      },
      premadeAdvantage: {
        leader: C > b ? "faction1" : b > C ? "faction2" : "balanced",
        f1MaxPartySize: C,
        f2MaxPartySize: b
      },
      smurfRiskDelta: {
        f1HighRiskCount: B,
        f2HighRiskCount: E,
        impactPercent: Math.round(L * 100)
      }
    },
    starMatchup: F && M ? { f1Star: F, f2Star: M } : void 0
  };
}
const P = (s, ...e) => {
  for (const a of e) {
    const t = s?.[a];
    if (t != null && t !== "") return t;
  }
};
function ye(s, e, a, t, i, o) {
  const c = a?.games?.cs2 || a?.games?.csgo || {}, f = c.faceit_elo || 1e3, v = c.skill_level || 1, h = c.game_player_id || a?.steam_id_64, S = a?.nickname || e || "Player", w = a?.avatar || "", p = a?.country || "", d = Array.isArray(t) ? null : t, y = Array.isArray(i) ? null : i, A = d?.lifetime || y?.lifetime || {}, l = parseInt(P(A, "Total Matches", "Matches", "m1") || "0", 10), _ = parseFloat(P(A, "Win Rate %", "k6") || "0"), T = parseFloat(P(A, "Average K/D Ratio", "K/D Ratio", "k5") || "1.0"), $ = parseFloat(P(A, "Average Headshots %", "Headshots %", "k8") || "0"), Y = P(A, "ADR", "adr", "c3"), V = Y ? parseFloat(Y) : void 0, N = {}, ee = [
    ...Array.isArray(t) ? t : t?.segments || t?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const n of ee) {
    const F = (n._id?.segmentId || n._id?.label || n.label || n.segmentId || n.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (F) {
      const M = parseInt(P(n.stats, "Matches") ?? P(n, "m1", "matches") ?? "0", 10), g = parseFloat(P(n.stats, "Win Rate %") ?? P(n, "k6", "winRate") ?? "0"), m = parseFloat(P(n.stats, "Average K/D Ratio", "K/D Ratio") ?? P(n, "k5", "kd") ?? "1.0"), u = parseFloat(P(n.stats, "Average Headshots %") ?? P(n, "k8", "hsPercent") ?? "0"), I = parseFloat(P(n.stats, "Average Kills") ?? P(n, "k1", "avgKills") ?? "0"), k = P(n.stats, "ADR") ?? P(n, "c3", "adr"), U = k ? parseFloat(k) : void 0, K = parseInt(P(n.stats, "Wins") ?? P(n, "m2", "wins") ?? Math.round(M * g / 100).toString(), 10);
      (!N[F] || M > N[F].matches) && (N[F] = {
        mapName: F,
        matches: M,
        winRate: g,
        kd: m,
        hsPercent: u,
        avgKills: I,
        avgAdr: U,
        wins: K,
        losses: Math.max(0, M - K)
      });
    }
  }
  const C = [];
  let b = 0, z = "NONE", B = !0;
  const E = {};
  if (Array.isArray(o))
    for (let n = 0; n < o.length; n++) {
      const r = o[n], F = r.i10 === "1" || r.result === "1" || r.stats?.Result === "1" || r.stats?.Win === "1", M = F ? "W" : "L";
      n === 0 ? (z = M, b = 1) : B && (M === z ? b++ : B = !1);
      const g = (r.i1 || r.stats?.Map || r.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), m = parseInt(r.i6 || r.stats?.Kills || r.kills || "0", 10), u = parseInt(r.i8 || r.stats?.Deaths || r.deaths || "0", 10), I = r.c3 || r.stats?.ADR || r.adr, k = I ? parseFloat(I) : void 0, U = r.c4 || r.stats?.["Headshots %"], K = U ? parseFloat(U) : void 0;
      g && (E[g] || (E[g] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), E[g].matches++, F && E[g].wins++, E[g].kills += m, E[g].deaths += u, k !== void 0 && (E[g].adrSum += k, E[g].adrCount++));
      const x = r.elo ? parseInt(r.elo.toString().replace(/,/g, ""), 10) : r.i15 ? parseInt(r.i15, 10) : void 0;
      let W;
      if (n < o.length - 1 && x) {
        const te = o[n + 1], ne = te?.elo ? parseInt(te.elo.toString().replace(/,/g, ""), 10) : te?.i15 ? parseInt(te.i15, 10) : void 0;
        if (typeof ne == "number" && !isNaN(ne)) {
          const oe = x - ne;
          Math.abs(oe) <= 60 && (W = oe);
        }
      }
      W === void 0 && (W = F ? 25 : -25), C.push({
        matchId: r.matchId || r.i0 || `match-${n}`,
        playedAt: r.date || r.created_at || 0,
        map: g,
        result: M,
        score: r.i18 || r.stats?.Score || "13:0",
        kills: m,
        deaths: u,
        kd: parseFloat(r.c2 || r.stats?.["K/D Ratio"] || (u > 0 ? (m / u).toFixed(2) : m.toFixed(2))),
        hsPercent: K,
        adr: k,
        elo: x,
        eloDiff: W
      });
    }
  for (const [n, r] of Object.entries(E))
    if (!N[n] || N[n].matches === 0) {
      const F = r.matches, M = r.wins, g = F > 0 ? Math.round(M / F * 100) : 50, m = r.deaths > 0 ? parseFloat((r.kills / r.deaths).toFixed(2)) : 1, u = r.adrCount > 0 ? Math.round(r.adrSum / r.adrCount) : void 0;
      N[n] = {
        mapName: n,
        matches: F,
        winRate: g,
        kd: m,
        hsPercent: $,
        avgKills: F > 0 ? parseFloat((r.kills / F).toFixed(1)) : 15,
        avgAdr: u,
        wins: M,
        losses: F - M
      };
    }
  const L = C.slice(0, 30), J = L.length;
  let Z, R, X = 0, H, O;
  if (J > 0) {
    const n = L.reduce((m, u) => m + (u.kills || 0), 0), r = L.reduce((m, u) => m + (u.deaths || 0), 0);
    Z = r > 0 ? parseFloat((n / r).toFixed(2)) : void 0;
    const F = L.map((m) => m.adr).filter((m) => m !== void 0 && m > 0);
    X = F.length, R = F.length > 0 ? Math.round(F.reduce((m, u) => m + u, 0) / F.length) : void 0;
    const M = L.map((m) => m.hsPercent).filter((m) => m !== void 0);
    H = M.length > 0 ? Math.round(M.reduce((m, u) => m + u, 0) / M.length) : void 0;
    const g = L.filter((m) => m.result === "W").length;
    O = Math.round(g / J * 100);
  }
  const { formStatus: q, recentKd: j, recentAdr: D } = ue(C, T, V);
  return {
    playerId: s,
    nickname: S,
    avatar: w,
    country: p,
    steamId64: h,
    elo: f,
    skillLevel: v,
    totalMatches: l,
    overallWinRate: _,
    overallKd: T,
    overallHsPercent: $,
    overallAdr: V,
    last30Kd: Z,
    last30Adr: R,
    last30AdrMatches: X,
    last30HsPercent: H,
    last30WinRate: O,
    last30Matches: J,
    currentStreak: {
      type: z,
      count: b
    },
    recentMatches: C,
    mapStats: N,
    registrationDate: a?.created_at,
    formStatus: q,
    recentKd: j,
    recentAdr: D
  };
}
class we {
  constructor() {
    Q(this, "inFlightMatch", /* @__PURE__ */ new Map());
    Q(this, "inFlightPlayer", /* @__PURE__ */ new Map());
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
      const t = await a.json(), i = t.payload || t;
      return ve(i);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, a), null;
    }
  }
  async getPlayerStats(e, a) {
    if (!e) return null;
    const t = `${e}_${a || ""}`;
    if (this.inFlightPlayer.has(t))
      return this.inFlightPlayer.get(t);
    const i = this.fetchPlayerStatsInternal(e, a).finally(() => {
      this.inFlightPlayer.delete(t);
    });
    return this.inFlightPlayer.set(t, i), i;
  }
  async fetchPlayerStatsInternal(e, a) {
    try {
      const [t, i, o, c] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=30`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let f = null;
      if (t.status === "fulfilled" && t.value.ok) {
        const w = await t.value.json();
        f = w.payload || w;
      }
      let v = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const w = await i.value.json();
        v = w.payload || w;
      }
      let h = null;
      if (c.status === "fulfilled" && c.value.ok) {
        const w = await c.value.json();
        h = w.payload || w;
      }
      let S = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const w = await o.value.json(), p = w.payload || w;
        S = Array.isArray(p) ? p : p?.items || p?.segments || [];
      }
      return ye(e, a, f, v, h, S);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
}
function ve(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, a = s.teams?.faction2 || s.faction2 || {}, t = s.voting?.map?.pick || [], i = t.length > 0 ? t[t.length - 1] : [...s.voting?.map?.entities || []].reverse().find((v) => v.status === "pick")?.name, o = s.configured_server_ip || s.server_ip, c = o && /^[a-zA-Z0-9.\-]+:\d+$/.test(o) ? o : void 0, f = (v) => (v || []).map((h) => ({
    player_id: h.id || h.player_id,
    nickname: h.nickname || "Player",
    avatar: h.avatar || "",
    game_player_id: h.game_player_id || h.gameId || h.steam_id_64,
    game_player_name: h.game_player_name || h.gameName,
    game_skill_level: h.skill_level || h.game_skill_level || 1,
    elo: h.elo || 1e3,
    membership: h.membership,
    party_id: h.party_id || h.partyId
  }));
  return {
    match_id: s.id || s.match_id,
    game: s.game || "cs2",
    region: s.region || "EU",
    status: s.status?.toUpperCase() || "VOTING",
    configured_at: s.configured_at,
    started_at: s.started_at,
    finished_at: s.finished_at,
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
    voting: s.voting,
    selected_map: i,
    server_ip: c
  };
}
const le = new we();
function Ae(s, e) {
  const a = !s.includes("<privacyState>public</privacyState>"), t = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), o = {
    steamId64: e,
    personaName: t ? t[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let c = 0, f = 0;
  const v = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (v) {
    const d = v[1].split("</mostPlayedGame>");
    for (const y of d)
      if (y.includes("Counter-Strike 2") || y.includes("Counter-Strike: Global Offensive")) {
        const A = y.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        A && (c = parseFloat(A[1].replace(/,/g, "")));
        const l = y.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        l && (f = parseFloat(l[1].replace(/,/g, "")), c === 0 && (c = f));
        break;
      }
  }
  const h = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (h) {
    const d = new Date(h[1]);
    isNaN(d.getTime()) || (o.timeCreated = d.getTime() / 1e3, o.accountAgeYears = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const S = s.match(/<communityBanned>(.*?)<\/communityBanned>/), w = s.match(/<vacBanned>(.*?)<\/vacBanned>/), p = {
    steamId64: e,
    communityBanned: S ? S[1] === "1" : !1,
    vacBanned: w ? w[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: o,
    playtime: {
      cs2HoursTotal: c,
      cs2HoursLast2Weeks: f
    },
    bans: p,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
class _e {
  constructor() {
    Q(this, "inFlightSteam", /* @__PURE__ */ new Map());
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
      return t.includes("<steamID>") ? Ae(t, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Me = new _e();
function Se(s, e) {
  const a = [];
  let t = 0;
  const i = s.totalMatches || 0, o = s.elo || 1e3, c = s.overallKd || 1, f = s.overallWinRate || 50, v = s.recentKd || c, h = s.recentAdr || 75;
  o >= 2200 && i < 100 ? (t += 45, a.push({
    id: "lvl10_extreme_low_matches",
    title: "High Elo on Very Fresh Account",
    description: `${o} Elo achieved in only ${i} matches`,
    weight: 45,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : o >= 2e3 && i < 150 ? (t += 35, a.push({
    id: "lvl10_low_matches",
    title: "Level 10 with Low Matches",
    description: `Level 10 (${o} Elo) in only ${i} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : o >= 1600 && i < 80 ? (t += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${o} Elo achieved in only ${i} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : o >= 1350 && i < 40 ? (t += 18, a.push({
    id: "mid_elo_fresh_account",
    title: "Level 7+ on New Account",
    description: `${o} Elo with only ${i} matches`,
    weight: 18,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : i < 20 ? (t += 10, a.push({
    id: "fresh_faceit_account",
    title: "New FACEIT Account",
    description: `Only ${i} total matches on record`,
    weight: 10,
    severity: "info",
    category: "MATCHES_ELO"
  })) : i >= 800 && (t -= 15), c >= 2 ? (t += 30, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${c.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : c >= 1.6 && i < 200 ? (t += 20, a.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${c.toFixed(2)} with ${i} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : c >= 1.4 && i < 150 ? (t += 12, a.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${c.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : c < 0.95 && i >= 50 && (t -= 10), s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (t += 22, a.push({
    id: "extreme_adr",
    title: "Exceptional Average Damage (95+)",
    description: `Lifetime ADR of ${s.overallAdr.toFixed(0)} is far above the typical range`,
    weight: 22,
    severity: "danger",
    category: "ADR_ANOMALY"
  })), s.last30Adr !== void 0 && s.last30Adr >= 100 && (s.last30AdrMatches ?? 0) >= 3 && (t += 18, a.push({
    id: "recent_extreme_adr",
    title: "Recent ADR Anomaly (100+)",
    description: `ADR of ${s.last30Adr} across the last 30 matches`,
    weight: 18,
    severity: "warning",
    category: "ADR_ANOMALY"
  })), h >= 95 && s.overallAdr !== void 0 && h >= s.overallAdr * 1.2 && (t += 12, a.push({
    id: "recent_adr_spike",
    title: "Recent ADR Spike",
    description: `Last 5 games ADR (${h}) is 20%+ above lifetime baseline (${s.overallAdr.toFixed(0)})`,
    weight: 12,
    severity: "warning",
    category: "ADR_ANOMALY"
  })), (s.last30HsPercent ?? 0) >= 60 ? (t += 10, a.push({
    id: "extreme_hs_recent",
    title: "Extreme Headshot Rate (60%+)",
    description: `Average ${s.last30HsPercent}% headshots over the last 30 matches`,
    weight: 10,
    severity: "warning",
    category: "HS_ANOMALY"
  })) : s.overallHsPercent >= 60 && c >= 1.5 && (t += 8, a.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${c.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), f >= 80 && i >= 10 ? (t += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${f.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : f >= 70 && i >= 15 ? (t += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${f.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : f >= 62 && i >= 25 && (t += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${f.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), s.last30WinRate !== void 0 && (s.last30Matches ?? 0) >= 5 && (s.last30WinRate >= 85 && i < 300 ? (t += 15, a.push({
    id: "recent_dominance",
    title: "Recent Dominance (85%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 15,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : s.last30WinRate >= 75 && o >= 1500 && (t += 8, a.push({
    id: "elevated_recent_winrate",
    title: "High Recent Win Rate (75%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 8,
    severity: "info",
    category: "WINRATE_ANOMALY"
  }))), v >= 1.75 && v >= c * 1.35 && i >= 10 && (t += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${v.toFixed(2)}) is significantly higher than lifetime baseline (${c.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  })), s.last30Kd !== void 0 && s.last30Kd >= 1.5 && s.last30Kd >= c * 1.3 && i >= 30 && (t += 10, a.push({
    id: "midterm_kd_spike",
    title: "Mid-Term K/D Spike",
    description: `Last 30 games K/D (${s.last30Kd.toFixed(2)}) well above lifetime baseline (${c.toFixed(2)})`,
    weight: 10,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let S = !0;
  if (e?.fetchError)
    S = !1;
  else if (e && !e.isPrivate && e.summary) {
    S = !1;
    const l = e.playtime?.cs2HoursTotal ?? 0;
    l > 0 && l < 150 && o >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo Rating",
      description: `Only ${l}h in CS2 with ${o} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : l > 0 && l < 350 && o >= 2e3 ? (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${l}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : l >= 2500 && (t -= 15);
    const _ = e.summary.accountAgeYears;
    if (_ !== void 0 && _ < 1 && o >= 1400 && (t += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${_.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    })), e.bans?.vacBanned || e.bans?.numberOfGameBans) {
      const T = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), $ = 25;
      t += $, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${T} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
        weight: $,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else if (e?.isPrivate) {
    S = !0, a.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const l = o >= 2200 ? 25 : o >= 2e3 ? 22 : o >= 1600 ? 15 : o >= 1350 ? 10 : 6;
    l >= 15 && (t += l, a.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${o} Elo`,
      weight: l,
      severity: l >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), i < 100 && (t += 10, a.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const _ = s.last30Kd ?? v;
    _ >= 1.6 && (t += 8, a.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${_.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else
    S = !1;
  const w = s.registrationDate ? new Date(s.registrationDate) : null;
  if (w && !isNaN(w.getTime())) {
    const l = (Date.now() - w.getTime()) / 315576e5;
    l < 0.5 && o >= 1350 ? (t += 22, a.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${l.toFixed(1)} years ago with ${o} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : l < 1 && o >= 1600 && (t += 18, a.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${l.toFixed(1)} years ago with ${o} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const p = Math.min(100, Math.max(0, Math.round(t)));
  let d = "LOW", y = "#10B981", A = "Legit";
  return p >= 70 ? (d = "CRITICAL", y = "#DC2626", A = "High Risk") : p >= 45 ? (d = "HIGH", y = "#EF4444", A = "Likely Smurf") : p >= 25 && (d = "MEDIUM", y = "#F59E0B", A = "Suspicious"), {
    score: p,
    level: d,
    flags: a,
    isPrivateSteam: S,
    summary: `${p}% Smurf Risk (${d})`,
    color: y,
    badgeText: A
  };
}
const se = [
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
function Fe(s, e) {
  const a = [];
  let t = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const o of i) {
    if (!o || !o.roster) continue;
    const c = /* @__PURE__ */ new Map();
    for (const d of o.roster)
      if (d.party_id) {
        const y = c.get(d.party_id) || [];
        y.push(d.player_id), c.set(d.party_id, y);
      }
    const f = /* @__PURE__ */ new Set();
    for (const [, d] of c.entries())
      if (d.length >= 2) {
        const y = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${y} (${d.length})`,
          color: se[t % se.length],
          playerIds: d
        }), t++, d.forEach((A) => f.add(A));
      }
    const v = o.roster.map((d) => d.player_id).filter((d) => !f.has(d)), h = 15, S = /* @__PURE__ */ new Map();
    for (const d of v) {
      const y = e[d];
      y?.recentMatches && S.set(d, new Set(y.recentMatches.slice(0, h).map((A) => A.matchId)));
    }
    const w = /* @__PURE__ */ new Set(), p = (d, y) => {
      const A = S.get(d), l = S.get(y);
      if (!A || !l) return !1;
      let _ = 0;
      for (const T of A)
        if (l.has(T) && _++, _ >= 2) return !0;
      return !1;
    };
    for (const d of v) {
      if (w.has(d)) continue;
      const y = [], A = [d];
      for (w.add(d); A.length > 0; ) {
        const l = A.shift();
        y.push(l);
        for (const _ of v)
          !w.has(_) && p(l, _) && (w.add(_), A.push(_));
      }
      if (y.length >= 2) {
        y.forEach((_) => f.add(_));
        const l = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${l} (${y.length})`,
          color: se[t % se.length],
          playerIds: y
        }), t++;
      }
    }
  }
  return a;
}
const Ee = (s) => new Promise((e) => setTimeout(e, s));
async function Ce(s, e, a, t = 150) {
  const i = new Array(s.length);
  let o = 0;
  const c = async () => {
    for (; o < s.length; ) {
      const v = o++;
      i[v] = await a(s[v], v), t > 0 && await Ee(t);
    }
  }, f = Array.from({ length: Math.min(e, s.length) }, c);
  return await Promise.all(f), i;
}
class Re {
  constructor() {
    Q(this, "settings", { ...re });
    Q(this, "initialized", !1);
  }
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0);
  }
  async loadSettings() {
    const e = await G.get("settings");
    return e && (this.settings = { ...re, ...e }), this.settings;
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
    return this.settings = { ...this.settings, ...e }, await G.set("settings", this.settings, ae.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: i } = e, o = `match_analysis:${t}`;
    if (!i) {
      const f = await G.get(o);
      if (f && !f.isPartial)
        return { success: !0, data: f };
    }
    const c = await le.getMatchDetails(t);
    return c ? (this.streamLobbyData(t, c, i, a).catch((f) => console.error("[f-insight:Stream] Error:", f)), { success: !0, data: { match: c, isPartial: !0 } }) : { success: !1, error: `Could not fetch match details for ${t}` };
  }
  async streamLobbyData(e, a, t, i) {
    try {
      await this.streamLobbyDataInner(e, a, t, i);
    } catch (o) {
      console.error("[f-insight:Stream] Error:", o), i?.tab?.id && this.safeSendToTab(i.tab.id, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: e, error: o?.message || "Match analysis stream failed" }
      });
    }
  }
  async streamLobbyDataInner(e, a, t, i) {
    const o = `match_analysis:${e}`, c = a.teams?.faction1?.roster || [], f = a.teams?.faction2?.roster || [], v = [...c, ...f], h = {}, S = {}, w = {};
    await Ce(
      v,
      3,
      async (n) => {
        const r = n.player_id;
        if (!r) return;
        const F = `player_stats:${r}`;
        let M = null;
        if (t || (M = await G.get(F)), M || (M = await le.getPlayerStats(r, n.nickname), M && await G.set(F, M, ae.PLAYER_STATS)), M) {
          h[r] = M;
          const g = M.steamId64 || n.game_player_id;
          if (g) {
            const m = `steam_data:${g}`;
            let u = null;
            t || (u = await G.get(m)), u || (u = await Me.getPlayerFullData(g), u && !u.fetchError && await G.set(m, u, ae.STEAM_PROFILE)), u && (S[r] = u);
          }
          w[r] = Se(M, S[r]), i?.tab?.id && this.safeSendToTab(i.tab.id, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: r, stats: M, steam: S[r], risk: w[r] }
          });
        }
      },
      200
    );
    const p = c.map((n) => h[n.player_id]?.elo || n.elo || 1e3), d = f.map((n) => h[n.player_id]?.elo || n.elo || 1e3), y = p.reduce((n, r) => n + r, 0), A = d.reduce((n, r) => n + r, 0), l = p.length > 0 ? Math.round(y / p.length) : 1e3, _ = d.length > 0 ? Math.round(A / d.length) : 1e3, T = l - _, $ = me(l, _), Y = c.map((n) => h[n.player_id]?.last30Kd ?? h[n.player_id]?.overallKd ?? 1), V = f.map((n) => h[n.player_id]?.last30Kd ?? h[n.player_id]?.overallKd ?? 1), N = Y.length > 0 ? parseFloat((Y.reduce((n, r) => n + r, 0) / Y.length).toFixed(2)) : 1, ee = V.length > 0 ? parseFloat((V.reduce((n, r) => n + r, 0) / V.length).toFixed(2)) : 1, C = c.map((n) => h[n.player_id]?.overallHsPercent || 0), b = f.map((n) => h[n.player_id]?.overallHsPercent || 0), z = C.length > 0 ? Math.round(C.reduce((n, r) => n + r, 0) / C.length) : 0, B = b.length > 0 ? Math.round(b.reduce((n, r) => n + r, 0) / b.length) : 0, E = c.map((n) => h[n.player_id]?.last30Adr ?? h[n.player_id]?.overallAdr ?? 75), L = f.map((n) => h[n.player_id]?.last30Adr ?? h[n.player_id]?.overallAdr ?? 75), J = E.length > 0 ? Math.round(E.reduce((n, r) => n + r, 0) / E.length) : 75, Z = L.length > 0 ? Math.round(L.reduce((n, r) => n + r, 0) / L.length) : 75, R = c.map((n) => h[n.player_id]).filter(Boolean), X = f.map((n) => h[n.player_id]).filter(Boolean), H = ce(R), O = ce(X);
    for (const [n, r] of Object.entries(H))
      h[n] && (h[n].fcrContributionPercent = r);
    for (const [n, r] of Object.entries(O))
      h[n] && (h[n].fcrContributionPercent = r);
    const q = Fe(a, h), j = pe({
      f1AvgElo: l,
      f2AvgElo: _,
      f1Players: R,
      f2Players: X,
      selectedMap: a.selected_map,
      premadeGroups: q,
      riskAnalysis: w,
      f1Fcr: H,
      f2Fcr: O
    }), D = {
      match: a,
      playersStats: h,
      steamData: S,
      riskAnalysis: w,
      premadeGroups: q,
      teamSummary: {
        faction1: {
          totalElo: y,
          avgElo: l,
          winChancePercent: j.winChanceF1,
          avgKd: N,
          avgHsPercent: z,
          avgAdr: J,
          projectedElo: $.faction1
        },
        faction2: {
          totalElo: A,
          avgElo: _,
          winChancePercent: j.winChanceF2,
          avgKd: ee,
          avgHsPercent: B,
          avgAdr: Z,
          projectedElo: $.faction2
        },
        eloDifference: Math.abs(T)
      },
      prediction: j,
      isPartial: !1
    };
    await G.set(o, D, ae.MATCH), i?.tab?.id && this.safeSendToTab(i.tab.id, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: D
    });
  }
  safeSendToTab(e, a) {
    chrome.tabs.sendMessage(e, a).catch((t) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", t?.message || t);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await G.getStats() };
  }
  async handleClearCache() {
    return await G.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const ie = new Re(), he = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), he(), await ie.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), he(), await ie.init();
});
chrome.runtime.onMessage.addListener((s, e, a) => (ie.init().then(() => ie.handleMessage(s, e)).then(a), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await G.cleanup());
});
