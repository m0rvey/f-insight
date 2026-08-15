var ie = Object.defineProperty;
var ce = (g, e, a) => e in g ? ie(g, e, { enumerable: !0, configurable: !0, writable: !0, value: a }) : g[e] = a;
var te = (g, e, a) => ce(g, typeof e != "symbol" ? e + "" : e, a);
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
  playReadySound: !0,
  // Tactical Analytics defaults
  showFcrRating: !0,
  showFormIndicators: !0
}, J = {
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
    te(this, "memoryCache", /* @__PURE__ */ new Map());
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
      } catch (n) {
        console.warn(`[f-insight:Cache] Failed to read ${e} from storage`, n);
      }
    return null;
  }
  async set(e, a, t) {
    const n = {
      value: a,
      cachedAt: Date.now(),
      ttlMs: t
    };
    if (this.memoryCache.set(e, n), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [e]: n });
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
        for (const [n, o] of Object.entries(a)) {
          if (n === "settings") continue;
          const r = o;
          r && r.cachedAt && r.ttlMs && e - r.cachedAt >= r.ttlMs && t.push(n);
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
function he(g, e) {
  const a = e - g, t = 1 / (1 + Math.pow(10, a / 400)), n = 1 - t, o = 50, r = Math.max(1, Math.min(49, Math.round(o * (1 - t)))), c = Math.max(1, Math.min(49, Math.round(o * t))), w = Math.max(1, Math.min(49, Math.round(o * (1 - n)))), h = Math.max(1, Math.min(49, Math.round(o * n)));
  return {
    faction1: {
      winGain: r,
      lossLoss: c
    },
    faction2: {
      winGain: w,
      lossLoss: h
    }
  };
}
function ne(g) {
  const e = {};
  if (g.length === 0) return e;
  const a = g.map((n) => {
    const o = Math.max(500, n.elo || 1e3) / 1e3, r = Math.max(0.4, n.overallKd || 1), c = 1 + ((n.overallAdr || 75) - 75) / 150, w = o * r * Math.max(0.6, c);
    return { id: n.playerId, power: w };
  }), t = a.reduce((n, o) => n + o.power, 0);
  for (const n of a) {
    const o = t > 0 ? n.power / t * 100 : 100 / g.length;
    e[n.id] = parseFloat(o.toFixed(1));
  }
  return e;
}
function de(g, e, a) {
  if (!g || g.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: e || 1,
      recentAdr: a || 75
    };
  const t = g.slice(0, 5), n = t.reduce((s, l) => s + (l.kills || 0), 0), o = t.reduce((s, l) => s + (l.deaths || 0), 0), r = o > 0 ? parseFloat((n / o).toFixed(2)) : parseFloat(n.toFixed(2)), c = t.map((s) => s.adr).filter((s) => s !== void 0 && s > 0), w = c.length > 0 ? Math.round(c.reduce((s, l) => s + l, 0) / c.length) : a || 75, h = Math.max(0.5, e || 1), p = r / h;
  let f = "STABLE";
  return p >= 1.15 || r >= 1.4 && t.filter((s) => s.result === "W").length >= 4 ? f = "HOT" : (p <= 0.82 || r <= 0.75 && t.filter((s) => s.result === "L").length >= 4) && (f = "COLD"), {
    formStatus: f,
    recentKd: r,
    recentAdr: w
  };
}
function me(g) {
  const {
    f1AvgElo: e,
    f2AvgElo: a,
    f1Players: t,
    f2Players: n,
    selectedMap: o,
    premadeGroups: r,
    riskAnalysis: c,
    f1Fcr: w,
    f2Fcr: h
  } = g, p = a - e, f = 1 / (1 + Math.pow(10, p / 400));
  let s = 0, l;
  const S = (o || "").replace("de_", "").toLowerCase();
  if (S) {
    const v = t.reduce((j, Y) => j + (Y.mapStats?.[S]?.wins || 0), 0), R = t.reduce((j, Y) => j + (Y.mapStats?.[S]?.matches || 0), 0), T = R > 0 ? Math.round(v / R * 100) : 50, I = n.reduce((j, Y) => j + (Y.mapStats?.[S]?.wins || 0), 0), V = n.reduce((j, Y) => j + (Y.mapStats?.[S]?.matches || 0), 0), ee = V > 0 ? Math.round(I / V * 100) : 50, U = T - ee;
    s = Math.max(-0.12, Math.min(0.12, U / 100 * 0.25)), l = {
      leader: U >= 5 ? "faction1" : U <= -5 ? "faction2" : "balanced",
      mapName: S,
      f1WinRate: T,
      f2WinRate: ee,
      deltaWinRate: Math.abs(U)
    };
  }
  const A = t.filter((v) => v.formStatus === "HOT").length, u = t.filter((v) => v.formStatus === "COLD").length, C = n.filter((v) => v.formStatus === "HOT").length, x = n.filter((v) => v.formStatus === "COLD").length, B = A - u, K = C - x, N = Math.max(-0.1, Math.min(0.1, (B - K) * 0.03)), $ = new Set(t.map((v) => v.playerId)), q = new Set(n.map((v) => v.playerId));
  let F = 1, P = 1;
  for (const v of r) {
    const R = v.playerIds.filter((I) => $.has(I)).length, T = v.playerIds.filter((I) => q.has(I)).length;
    R > F && (F = R), T > P && (P = T);
  }
  const W = Math.max(-0.08, Math.min(0.08, (F - P) * 0.02)), z = f + s + N + W, D = Math.max(0.06, Math.min(0.94, z)), k = Math.round(D * 100), X = 100 - k;
  let O = 13, d = 9, m = !1;
  const _ = Math.abs(k - 50);
  _ <= 3 ? (O = k >= 50 ? 13 : 11, d = k >= 50 ? 11 : 13, m = !0) : _ <= 8 ? (O = k >= 50 ? 13 : 10, d = k >= 50 ? 10 : 13) : _ <= 16 ? (O = k >= 50 ? 13 : 8, d = k >= 50 ? 8 : 13) : _ <= 26 ? (O = k >= 50 ? 13 : 5, d = k >= 50 ? 5 : 13) : (O = k >= 50 ? 13 : 3, d = k >= 50 ? 3 : 13);
  const M = [];
  Math.abs(e - a) >= 60 && M.push(
    e > a ? `Team 1 holds +${Math.round(e - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - e)} avg Elo edge`
  ), l && l.deltaWinRate >= 8 && M.push(
    l.leader === "faction1" ? `Team 1 dominates ${l.mapName} (+${l.deltaWinRate}% WR)` : `Team 2 dominates ${l.mapName} (+${l.deltaWinRate}% WR)`
  ), A > C && A >= 2 ? M.push(`Team 1 on hot momentum (${A} players On Fire)`) : C > A && C >= 2 && M.push(`Team 2 on hot momentum (${C} players On Fire)`), F >= 3 && F > P ? M.push(`Team 1 has ${F}-stack coordination`) : P >= 3 && P > F && M.push(`Team 2 has ${P}-stack coordination`);
  const b = M.length > 0 ? M.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", E = (v, R) => {
    let T = v[0], I = -1;
    for (const V of v) {
      const U = (R[V.playerId] || 20) * 1.5 + (V.overallKd || 1) * 10;
      U > I && (I = U, T = V);
    }
    return T ? {
      nickname: T.nickname,
      fcr: R[T.playerId] || 20,
      kd: T.overallKd || 1,
      elo: T.elo || 1e3
    } : void 0;
  }, H = E(t, w), i = E(n, h), y = t.filter((v) => {
    const R = c[v.playerId]?.level;
    return R === "HIGH" || R === "CRITICAL";
  }).length, G = n.filter((v) => {
    const R = c[v.playerId]?.level;
    return R === "HIGH" || R === "CRITICAL";
  }).length;
  return {
    winChanceF1: k,
    winChanceF2: X,
    predictedScore: {
      f1Score: O,
      f2Score: d,
      isOvertimeLikely: m
    },
    keyAdvantageText: b,
    factors: {
      eloDelta: Math.round(e - a),
      mapAdvantage: l,
      momentumAdvantage: {
        leader: B > K ? "faction1" : K > B ? "faction2" : "balanced",
        f1HotCount: A,
        f2HotCount: C,
        f1ColdCount: u,
        f2ColdCount: x
      },
      premadeAdvantage: {
        leader: F > P ? "faction1" : P > F ? "faction2" : "balanced",
        f1MaxPartySize: F,
        f2MaxPartySize: P
      },
      smurfRiskDelta: {
        f1HighRiskCount: y,
        f2HighRiskCount: G
      }
    },
    starMatchup: H && i ? { f1Star: H, f2Star: i } : void 0
  };
}
const fe = {
  // Russian & CIS Server Locations
  moscow: "Russia (Moscow)",
  russia: "Russia (Moscow)",
  mow: "Russia (Moscow)",
  spb: "Russia (Saint Petersburg)",
  saint_petersburg: "Russia (Saint Petersburg)",
  petersburg: "Russia (Saint Petersburg)",
  led: "Russia (Saint Petersburg)",
  ekaterinburg: "Russia (Yekaterinburg)",
  yekaterinburg: "Russia (Yekaterinburg)",
  svx: "Russia (Yekaterinburg)",
  novosibirsk: "Russia (Novosibirsk)",
  ovb: "Russia (Novosibirsk)",
  khabarovsk: "Russia (Khabarovsk)",
  khv: "Russia (Khabarovsk)",
  vladivostok: "Russia (Vladivostok)",
  vvo: "Russia (Vladivostok)",
  kazakhstan: "Kazakhstan (Almaty)",
  almaty: "Kazakhstan (Almaty)",
  ala: "Kazakhstan (Almaty)",
  astana: "Kazakhstan (Astana)",
  tse: "Kazakhstan (Astana)",
  minsk: "Belarus (Minsk)",
  belarus: "Belarus (Minsk)",
  msq: "Belarus (Minsk)",
  kyiv: "Ukraine (Kyiv)",
  kiev: "Ukraine (Kyiv)",
  ukraine: "Ukraine (Kyiv)",
  iev: "Ukraine (Kyiv)",
  // European Server Locations
  germany: "Germany (Frankfurt)",
  frankfurt: "Germany (Frankfurt)",
  finland: "Finland (Helsinki)",
  helsinki: "Finland (Helsinki)",
  sweden: "Sweden (Stockholm)",
  stockholm: "Sweden (Stockholm)",
  netherlands: "Netherlands (Amsterdam)",
  amsterdam: "Netherlands (Amsterdam)",
  uk: "United Kingdom (London)",
  london: "United Kingdom (London)",
  france: "France (Paris)",
  paris: "France (Paris)",
  poland: "Poland (Warsaw)",
  warsaw: "Poland (Warsaw)",
  turkey: "Turkey (Istanbul)",
  istanbul: "Turkey (Istanbul)",
  // Americas & APAC
  dallas: "US (Dallas)",
  chicago: "US (Chicago)",
  denver: "US (Denver)",
  singapore: "Singapore",
  brazil: "Brazil (São Paulo)",
  sao_paulo: "Brazil (São Paulo)"
};
class ue {
  async getMatchDetails(e) {
    try {
      const a = await fetch(`https://api.faceit.com/match/v2/match/${e}`, {
        headers: { Accept: "application/json" }
      });
      if (!a.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${a.status}`), null;
      const t = await a.json(), n = t.payload || t;
      return this.parseMatchPayload(n);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, a), null;
    }
  }
  async getPlayerStats(e, a) {
    try {
      const [t, n, o, r] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=50`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let c = null;
      if (t.status === "fulfilled" && t.value.ok) {
        const f = await t.value.json();
        c = f.payload || f;
      }
      let w = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const f = await n.value.json();
        w = f.payload || f;
      }
      let h = null;
      if (r.status === "fulfilled" && r.value.ok) {
        const f = await r.value.json();
        h = f.payload || f;
      }
      let p = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const f = await o.value.json(), s = f.payload || f;
        p = Array.isArray(s) ? s : s?.items || s?.segments || [];
      }
      return this.parsePlayerPayload(e, a, c, w, h, p);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
  parseMatchPayload(e) {
    const a = e.teams?.faction1 || e.faction1 || {}, t = e.teams?.faction2 || e.faction2 || {}, n = e.voting?.map?.pick || [], o = n.length > 0 ? n[0] : e.voting?.map?.entities?.find((f) => f.status === "pick")?.name, r = e.voting?.location?.pick?.[0] || e.voting?.location?.entities?.find((f) => f.status === "pick")?.name || e.entity_custom_location || e.summary?.server_location || e.summary?.location || e.location || "", c = r ? fe[r.toLowerCase()] || r.charAt(0).toUpperCase() + r.slice(1) : void 0, w = e.configured_server_ip || e.server_ip, h = w && /^[a-zA-Z0-9.\-]+:\d+$/.test(w) ? w : void 0, p = (f) => (f || []).map((s) => ({
      player_id: s.id || s.player_id,
      nickname: s.nickname || "Player",
      avatar: s.avatar || "",
      game_player_id: s.game_player_id || s.gameId || s.steam_id_64,
      game_player_name: s.game_player_name || s.gameName,
      game_skill_level: s.skill_level || s.game_skill_level || 1,
      elo: s.elo || 1e3,
      membership: s.membership,
      party_id: s.party_id || s.partyId
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
          roster: p(a.roster)
        },
        faction2: {
          faction_id: t.id || t.faction_id || "faction2",
          name: t.name || "Team 2",
          avatar: t.avatar,
          leader: t.leader,
          roster: p(t.roster)
        }
      },
      voting: e.voting,
      selected_map: o,
      server_location: c,
      server_ip: h
    };
  }
  parsePlayerPayload(e, a, t, n, o, r) {
    const c = t?.games?.cs2 || t?.games?.csgo || {}, w = c.faceit_elo || 1e3, h = c.skill_level || 1, p = c.game_player_id || t?.steam_id_64, f = t?.nickname || a || "Player", s = t?.avatar || "", l = t?.country || "", S = Array.isArray(n) ? null : n, A = Array.isArray(o) ? null : o, u = S?.lifetime || A?.lifetime || {}, C = parseInt(u.m1 || u.Matches || "0", 10), x = parseFloat(u.k6 || u["Win Rate %"] || "0"), B = parseFloat(u.k5 || u["Average K/D Ratio"] || "1.0"), K = parseFloat(u.k8 || u["Average Headshots %"] || "0"), N = parseFloat(u.c3 || u.adr || "78.5"), $ = {}, q = [
      ...Array.isArray(n) ? n : n?.segments || n?.items || [],
      ...Array.isArray(o) ? o : o?.segments || o?.items || []
    ];
    for (const d of q) {
      const _ = (d._id?.segmentId || d._id?.label || d.label || d.segmentId || d.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
      if (_) {
        const M = parseInt(d.m1 || d.stats?.Matches || d.matches || "0", 10), b = parseFloat(d.k6 || d.stats?.["Win Rate %"] || d.winRate || "0"), E = parseFloat(d.k5 || d.stats?.["Average K/D Ratio"] || d.kd || "1.0"), H = parseFloat(d.k8 || d.stats?.["Average Headshots %"] || d.hsPercent || "0"), i = parseFloat(d.k1 || d.stats?.["Average Kills"] || d.avgKills || "0"), y = parseFloat(d.c3 || d.stats?.ADR || d.adr || "78.0"), G = parseInt(d.m2 || d.stats?.Wins || d.wins || Math.round(M * b / 100).toString(), 10);
        (!$[_] || M > $[_].matches) && ($[_] = {
          mapName: _,
          matches: M,
          winRate: b,
          kd: E,
          hsPercent: H,
          avgKills: i,
          avgAdr: y,
          wins: G,
          losses: Math.max(0, M - G)
        });
      }
    }
    const F = [];
    let P = 0, W = "NONE", z = !0;
    const D = {};
    if (Array.isArray(r))
      for (let d = 0; d < r.length; d++) {
        const m = r[d], _ = m.i10 === "1" || m.result === "1" || m.stats?.Result === "1" || m.stats?.Win === "1", M = _ ? "W" : "L";
        d === 0 ? (W = M, P = 1) : z && (M === W ? P++ : z = !1);
        const b = (m.i1 || m.stats?.Map || m.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), E = parseInt(m.i6 || m.stats?.Kills || m.kills || "0", 10), H = parseInt(m.i8 || m.stats?.Deaths || m.deaths || "0", 10), i = parseFloat(m.c3 || m.stats?.ADR || m.adr || "78.0");
        b && (D[b] || (D[b] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 }), D[b].matches++, _ && D[b].wins++, D[b].kills += E, D[b].deaths += H, D[b].adrSum += i), F.push({
          matchId: m.matchId || m.i0 || `match-${d}`,
          playedAt: m.date || m.created_at || 0,
          map: b,
          result: M,
          score: m.i18 || m.stats?.Score || "13:0",
          kills: E,
          deaths: H,
          kd: parseFloat(m.c2 || m.stats?.["K/D Ratio"] || (H > 0 ? (E / H).toFixed(2) : E.toFixed(2))),
          hsPercent: parseFloat(m.c4 || m.stats?.["Headshots %"] || "0"),
          adr: i
        });
      }
    for (const [d, m] of Object.entries(D))
      if (!$[d] || $[d].matches === 0) {
        const _ = m.matches, M = m.wins, b = _ > 0 ? Math.round(M / _ * 100) : 50, E = m.deaths > 0 ? parseFloat((m.kills / m.deaths).toFixed(2)) : 1, H = _ > 0 ? Math.round(m.adrSum / _) : 75;
        $[d] = {
          mapName: d,
          matches: _,
          winRate: b,
          kd: E,
          hsPercent: K,
          avgKills: _ > 0 ? parseFloat((m.kills / _).toFixed(1)) : 15,
          avgAdr: H,
          wins: M,
          losses: _ - M
        };
      }
    const { formStatus: k, recentKd: X, recentAdr: O } = de(F, B, N);
    return {
      playerId: e,
      nickname: f,
      avatar: s,
      country: l,
      steamId64: p,
      elo: w,
      skillLevel: h,
      totalMatches: C,
      overallWinRate: x,
      overallKd: B,
      overallHsPercent: K,
      overallAdr: N,
      currentStreak: {
        type: W,
        count: P
      },
      recentMatches: F,
      mapStats: $,
      registrationDate: t?.created_at,
      formStatus: k,
      recentKd: X,
      recentAdr: O
    };
  }
}
const ae = new ue();
class ge {
  async getPlayerFullData(e) {
    if (!e)
      return { isPrivate: !0, fetchedAt: Date.now() };
    try {
      const a = await fetch(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (a.ok) {
        const t = await a.text(), n = t.includes("<privacyState>private</privacyState>") || !t.includes("<privacyState>public</privacyState>"), o = t.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), r = t.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), c = t.match(/<vacBanned>(.*?)<\/vacBanned>/), w = {
          steamId64: e,
          personaName: o ? o[1] : "Steam User",
          profileUrl: `https://steamcommunity.com/profiles/${e}`,
          avatar: r ? r[1] : "",
          communityVisibilityState: n ? 1 : 3
        };
        let h = 0, p = 0;
        const f = t.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
        if (f) {
          const A = f[1].split("</mostPlayedGame>");
          for (const u of A)
            if (u.includes("Counter-Strike 2") || u.includes("Counter-Strike: Global Offensive")) {
              const C = u.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
              C && (h = parseFloat(C[1].replace(/,/g, "")));
              const x = u.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
              x && (p = parseFloat(x[1].replace(/,/g, "")), h === 0 && (h = p));
              break;
            }
        }
        const s = t.match(/<memberSince>(.*?)<\/memberSince>/);
        if (s) {
          const A = new Date(s[1]);
          if (!isNaN(A.getTime())) {
            const u = Date.now() - A.getTime();
            w.accountAgeYears = u / (1e3 * 60 * 60 * 24 * 365.25);
          }
        }
        const l = {
          cs2HoursTotal: h,
          cs2HoursLast2Weeks: p
        }, S = {
          steamId64: e,
          communityBanned: !1,
          vacBanned: c ? c[1] === "1" : !1,
          numberOfVACBans: c && c[1] === "1" ? 1 : 0,
          daysSinceLastBan: 0,
          numberOfGameBans: 0,
          economyBan: "none"
        };
        return {
          summary: w,
          playtime: l,
          bans: S,
          isPrivate: n,
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
const oe = new ge();
function re(g, e) {
  const a = [];
  let t = 0;
  const n = g.totalMatches || 0, o = g.elo || 1e3, r = g.overallKd || 1, c = g.overallWinRate || 50;
  o >= 2e3 && n < 150 ? (t += 35, a.push({
    id: "lvl10_low_matches",
    title: "High Elo with Very Few Matches",
    description: `Level 10 (${o} Elo) in only ${n} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : o >= 1600 && n < 80 ? (t += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${o} Elo achieved in only ${n} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : n < 30 && (t += 15, a.push({
    id: "fresh_faceit_account",
    title: "Brand New FACEIT Account",
    description: `Only ${n} total matches on record`,
    weight: 15,
    severity: "info",
    category: "MATCHES_ELO"
  })), r >= 1.8 ? (t += 25, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio",
    description: `Overall K/D of ${r.toFixed(2)} is significantly above normal distribution`,
    weight: 25,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : r >= 1.45 && (t += 12, a.push({
    id: "high_kd",
    title: "High K/D Ratio",
    description: `Overall K/D of ${r.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })), c >= 70 && n >= 15 ? (t += 20, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate",
    description: `Lifetime win rate of ${c.toFixed(0)}% across ${n} matches`,
    weight: 20,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : c >= 62 && n >= 20 && (t += 10, a.push({
    id: "high_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${c.toFixed(0)}%`,
    weight: 10,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  }));
  let w = !0;
  if (e && !e.isPrivate && e.summary) {
    w = !1;
    const l = e.playtime?.cs2HoursTotal ?? 0;
    l > 0 && l < 200 && o >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo",
      description: `Only ${l} hours in CS2 with ${o} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : l > 0 && l < 400 && o >= 2e3 && (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${l} hours on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    }));
    const S = e.summary.accountAgeYears;
    if (S !== void 0 && S < 1 && o >= 1400 && (t += 20, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account",
      description: `Steam profile created less than 1 year ago (${S.toFixed(1)} yrs)`,
      weight: 20,
      severity: "warning",
      category: "STEAM_AGE"
    })), e.bans?.vacBanned || e.bans?.numberOfGameBans) {
      const A = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), u = 25;
      t += u, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${A} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
        weight: u,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else
    w = !0, a.push({
      id: "private_steam",
      title: "Private Steam Profile",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
  const h = Math.min(Math.max(t, 0), 100);
  let p = "LOW", f = "#10B981", s = "Legit";
  return h >= 75 ? (p = "CRITICAL", f = "#DC2626", s = "High Risk") : h >= 50 ? (p = "HIGH", f = "#EF4444", s = "Likely Smurf") : h >= 25 && (p = "MEDIUM", f = "#F59E0B", s = "Suspicious"), {
    score: h,
    level: p,
    flags: a,
    isPrivateSteam: w,
    summary: `${h}% Risk (${p})`,
    color: f,
    badgeText: s
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
function pe(g, e) {
  const a = [];
  let t = 0;
  const n = [g.teams.faction1, g.teams.faction2];
  for (const o of n) {
    if (!o || !o.roster) continue;
    const r = /* @__PURE__ */ new Map();
    for (const s of o.roster)
      if (s.party_id) {
        const l = r.get(s.party_id) || [];
        l.push(s.player_id), r.set(s.party_id, l);
      }
    const c = /* @__PURE__ */ new Set();
    for (const [, s] of r.entries())
      if (s.length >= 2) {
        const l = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${l} (${s.length})`,
          color: Z[t % Z.length],
          playerIds: s
        }), t++, s.forEach((S) => c.add(S));
      }
    const w = o.roster.map((s) => s.player_id).filter((s) => !c.has(s)), h = /* @__PURE__ */ new Map();
    for (const s of w) {
      const l = e[s];
      l?.recentMatches && h.set(s, new Set(l.recentMatches.map((S) => S.matchId)));
    }
    const p = /* @__PURE__ */ new Set(), f = (s, l) => {
      const S = h.get(s), A = h.get(l);
      if (!S || !A) return !1;
      let u = 0;
      for (const C of S)
        if (A.has(C) && u++, u >= 2) return !0;
      return !1;
    };
    for (const s of w) {
      if (p.has(s)) continue;
      const l = [], S = [s];
      for (p.add(s); S.length > 0; ) {
        const A = S.shift();
        l.push(A);
        for (const u of w)
          !p.has(u) && f(A, u) && (p.add(u), S.push(u));
      }
      if (l.length >= 2) {
        l.forEach((u) => c.add(u));
        const A = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${A} (${l.length})`,
          color: Z[t % Z.length],
          playerIds: l
        }), t++;
      }
    }
  }
  return a;
}
class ye {
  constructor() {
    te(this, "settings", { ...se });
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
    return this.settings = { ...this.settings, ...e }, await L.set("settings", this.settings, J.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: n } = e, o = `match_analysis:${t}`;
    if (!n) {
      const c = await L.get(o);
      if (c && !c.isPartial)
        return { success: !0, data: c };
    }
    const r = await ae.getMatchDetails(t);
    return r ? (this.streamLobbyData(t, r, n, a).catch((c) => console.error("[f-insight:Stream] Error:", c)), { success: !0, data: { match: r, isPartial: !0 } }) : { success: !1, error: `Could not fetch match details for ${t}` };
  }
  async streamLobbyData(e, a, t, n) {
    const o = `match_analysis:${e}`, r = a.teams?.faction1?.roster || [], c = a.teams?.faction2?.roster || [], w = [...r, ...c], h = {}, p = {}, f = {};
    await Promise.all(
      w.map(async (i) => {
        const y = i.player_id;
        if (!y) return;
        const G = `player_stats:${y}`;
        let v = null;
        if (t || (v = await L.get(G)), v || (v = await ae.getPlayerStats(y, i.nickname), v && await L.set(G, v, J.PLAYER_STATS)), v) {
          h[y] = v;
          const R = v.steamId64 || i.game_player_id;
          if (R) {
            const T = `steam_data:${R}`;
            let I = null;
            t || (I = await L.get(T)), I || (I = await oe.getPlayerFullData(R), await L.set(T, I, J.STEAM_PROFILE)), I && (p[y] = I);
          }
          f[y] = re(v, p[y]), n?.tab?.id && chrome.tabs.sendMessage(n.tab.id, {
            type: "PLAYER_STATS_UPDATE",
            payload: { playerId: y, stats: v, steam: p[y], risk: f[y] }
          });
        }
      })
    );
    const s = r.map((i) => h[i.player_id]?.elo || i.elo || 1e3), l = c.map((i) => h[i.player_id]?.elo || i.elo || 1e3), S = s.reduce((i, y) => i + y, 0), A = l.reduce((i, y) => i + y, 0), u = s.length > 0 ? Math.round(S / s.length) : 1e3, C = l.length > 0 ? Math.round(A / l.length) : 1e3, x = u - C, B = he(u, C), K = r.map((i) => h[i.player_id]?.overallKd || 1), N = c.map((i) => h[i.player_id]?.overallKd || 1), $ = K.length > 0 ? parseFloat((K.reduce((i, y) => i + y, 0) / K.length).toFixed(2)) : 1, q = N.length > 0 ? parseFloat((N.reduce((i, y) => i + y, 0) / N.length).toFixed(2)) : 1, F = r.map((i) => h[i.player_id]?.overallHsPercent || 0), P = c.map((i) => h[i.player_id]?.overallHsPercent || 0), W = F.length > 0 ? Math.round(F.reduce((i, y) => i + y, 0) / F.length) : 0, z = P.length > 0 ? Math.round(P.reduce((i, y) => i + y, 0) / P.length) : 0, D = r.map((i) => h[i.player_id]?.overallAdr || 75), k = c.map((i) => h[i.player_id]?.overallAdr || 75), X = D.length > 0 ? Math.round(D.reduce((i, y) => i + y, 0) / D.length) : 75, O = k.length > 0 ? Math.round(k.reduce((i, y) => i + y, 0) / k.length) : 75, d = r.map((i) => h[i.player_id]).filter(Boolean), m = c.map((i) => h[i.player_id]).filter(Boolean), _ = ne(d), M = ne(m);
    for (const [i, y] of Object.entries(_))
      h[i] && (h[i].fcrContributionPercent = y);
    for (const [i, y] of Object.entries(M))
      h[i] && (h[i].fcrContributionPercent = y);
    const b = pe(a, h), E = me({
      f1AvgElo: u,
      f2AvgElo: C,
      f1Players: d,
      f2Players: m,
      selectedMap: a.selected_map,
      premadeGroups: b,
      riskAnalysis: f,
      f1Fcr: _,
      f2Fcr: M
    }), H = {
      match: a,
      playersStats: h,
      steamData: p,
      riskAnalysis: f,
      premadeGroups: b,
      teamSummary: {
        faction1: {
          totalElo: S,
          avgElo: u,
          winChancePercent: E.winChanceF1,
          avgKd: $,
          avgHsPercent: W,
          avgAdr: X,
          projectedElo: B.faction1
        },
        faction2: {
          totalElo: A,
          avgElo: C,
          winChancePercent: E.winChanceF2,
          avgKd: q,
          avgHsPercent: z,
          avgAdr: O,
          projectedElo: B.faction2
        },
        eloDifference: Math.abs(x)
      },
      prediction: E,
      isPartial: !1
    };
    await L.set(o, H, J.MATCH), n?.tab?.id && chrome.tabs.sendMessage(n.tab.id, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: H
    });
  }
  async handleFetchPlayerInsight(e) {
    const { playerId: a, steamId64: t, forceRefresh: n } = e, o = `player_stats:${a}`;
    let r = n ? null : await L.get(o);
    if (r || (r = await ae.getPlayerStats(a), r && await L.set(o, r, J.PLAYER_STATS)), !r)
      return { success: !1, error: "Player stats not found" };
    let c;
    const w = t || r.steamId64;
    if (w) {
      const p = `steam_data:${w}`;
      c = n ? void 0 : await L.get(p) || void 0, c || (c = await oe.getPlayerFullData(w), await L.set(p, c, J.STEAM_PROFILE));
    }
    const h = re(r, c);
    return {
      success: !0,
      data: {
        stats: r,
        steam: c,
        risk: h
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
const Q = new ye();
chrome.runtime.onInstalled.addListener(async (g) => {
  console.log("[f-insight:Background] Extension installed/updated:", g.reason), await Q.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), await Q.init();
});
chrome.runtime.onMessage.addListener((g, e, a) => (Q.init().then(() => Q.handleMessage(g, e)).then(a), !0));
chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (g) => {
  g.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await L.cleanup());
});
