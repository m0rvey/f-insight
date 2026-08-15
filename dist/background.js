var re = Object.defineProperty;
var ce = (w, e, a) => e in w ? re(w, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : w[e] = a;
var J = (w, e, a) => ce(w, typeof e != "symbol" ? e + "" : e, a);
const se = {
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
}, q = {
  MATCH: 180 * 1e3,
  // 3 minutes
  PLAYER_STATS: 3600 * 1e3,
  // 1 hour (Aggressive caching)
  STEAM_PROFILE: 1440 * 60 * 1e3,
  // 24 hours
  SETTINGS: Number.MAX_SAFE_INTEGER
};
class le {
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
const L = new le();
function he(w, e) {
  const a = e - w, t = 1 / (1 + Math.pow(10, a / 400)), s = 1 - t, n = 50, i = Math.max(1, Math.min(49, Math.round(n * (1 - t)))), r = Math.max(1, Math.min(49, Math.round(n * t))), A = Math.max(1, Math.min(49, Math.round(n * (1 - s)))), d = Math.max(1, Math.min(49, Math.round(n * s)));
  return {
    faction1: {
      winGain: i,
      lossLoss: r
    },
    faction2: {
      winGain: A,
      lossLoss: d
    }
  };
}
function ne(w) {
  const e = {};
  if (w.length === 0) return e;
  const a = w.map((s) => {
    const n = Math.max(500, s.elo || 1e3) / 1e3, i = Math.max(0.4, s.overallKd || 1), r = 1 + ((s.overallAdr || 75) - 75) / 150, A = n * i * Math.max(0.6, r);
    return { id: s.playerId, power: A };
  }), t = a.reduce((s, n) => s + n.power, 0);
  for (const s of a) {
    const n = t > 0 ? s.power / t * 100 : 100 / w.length;
    e[s.id] = parseFloat(n.toFixed(1));
  }
  return e;
}
function de(w, e, a) {
  if (!w || w.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: e || 1,
      recentAdr: a || 75
    };
  const t = w.slice(0, 5), s = t.reduce((o, u) => o + (u.kills || 0), 0), n = t.reduce((o, u) => o + (u.deaths || 0), 0), i = n > 0 ? parseFloat((s / n).toFixed(2)) : parseFloat(s.toFixed(2)), r = t.map((o) => o.adr).filter((o) => o !== void 0 && o > 0), A = r.length > 0 ? Math.round(r.reduce((o, u) => o + u, 0) / r.length) : a || 75, d = Math.max(0.5, e || 1), h = i / d;
  let v = "STABLE";
  return h >= 1.15 || i >= 1.4 && t.filter((o) => o.result === "W").length >= 4 ? v = "HOT" : (h <= 0.82 || i <= 0.75 && t.filter((o) => o.result === "L").length >= 4) && (v = "COLD"), {
    formStatus: v,
    recentKd: i,
    recentAdr: A
  };
}
function fe(w) {
  const {
    f1AvgElo: e,
    f2AvgElo: a,
    f1Players: t,
    f2Players: s,
    selectedMap: n,
    premadeGroups: i,
    riskAnalysis: r,
    f1Fcr: A,
    f2Fcr: d
  } = w, h = a - e, v = 1 / (1 + Math.pow(10, h / 400));
  let o = 0, u;
  const f = (n || "").replace("de_", "").toLowerCase();
  if (f) {
    const p = t.reduce((Y, U) => Y + (U.mapStats?.[f]?.wins || 0), 0), F = t.reduce((Y, U) => Y + (U.mapStats?.[f]?.matches || 0), 0), R = F > 0 ? Math.round(p / F * 100) : 50, I = s.reduce((Y, U) => Y + (U.mapStats?.[f]?.wins || 0), 0), z = s.reduce((Y, U) => Y + (U.mapStats?.[f]?.matches || 0), 0), te = z > 0 ? Math.round(I / z * 100) : 50, j = R - te;
    o = Math.max(-0.12, Math.min(0.12, j / 100 * 0.25)), u = {
      leader: j >= 5 ? "faction1" : j <= -5 ? "faction2" : "balanced",
      mapName: f,
      f1WinRate: R,
      f2WinRate: te,
      deltaWinRate: Math.abs(j)
    };
  }
  const S = t.filter((p) => p.formStatus === "HOT").length, g = t.filter((p) => p.formStatus === "COLD").length, C = s.filter((p) => p.formStatus === "HOT").length, N = s.filter((p) => p.formStatus === "COLD").length, W = S - g, x = C - N, B = Math.max(-0.1, Math.min(0.1, (W - x) * 0.03)), O = new Set(t.map((p) => p.playerId)), Q = new Set(s.map((p) => p.playerId));
  let T = 1, b = 1;
  for (const p of i) {
    const F = p.playerIds.filter((I) => O.has(I)).length, R = p.playerIds.filter((I) => Q.has(I)).length;
    F > T && (T = F), R > b && (b = R);
  }
  const G = Math.max(-0.08, Math.min(0.08, (T - b) * 0.02)), V = v + o + B + G, $ = Math.max(0.06, Math.min(0.94, V)), E = Math.round($ * 100), X = 100 - E;
  let K = 13, l = 9, m = !1;
  const _ = Math.abs(E - 50);
  _ <= 3 ? (K = E >= 50 ? 13 : 11, l = E >= 50 ? 11 : 13, m = !0) : _ <= 8 ? (K = E >= 50 ? 13 : 10, l = E >= 50 ? 10 : 13) : _ <= 16 ? (K = E >= 50 ? 13 : 8, l = E >= 50 ? 8 : 13) : _ <= 26 ? (K = E >= 50 ? 13 : 5, l = E >= 50 ? 5 : 13) : (K = E >= 50 ? 13 : 3, l = E >= 50 ? 3 : 13);
  const M = [];
  Math.abs(e - a) >= 60 && M.push(
    e > a ? `Team 1 holds +${Math.round(e - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - e)} avg Elo edge`
  ), u && u.deltaWinRate >= 8 && M.push(
    u.leader === "faction1" ? `Team 1 dominates ${u.mapName} (+${u.deltaWinRate}% WR)` : `Team 2 dominates ${u.mapName} (+${u.deltaWinRate}% WR)`
  ), S > C && S >= 2 ? M.push(`Team 1 on hot momentum (${S} players On Fire)`) : C > S && C >= 2 && M.push(`Team 2 on hot momentum (${C} players On Fire)`), T >= 3 && T > b ? M.push(`Team 1 has ${T}-stack coordination`) : b >= 3 && b > T && M.push(`Team 2 has ${b}-stack coordination`);
  const P = M.length > 0 ? M.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", k = (p, F) => {
    let R = p[0], I = -1;
    for (const z of p) {
      const j = (F[z.playerId] || 20) * 1.5 + (z.overallKd || 1) * 10;
      j > I && (I = j, R = z);
    }
    return R ? {
      nickname: R.nickname,
      fcr: F[R.playerId] || 20,
      kd: R.overallKd || 1,
      elo: R.elo || 1e3
    } : void 0;
  }, D = k(t, A), c = k(s, d), y = t.filter((p) => {
    const F = r[p.playerId]?.level;
    return F === "HIGH" || F === "CRITICAL";
  }).length, H = s.filter((p) => {
    const F = r[p.playerId]?.level;
    return F === "HIGH" || F === "CRITICAL";
  }).length;
  return {
    winChanceF1: E,
    winChanceF2: X,
    predictedScore: {
      f1Score: K,
      f2Score: l,
      isOvertimeLikely: m
    },
    keyAdvantageText: P,
    factors: {
      eloDelta: Math.round(e - a),
      mapAdvantage: u,
      momentumAdvantage: {
        leader: W > x ? "faction1" : x > W ? "faction2" : "balanced",
        f1HotCount: S,
        f2HotCount: C,
        f1ColdCount: g,
        f2ColdCount: N
      },
      premadeAdvantage: {
        leader: T > b ? "faction1" : b > T ? "faction2" : "balanced",
        f1MaxPartySize: T,
        f2MaxPartySize: b
      },
      smurfRiskDelta: {
        f1HighRiskCount: y,
        f2HighRiskCount: H
      }
    },
    starMatchup: D && c ? { f1Star: D, f2Star: c } : void 0
  };
}
class me {
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
      let r = null;
      if (t.status === "fulfilled" && t.value.ok) {
        const v = await t.value.json();
        r = v.payload || v;
      }
      let A = null;
      if (s.status === "fulfilled" && s.value.ok) {
        const v = await s.value.json();
        A = v.payload || v;
      }
      let d = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const v = await i.value.json();
        d = v.payload || v;
      }
      let h = [];
      if (n.status === "fulfilled" && n.value.ok) {
        const v = await n.value.json(), o = v.payload || v;
        h = Array.isArray(o) ? o : o?.items || o?.segments || [];
      }
      return this.parsePlayerPayload(e, a, r, A, d, h);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
  parseMatchPayload(e) {
    const a = e.teams?.faction1 || e.faction1 || {}, t = e.teams?.faction2 || e.faction2 || {}, s = e.voting?.map?.pick || [], n = s.length > 0 ? s[0] : e.voting?.map?.entities?.find((d) => d.status === "pick")?.name, i = e.configured_server_ip || e.server_ip, r = i && /^[a-zA-Z0-9.\-]+:\d+$/.test(i) ? i : void 0, A = (d) => (d || []).map((h) => ({
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
          roster: A(a.roster)
        },
        faction2: {
          faction_id: t.id || t.faction_id || "faction2",
          name: t.name || "Team 2",
          avatar: t.avatar,
          leader: t.leader,
          roster: A(t.roster)
        }
      },
      voting: e.voting,
      selected_map: n,
      server_ip: r
    };
  }
  parsePlayerPayload(e, a, t, s, n, i) {
    const r = t?.games?.cs2 || t?.games?.csgo || {}, A = r.faceit_elo || 1e3, d = r.skill_level || 1, h = r.game_player_id || t?.steam_id_64, v = t?.nickname || a || "Player", o = t?.avatar || "", u = t?.country || "", f = Array.isArray(s) ? null : s, S = Array.isArray(n) ? null : n, g = f?.lifetime || S?.lifetime || {}, C = parseInt(g.m1 || g.Matches || "0", 10), N = parseFloat(g.k6 || g["Win Rate %"] || "0"), W = parseFloat(g.k5 || g["Average K/D Ratio"] || "1.0"), x = parseFloat(g.k8 || g["Average Headshots %"] || "0"), B = parseFloat(g.c3 || g.adr || "78.5"), O = {}, Q = [
      ...Array.isArray(s) ? s : s?.segments || s?.items || [],
      ...Array.isArray(n) ? n : n?.segments || n?.items || []
    ];
    for (const l of Q) {
      const _ = (l._id?.segmentId || l._id?.label || l.label || l.segmentId || l.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
      if (_) {
        const M = parseInt(l.m1 || l.stats?.Matches || l.matches || "0", 10), P = parseFloat(l.k6 || l.stats?.["Win Rate %"] || l.winRate || "0"), k = parseFloat(l.k5 || l.stats?.["Average K/D Ratio"] || l.kd || "1.0"), D = parseFloat(l.k8 || l.stats?.["Average Headshots %"] || l.hsPercent || "0"), c = parseFloat(l.k1 || l.stats?.["Average Kills"] || l.avgKills || "0"), y = parseFloat(l.c3 || l.stats?.ADR || l.adr || "78.0"), H = parseInt(l.m2 || l.stats?.Wins || l.wins || Math.round(M * P / 100).toString(), 10);
        (!O[_] || M > O[_].matches) && (O[_] = {
          mapName: _,
          matches: M,
          winRate: P,
          kd: k,
          hsPercent: D,
          avgKills: c,
          avgAdr: y,
          wins: H,
          losses: Math.max(0, M - H)
        });
      }
    }
    const T = [];
    let b = 0, G = "NONE", V = !0;
    const $ = {};
    if (Array.isArray(i))
      for (let l = 0; l < i.length; l++) {
        const m = i[l], _ = m.i10 === "1" || m.result === "1" || m.stats?.Result === "1" || m.stats?.Win === "1", M = _ ? "W" : "L";
        l === 0 ? (G = M, b = 1) : V && (M === G ? b++ : V = !1);
        const P = (m.i1 || m.stats?.Map || m.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), k = parseInt(m.i6 || m.stats?.Kills || m.kills || "0", 10), D = parseInt(m.i8 || m.stats?.Deaths || m.deaths || "0", 10), c = parseFloat(m.c3 || m.stats?.ADR || m.adr || "78.0");
        P && ($[P] || ($[P] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 }), $[P].matches++, _ && $[P].wins++, $[P].kills += k, $[P].deaths += D, $[P].adrSum += c);
        const y = m.elo ? parseInt(m.elo.toString().replace(/,/g, ""), 10) : m.i15 ? parseInt(m.i15, 10) : void 0;
        let H;
        if (l < i.length - 1 && y) {
          const p = i[l + 1], F = p?.elo ? parseInt(p.elo.toString().replace(/,/g, ""), 10) : p?.i15 ? parseInt(p.i15, 10) : void 0;
          if (typeof F == "number" && !isNaN(F)) {
            const R = y - F;
            Math.abs(R) <= 60 && (H = R);
          }
        }
        H === void 0 && (H = _ ? 25 : -25), T.push({
          matchId: m.matchId || m.i0 || `match-${l}`,
          playedAt: m.date || m.created_at || 0,
          map: P,
          result: M,
          score: m.i18 || m.stats?.Score || "13:0",
          kills: k,
          deaths: D,
          kd: parseFloat(m.c2 || m.stats?.["K/D Ratio"] || (D > 0 ? (k / D).toFixed(2) : k.toFixed(2))),
          hsPercent: parseFloat(m.c4 || m.stats?.["Headshots %"] || "0"),
          adr: c,
          elo: y,
          eloDiff: H
        });
      }
    for (const [l, m] of Object.entries($))
      if (!O[l] || O[l].matches === 0) {
        const _ = m.matches, M = m.wins, P = _ > 0 ? Math.round(M / _ * 100) : 50, k = m.deaths > 0 ? parseFloat((m.kills / m.deaths).toFixed(2)) : 1, D = _ > 0 ? Math.round(m.adrSum / _) : 75;
        O[l] = {
          mapName: l,
          matches: _,
          winRate: P,
          kd: k,
          hsPercent: x,
          avgKills: _ > 0 ? parseFloat((m.kills / _).toFixed(1)) : 15,
          avgAdr: D,
          wins: M,
          losses: _ - M
        };
      }
    const { formStatus: E, recentKd: X, recentAdr: K } = de(T, W, B);
    return {
      playerId: e,
      nickname: v,
      avatar: o,
      country: u,
      steamId64: h,
      elo: A,
      skillLevel: d,
      totalMatches: C,
      overallWinRate: N,
      overallKd: W,
      overallHsPercent: x,
      overallAdr: B,
      currentStreak: {
        type: G,
        count: b
      },
      recentMatches: T,
      mapStats: O,
      registrationDate: t?.created_at,
      formStatus: E,
      recentKd: X,
      recentAdr: K
    };
  }
}
const ae = new me();
class ue {
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
      if (a.ok) {
        const t = await a.text(), s = t.includes("<privacyState>private</privacyState>") || !t.includes("<privacyState>public</privacyState>"), n = t.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = t.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), r = t.match(/<vacBanned>(.*?)<\/vacBanned>/), A = {
          steamId64: e,
          personaName: n ? n[1] : "Steam User",
          profileUrl: `https://steamcommunity.com/profiles/${e}`,
          avatar: i ? i[1] : "",
          communityVisibilityState: s ? 1 : 3
        };
        let d = 0, h = 0;
        const v = t.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
        if (v) {
          const S = v[1].split("</mostPlayedGame>");
          for (const g of S)
            if (g.includes("Counter-Strike 2") || g.includes("Counter-Strike: Global Offensive")) {
              const C = g.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
              C && (d = parseFloat(C[1].replace(/,/g, "")));
              const N = g.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
              N && (h = parseFloat(N[1].replace(/,/g, "")), d === 0 && (d = h));
              break;
            }
        }
        const o = t.match(/<memberSince>(.*?)<\/memberSince>/);
        if (o) {
          const S = new Date(o[1]);
          if (!isNaN(S.getTime())) {
            const g = Date.now() - S.getTime();
            A.accountAgeYears = g / (1e3 * 60 * 60 * 24 * 365.25);
          }
        }
        const u = {
          cs2HoursTotal: d,
          cs2HoursLast2Weeks: h
        }, f = {
          steamId64: e,
          communityBanned: !1,
          vacBanned: r ? r[1] === "1" : !1,
          numberOfVACBans: r && r[1] === "1" ? 1 : 0,
          daysSinceLastBan: 0,
          numberOfGameBans: 0,
          economyBan: "none"
        };
        return {
          summary: A,
          playtime: u,
          bans: f,
          isPrivate: s,
          fetchedAt: Date.now()
        };
      }
    } catch {
    }
    return {
      isPrivate: !0,
      summary: {
        steamId64: e,
        personaName: "Steam User",
        profileUrl: `https://steamcommunity.com/profiles/${e}`,
        avatar: "",
        communityVisibilityState: 1
      },
      fetchedAt: Date.now()
    };
  }
}
const ie = new ue();
function oe(w, e) {
  const a = [];
  let t = 0;
  const s = w.totalMatches || 0, n = w.elo || 1e3, i = w.overallKd || 1, r = w.overallWinRate || 50, A = w.recentKd || i;
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
  })) : i < 0.95 && s >= 50 && (t -= 10), r >= 80 && s >= 10 ? (t += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${r.toFixed(0)}% across ${s} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : r >= 70 && s >= 15 ? (t += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${r.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : r >= 62 && s >= 25 && (t += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${r.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), A >= 1.75 && A >= i * 1.35 && s >= 10 && (t += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${A.toFixed(2)}) is significantly higher than lifetime baseline (${i.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let d = !0;
  if (e && !e.isPrivate && e.summary) {
    d = !1;
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
    const S = e.summary.accountAgeYears;
    if (S !== void 0 && S < 1 && n >= 1400 && (t += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${S.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    })), e.bans?.vacBanned || e.bans?.numberOfGameBans) {
      const g = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), C = 25;
      t += C, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${g} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
        weight: C,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else
    d = !0, s < 100 && n >= 1600 ? (t += 15, a.push({
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
  const h = Math.min(100, Math.max(0, Math.round(t)));
  let v = "LOW", o = "#10B981", u = "Legit";
  return h >= 70 ? (v = "CRITICAL", o = "#DC2626", u = "High Risk") : h >= 45 ? (v = "HIGH", o = "#EF4444", u = "Likely Smurf") : h >= 25 && (v = "MEDIUM", o = "#F59E0B", u = "Suspicious"), {
    score: h,
    level: v,
    flags: a,
    isPrivateSteam: d,
    summary: `${h}% Smurf Risk (${v})`,
    color: o,
    badgeText: u
  };
}
const Z = [
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
function ge(w, e) {
  const a = [];
  let t = 0;
  const s = [w.teams.faction1, w.teams.faction2];
  for (const n of s) {
    if (!n || !n.roster) continue;
    const i = /* @__PURE__ */ new Map();
    for (const o of n.roster)
      if (o.party_id) {
        const u = i.get(o.party_id) || [];
        u.push(o.player_id), i.set(o.party_id, u);
      }
    const r = /* @__PURE__ */ new Set();
    for (const [, o] of i.entries())
      if (o.length >= 2) {
        const u = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${u} (${o.length})`,
          color: Z[t % Z.length],
          playerIds: o
        }), t++, o.forEach((f) => r.add(f));
      }
    const A = n.roster.map((o) => o.player_id).filter((o) => !r.has(o)), d = /* @__PURE__ */ new Map();
    for (const o of A) {
      const u = e[o];
      u?.recentMatches && d.set(o, new Set(u.recentMatches.map((f) => f.matchId)));
    }
    const h = /* @__PURE__ */ new Set(), v = (o, u) => {
      const f = d.get(o), S = d.get(u);
      if (!f || !S) return !1;
      let g = 0;
      for (const C of f)
        if (S.has(C) && g++, g >= 2) return !0;
      return !1;
    };
    for (const o of A) {
      if (h.has(o)) continue;
      const u = [], f = [o];
      for (h.add(o); f.length > 0; ) {
        const S = f.shift();
        u.push(S);
        for (const g of A)
          !h.has(g) && v(S, g) && (h.add(g), f.push(g));
      }
      if (u.length >= 2) {
        u.forEach((g) => r.add(g));
        const S = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${S} (${u.length})`,
          color: Z[t % Z.length],
          playerIds: u
        }), t++;
      }
    }
  }
  return a;
}
class pe {
  constructor() {
    J(this, "settings", { ...se });
  }
  async init() {
    await this.loadSettings();
  }
  async loadSettings() {
    const e = await L.get("settings");
    return e && (this.settings = { ...se, ...e }), this.settings;
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
    return this.settings = { ...this.settings, ...e }, await L.set("settings", this.settings, q.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: s } = e, n = `match_analysis:${t}`;
    if (!s) {
      const r = await L.get(n);
      if (r && !r.isPartial)
        return { success: !0, data: r };
    }
    const i = await ae.getMatchDetails(t);
    return i ? (this.streamLobbyData(t, i, s, a).catch((r) => console.error("[f-insight:Stream] Error:", r)), { success: !0, data: { match: i, isPartial: !0 } }) : { success: !1, error: `Could not fetch match details for ${t}` };
  }
  async streamLobbyData(e, a, t, s) {
    const n = `match_analysis:${e}`, i = a.teams?.faction1?.roster || [], r = a.teams?.faction2?.roster || [], A = [...i, ...r], d = {}, h = {}, v = {};
    await Promise.all(
      A.map(async (c) => {
        const y = c.player_id;
        if (!y) return;
        const H = `player_stats:${y}`;
        let p = null;
        if (t || (p = await L.get(H)), p || (p = await ae.getPlayerStats(y, c.nickname), p && await L.set(H, p, q.PLAYER_STATS)), p) {
          d[y] = p;
          const F = p.steamId64 || c.game_player_id;
          if (F) {
            const R = `steam_data:${F}`;
            let I = null;
            t || (I = await L.get(R)), I || (I = await ie.getPlayerFullData(F), await L.set(R, I, q.STEAM_PROFILE)), I && (h[y] = I);
          }
          v[y] = oe(p, h[y]), s?.tab?.id && chrome.tabs.sendMessage(s.tab.id, {
            type: "PLAYER_STATS_UPDATE",
            payload: { playerId: y, stats: p, steam: h[y], risk: v[y] }
          });
        }
      })
    );
    const o = i.map((c) => d[c.player_id]?.elo || c.elo || 1e3), u = r.map((c) => d[c.player_id]?.elo || c.elo || 1e3), f = o.reduce((c, y) => c + y, 0), S = u.reduce((c, y) => c + y, 0), g = o.length > 0 ? Math.round(f / o.length) : 1e3, C = u.length > 0 ? Math.round(S / u.length) : 1e3, N = g - C, W = he(g, C), x = i.map((c) => d[c.player_id]?.overallKd || 1), B = r.map((c) => d[c.player_id]?.overallKd || 1), O = x.length > 0 ? parseFloat((x.reduce((c, y) => c + y, 0) / x.length).toFixed(2)) : 1, Q = B.length > 0 ? parseFloat((B.reduce((c, y) => c + y, 0) / B.length).toFixed(2)) : 1, T = i.map((c) => d[c.player_id]?.overallHsPercent || 0), b = r.map((c) => d[c.player_id]?.overallHsPercent || 0), G = T.length > 0 ? Math.round(T.reduce((c, y) => c + y, 0) / T.length) : 0, V = b.length > 0 ? Math.round(b.reduce((c, y) => c + y, 0) / b.length) : 0, $ = i.map((c) => d[c.player_id]?.overallAdr || 75), E = r.map((c) => d[c.player_id]?.overallAdr || 75), X = $.length > 0 ? Math.round($.reduce((c, y) => c + y, 0) / $.length) : 75, K = E.length > 0 ? Math.round(E.reduce((c, y) => c + y, 0) / E.length) : 75, l = i.map((c) => d[c.player_id]).filter(Boolean), m = r.map((c) => d[c.player_id]).filter(Boolean), _ = ne(l), M = ne(m);
    for (const [c, y] of Object.entries(_))
      d[c] && (d[c].fcrContributionPercent = y);
    for (const [c, y] of Object.entries(M))
      d[c] && (d[c].fcrContributionPercent = y);
    const P = ge(a, d), k = fe({
      f1AvgElo: g,
      f2AvgElo: C,
      f1Players: l,
      f2Players: m,
      selectedMap: a.selected_map,
      premadeGroups: P,
      riskAnalysis: v,
      f1Fcr: _,
      f2Fcr: M
    }), D = {
      match: a,
      playersStats: d,
      steamData: h,
      riskAnalysis: v,
      premadeGroups: P,
      teamSummary: {
        faction1: {
          totalElo: f,
          avgElo: g,
          winChancePercent: k.winChanceF1,
          avgKd: O,
          avgHsPercent: G,
          avgAdr: X,
          projectedElo: W.faction1
        },
        faction2: {
          totalElo: S,
          avgElo: C,
          winChancePercent: k.winChanceF2,
          avgKd: Q,
          avgHsPercent: V,
          avgAdr: K,
          projectedElo: W.faction2
        },
        eloDifference: Math.abs(N)
      },
      prediction: k,
      isPartial: !1
    };
    await L.set(n, D, q.MATCH), s?.tab?.id && chrome.tabs.sendMessage(s.tab.id, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: D
    });
  }
  async handleFetchPlayerInsight(e) {
    const { playerId: a, steamId64: t, forceRefresh: s } = e, n = `player_stats:${a}`;
    let i = s ? null : await L.get(n);
    if (i || (i = await ae.getPlayerStats(a), i && await L.set(n, i, q.PLAYER_STATS)), !i)
      return { success: !1, error: "Player stats not found" };
    let r;
    const A = t || i.steamId64;
    if (A) {
      const h = `steam_data:${A}`;
      r = s ? void 0 : await L.get(h) || void 0, r || (r = await ie.getPlayerFullData(A), await L.set(h, r, q.STEAM_PROFILE));
    }
    const d = oe(i, r);
    return {
      success: !0,
      data: {
        stats: i,
        steam: r,
        risk: d
      }
    };
  }
  async handleGetCacheStats() {
    return { success: !0, data: await L.getStats() };
  }
  async handleClearCache() {
    return await L.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const ee = new pe();
chrome.runtime.onInstalled.addListener(async (w) => {
  console.log("[f-insight:Background] Extension installed/updated:", w.reason), await ee.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), await ee.init();
});
chrome.runtime.onMessage.addListener((w, e, a) => (ee.init().then(() => ee.handleMessage(w, e)).then(a), !0));
chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (w) => {
  w.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await L.cleanup());
});
