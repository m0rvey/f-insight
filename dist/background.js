var it = Object.defineProperty;
var ct = (g, t, a) => t in g ? it(g, t, { enumerable: !0, configurable: !0, writable: !0, value: a }) : g[t] = a;
var tt = (g, t, a) => ct(g, typeof t != "symbol" ? t + "" : t, a);
const st = {
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
  SETTINGS: 1 / 0
};
class lt {
  constructor() {
    tt(this, "memoryCache", /* @__PURE__ */ new Map());
  }
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  async get(t) {
    const a = Date.now(), e = this.memoryCache.get(t);
    if (e) {
      if (a - e.cachedAt < e.ttlMs)
        return e.value;
      this.memoryCache.delete(t);
    }
    if (this.isChromeStorageAvailable())
      try {
        const n = (await chrome.storage.local.get([t]))[t];
        if (n && n.cachedAt && n.ttlMs) {
          if (a - n.cachedAt < n.ttlMs)
            return this.memoryCache.set(t, n), n.value;
          await chrome.storage.local.remove([t]);
        }
      } catch (s) {
        console.warn(`[f-insight:Cache] Failed to read ${t} from storage`, s);
      }
    return null;
  }
  async set(t, a, e) {
    const s = {
      value: a,
      cachedAt: Date.now(),
      ttlMs: e
    };
    if (this.memoryCache.set(t, s), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [t]: s });
      } catch (n) {
        console.warn(`[f-insight:Cache] Failed to save ${t} to storage`, n);
      }
  }
  async remove(t) {
    if (this.memoryCache.delete(t), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.remove([t]);
      } catch (a) {
        console.warn(`[f-insight:Cache] Failed to remove ${t}`, a);
      }
  }
  async clear() {
    if (this.memoryCache.clear(), this.isChromeStorageAvailable())
      try {
        const t = await chrome.storage.local.get(null), a = Object.keys(t).filter((e) => e !== "settings");
        a.length > 0 && await chrome.storage.local.remove(a);
      } catch (t) {
        console.warn("[f-insight:Cache] Failed to clear storage", t);
      }
  }
  async getStats() {
    if (this.isChromeStorageAvailable())
      try {
        const t = await chrome.storage.local.get(null), a = Object.keys(t), e = await chrome.storage.local.getBytesInUse(null);
        return {
          totalEntries: a.length,
          bytesInUse: e,
          keys: a
        };
      } catch (t) {
        console.warn("[f-insight:Cache] Failed to get stats", t);
      }
    return {
      totalEntries: this.memoryCache.size,
      bytesInUse: 0,
      keys: Array.from(this.memoryCache.keys())
    };
  }
}
const L = new lt();
function dt(g, t) {
  const a = t - g, e = 1 / (1 + Math.pow(10, a / 400)), s = 1 - e, n = 50, d = Math.max(1, Math.min(49, Math.round(n * (1 - e)))), c = Math.max(1, Math.min(49, Math.round(n * e))), u = Math.max(1, Math.min(49, Math.round(n * (1 - s)))), p = Math.max(1, Math.min(49, Math.round(n * s)));
  return {
    faction1: {
      winGain: d,
      lossLoss: c
    },
    faction2: {
      winGain: u,
      lossLoss: p
    }
  };
}
function nt(g) {
  const t = {};
  if (g.length === 0) return t;
  const a = g.map((s) => {
    const n = Math.max(500, s.elo || 1e3) / 1e3, d = Math.max(0.4, s.overallKd || 1), c = 1 + ((s.overallAdr || 75) - 75) / 150, u = n * d * Math.max(0.6, c);
    return { id: s.playerId, power: u };
  }), e = a.reduce((s, n) => s + n.power, 0);
  for (const s of a) {
    const n = e > 0 ? s.power / e * 100 : 100 / g.length;
    t[s.id] = parseFloat(n.toFixed(1));
  }
  return t;
}
function ht(g, t, a) {
  if (!g || g.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: t || 1,
      recentAdr: a || 75
    };
  const e = g.slice(0, 5), s = e.reduce((l, o) => l + (o.kills || 0), 0), n = e.reduce((l, o) => l + (o.deaths || 0), 0), d = n > 0 ? parseFloat((s / n).toFixed(2)) : parseFloat(s.toFixed(2)), c = e.map((l) => l.adr).filter((l) => l !== void 0 && l > 0), u = c.length > 0 ? Math.round(c.reduce((l, o) => l + o, 0) / c.length) : a || 75, p = Math.max(0.5, t || 1), f = d / p;
  let r = "STABLE";
  return f >= 1.15 || d >= 1.4 && e.filter((l) => l.result === "W").length >= 4 ? r = "HOT" : (f <= 0.82 || d <= 0.75 && e.filter((l) => l.result === "L").length >= 4) && (r = "COLD"), {
    formStatus: r,
    recentKd: d,
    recentAdr: u
  };
}
function mt(g) {
  const {
    f1AvgElo: t,
    f2AvgElo: a,
    f1Players: e,
    f2Players: s,
    selectedMap: n,
    premadeGroups: d,
    riskAnalysis: c,
    f1Fcr: u,
    f2Fcr: p
  } = g, f = a - t, r = 1 / (1 + Math.pow(10, f / 400));
  let l = 0, o;
  const y = (n || "").replace("de_", "").toLowerCase();
  if (y) {
    const A = e.reduce((Y, V) => Y + (V.mapStats?.[y]?.wins || 0), 0), S = e.reduce((Y, V) => Y + (V.mapStats?.[y]?.matches || 0), 0), E = S > 0 ? Math.round(A / S * 100) : 50, D = s.reduce((Y, V) => Y + (V.mapStats?.[y]?.wins || 0), 0), K = s.reduce((Y, V) => Y + (V.mapStats?.[y]?.matches || 0), 0), X = K > 0 ? Math.round(D / K * 100) : 50, z = E - X;
    l = Math.max(-0.12, Math.min(0.12, z / 100 * 0.25)), o = {
      leader: z >= 5 ? "faction1" : z <= -5 ? "faction2" : "balanced",
      mapName: y,
      f1WinRate: E,
      f2WinRate: X,
      deltaWinRate: Math.abs(z)
    };
  }
  const _ = e.filter((A) => A.formStatus === "HOT").length, $ = e.filter((A) => A.formStatus === "COLD").length, P = s.filter((A) => A.formStatus === "HOT").length, x = s.filter((A) => A.formStatus === "COLD").length, B = _ - $, T = P - x, U = Math.max(-0.1, Math.min(0.1, (B - T) * 0.03)), W = new Set(e.map((A) => A.playerId)), j = new Set(s.map((A) => A.playerId));
  let b = 1, R = 1;
  for (const A of d) {
    const S = A.playerIds.filter((D) => W.has(D)).length, E = A.playerIds.filter((D) => j.has(D)).length;
    S > b && (b = S), E > R && (R = E);
  }
  const I = Math.max(-0.08, Math.min(0.08, (b - R) * 0.02)), q = r + l + U + I, Z = Math.max(0.06, Math.min(0.94, q)), F = Math.round(Z * 100), m = 100 - F;
  let h = 13, w = 9, C = !1;
  const M = Math.abs(F - 50);
  M <= 3 ? (h = F >= 50 ? 13 : 11, w = F >= 50 ? 11 : 13, C = !0) : M <= 8 ? (h = F >= 50 ? 13 : 10, w = F >= 50 ? 10 : 13) : M <= 16 ? (h = F >= 50 ? 13 : 8, w = F >= 50 ? 8 : 13) : M <= 26 ? (h = F >= 50 ? 13 : 5, w = F >= 50 ? 5 : 13) : (h = F >= 50 ? 13 : 3, w = F >= 50 ? 3 : 13);
  const k = [];
  Math.abs(t - a) >= 60 && k.push(
    t > a ? `Team 1 holds +${Math.round(t - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - t)} avg Elo edge`
  ), o && o.deltaWinRate >= 8 && k.push(
    o.leader === "faction1" ? `Team 1 dominates ${o.mapName} (+${o.deltaWinRate}% WR)` : `Team 2 dominates ${o.mapName} (+${o.deltaWinRate}% WR)`
  ), _ > P && _ >= 2 ? k.push(`Team 1 on hot momentum (${_} players On Fire)`) : P > _ && P >= 2 && k.push(`Team 2 on hot momentum (${P} players On Fire)`), b >= 3 && b > R ? k.push(`Team 1 has ${b}-stack coordination`) : R >= 3 && R > b && k.push(`Team 2 has ${R}-stack coordination`);
  const H = k.length > 0 ? k.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", O = (A, S) => {
    let E = A[0], D = -1;
    for (const K of A) {
      const z = (S[K.playerId] || 20) * 1.5 + (K.overallKd || 1) * 10;
      z > D && (D = z, E = K);
    }
    return E ? {
      nickname: E.nickname,
      fcr: S[E.playerId] || 20,
      kd: E.overallKd || 1,
      elo: E.elo || 1e3
    } : void 0;
  }, N = O(e, u), G = O(s, p), i = e.filter((A) => {
    const S = c[A.playerId]?.level;
    return S === "HIGH" || S === "CRITICAL";
  }).length, v = s.filter((A) => {
    const S = c[A.playerId]?.level;
    return S === "HIGH" || S === "CRITICAL";
  }).length;
  return {
    winChanceF1: F,
    winChanceF2: m,
    predictedScore: {
      f1Score: h,
      f2Score: w,
      isOvertimeLikely: C
    },
    keyAdvantageText: H,
    factors: {
      eloDelta: Math.round(t - a),
      mapAdvantage: o,
      momentumAdvantage: {
        leader: B > T ? "faction1" : T > B ? "faction2" : "balanced",
        f1HotCount: _,
        f2HotCount: P,
        f1ColdCount: $,
        f2ColdCount: x
      },
      premadeAdvantage: {
        leader: b > R ? "faction1" : R > b ? "faction2" : "balanced",
        f1MaxPartySize: b,
        f2MaxPartySize: R
      },
      smurfRiskDelta: {
        f1HighRiskCount: i,
        f2HighRiskCount: v
      }
    },
    starMatchup: N && G ? { f1Star: N, f2Star: G } : void 0
  };
}
class ft {
  async getMatchDetails(t) {
    try {
      const a = await fetch(`https://api.faceit.com/match/v2/match/${t}`, {
        headers: { Accept: "application/json" }
      });
      if (!a.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${t} returned HTTP ${a.status}`), null;
      const e = await a.json(), s = e.payload || e;
      return this.parseMatchPayload(s);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${t}:`, a), null;
    }
  }
  async getPlayerStats(t, a) {
    try {
      const [e, s, n, d] = await Promise.allSettled([
        fetch(`https://api.faceit.com/users/v1/users/${t}`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${t}/games/cs2`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/time/users/${t}/games/cs2?size=30`, { headers: { Accept: "application/json" } }),
        fetch(`https://api.faceit.com/stats/v1/stats/users/${t}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let c = null;
      if (e.status === "fulfilled" && e.value.ok) {
        const r = await e.value.json();
        c = r.payload || r;
      }
      let u = null;
      if (s.status === "fulfilled" && s.value.ok) {
        const r = await s.value.json();
        u = r.payload || r;
      }
      let p = null;
      if (d.status === "fulfilled" && d.value.ok) {
        const r = await d.value.json();
        p = r.payload || r;
      }
      let f = [];
      if (n.status === "fulfilled" && n.value.ok) {
        const r = await n.value.json();
        f = r.payload || r || [];
      }
      return this.parsePlayerPayload(t, a, c, u, p, f);
    } catch (e) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${t}:`, e), null;
    }
  }
  parseMatchPayload(t) {
    const a = t.teams?.faction1 || t.faction1 || {}, e = t.teams?.faction2 || t.faction2 || {}, s = t.voting?.map?.pick || [], n = s.length > 0 ? s[0] : t.voting?.map?.entities?.find((l) => l.status === "pick")?.name, d = t.voting?.location?.pick?.[0] || t.voting?.location?.entities?.find((l) => l.status === "pick")?.name || t.location || "", u = d ? {
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
    }[d.toLowerCase()] || d : void 0, p = t.configured_server_ip || t.server_ip, f = p && /^[a-zA-Z0-9.\-]+:\d+$/.test(p) ? p : void 0, r = (l) => (l || []).map((o) => ({
      player_id: o.id || o.player_id,
      nickname: o.nickname || "Player",
      avatar: o.avatar || "",
      game_player_id: o.game_player_id || o.gameId || o.steam_id_64,
      game_player_name: o.game_player_name || o.gameName,
      game_skill_level: o.skill_level || o.game_skill_level || 1,
      elo: o.elo || 1e3,
      membership: o.membership,
      party_id: o.party_id || o.partyId
    }));
    return {
      match_id: t.id || t.match_id,
      game: t.game || "cs2",
      region: t.region || "EU",
      status: t.status?.toUpperCase() || "VOTING",
      configured_at: t.configured_at,
      started_at: t.started_at,
      finished_at: t.finished_at,
      teams: {
        faction1: {
          faction_id: a.id || a.faction_id || "faction1",
          name: a.name || "Team 1",
          avatar: a.avatar,
          leader: a.leader,
          roster: r(a.roster)
        },
        faction2: {
          faction_id: e.id || e.faction_id || "faction2",
          name: e.name || "Team 2",
          avatar: e.avatar,
          leader: e.leader,
          roster: r(e.roster)
        }
      },
      voting: t.voting,
      selected_map: n,
      server_location: u,
      server_ip: f
    };
  }
  parsePlayerPayload(t, a, e, s, n, d) {
    const c = e?.games?.cs2 || e?.games?.csgo || {}, u = c.faceit_elo || 1e3, p = c.skill_level || 1, f = c.game_player_id || e?.steam_id_64, r = e?.nickname || a || "Player", l = e?.avatar || "", o = e?.country || "", y = s?.lifetime || n?.lifetime || {}, _ = parseInt(y.m1 || y.Matches || "0", 10), $ = parseFloat(y.k6 || y["Win Rate %"] || "0"), P = parseFloat(y.k5 || y["Average K/D Ratio"] || "1.0"), x = parseFloat(y.k8 || y["Average Headshots %"] || "0"), B = parseFloat(y.c3 || y.adr || "78.5"), T = {}, U = [
      ...Array.isArray(s) ? s : s?.segments || s?.items || [],
      ...Array.isArray(n) ? n : n?.segments || n?.items || []
    ];
    for (const m of U) {
      const w = (m._id?.segmentId || m._id?.label || m.label || m.segmentId || m.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
      if (w) {
        const C = parseInt(m.m1 || m.stats?.Matches || m.matches || "0", 10), M = parseFloat(m.k6 || m.stats?.["Win Rate %"] || m.winRate || "0"), k = parseFloat(m.k5 || m.stats?.["Average K/D Ratio"] || m.kd || "1.0"), H = parseFloat(m.k8 || m.stats?.["Average Headshots %"] || m.hsPercent || "0"), O = parseFloat(m.k1 || m.stats?.["Average Kills"] || m.avgKills || "0"), N = parseFloat(m.c3 || m.stats?.ADR || m.adr || "78.0"), G = parseInt(m.m2 || m.stats?.Wins || m.wins || Math.round(C * M / 100).toString(), 10);
        (!T[w] || C > T[w].matches) && (T[w] = {
          mapName: w,
          matches: C,
          winRate: M,
          kd: k,
          hsPercent: H,
          avgKills: O,
          avgAdr: N,
          wins: G,
          losses: Math.max(0, C - G)
        });
      }
    }
    const W = [];
    let j = 0, b = "NONE", R = !0;
    const I = {};
    if (Array.isArray(d))
      for (let m = 0; m < d.length; m++) {
        const h = d[m], w = h.i10 === "1" || h.result === "1" || h.stats?.Result === "1" || h.stats?.Win === "1", C = w ? "W" : "L";
        m === 0 ? (b = C, j = 1) : R && (C === b ? j++ : R = !1);
        const M = (h.i1 || h.stats?.Map || h.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), k = parseInt(h.i6 || h.stats?.Kills || h.kills || "0", 10), H = parseInt(h.i8 || h.stats?.Deaths || h.deaths || "0", 10), O = parseFloat(h.c3 || h.stats?.ADR || h.adr || "78.0");
        M && (I[M] || (I[M] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0 }), I[M].matches++, w && I[M].wins++, I[M].kills += k, I[M].deaths += H, I[M].adrSum += O), W.push({
          matchId: h.matchId || h.i0 || `match-${m}`,
          playedAt: h.date || h.created_at || 0,
          map: M,
          result: C,
          score: h.i18 || h.stats?.Score || "13:0",
          kills: k,
          deaths: H,
          kd: parseFloat(h.c2 || h.stats?.["K/D Ratio"] || (H > 0 ? (k / H).toFixed(2) : k.toFixed(2))),
          hsPercent: parseFloat(h.c4 || h.stats?.["Headshots %"] || "0"),
          adr: O
        });
      }
    for (const [m, h] of Object.entries(I))
      if (!T[m] || T[m].matches === 0) {
        const w = h.matches, C = h.wins, M = w > 0 ? Math.round(C / w * 100) : 50, k = h.deaths > 0 ? parseFloat((h.kills / h.deaths).toFixed(2)) : 1, H = w > 0 ? Math.round(h.adrSum / w) : 75;
        T[m] = {
          mapName: m,
          matches: w,
          winRate: M,
          kd: k,
          hsPercent: x,
          avgKills: w > 0 ? parseFloat((h.kills / w).toFixed(1)) : 15,
          avgAdr: H,
          wins: C,
          losses: w - C
        };
      }
    const { formStatus: q, recentKd: Z, recentAdr: F } = ht(W, P, B);
    return {
      playerId: t,
      nickname: r,
      avatar: l,
      country: o,
      steamId64: f,
      elo: u,
      skillLevel: p,
      totalMatches: _,
      overallWinRate: $,
      overallKd: P,
      overallHsPercent: x,
      overallAdr: B,
      currentStreak: {
        type: b,
        count: j
      },
      recentMatches: W,
      mapStats: T,
      registrationDate: e?.created_at,
      formStatus: q,
      recentKd: Z,
      recentAdr: F
    };
  }
}
const et = new ft();
class ut {
  async getPlayerFullData(t) {
    if (!t)
      return { isPrivate: !0, fetchedAt: Date.now() };
    try {
      const a = await fetch(`https://steamcommunity.com/profiles/${t}/?xml=1`);
      if (a.ok) {
        const e = await a.text(), s = e.includes("<privacyState>private</privacyState>") || !e.includes("<privacyState>public</privacyState>"), n = e.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), d = e.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), c = e.match(/<vacBanned>(.*?)<\/vacBanned>/), u = {
          steamId64: t,
          personaName: n ? n[1] : "Steam User",
          profileUrl: `https://steamcommunity.com/profiles/${t}`,
          avatar: d ? d[1] : "",
          communityVisibilityState: s ? 1 : 3
        }, p = {
          steamId64: t,
          communityBanned: !1,
          vacBanned: c ? c[1] === "1" : !1,
          numberOfVACBans: c && c[1] === "1" ? 1 : 0,
          daysSinceLastBan: 0,
          numberOfGameBans: 0,
          economyBan: "none"
        };
        return {
          summary: u,
          bans: p,
          isPrivate: s,
          fetchedAt: Date.now()
        };
      }
    } catch {
    }
    return {
      isPrivate: !0,
      summary: {
        steamId64: t,
        personaName: "Steam User",
        profileUrl: `https://steamcommunity.com/profiles/${t}`,
        avatar: "",
        communityVisibilityState: 1
      },
      fetchedAt: Date.now()
    };
  }
}
const ot = new ut();
function rt(g, t) {
  const a = [];
  let e = 0;
  const s = g.totalMatches || 0, n = g.elo || 1e3, d = g.overallKd || 1, c = g.overallWinRate || 50;
  n >= 2e3 && s < 150 ? (e += 35, a.push({
    id: "lvl10_low_matches",
    title: "High Elo with Very Few Matches",
    description: `Level 10 (${n} Elo) in only ${s} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 1600 && s < 80 ? (e += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${n} Elo achieved in only ${s} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : s < 30 && (e += 15, a.push({
    id: "fresh_faceit_account",
    title: "Brand New FACEIT Account",
    description: `Only ${s} total matches on record`,
    weight: 15,
    severity: "info",
    category: "MATCHES_ELO"
  })), d >= 1.8 ? (e += 25, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio",
    description: `Overall K/D of ${d.toFixed(2)} is significantly above normal distribution`,
    weight: 25,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : d >= 1.45 && (e += 12, a.push({
    id: "high_kd",
    title: "High K/D Ratio",
    description: `Overall K/D of ${d.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })), c >= 70 && s >= 15 ? (e += 20, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate",
    description: `Lifetime win rate of ${c.toFixed(0)}% across ${s} matches`,
    weight: 20,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : c >= 62 && s >= 20 && (e += 10, a.push({
    id: "high_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${c.toFixed(0)}%`,
    weight: 10,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  }));
  let u = !0;
  if (t && !t.isPrivate && t.summary) {
    u = !1;
    const o = t.playtime?.cs2HoursTotal ?? 0;
    o > 0 && o < 200 && n >= 1600 ? (e += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo",
      description: `Only ${o} hours in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : o > 0 && o < 400 && n >= 2e3 && (e += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${o} hours on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    }));
    const y = t.summary.accountAgeYears;
    if (y !== void 0 && y < 1 && n >= 1400 && (e += 20, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account",
      description: `Steam profile created less than 1 year ago (${y.toFixed(1)} yrs)`,
      weight: 20,
      severity: "warning",
      category: "STEAM_AGE"
    })), t.bans?.numberOfVACBans || t.bans?.numberOfGameBans) {
      const _ = (t.bans.numberOfVACBans || 0) + (t.bans.numberOfGameBans || 0), $ = 25;
      e += $, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${_} ban(s) on record (${t.bans.daysSinceLastBan || 0} days ago)`,
        weight: $,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else
    u = !0, a.push({
      id: "private_steam",
      title: "Private Steam Profile",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
  const p = Math.min(Math.max(e, 0), 100);
  let f = "LOW", r = "#10B981", l = "Legit";
  return p >= 75 ? (f = "CRITICAL", r = "#DC2626", l = "High Risk") : p >= 50 ? (f = "HIGH", r = "#EF4444", l = "Likely Smurf") : p >= 25 && (f = "MEDIUM", r = "#F59E0B", l = "Suspicious"), {
    score: p,
    level: f,
    flags: a,
    isPrivateSteam: u,
    summary: `${p}% Risk (${f})`,
    color: r,
    badgeText: l
  };
}
const Q = [
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
function gt(g, t) {
  const a = [];
  let e = 0;
  const s = [g.teams.faction1, g.teams.faction2];
  for (const n of s) {
    if (!n || !n.roster) continue;
    const d = /* @__PURE__ */ new Map();
    for (const r of n.roster)
      if (r.party_id) {
        const l = d.get(r.party_id) || [];
        l.push(r.player_id), d.set(r.party_id, l);
      }
    const c = /* @__PURE__ */ new Set();
    for (const [, r] of d.entries())
      if (r.length >= 2) {
        const l = String.fromCharCode(65 + e % 26);
        a.push({
          id: `party-${e}`,
          tag: `Party ${l} (${r.length})`,
          color: Q[e % Q.length],
          playerIds: r
        }), e++, r.forEach((o) => c.add(o));
      }
    const u = n.roster.map((r) => r.player_id).filter((r) => !c.has(r)), p = /* @__PURE__ */ new Map();
    for (const r of u) {
      const l = t[r];
      l?.recentMatches && p.set(r, new Set(l.recentMatches.map((o) => o.matchId)));
    }
    const f = /* @__PURE__ */ new Set();
    for (const r of u) {
      if (f.has(r)) continue;
      const l = [r], o = p.get(r);
      if (!(!o || o.size === 0)) {
        for (const y of u) {
          if (r === y || f.has(y)) continue;
          const _ = p.get(y);
          if (!_ || _.size === 0) continue;
          let $ = 0;
          for (const P of o)
            _.has(P) && $++;
          $ >= 2 && l.push(y);
        }
        if (l.length >= 2) {
          l.forEach((_) => {
            f.add(_), c.add(_);
          });
          const y = String.fromCharCode(65 + e % 26);
          a.push({
            id: `party-${e}`,
            tag: `Party ${y} (${l.length})`,
            color: Q[e % Q.length],
            playerIds: l
          }), e++;
        }
      }
    }
  }
  return a;
}
class pt {
  constructor() {
    tt(this, "settings", { ...st });
  }
  async init() {
    await this.loadSettings();
  }
  async loadSettings() {
    const t = await L.get("settings");
    return t && (this.settings = { ...st, ...t }), this.settings;
  }
  async handleMessage(t, a) {
    try {
      switch (t.type) {
        case "GET_SETTINGS":
          return { success: !0, data: await this.loadSettings() };
        case "SAVE_SETTINGS":
          return this.settings = { ...this.settings, ...t.payload }, await L.set("settings", this.settings, J.SETTINGS), { success: !0, data: this.settings };
        case "FETCH_LOBBY_INSIGHT": {
          const { matchId: e, forceRefresh: s } = t.payload, n = `match_analysis:${e}`;
          if (!s) {
            const i = await L.get(n);
            if (i)
              return { success: !0, data: i };
          }
          const d = await et.getMatchDetails(e);
          if (!d)
            return { success: !1, error: `Could not fetch match details for ${e}` };
          const c = d.teams?.faction1?.roster || [], u = d.teams?.faction2?.roster || [], p = [...c, ...u], f = {}, r = {}, l = {};
          await Promise.all(
            p.map(async (i) => {
              const v = i.player_id;
              if (!v) return;
              const A = `player_stats:${v}`;
              let S = null;
              if (s || (S = await L.get(A)), S || (S = await et.getPlayerStats(v, i.nickname), S && await L.set(A, S, J.PLAYER_STATS)), S) {
                f[v] = S;
                const E = S.steamId64 || i.game_player_id;
                if (E) {
                  const D = `steam_data:${E}`;
                  let K = null;
                  s || (K = await L.get(D)), K || (K = await ot.getPlayerFullData(E), await L.set(D, K, J.STEAM_PROFILE)), K && (r[v] = K);
                }
                l[v] = rt(S, r[v]);
              }
            })
          );
          const o = c.map((i) => f[i.player_id]?.elo || i.elo || 1e3), y = u.map((i) => f[i.player_id]?.elo || i.elo || 1e3), _ = o.reduce((i, v) => i + v, 0), $ = y.reduce((i, v) => i + v, 0), P = o.length > 0 ? Math.round(_ / o.length) : 1e3, x = y.length > 0 ? Math.round($ / y.length) : 1e3, B = P - x, T = dt(P, x), U = c.map((i) => f[i.player_id]?.overallKd || 1), W = u.map((i) => f[i.player_id]?.overallKd || 1), j = U.length > 0 ? parseFloat((U.reduce((i, v) => i + v, 0) / U.length).toFixed(2)) : 1, b = W.length > 0 ? parseFloat((W.reduce((i, v) => i + v, 0) / W.length).toFixed(2)) : 1, R = c.map((i) => f[i.player_id]?.overallHsPercent || 0), I = u.map((i) => f[i.player_id]?.overallHsPercent || 0), q = R.length > 0 ? Math.round(R.reduce((i, v) => i + v, 0) / R.length) : 0, Z = I.length > 0 ? Math.round(I.reduce((i, v) => i + v, 0) / I.length) : 0, F = c.map((i) => f[i.player_id]?.overallAdr || 75), m = u.map((i) => f[i.player_id]?.overallAdr || 75), h = F.length > 0 ? Math.round(F.reduce((i, v) => i + v, 0) / F.length) : 75, w = m.length > 0 ? Math.round(m.reduce((i, v) => i + v, 0) / m.length) : 75, C = c.map((i) => f[i.player_id]).filter(Boolean), M = u.map((i) => f[i.player_id]).filter(Boolean), k = nt(C), H = nt(M);
          for (const [i, v] of Object.entries(k))
            f[i] && (f[i].fcrContributionPercent = v);
          for (const [i, v] of Object.entries(H))
            f[i] && (f[i].fcrContributionPercent = v);
          const O = gt(d, f), N = mt({
            f1AvgElo: P,
            f2AvgElo: x,
            f1Players: C,
            f2Players: M,
            selectedMap: d.selected_map,
            premadeGroups: O,
            riskAnalysis: l,
            f1Fcr: k,
            f2Fcr: H
          }), G = {
            match: d,
            playersStats: f,
            steamData: r,
            riskAnalysis: l,
            premadeGroups: O,
            teamSummary: {
              faction1: {
                totalElo: _,
                avgElo: P,
                winChancePercent: N.winChanceF1,
                avgKd: j,
                avgHsPercent: q,
                avgAdr: h,
                projectedElo: T.faction1
              },
              faction2: {
                totalElo: $,
                avgElo: x,
                winChancePercent: N.winChanceF2,
                avgKd: b,
                avgHsPercent: Z,
                avgAdr: w,
                projectedElo: T.faction2
              },
              eloDifference: Math.abs(B)
            },
            prediction: N
          };
          return await L.set(n, G, J.MATCH), { success: !0, data: G };
        }
        case "FETCH_PLAYER_INSIGHT": {
          const { playerId: e, steamId64: s, forceRefresh: n } = t.payload, d = `player_stats:${e}`;
          let c = n ? null : await L.get(d);
          if (c || (c = await et.getPlayerStats(e), c && await L.set(d, c, J.PLAYER_STATS)), !c)
            return { success: !1, error: "Player stats not found" };
          let u;
          const p = s || c.steamId64;
          if (p) {
            const r = `steam_data:${p}`;
            u = n ? void 0 : await L.get(r) || void 0, u || (u = await ot.getPlayerFullData(p), await L.set(r, u, J.STEAM_PROFILE));
          }
          const f = rt(c, u);
          return {
            success: !0,
            data: {
              stats: c,
              steam: u,
              risk: f
            }
          };
        }
        case "GET_CACHE_STATS":
          return { success: !0, data: await L.getStats() };
        case "CLEAR_CACHE":
          return await L.clear(), { success: !0, data: { cleared: !0 } };
        default:
          return { success: !1, error: "Unknown message type" };
      }
    } catch (e) {
      return console.error("[f-insight:Background] Message handler error:", e), { success: !1, error: e.message || "Internal error" };
    }
  }
}
const at = new pt();
chrome.runtime.onInstalled.addListener(async (g) => {
  console.log("[f-insight:Background] Extension installed/updated:", g.reason), await at.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), await at.init();
});
chrome.runtime.onMessage.addListener((g, t, a) => (at.handleMessage(g, t).then(a), !0));
chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (g) => {
  g.name === "cache_cleanup" && console.log("[f-insight:Background] Running scheduled cache cleanup...");
});
