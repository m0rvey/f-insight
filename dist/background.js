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
  PLAYER_STATS: 900 * 1e3,
  // 15 minutes
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
          const i = o;
          i && i.cachedAt && i.ttlMs && e - i.cachedAt >= i.ttlMs && t.push(n);
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
  const a = e - g, t = 1 / (1 + Math.pow(10, a / 400)), n = 1 - t, o = 50, i = Math.max(1, Math.min(49, Math.round(o * (1 - t)))), l = Math.max(1, Math.min(49, Math.round(o * t))), y = Math.max(1, Math.min(49, Math.round(o * (1 - n)))), h = Math.max(1, Math.min(49, Math.round(o * n)));
  return {
    faction1: {
      winGain: i,
      lossLoss: l
    },
    faction2: {
      winGain: y,
      lossLoss: h
    }
  };
}
function ne(g) {
  const e = {};
  if (g.length === 0) return e;
  const a = g.map((n) => {
    const o = Math.max(500, n.elo || 1e3) / 1e3, i = Math.max(0.4, n.overallKd || 1), l = 1 + ((n.overallAdr || 75) - 75) / 150, y = o * i * Math.max(0.6, l);
    return { id: n.playerId, power: y };
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
  const t = g.slice(0, 5), n = t.reduce((s, c) => s + (c.kills || 0), 0), o = t.reduce((s, c) => s + (c.deaths || 0), 0), i = o > 0 ? parseFloat((n / o).toFixed(2)) : parseFloat(n.toFixed(2)), l = t.map((s) => s.adr).filter((s) => s !== void 0 && s > 0), y = l.length > 0 ? Math.round(l.reduce((s, c) => s + c, 0) / l.length) : a || 75, h = Math.max(0.5, e || 1), p = i / h;
  let f = "STABLE";
  return p >= 1.15 || i >= 1.4 && t.filter((s) => s.result === "W").length >= 4 ? f = "HOT" : (p <= 0.82 || i <= 0.75 && t.filter((s) => s.result === "L").length >= 4) && (f = "COLD"), {
    formStatus: f,
    recentKd: i,
    recentAdr: y
  };
}
function me(g) {
  const {
    f1AvgElo: e,
    f2AvgElo: a,
    f1Players: t,
    f2Players: n,
    selectedMap: o,
    premadeGroups: i,
    riskAnalysis: l,
    f1Fcr: y,
    f2Fcr: h
  } = g, p = a - e, f = 1 / (1 + Math.pow(10, p / 400));
  let s = 0, c;
  const S = (o || "").replace("de_", "").toLowerCase();
  if (S) {
    const v = t.reduce((U, Y) => U + (Y.mapStats?.[S]?.wins || 0), 0), R = t.reduce((U, Y) => U + (Y.mapStats?.[S]?.matches || 0), 0), T = R > 0 ? Math.round(v / R * 100) : 50, I = n.reduce((U, Y) => U + (Y.mapStats?.[S]?.wins || 0), 0), V = n.reduce((U, Y) => U + (Y.mapStats?.[S]?.matches || 0), 0), ee = V > 0 ? Math.round(I / V * 100) : 50, j = T - ee;
    s = Math.max(-0.12, Math.min(0.12, j / 100 * 0.25)), c = {
      leader: j >= 5 ? "faction1" : j <= -5 ? "faction2" : "balanced",
      mapName: S,
      f1WinRate: T,
      f2WinRate: ee,
      deltaWinRate: Math.abs(j)
    };
  }
  const A = t.filter((v) => v.formStatus === "HOT").length, u = t.filter((v) => v.formStatus === "COLD").length, C = n.filter((v) => v.formStatus === "HOT").length, x = n.filter((v) => v.formStatus === "COLD").length, W = A - u, K = C - x, N = Math.max(-0.1, Math.min(0.1, (W - K) * 0.03)), D = new Set(t.map((v) => v.playerId)), q = new Set(n.map((v) => v.playerId));
  let b = 1, P = 1;
  for (const v of i) {
    const R = v.playerIds.filter((I) => D.has(I)).length, T = v.playerIds.filter((I) => q.has(I)).length;
    R > b && (b = R), T > P && (P = T);
  }
  const B = Math.max(-0.08, Math.min(0.08, (b - P) * 0.02)), z = f + s + N + B, H = Math.max(0.06, Math.min(0.94, z)), k = Math.round(H * 100), X = 100 - k;
  let O = 13, d = 9, m = !1;
  const _ = Math.abs(k - 50);
  _ <= 3 ? (O = k >= 50 ? 13 : 11, d = k >= 50 ? 11 : 13, m = !0) : _ <= 8 ? (O = k >= 50 ? 13 : 10, d = k >= 50 ? 10 : 13) : _ <= 16 ? (O = k >= 50 ? 13 : 8, d = k >= 50 ? 8 : 13) : _ <= 26 ? (O = k >= 50 ? 13 : 5, d = k >= 50 ? 5 : 13) : (O = k >= 50 ? 13 : 3, d = k >= 50 ? 3 : 13);
  const M = [];
  Math.abs(e - a) >= 60 && M.push(
    e > a ? `Team 1 holds +${Math.round(e - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - e)} avg Elo edge`
  ), c && c.deltaWinRate >= 8 && M.push(
    c.leader === "faction1" ? `Team 1 dominates ${c.mapName} (+${c.deltaWinRate}% WR)` : `Team 2 dominates ${c.mapName} (+${c.deltaWinRate}% WR)`
  ), A > C && A >= 2 ? M.push(`Team 1 on hot momentum (${A} players On Fire)`) : C > A && C >= 2 && M.push(`Team 2 on hot momentum (${C} players On Fire)`), b >= 3 && b > P ? M.push(`Team 1 has ${b}-stack coordination`) : P >= 3 && P > b && M.push(`Team 2 has ${P}-stack coordination`);
  const F = M.length > 0 ? M.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", E = (v, R) => {
    let T = v[0], I = -1;
    for (const V of v) {
      const j = (R[V.playerId] || 20) * 1.5 + (V.overallKd || 1) * 10;
      j > I && (I = j, T = V);
    }
    return T ? {
      nickname: T.nickname,
      fcr: R[T.playerId] || 20,
      kd: T.overallKd || 1,
      elo: T.elo || 1e3
    } : void 0;
  }, $ = E(t, y), r = E(n, h), w = t.filter((v) => {
    const R = l[v.playerId]?.level;
    return R === "HIGH" || R === "CRITICAL";
  }).length, G = n.filter((v) => {
    const R = l[v.playerId]?.level;
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
    keyAdvantageText: F,
    factors: {
      eloDelta: Math.round(e - a),
      mapAdvantage: c,
      momentumAdvantage: {
        leader: W > K ? "faction1" : K > W ? "faction2" : "balanced",
        f1HotCount: A,
        f2HotCount: C,
        f1ColdCount: u,
        f2ColdCount: x
      },
      premadeAdvantage: {
        leader: b > P ? "faction1" : P > b ? "faction2" : "balanced",
        f1MaxPartySize: b,
        f2MaxPartySize: P
      },
      smurfRiskDelta: {
        f1HighRiskCount: w,
        f2HighRiskCount: G
      }
    },
    starMatchup: $ && r ? { f1Star: $, f2Star: r } : void 0
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
      const [t, n, o, i] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=50`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let l = null;
      if (t.status === "fulfilled" && t.value.ok) {
        const f = await t.value.json();
        l = f.payload || f;
      }
      let y = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const f = await n.value.json();
        y = f.payload || f;
      }
      let h = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const f = await i.value.json();
        h = f.payload || f;
      }
      let p = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const f = await o.value.json(), s = f.payload || f;
        p = Array.isArray(s) ? s : s?.items || s?.segments || [];
      }
      return this.parsePlayerPayload(e, a, l, y, h, p);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
  parseMatchPayload(e) {
    const a = e.teams?.faction1 || e.faction1 || {}, t = e.teams?.faction2 || e.faction2 || {}, n = e.voting?.map?.pick || [], o = n.length > 0 ? n[0] : e.voting?.map?.entities?.find((f) => f.status === "pick")?.name, i = e.voting?.location?.pick?.[0] || e.voting?.location?.entities?.find((f) => f.status === "pick")?.name || e.location || "", l = i ? fe[i.toLowerCase()] || i : void 0, y = e.configured_server_ip || e.server_ip, h = y && /^[a-zA-Z0-9.\-]+:\d+$/.test(y) ? y : void 0, p = (f) => (f || []).map((s) => ({
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
      server_location: l,
      server_ip: h
    };
  }
  parsePlayerPayload(e, a, t, n, o, i) {
    const l = t?.games?.cs2 || t?.games?.csgo || {}, y = l.faceit_elo || 1e3, h = l.skill_level || 1, p = l.game_player_id || t?.steam_id_64, f = t?.nickname || a || "Player", s = t?.avatar || "", c = t?.country || "", S = Array.isArray(n) ? null : n, A = Array.isArray(o) ? null : o, u = S?.lifetime || A?.lifetime || {}, C = parseInt(u.m1 || u.Matches || "0", 10), x = parseFloat(u.k6 || u["Win Rate %"] || "0"), W = parseFloat(u.k5 || u["Average K/D Ratio"] || "1.0"), K = parseFloat(u.k8 || u["Average Headshots %"] || "0"), N = parseFloat(u.c3 || u.adr || "78.5"), D = {}, q = [
      ...Array.isArray(n) ? n : n?.segments || n?.items || [],
      ...Array.isArray(o) ? o : o?.segments || o?.items || []
    ];
    for (const d of q) {
      const _ = (d._id?.segmentId || d._id?.label || d.label || d.segmentId || d.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
      if (_) {
        const M = parseInt(d.m1 || d.stats?.Matches || d.matches || "0", 10), F = parseFloat(d.k6 || d.stats?.["Win Rate %"] || d.winRate || "0"), E = parseFloat(d.k5 || d.stats?.["Average K/D Ratio"] || d.kd || "1.0"), $ = parseFloat(d.k8 || d.stats?.["Average Headshots %"] || d.hsPercent || "0"), r = parseFloat(d.k1 || d.stats?.["Average Kills"] || d.avgKills || "0"), w = parseFloat(d.c3 || d.stats?.ADR || d.adr || "78.0"), G = parseInt(d.m2 || d.stats?.Wins || d.wins || Math.round(M * F / 100).toString(), 10);
        (!D[_] || M > D[_].matches) && (D[_] = {
          mapName: _,
          matches: M,
          winRate: F,
          kd: E,
          hsPercent: $,
          avgKills: r,
          avgAdr: w,
          wins: G,
          losses: Math.max(0, M - G)
        });
      }
    }
    const b = [];
    let P = 0, B = "NONE", z = !0;
    const H = {};
    if (Array.isArray(i))
      for (let d = 0; d < i.length; d++) {
        const m = i[d], _ = m.i10 === "1" || m.result === "1" || m.stats?.Result === "1" || m.stats?.Win === "1", M = _ ? "W" : "L";
        d === 0 ? (B = M, P = 1) : z && (M === B ? P++ : z = !1);
        const F = (m.i1 || m.stats?.Map || m.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), E = parseInt(m.i6 || m.stats?.Kills || m.kills || "0", 10), $ = parseInt(m.i8 || m.stats?.Deaths || m.deaths || "0", 10), r = parseFloat(m.c3 || m.stats?.ADR || m.adr || "78.0");
        F && (H[F] || (H[F] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 }), H[F].matches++, _ && H[F].wins++, H[F].kills += E, H[F].deaths += $, H[F].adrSum += r), b.push({
          matchId: m.matchId || m.i0 || `match-${d}`,
          playedAt: m.date || m.created_at || 0,
          map: F,
          result: M,
          score: m.i18 || m.stats?.Score || "13:0",
          kills: E,
          deaths: $,
          kd: parseFloat(m.c2 || m.stats?.["K/D Ratio"] || ($ > 0 ? (E / $).toFixed(2) : E.toFixed(2))),
          hsPercent: parseFloat(m.c4 || m.stats?.["Headshots %"] || "0"),
          adr: r
        });
      }
    for (const [d, m] of Object.entries(H))
      if (!D[d] || D[d].matches === 0) {
        const _ = m.matches, M = m.wins, F = _ > 0 ? Math.round(M / _ * 100) : 50, E = m.deaths > 0 ? parseFloat((m.kills / m.deaths).toFixed(2)) : 1, $ = _ > 0 ? Math.round(m.adrSum / _) : 75;
        D[d] = {
          mapName: d,
          matches: _,
          winRate: F,
          kd: E,
          hsPercent: K,
          avgKills: _ > 0 ? parseFloat((m.kills / _).toFixed(1)) : 15,
          avgAdr: $,
          wins: M,
          losses: _ - M
        };
      }
    const { formStatus: k, recentKd: X, recentAdr: O } = de(b, W, N);
    return {
      playerId: e,
      nickname: f,
      avatar: s,
      country: c,
      steamId64: p,
      elo: y,
      skillLevel: h,
      totalMatches: C,
      overallWinRate: x,
      overallKd: W,
      overallHsPercent: K,
      overallAdr: N,
      currentStreak: {
        type: B,
        count: P
      },
      recentMatches: b,
      mapStats: D,
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
        const t = await a.text(), n = t.includes("<privacyState>private</privacyState>") || !t.includes("<privacyState>public</privacyState>"), o = t.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = t.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), l = t.match(/<vacBanned>(.*?)<\/vacBanned>/), y = {
          steamId64: e,
          personaName: o ? o[1] : "Steam User",
          profileUrl: `https://steamcommunity.com/profiles/${e}`,
          avatar: i ? i[1] : "",
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
            y.accountAgeYears = u / (1e3 * 60 * 60 * 24 * 365.25);
          }
        }
        const c = {
          cs2HoursTotal: h,
          cs2HoursLast2Weeks: p
        }, S = {
          steamId64: e,
          communityBanned: !1,
          vacBanned: l ? l[1] === "1" : !1,
          numberOfVACBans: l && l[1] === "1" ? 1 : 0,
          daysSinceLastBan: 0,
          numberOfGameBans: 0,
          economyBan: "none"
        };
        return {
          summary: y,
          playtime: c,
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
  const n = g.totalMatches || 0, o = g.elo || 1e3, i = g.overallKd || 1, l = g.overallWinRate || 50;
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
  })), i >= 1.8 ? (t += 25, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio",
    description: `Overall K/D of ${i.toFixed(2)} is significantly above normal distribution`,
    weight: 25,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : i >= 1.45 && (t += 12, a.push({
    id: "high_kd",
    title: "High K/D Ratio",
    description: `Overall K/D of ${i.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })), l >= 70 && n >= 15 ? (t += 20, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate",
    description: `Lifetime win rate of ${l.toFixed(0)}% across ${n} matches`,
    weight: 20,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : l >= 62 && n >= 20 && (t += 10, a.push({
    id: "high_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${l.toFixed(0)}%`,
    weight: 10,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  }));
  let y = !0;
  if (e && !e.isPrivate && e.summary) {
    y = !1;
    const c = e.playtime?.cs2HoursTotal ?? 0;
    c > 0 && c < 200 && o >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo",
      description: `Only ${c} hours in CS2 with ${o} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : c > 0 && c < 400 && o >= 2e3 && (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${c} hours on Level 10 account`,
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
    y = !0, a.push({
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
    isPrivateSteam: y,
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
    const i = /* @__PURE__ */ new Map();
    for (const s of o.roster)
      if (s.party_id) {
        const c = i.get(s.party_id) || [];
        c.push(s.player_id), i.set(s.party_id, c);
      }
    const l = /* @__PURE__ */ new Set();
    for (const [, s] of i.entries())
      if (s.length >= 2) {
        const c = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${c} (${s.length})`,
          color: Z[t % Z.length],
          playerIds: s
        }), t++, s.forEach((S) => l.add(S));
      }
    const y = o.roster.map((s) => s.player_id).filter((s) => !l.has(s)), h = /* @__PURE__ */ new Map();
    for (const s of y) {
      const c = e[s];
      c?.recentMatches && h.set(s, new Set(c.recentMatches.map((S) => S.matchId)));
    }
    const p = /* @__PURE__ */ new Set(), f = (s, c) => {
      const S = h.get(s), A = h.get(c);
      if (!S || !A) return !1;
      let u = 0;
      for (const C of S)
        if (A.has(C) && u++, u >= 2) return !0;
      return !1;
    };
    for (const s of y) {
      if (p.has(s)) continue;
      const c = [], S = [s];
      for (p.add(s); S.length > 0; ) {
        const A = S.shift();
        c.push(A);
        for (const u of y)
          !p.has(u) && f(A, u) && (p.add(u), S.push(u));
      }
      if (c.length >= 2) {
        c.forEach((u) => l.add(u));
        const A = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${A} (${c.length})`,
          color: Z[t % Z.length],
          playerIds: c
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
          return this.handleFetchLobbyInsight(e.payload);
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
  async handleFetchLobbyInsight(e) {
    const { matchId: a, forceRefresh: t } = e, n = `match_analysis:${a}`;
    if (!t) {
      const r = await L.get(n);
      if (r)
        return { success: !0, data: r };
    }
    const o = await ae.getMatchDetails(a);
    if (!o)
      return { success: !1, error: `Could not fetch match details for ${a}` };
    const i = o.teams?.faction1?.roster || [], l = o.teams?.faction2?.roster || [], y = [...i, ...l], h = {}, p = {}, f = {};
    await Promise.all(
      y.map(async (r) => {
        const w = r.player_id;
        if (!w) return;
        const G = `player_stats:${w}`;
        let v = null;
        if (t || (v = await L.get(G)), v || (v = await ae.getPlayerStats(w, r.nickname), v && await L.set(G, v, J.PLAYER_STATS)), v) {
          h[w] = v;
          const R = v.steamId64 || r.game_player_id;
          if (R) {
            const T = `steam_data:${R}`;
            let I = null;
            t || (I = await L.get(T)), I || (I = await oe.getPlayerFullData(R), await L.set(T, I, J.STEAM_PROFILE)), I && (p[w] = I);
          }
          f[w] = re(v, p[w]);
        }
      })
    );
    const s = i.map((r) => h[r.player_id]?.elo || r.elo || 1e3), c = l.map((r) => h[r.player_id]?.elo || r.elo || 1e3), S = s.reduce((r, w) => r + w, 0), A = c.reduce((r, w) => r + w, 0), u = s.length > 0 ? Math.round(S / s.length) : 1e3, C = c.length > 0 ? Math.round(A / c.length) : 1e3, x = u - C, W = he(u, C), K = i.map((r) => h[r.player_id]?.overallKd || 1), N = l.map((r) => h[r.player_id]?.overallKd || 1), D = K.length > 0 ? parseFloat((K.reduce((r, w) => r + w, 0) / K.length).toFixed(2)) : 1, q = N.length > 0 ? parseFloat((N.reduce((r, w) => r + w, 0) / N.length).toFixed(2)) : 1, b = i.map((r) => h[r.player_id]?.overallHsPercent || 0), P = l.map((r) => h[r.player_id]?.overallHsPercent || 0), B = b.length > 0 ? Math.round(b.reduce((r, w) => r + w, 0) / b.length) : 0, z = P.length > 0 ? Math.round(P.reduce((r, w) => r + w, 0) / P.length) : 0, H = i.map((r) => h[r.player_id]?.overallAdr || 75), k = l.map((r) => h[r.player_id]?.overallAdr || 75), X = H.length > 0 ? Math.round(H.reduce((r, w) => r + w, 0) / H.length) : 75, O = k.length > 0 ? Math.round(k.reduce((r, w) => r + w, 0) / k.length) : 75, d = i.map((r) => h[r.player_id]).filter(Boolean), m = l.map((r) => h[r.player_id]).filter(Boolean), _ = ne(d), M = ne(m);
    for (const [r, w] of Object.entries(_))
      h[r] && (h[r].fcrContributionPercent = w);
    for (const [r, w] of Object.entries(M))
      h[r] && (h[r].fcrContributionPercent = w);
    const F = pe(o, h), E = me({
      f1AvgElo: u,
      f2AvgElo: C,
      f1Players: d,
      f2Players: m,
      selectedMap: o.selected_map,
      premadeGroups: F,
      riskAnalysis: f,
      f1Fcr: _,
      f2Fcr: M
    }), $ = {
      match: o,
      playersStats: h,
      steamData: p,
      riskAnalysis: f,
      premadeGroups: F,
      teamSummary: {
        faction1: {
          totalElo: S,
          avgElo: u,
          winChancePercent: E.winChanceF1,
          avgKd: D,
          avgHsPercent: B,
          avgAdr: X,
          projectedElo: W.faction1
        },
        faction2: {
          totalElo: A,
          avgElo: C,
          winChancePercent: E.winChanceF2,
          avgKd: q,
          avgHsPercent: z,
          avgAdr: O,
          projectedElo: W.faction2
        },
        eloDifference: Math.abs(x)
      },
      prediction: E
    };
    return await L.set(n, $, J.MATCH), { success: !0, data: $ };
  }
  async handleFetchPlayerInsight(e) {
    const { playerId: a, steamId64: t, forceRefresh: n } = e, o = `player_stats:${a}`;
    let i = n ? null : await L.get(o);
    if (i || (i = await ae.getPlayerStats(a), i && await L.set(o, i, J.PLAYER_STATS)), !i)
      return { success: !1, error: "Player stats not found" };
    let l;
    const y = t || i.steamId64;
    if (y) {
      const p = `steam_data:${y}`;
      l = n ? void 0 : await L.get(p) || void 0, l || (l = await oe.getPlayerFullData(y), await L.set(p, l, J.STEAM_PROFILE));
    }
    const h = re(i, l);
    return {
      success: !0,
      data: {
        stats: i,
        steam: l,
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
