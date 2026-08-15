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
  // 3 minutes for failed / unreachable queries
  SETTINGS: Number.MAX_SAFE_INTEGER
}, ce = 500;
class fe {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= ce) return;
    const t = this.memoryCache.keys();
    for (; this.memoryCache.size > ce; ) {
      const a = t.next();
      if (a.done) break;
      a.value !== "settings" && this.memoryCache.delete(a.value);
    }
  }
  async get(t) {
    const a = Date.now(), e = this.memoryCache.get(t);
    if (e) {
      if (a - e.cachedAt < e.ttlMs)
        return this.memoryCache.delete(t), this.memoryCache.set(t, e), e.value;
      this.memoryCache.delete(t);
    }
    if (this.isChromeStorageAvailable())
      try {
        const n = (await chrome.storage.local.get([t]))[t];
        if (n && n.cachedAt && n.ttlMs) {
          if (a - n.cachedAt < n.ttlMs)
            return this.memoryCache.set(t, n), this.enforceMemoryLimit(), n.value;
          await chrome.storage.local.remove([t]);
        }
      } catch (i) {
        console.warn(`[f-insight:Cache] Failed to read ${t} from storage`, i);
      }
    return null;
  }
  async set(t, a, e) {
    const i = {
      value: a,
      cachedAt: Date.now(),
      ttlMs: e
    };
    if (this.memoryCache.delete(t), this.memoryCache.set(t, i), this.enforceMemoryLimit(), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [t]: i });
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
  async cleanup() {
    const t = Date.now();
    for (const [a, e] of this.memoryCache.entries())
      t - e.cachedAt >= e.ttlMs && this.memoryCache.delete(a);
    if (this.isChromeStorageAvailable())
      try {
        const a = await chrome.storage.local.get(null), e = [];
        for (const [i, n] of Object.entries(a)) {
          if (i === "settings") continue;
          const c = n;
          c && c.cachedAt && c.ttlMs && t - c.cachedAt >= c.ttlMs && e.push(i);
        }
        e.length > 0 && await chrome.storage.local.remove(e);
      } catch (a) {
        console.warn("[f-insight:Cache] Failed to cleanup storage", a);
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
const x = new fe();
function me(s, t) {
  const a = t - s, e = 1 / (1 + Math.pow(10, a / 400)), i = 1 - e, n = 50, c = Math.max(1, Math.min(49, Math.round(n * (1 - e)))), u = Math.max(1, Math.min(49, Math.round(n * e))), d = Math.max(1, Math.min(49, Math.round(n * (1 - i)))), y = Math.max(1, Math.min(49, Math.round(n * i)));
  return {
    faction1: {
      winGain: c,
      lossLoss: u
    },
    faction2: {
      winGain: d,
      lossLoss: y
    }
  };
}
function le(s) {
  const t = {};
  if (s.length === 0) return t;
  const a = s.map((i) => {
    const n = Math.max(500, i.elo || 1e3) / 1e3, c = Math.max(0.4, i.last30Kd ?? i.overallKd ?? 1), u = 1 + ((i.last30Adr ?? i.overallAdr ?? 75) - 75) / 150, d = n * c * Math.max(0.6, u);
    return { id: i.playerId, power: d };
  }), e = a.reduce((i, n) => i + n.power, 0);
  for (const i of a) {
    const n = e > 0 ? i.power / e * 100 : 100 / s.length;
    t[i.id] = parseFloat(n.toFixed(1));
  }
  return t;
}
function ge(s, t, a) {
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: t || 1,
      recentAdr: a || 75
    };
  const e = s.slice(0, 5), i = e.reduce((g, l) => g + (l.kills || 0), 0), n = e.reduce((g, l) => g + (l.deaths || 0), 0), c = n > 0 ? parseFloat((i / n).toFixed(2)) : parseFloat((t || 1).toFixed(2)), u = e.map((g) => g.adr).filter((g) => g !== void 0 && g > 0), d = u.length > 0 ? Math.round(u.reduce((g, l) => g + l, 0) / u.length) : a || 75, y = Math.max(0.5, t || 1), S = c / y;
  let F = "STABLE";
  return S >= 1.15 || c >= 1.4 && e.filter((g) => g.result === "W").length >= 4 ? F = "HOT" : (S <= 0.82 || c <= 0.75 && e.filter((g) => g.result === "L").length >= 4) && (F = "COLD"), {
    formStatus: F,
    recentKd: c,
    recentAdr: d
  };
}
function ue(s) {
  const {
    f1AvgElo: t,
    f2AvgElo: a,
    f1Players: e,
    f2Players: i,
    selectedMap: n,
    premadeGroups: c,
    riskAnalysis: u,
    f1Fcr: d,
    f2Fcr: y
  } = s, S = a - t, F = 1 / (1 + Math.pow(10, S / 400));
  let g = 0, l;
  const w = (n || "").replace("de_", "").toLowerCase();
  if (w) {
    const p = e.reduce((G, N) => G + (N.mapStats?.[w]?.wins || 0), 0), f = e.reduce((G, N) => G + (N.mapStats?.[w]?.matches || 0), 0), _ = f > 0 ? Math.round(p / f * 100) : 50, I = i.reduce((G, N) => G + (N.mapStats?.[w]?.wins || 0), 0), D = i.reduce((G, N) => G + (N.mapStats?.[w]?.matches || 0), 0), V = D > 0 ? Math.round(I / D * 100) : 50, W = _ - V;
    g = Math.max(-0.12, Math.min(0.12, W / 100 * 0.25)), l = {
      leader: W >= 5 ? "faction1" : W <= -5 ? "faction2" : "balanced",
      mapName: w,
      f1WinRate: _,
      f2WinRate: V,
      deltaWinRate: Math.abs(W)
    };
  }
  const v = e.filter((p) => p.formStatus === "HOT").length, h = e.filter((p) => p.formStatus === "COLD").length, M = i.filter((p) => p.formStatus === "HOT").length, P = i.filter((p) => p.formStatus === "COLD").length, k = v - h, Y = M - P, Q = Math.max(-0.1, Math.min(0.1, (k - Y) * 0.03)), B = new Set(e.map((p) => p.playerId)), z = new Set(i.map((p) => p.playerId));
  let E = 1, L = 1;
  for (const p of c) {
    const f = p.playerIds.filter((I) => B.has(I)).length, _ = p.playerIds.filter((I) => z.has(I)).length;
    f > E && (E = f), _ > L && (L = _);
  }
  const J = Math.max(-0.08, Math.min(0.08, (E - L) * 0.02)), $ = e.filter((p) => {
    const f = u[p.playerId]?.level;
    return f === "HIGH" || f === "CRITICAL";
  }).length, b = i.filter((p) => {
    const f = u[p.playerId]?.level;
    return f === "HIGH" || f === "CRITICAL";
  }).length, H = Math.max(-0.06, Math.min(0.06, ($ - b) * 0.02)), X = F + g + Q + J + H, Z = Math.max(0.06, Math.min(0.94, X)), R = Math.round(Z * 100), q = 100 - R;
  let O = 13, K = 9, U = !1;
  const j = Math.abs(R - 50);
  j <= 3 ? (O = R >= 50 ? 13 : 11, K = R >= 50 ? 11 : 13, U = !0) : j <= 8 ? (O = R >= 50 ? 13 : 10, K = R >= 50 ? 10 : 13) : j <= 16 ? (O = R >= 50 ? 13 : 8, K = R >= 50 ? 8 : 13) : j <= 26 ? (O = R >= 50 ? 13 : 5, K = R >= 50 ? 5 : 13) : (O = R >= 50 ? 13 : 3, K = R >= 50 ? 3 : 13);
  const r = [];
  Math.abs(t - a) >= 60 && r.push(
    t > a ? `Team 1 holds +${Math.round(t - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - t)} avg Elo edge`
  ), l && l.deltaWinRate >= 8 && r.push(
    l.leader === "faction1" ? `Team 1 dominates ${l.mapName} (+${l.deltaWinRate}% WR)` : `Team 2 dominates ${l.mapName} (+${l.deltaWinRate}% WR)`
  ), v > M && v >= 2 ? r.push(`Team 1 on hot momentum (${v} players On Fire)`) : M > v && M >= 2 && r.push(`Team 2 on hot momentum (${M} players On Fire)`), E >= 3 && E > L ? r.push(`Team 1 has ${E}-stack coordination`) : L >= 3 && L > E && r.push(`Team 2 has ${L}-stack coordination`), Math.abs(H) >= 0.04 && $ + b > 0 && ($ > b ? r.push(`Team 1 likely carries flagged accounts (${$} risk flagged)`) : b > $ && r.push(`Team 2 likely carries flagged accounts (${b} risk flagged)`));
  const o = r.length > 0 ? r.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", m = (p, f) => {
    let _ = p[0], I = -1;
    for (const D of p) {
      const W = (f[D.playerId] || 20) * 1.5 + (D.last30Kd ?? D.overallKd ?? 1) * 10;
      W > I && (I = W, _ = D);
    }
    return _ ? {
      nickname: _.nickname,
      fcr: f[_.playerId] || 20,
      kd: _.last30Kd ?? _.overallKd ?? 1,
      elo: _.elo || 1e3
    } : void 0;
  }, A = m(e, d), C = m(i, y);
  return {
    winChanceF1: R,
    winChanceF2: q,
    predictedScore: {
      f1Score: O,
      f2Score: K,
      isOvertimeLikely: U
    },
    keyAdvantageText: o,
    factors: {
      eloDelta: Math.round(t - a),
      mapAdvantage: l,
      momentumAdvantage: {
        leader: k > Y ? "faction1" : Y > k ? "faction2" : "balanced",
        f1HotCount: v,
        f2HotCount: M,
        f1ColdCount: h,
        f2ColdCount: P
      },
      premadeAdvantage: {
        leader: E > L ? "faction1" : L > E ? "faction2" : "balanced",
        f1MaxPartySize: E,
        f2MaxPartySize: L
      },
      smurfRiskDelta: {
        f1HighRiskCount: $,
        f2HighRiskCount: b,
        impactPercent: Math.round(H * 100)
      }
    },
    starMatchup: A && C ? { f1Star: A, f2Star: C } : void 0
  };
}
const T = (s, ...t) => {
  for (const a of t) {
    const e = s?.[a];
    if (e != null && e !== "") return e;
  }
};
function pe(s, t, a, e, i, n) {
  const c = a?.games?.cs2 || a?.games?.csgo || {}, u = c.faceit_elo || 1e3, d = c.skill_level || 1, y = c.game_player_id || a?.steam_id_64, S = a?.nickname || t || "Player", F = a?.avatar || "", g = a?.country || "", l = Array.isArray(e) ? null : e, w = Array.isArray(i) ? null : i, v = l?.lifetime || w?.lifetime || {}, h = parseInt(T(v, "Total Matches", "Matches", "m1") || "0", 10), M = parseFloat(T(v, "Win Rate %", "k6") || "0"), P = parseFloat(T(v, "Average K/D Ratio", "K/D Ratio", "k5") || "1.0"), k = parseFloat(T(v, "Average Headshots %", "Headshots %", "k8") || "0"), Y = T(v, "ADR", "adr", "c3"), Q = Y ? parseFloat(Y) : void 0, B = {}, z = [
    ...Array.isArray(e) ? e : e?.segments || e?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const o of z) {
    const A = (o._id?.segmentId || o._id?.label || o.label || o.segmentId || o.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (A) {
      const C = parseInt(T(o.stats, "Matches") ?? T(o, "m1", "matches") ?? "0", 10), p = parseFloat(T(o.stats, "Win Rate %") ?? T(o, "k6", "winRate") ?? "0"), f = parseFloat(T(o.stats, "Average K/D Ratio", "K/D Ratio") ?? T(o, "k5", "kd") ?? "1.0"), _ = parseFloat(T(o.stats, "Average Headshots %") ?? T(o, "k8", "hsPercent") ?? "0"), I = parseFloat(T(o.stats, "Average Kills") ?? T(o, "k1", "avgKills") ?? "0"), D = T(o.stats, "ADR") ?? T(o, "c3", "adr"), V = D ? parseFloat(D) : void 0, W = parseInt(T(o.stats, "Wins") ?? T(o, "m2", "wins") ?? Math.round(C * p / 100).toString(), 10);
      (!B[A] || C > B[A].matches) && (B[A] = {
        mapName: A,
        matches: C,
        winRate: p,
        kd: f,
        hsPercent: _,
        avgKills: I,
        avgAdr: V,
        wins: W,
        losses: Math.max(0, C - W)
      });
    }
  }
  const E = [];
  let L = 0, J = "NONE", $ = !0;
  const b = {};
  if (Array.isArray(n))
    for (let o = 0; o < n.length; o++) {
      const m = n[o], A = m.i10 === "1" || m.result === "1" || m.stats?.Result === "1" || m.stats?.Win === "1", C = A ? "W" : "L";
      o === 0 ? (J = C, L = 1) : $ && (C === J ? L++ : $ = !1);
      const p = (m.i1 || m.stats?.Map || m.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), f = parseInt(m.i6 || m.stats?.Kills || m.kills || "0", 10), _ = parseInt(m.i8 || m.stats?.Deaths || m.deaths || "0", 10), I = m.c3 || m.stats?.ADR || m.adr, D = I ? parseFloat(I) : void 0, V = m.c4 || m.stats?.["Headshots %"], W = V ? parseFloat(V) : void 0;
      p && (b[p] || (b[p] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), b[p].matches++, A && b[p].wins++, b[p].kills += f, b[p].deaths += _, D !== void 0 && (b[p].adrSum += D, b[p].adrCount++));
      const G = m.elo ? parseInt(m.elo.toString().replace(/,/g, ""), 10) : m.i15 ? parseInt(m.i15, 10) : void 0;
      let N;
      if (o < n.length - 1 && G) {
        const te = n[o + 1], ne = te?.elo ? parseInt(te.elo.toString().replace(/,/g, ""), 10) : te?.i15 ? parseInt(te.i15, 10) : void 0;
        if (typeof ne == "number" && !isNaN(ne)) {
          const oe = G - ne;
          Math.abs(oe) <= 60 && (N = oe);
        }
      }
      N === void 0 && (N = A ? 25 : -25), E.push({
        matchId: m.matchId || m.i0 || `match-${o}`,
        playedAt: m.date || m.created_at || 0,
        map: p,
        result: C,
        score: m.i18 || m.stats?.Score || "13:0",
        kills: f,
        deaths: _,
        kd: parseFloat(m.c2 || m.stats?.["K/D Ratio"] || (_ > 0 ? (f / _).toFixed(2) : f.toFixed(2))),
        hsPercent: W,
        adr: D,
        elo: G,
        eloDiff: N
      });
    }
  for (const [o, m] of Object.entries(b))
    if (!B[o] || B[o].matches === 0) {
      const A = m.matches, C = m.wins, p = A > 0 ? Math.round(C / A * 100) : 50, f = m.deaths > 0 ? parseFloat((m.kills / m.deaths).toFixed(2)) : 1, _ = m.adrCount > 0 ? Math.round(m.adrSum / m.adrCount) : void 0;
      B[o] = {
        mapName: o,
        matches: A,
        winRate: p,
        kd: f,
        hsPercent: k,
        avgKills: A > 0 ? parseFloat((m.kills / A).toFixed(1)) : 15,
        avgAdr: _,
        wins: C,
        losses: A - C
      };
    }
  const H = E.slice(0, 30), X = H.length;
  let Z, R, q = 0, O, K;
  if (X > 0) {
    const o = H.reduce((f, _) => f + (_.kills || 0), 0), m = H.reduce((f, _) => f + (_.deaths || 0), 0);
    Z = m > 0 ? parseFloat((o / m).toFixed(2)) : void 0;
    const A = H.map((f) => f.adr).filter((f) => f !== void 0 && f > 0);
    q = A.length, R = A.length > 0 ? Math.round(A.reduce((f, _) => f + _, 0) / A.length) : void 0;
    const C = H.map((f) => f.hsPercent).filter((f) => f !== void 0);
    O = C.length > 0 ? Math.round(C.reduce((f, _) => f + _, 0) / C.length) : void 0;
    const p = H.filter((f) => f.result === "W").length;
    K = Math.round(p / X * 100);
  }
  const { formStatus: U, recentKd: j, recentAdr: r } = ge(E, P, Q);
  return {
    playerId: s,
    nickname: S,
    avatar: F,
    country: g,
    steamId64: y,
    elo: u,
    skillLevel: d,
    totalMatches: h,
    overallWinRate: M,
    overallKd: P,
    overallHsPercent: k,
    overallAdr: Q,
    last30Kd: Z,
    last30Adr: R,
    last30AdrMatches: q,
    last30HsPercent: O,
    last30WinRate: K,
    last30Matches: X,
    currentStreak: {
      type: J,
      count: L
    },
    recentMatches: E,
    mapStats: B,
    registrationDate: a?.created_at,
    formStatus: U,
    recentKd: j,
    recentAdr: r
  };
}
async function ee(s, t = {}, a = 8e3) {
  const e = new AbortController(), i = setTimeout(() => e.abort(), a);
  try {
    return await fetch(s, { ...t, signal: e.signal });
  } finally {
    clearTimeout(i);
  }
}
class ye {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(t) {
    if (!t || !/^[a-zA-Z0-9.\-_]+$/.test(t)) return null;
    if (this.inFlightMatch.has(t))
      return this.inFlightMatch.get(t);
    const a = this.fetchMatchDetailsInternal(t).finally(() => {
      this.inFlightMatch.delete(t);
    });
    return this.inFlightMatch.set(t, a), a;
  }
  async fetchMatchDetailsInternal(t) {
    try {
      const a = await ee(`https://api.faceit.com/match/v2/match/${encodeURIComponent(t)}`, {
        headers: { Accept: "application/json" }
      });
      if (!a.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${t} returned HTTP ${a.status}`), null;
      const e = await a.json(), i = e.payload || e;
      return we(i);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${t}:`, a), null;
    }
  }
  async getPlayerStats(t, a) {
    if (!t || !/^[a-zA-Z0-9.\-_]+$/.test(t)) return null;
    const e = `${t}_${a || ""}`;
    if (this.inFlightPlayer.has(e))
      return this.inFlightPlayer.get(e);
    const i = this.fetchPlayerStatsInternal(t, a).finally(() => {
      this.inFlightPlayer.delete(e);
    });
    return this.inFlightPlayer.set(e, i), i;
  }
  async fetchPlayerStatsInternal(t, a) {
    try {
      const e = encodeURIComponent(t), [i, n, c, u] = await Promise.allSettled([
        ee(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        ee(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        ee(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=30`, { headers: { Accept: "application/json" } }),
        ee(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let d = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const g = await i.value.json();
        d = g.payload || g;
      }
      let y = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const g = await n.value.json();
        y = g.payload || g;
      }
      let S = null;
      if (u.status === "fulfilled" && u.value.ok) {
        const g = await u.value.json();
        S = g.payload || g;
      }
      let F = [];
      if (c.status === "fulfilled" && c.value.ok) {
        const g = await c.value.json(), l = g.payload || g;
        F = Array.isArray(l) ? l : l?.items || l?.segments || [];
      }
      return pe(t, a, d, y, S, F);
    } catch (e) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${t}:`, e), null;
    }
  }
}
function we(s) {
  const t = s.teams?.faction1 || s.faction1 || {}, a = s.teams?.faction2 || s.faction2 || {}, e = s.voting?.map?.pick || [], i = e.length > 0 ? e[e.length - 1] : [...s.voting?.map?.entities || []].reverse().find((d) => d.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, c = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, u = (d) => (d || []).map((y) => ({
    player_id: y.id || y.player_id,
    nickname: y.nickname || "Player",
    avatar: y.avatar || "",
    game_player_id: y.game_player_id || y.gameId || y.steam_id_64,
    game_player_name: y.game_player_name || y.gameName,
    game_skill_level: y.skill_level || y.game_skill_level || 1,
    elo: y.elo || 1e3,
    membership: y.membership,
    party_id: y.party_id || y.partyId
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
        faction_id: t.id || t.faction_id || "faction1",
        name: t.name || "Team 1",
        avatar: t.avatar,
        leader: t.leader,
        roster: u(t.roster)
      },
      faction2: {
        faction_id: a.id || a.faction_id || "faction2",
        name: a.name || "Team 2",
        avatar: a.avatar,
        leader: a.leader,
        roster: u(a.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: c
  };
}
const he = new ye();
function ve(s, t) {
  const a = !s.includes("<privacyState>public</privacyState>"), e = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: t,
    personaName: e ? e[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${t}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let c = 0, u = 0;
  const d = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (d) {
    const l = d[1].split("</mostPlayedGame>");
    for (const w of l)
      if (w.includes("Counter-Strike 2") || w.includes("Counter-Strike: Global Offensive")) {
        const v = w.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        v && (c = parseFloat(v[1].replace(/,/g, "")));
        const h = w.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        h && (u = parseFloat(h[1].replace(/,/g, "")), c === 0 && (c = u));
        break;
      }
  }
  const y = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (y) {
    const l = new Date(y[1]);
    isNaN(l.getTime()) || (n.timeCreated = l.getTime() / 1e3, n.accountAgeYears = (Date.now() - l.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const S = s.match(/<communityBanned>(.*?)<\/communityBanned>/), F = s.match(/<vacBanned>(.*?)<\/vacBanned>/), g = {
    steamId64: t,
    communityBanned: S ? S[1] === "1" : !1,
    vacBanned: F ? F[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: c,
      cs2HoursLast2Weeks: u
    },
    bans: g,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
async function Ae(s, t = {}, a = 6e3) {
  const e = new AbortController(), i = setTimeout(() => e.abort(), a);
  try {
    return await fetch(s, { ...t, signal: e.signal });
  } finally {
    clearTimeout(i);
  }
}
class _e {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(t) {
    if (!t || !/^\d{5,25}$/.test(t))
      return { isPrivate: !0, fetchedAt: Date.now() };
    if (this.inFlightSteam.has(t))
      return this.inFlightSteam.get(t);
    const a = this.fetchSteamDataInternal(t).finally(() => {
      this.inFlightSteam.delete(t);
    });
    return this.inFlightSteam.set(t, a), a;
  }
  async fetchSteamDataInternal(t) {
    try {
      const a = await Ae(`https://steamcommunity.com/profiles/${t}/?xml=1`);
      if (!a.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const e = await a.text();
      return e.includes("<steamID>") ? ve(e, t) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Me = new _e();
function Se(s, t) {
  const a = [];
  let e = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, c = s.overallKd || 1, u = s.overallWinRate || 50, d = s.recentKd || c, y = s.recentAdr || 75;
  n >= 2200 && i < 100 ? (e += 45, a.push({
    id: "lvl10_extreme_low_matches",
    title: "High Elo on Very Fresh Account",
    description: `${n} Elo achieved in only ${i} matches`,
    weight: 45,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 2e3 && i < 150 ? (e += 35, a.push({
    id: "lvl10_low_matches",
    title: "Level 10 with Low Matches",
    description: `Level 10 (${n} Elo) in only ${i} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 1600 && i < 80 ? (e += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${n} Elo achieved in only ${i} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : n >= 1350 && i < 40 ? (e += 18, a.push({
    id: "mid_elo_fresh_account",
    title: "Level 7+ on New Account",
    description: `${n} Elo with only ${i} matches`,
    weight: 18,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : i < 20 ? (e += 10, a.push({
    id: "fresh_faceit_account",
    title: "New FACEIT Account",
    description: `Only ${i} total matches on record`,
    weight: 10,
    severity: "info",
    category: "MATCHES_ELO"
  })) : i >= 800 && (e -= 15), c >= 2 ? (e += 30, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${c.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : c >= 1.6 && i < 200 ? (e += 20, a.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${c.toFixed(2)} with ${i} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : c >= 1.4 && i < 150 ? (e += 12, a.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${c.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : c < 0.95 && i >= 50 && (e -= 10), s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (e += 22, a.push({
    id: "extreme_adr",
    title: "Exceptional Average Damage (95+)",
    description: `Lifetime ADR of ${s.overallAdr.toFixed(0)} is far above the typical range`,
    weight: 22,
    severity: "danger",
    category: "ADR_ANOMALY"
  })), s.last30Adr !== void 0 && s.last30Adr >= 100 && (s.last30AdrMatches ?? 0) >= 3 && (e += 18, a.push({
    id: "recent_extreme_adr",
    title: "Recent ADR Anomaly (100+)",
    description: `ADR of ${s.last30Adr} across the last 30 matches`,
    weight: 18,
    severity: "warning",
    category: "ADR_ANOMALY"
  })), y >= 95 && s.overallAdr !== void 0 && y >= s.overallAdr * 1.2 && (e += 12, a.push({
    id: "recent_adr_spike",
    title: "Recent ADR Spike",
    description: `Last 5 games ADR (${y}) is 20%+ above lifetime baseline (${s.overallAdr.toFixed(0)})`,
    weight: 12,
    severity: "warning",
    category: "ADR_ANOMALY"
  })), (s.last30HsPercent ?? 0) >= 60 ? (e += 10, a.push({
    id: "extreme_hs_recent",
    title: "Extreme Headshot Rate (60%+)",
    description: `Average ${s.last30HsPercent}% headshots over the last 30 matches`,
    weight: 10,
    severity: "warning",
    category: "HS_ANOMALY"
  })) : s.overallHsPercent >= 60 && c >= 1.5 && (e += 8, a.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${c.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), u >= 80 && i >= 10 ? (e += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${u.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : u >= 70 && i >= 15 ? (e += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${u.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : u >= 62 && i >= 25 && (e += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${u.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), s.last30WinRate !== void 0 && (s.last30Matches ?? 0) >= 5 && (s.last30WinRate >= 85 && i < 300 ? (e += 15, a.push({
    id: "recent_dominance",
    title: "Recent Dominance (85%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 15,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : s.last30WinRate >= 75 && n >= 1500 && (e += 8, a.push({
    id: "elevated_recent_winrate",
    title: "High Recent Win Rate (75%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 8,
    severity: "info",
    category: "WINRATE_ANOMALY"
  }))), d >= 1.75 && d >= c * 1.35 && i >= 10 && (e += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${d.toFixed(2)}) is significantly higher than lifetime baseline (${c.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  })), s.last30Kd !== void 0 && s.last30Kd >= 1.5 && s.last30Kd >= c * 1.3 && i >= 30 && (e += 10, a.push({
    id: "midterm_kd_spike",
    title: "Mid-Term K/D Spike",
    description: `Last 30 games K/D (${s.last30Kd.toFixed(2)}) well above lifetime baseline (${c.toFixed(2)})`,
    weight: 10,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let S = !0;
  if (t?.fetchError)
    S = !1;
  else if (t && !t.isPrivate && t.summary) {
    S = !1;
    const h = t.playtime?.cs2HoursTotal ?? 0;
    h > 0 && h < 150 && n >= 1600 ? (e += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo Rating",
      description: `Only ${h}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : h > 0 && h < 350 && n >= 2e3 ? (e += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${h}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : h >= 2500 && (e -= 15);
    const M = t.summary.accountAgeYears;
    if (M !== void 0 && M < 1 && n >= 1400 && (e += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${M.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    })), t.bans?.vacBanned || t.bans?.numberOfGameBans) {
      const P = (t.bans.vacBanned ? 1 : 0) + (t.bans.numberOfGameBans || 0), k = 25;
      e += k, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${P} ban(s) on record (${t.bans.daysSinceLastBan || 0} days ago)`,
        weight: k,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else if (t?.isPrivate) {
    S = !0, a.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const h = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    h >= 15 && (e += h, a.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: h,
      severity: h >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), i < 100 && (e += 10, a.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const M = s.last30Kd ?? d;
    M >= 1.6 && (e += 8, a.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${M.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else
    S = !1;
  const F = s.registrationDate ? new Date(s.registrationDate) : null;
  if (F && !isNaN(F.getTime())) {
    const h = (Date.now() - F.getTime()) / 315576e5;
    h < 0.5 && n >= 1350 ? (e += 22, a.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${h.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : h < 1 && n >= 1600 && (e += 18, a.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${h.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const g = Math.min(100, Math.max(0, Math.round(e)));
  let l = "LOW", w = "#10B981", v = "Legit";
  return g >= 70 ? (l = "CRITICAL", w = "#DC2626", v = "High Risk") : g >= 45 ? (l = "HIGH", w = "#EF4444", v = "Likely Smurf") : g >= 25 && (l = "MEDIUM", w = "#F59E0B", v = "Suspicious"), {
    score: g,
    level: l,
    flags: a,
    isPrivateSteam: S,
    summary: `${g}% Smurf Risk (${l})`,
    color: w,
    badgeText: v
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
function Fe(s, t) {
  const a = [];
  let e = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const c = /* @__PURE__ */ new Map();
    for (const l of n.roster)
      if (l.party_id) {
        const w = c.get(l.party_id) || [];
        w.push(l.player_id), c.set(l.party_id, w);
      }
    const u = /* @__PURE__ */ new Set();
    for (const [, l] of c.entries())
      if (l.length >= 2) {
        const w = String.fromCharCode(65 + e % 26);
        a.push({
          id: `party-${e}`,
          tag: `Party ${w} (${l.length})`,
          color: se[e % se.length],
          playerIds: l
        }), e++, l.forEach((v) => u.add(v));
      }
    const d = n.roster.map((l) => l.player_id).filter((l) => !u.has(l)), y = 15, S = /* @__PURE__ */ new Map();
    for (const l of d) {
      const w = t[l];
      w?.recentMatches && S.set(l, new Set(w.recentMatches.slice(0, y).map((v) => v.matchId)));
    }
    const F = /* @__PURE__ */ new Set(), g = (l, w) => {
      const v = S.get(l), h = S.get(w);
      if (!v || !h) return !1;
      let M = 0;
      for (const P of v)
        if (h.has(P) && M++, M >= 2) return !0;
      return !1;
    };
    for (const l of d) {
      if (F.has(l)) continue;
      const w = [], v = [l];
      for (F.add(l); v.length > 0; ) {
        const h = v.shift();
        w.push(h);
        for (const M of d)
          !F.has(M) && g(h, M) && (F.add(M), v.push(M));
      }
      if (w.length >= 2) {
        w.forEach((M) => u.add(M));
        const h = String.fromCharCode(65 + e % 26);
        a.push({
          id: `party-${e}`,
          tag: `Party ${h} (${w.length})`,
          color: se[e % se.length],
          playerIds: w
        }), e++;
      }
    }
  }
  return a;
}
const Ce = (s) => new Promise((t) => setTimeout(t, s));
async function be(s, t, a, e = 150) {
  const i = new Array(s.length);
  let n = 0;
  const c = async () => {
    for (; n < s.length; ) {
      const d = n++;
      i[d] = await a(s[d], d), e > 0 && await Ce(e);
    }
  }, u = Array.from({ length: Math.min(t, s.length) }, c);
  return await Promise.all(u), i;
}
class Ee {
  settings = { ...re };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, x.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const t = await x.get("settings");
    return t && (this.settings = { ...re, ...t }), this.settings;
  }
  async handleMessage(t, a) {
    try {
      switch (t.type) {
        case "GET_SETTINGS":
          return this.handleGetSettings();
        case "SAVE_SETTINGS":
          return this.handleSaveSettings(t.payload);
        case "FETCH_LOBBY_INSIGHT":
          return this.handleFetchLobbyInsight(t.payload, a);
        case "GET_CACHE_STATS":
          return this.handleGetCacheStats();
        case "CLEAR_CACHE":
          return this.handleClearCache();
        default:
          return { success: !1, error: "Unknown message type" };
      }
    } catch (e) {
      return console.error("[f-insight:Background] Message handler error:", e), { success: !1, error: e.message || "Internal error" };
    }
  }
  async handleGetSettings() {
    return { success: !0, data: await this.loadSettings() };
  }
  async handleSaveSettings(t) {
    return this.settings = { ...this.settings, ...t }, await x.set("settings", this.settings, ae.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(t, a) {
    const { matchId: e, forceRefresh: i } = t, n = `match_analysis:${e}`;
    if (!i) {
      const u = await x.get(n);
      if (u && !u.isPartial)
        return { success: !0, data: u };
    }
    const c = await he.getMatchDetails(e);
    if (!c)
      return { success: !1, error: `Could not fetch match details for ${e}` };
    if (a?.tab?.id && (this.streamSubscribers.has(e) || this.streamSubscribers.set(e, /* @__PURE__ */ new Set()), this.streamSubscribers.get(e).add(a.tab.id)), !this.inFlightStreams.has(e) || i) {
      const u = this.streamLobbyData(e, c, i).finally(() => {
        this.inFlightStreams.delete(e), this.streamSubscribers.delete(e);
      });
      this.inFlightStreams.set(e, u);
    }
    return { success: !0, data: { match: c, isPartial: !0 } };
  }
  async streamLobbyData(t, a, e) {
    try {
      await this.streamLobbyDataInner(t, a, e);
    } catch (i) {
      console.error("[f-insight:Stream] Error:", i), this.broadcastToSubscribers(t, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: t, error: i?.message || "Match analysis stream failed" }
      });
    }
  }
  broadcastToSubscribers(t, a) {
    const e = this.streamSubscribers.get(t);
    if (!(!e || e.size === 0))
      for (const i of e)
        this.safeSendToTab(i, a);
  }
  async streamLobbyDataInner(t, a, e) {
    const i = `match_analysis:${t}`, n = a.teams?.faction1?.roster || [], c = a.teams?.faction2?.roster || [], u = [...n, ...c], d = {}, y = {}, S = {};
    await be(
      u,
      3,
      async (r) => {
        const o = r.player_id;
        if (!o) return;
        const m = `player_stats:${o}`;
        let A = null;
        if (e || (A = await x.get(m)), A || (A = await he.getPlayerStats(o, r.nickname), A && await x.set(m, A, ae.PLAYER_STATS)), A) {
          d[o] = A;
          const C = A.steamId64 || r.game_player_id;
          if (C) {
            const p = `steam_data:${C}`;
            let f = null;
            e || (f = await x.get(p)), f || (f = await Me.getPlayerFullData(C), f && !f.fetchError && await x.set(p, f, ae.STEAM_PROFILE)), f && (y[o] = f);
          }
          S[o] = Se(A, y[o]), this.broadcastToSubscribers(t, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: t, playerId: o, stats: A, steam: y[o], risk: S[o] }
          });
        }
      },
      200
    );
    const F = n.map((r) => d[r.player_id]?.elo || r.elo || 1e3), g = c.map((r) => d[r.player_id]?.elo || r.elo || 1e3), l = F.reduce((r, o) => r + o, 0), w = g.reduce((r, o) => r + o, 0), v = F.length > 0 ? Math.round(l / F.length) : 1e3, h = g.length > 0 ? Math.round(w / g.length) : 1e3, M = v - h, P = me(v, h), k = n.map((r) => d[r.player_id]?.last30Kd ?? d[r.player_id]?.overallKd ?? 1), Y = c.map((r) => d[r.player_id]?.last30Kd ?? d[r.player_id]?.overallKd ?? 1), Q = k.length > 0 ? parseFloat((k.reduce((r, o) => r + o, 0) / k.length).toFixed(2)) : 1, B = Y.length > 0 ? parseFloat((Y.reduce((r, o) => r + o, 0) / Y.length).toFixed(2)) : 1, z = n.map((r) => d[r.player_id]?.overallHsPercent || 0), E = c.map((r) => d[r.player_id]?.overallHsPercent || 0), L = z.length > 0 ? Math.round(z.reduce((r, o) => r + o, 0) / z.length) : 0, J = E.length > 0 ? Math.round(E.reduce((r, o) => r + o, 0) / E.length) : 0, $ = n.map((r) => d[r.player_id]?.last30Adr ?? d[r.player_id]?.overallAdr ?? 75), b = c.map((r) => d[r.player_id]?.last30Adr ?? d[r.player_id]?.overallAdr ?? 75), H = $.length > 0 ? Math.round($.reduce((r, o) => r + o, 0) / $.length) : 75, X = b.length > 0 ? Math.round(b.reduce((r, o) => r + o, 0) / b.length) : 75, Z = n.map((r) => d[r.player_id]).filter(Boolean), R = c.map((r) => d[r.player_id]).filter(Boolean), q = le(Z), O = le(R);
    for (const [r, o] of Object.entries(q))
      d[r] && (d[r].fcrContributionPercent = o);
    for (const [r, o] of Object.entries(O))
      d[r] && (d[r].fcrContributionPercent = o);
    const K = Fe(a, d), U = ue({
      f1AvgElo: v,
      f2AvgElo: h,
      f1Players: Z,
      f2Players: R,
      selectedMap: a.selected_map,
      premadeGroups: K,
      riskAnalysis: S,
      f1Fcr: q,
      f2Fcr: O
    }), j = {
      match: a,
      playersStats: d,
      steamData: y,
      riskAnalysis: S,
      premadeGroups: K,
      teamSummary: {
        faction1: {
          totalElo: l,
          avgElo: v,
          winChancePercent: U.winChanceF1,
          avgKd: Q,
          avgHsPercent: L,
          avgAdr: H,
          projectedElo: P.faction1
        },
        faction2: {
          totalElo: w,
          avgElo: h,
          winChancePercent: U.winChanceF2,
          avgKd: B,
          avgHsPercent: J,
          avgAdr: X,
          projectedElo: P.faction2
        },
        eloDifference: Math.abs(M)
      },
      prediction: U,
      isPartial: !1
    };
    await x.set(i, j, ae.MATCH), this.broadcastToSubscribers(t, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: j
    });
  }
  safeSendToTab(t, a) {
    chrome.tabs.sendMessage(t, a).catch((e) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", e?.message || e);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await x.getStats() };
  }
  async handleClearCache() {
    return await x.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const ie = new Ee(), de = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), de(), await ie.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), de(), await ie.init();
});
chrome.runtime.onMessage.addListener((s, t, a) => (ie.init().then(() => ie.handleMessage(s, t)).then(a), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await x.cleanup());
});
