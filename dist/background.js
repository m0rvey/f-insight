const oe = {
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
        const i = (await chrome.storage.local.get([t]))[t];
        if (i && i.cachedAt && i.ttlMs) {
          if (a - i.cachedAt < i.ttlMs)
            return this.memoryCache.set(t, i), this.enforceMemoryLimit(), i.value;
          await chrome.storage.local.remove([t]);
        }
      } catch (n) {
        console.warn(`[f-insight:Cache] Failed to read ${t} from storage`, n);
      }
    return null;
  }
  async set(t, a, e) {
    const n = {
      value: a,
      cachedAt: Date.now(),
      ttlMs: e
    };
    if (this.memoryCache.delete(t), this.memoryCache.set(t, n), this.enforceMemoryLimit(), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [t]: n });
      } catch (i) {
        console.warn(`[f-insight:Cache] Failed to save ${t} to storage`, i);
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
        for (const [n, i] of Object.entries(a)) {
          if (n === "settings") continue;
          const r = i;
          r && r.cachedAt && r.ttlMs && t - r.cachedAt >= r.ttlMs && e.push(n);
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
  const a = Number.isFinite(s) ? Math.max(100, Math.min(6e3, s)) : 1e3, n = (Number.isFinite(t) ? Math.max(100, Math.min(6e3, t)) : 1e3) - a, i = 1 / (1 + Math.pow(10, n / 400)), r = 1 - i, u = 50, d = Math.max(1, Math.min(49, Math.round(u * (1 - i)))), y = Math.max(1, Math.min(49, Math.round(u * i))), _ = Math.max(1, Math.min(49, Math.round(u * (1 - r)))), M = Math.max(1, Math.min(49, Math.round(u * r)));
  return {
    faction1: {
      winGain: d,
      lossLoss: y
    },
    faction2: {
      winGain: _,
      lossLoss: M
    }
  };
}
function le(s) {
  const t = {};
  if (!s || s.length === 0) return t;
  const a = s.map((i) => {
    const r = Number.isFinite(i.elo) ? i.elo : 1e3, u = Math.max(500, r || 1e3) / 1e3, d = Number.isFinite(i.last30Kd) ? i.last30Kd : Number.isFinite(i.overallKd) ? i.overallKd : 1, y = Math.max(0.4, d ?? 1), M = 1 + (((Number.isFinite(i.last30Adr) ? i.last30Adr : Number.isFinite(i.overallAdr) ? i.overallAdr : 75) ?? 75) - 75) / 150, f = u * y * Math.max(0.6, M);
    return { id: i.playerId, power: Number.isFinite(f) && f > 0 ? f : 1 };
  }), e = a.reduce((i, r) => i + r.power, 0), n = Number.isFinite(e) && e > 0 ? e : 0;
  for (const i of a) {
    const r = n > 0 ? i.power / n * 100 : 100 / s.length;
    t[i.id] = parseFloat(r.toFixed(1));
  }
  return t;
}
function ge(s, t, a) {
  const e = Number.isFinite(t) ? Math.max(0.5, t) : 1, n = Number.isFinite(a) ? Math.max(20, a) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: e,
      recentAdr: n
    };
  const i = s.slice(0, 5), r = i.filter(
    (f) => typeof f.kills == "number" && Number.isFinite(f.kills) && typeof f.deaths == "number" && Number.isFinite(f.deaths)
  );
  let u = e;
  if (r.length > 0) {
    const f = r.reduce((w, A) => w + (A.kills || 0), 0), l = r.reduce((w, A) => w + (A.deaths || 0), 0);
    u = l > 0 ? parseFloat((f / l).toFixed(2)) : parseFloat(e.toFixed(2));
  }
  const d = i.map((f) => f.adr).filter((f) => typeof f == "number" && Number.isFinite(f) && f > 0), y = d.length > 0 ? Math.round(d.reduce((f, l) => f + l, 0) / d.length) : n, _ = u / e;
  let M = "STABLE";
  return _ >= 1.15 || u >= 1.4 && i.filter((f) => f.result === "W").length >= 4 ? M = "HOT" : (_ <= 0.82 || u <= 0.75 && i.filter((f) => f.result === "L").length >= 4) && (M = "COLD"), {
    formStatus: M,
    recentKd: u,
    recentAdr: y
  };
}
function ue(s) {
  const {
    f1AvgElo: t,
    f2AvgElo: a,
    f1Players: e,
    f2Players: n,
    selectedMap: i,
    premadeGroups: r,
    riskAnalysis: u,
    f1Fcr: d,
    f2Fcr: y
  } = s, _ = a - t, M = 1 / (1 + Math.pow(10, _ / 400));
  let f = 0, l;
  const w = (i || "").replace("de_", "").toLowerCase();
  if (w) {
    const p = e.reduce((G, W) => G + (W.mapStats?.[w]?.wins || 0), 0), m = e.reduce((G, W) => G + (W.mapStats?.[w]?.matches || 0), 0), S = m > 0 ? Math.round(p / m * 100) : 50, I = n.reduce((G, W) => G + (W.mapStats?.[w]?.wins || 0), 0), k = n.reduce((G, W) => G + (W.mapStats?.[w]?.matches || 0), 0), V = k > 0 ? Math.round(I / k * 100) : 50, K = S - V;
    f = Math.max(-0.12, Math.min(0.12, K / 100 * 0.25)), l = {
      leader: K >= 5 ? "faction1" : K <= -5 ? "faction2" : "balanced",
      mapName: w,
      f1WinRate: S,
      f2WinRate: V,
      deltaWinRate: Math.abs(K)
    };
  }
  const A = e.filter((p) => p.formStatus === "HOT").length, h = e.filter((p) => p.formStatus === "COLD").length, F = n.filter((p) => p.formStatus === "HOT").length, P = n.filter((p) => p.formStatus === "COLD").length, D = A - h, Y = F - P, Q = Math.max(-0.1, Math.min(0.1, (D - Y) * 0.03)), B = new Set(e.map((p) => p.playerId)), z = new Set(n.map((p) => p.playerId));
  let E = 1, L = 1;
  for (const p of r) {
    const m = p.playerIds.filter((I) => B.has(I)).length, S = p.playerIds.filter((I) => z.has(I)).length;
    m > E && (E = m), S > L && (L = S);
  }
  const J = Math.max(-0.08, Math.min(0.08, (E - L) * 0.02)), $ = e.filter((p) => {
    const m = u[p.playerId]?.level;
    return m === "HIGH" || m === "CRITICAL";
  }).length, C = n.filter((p) => {
    const m = u[p.playerId]?.level;
    return m === "HIGH" || m === "CRITICAL";
  }).length, H = Math.max(-0.06, Math.min(0.06, ($ - C) * 0.02)), X = M + f + Q + J + H, Z = Math.max(0.06, Math.min(0.94, X)), R = Math.round(Z * 100), q = 100 - R;
  let O = 13, N = 9, U = !1;
  const j = Math.abs(R - 50);
  j <= 3 ? (O = R >= 50 ? 13 : 11, N = R >= 50 ? 11 : 13, U = !0) : j <= 8 ? (O = R >= 50 ? 13 : 10, N = R >= 50 ? 10 : 13) : j <= 16 ? (O = R >= 50 ? 13 : 8, N = R >= 50 ? 8 : 13) : j <= 26 ? (O = R >= 50 ? 13 : 5, N = R >= 50 ? 5 : 13) : (O = R >= 50 ? 13 : 3, N = R >= 50 ? 3 : 13);
  const c = [];
  Math.abs(t - a) >= 60 && c.push(
    t > a ? `Team 1 holds +${Math.round(t - a)} avg Elo edge` : `Team 2 holds +${Math.round(a - t)} avg Elo edge`
  ), l && l.deltaWinRate >= 8 && c.push(
    l.leader === "faction1" ? `Team 1 dominates ${l.mapName} (+${l.deltaWinRate}% WR)` : `Team 2 dominates ${l.mapName} (+${l.deltaWinRate}% WR)`
  ), A > F && A >= 2 ? c.push(`Team 1 on hot momentum (${A} players On Fire)`) : F > A && F >= 2 && c.push(`Team 2 on hot momentum (${F} players On Fire)`), E >= 3 && E > L ? c.push(`Team 1 has ${E}-stack coordination`) : L >= 3 && L > E && c.push(`Team 2 has ${L}-stack coordination`), Math.abs(H) >= 0.04 && $ + C > 0 && ($ > C ? c.push(`Team 1 likely carries flagged accounts (${$} risk flagged)`) : C > $ && c.push(`Team 2 likely carries flagged accounts (${C} risk flagged)`));
  const o = c.length > 0 ? c.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", g = (p, m) => {
    let S = p[0], I = -1;
    for (const k of p) {
      const K = (m[k.playerId] || 20) * 1.5 + (k.last30Kd ?? k.overallKd ?? 1) * 10;
      K > I && (I = K, S = k);
    }
    return S ? {
      nickname: S.nickname,
      fcr: m[S.playerId] || 20,
      kd: S.last30Kd ?? S.overallKd ?? 1,
      elo: S.elo || 1e3
    } : void 0;
  }, v = g(e, d), b = g(n, y);
  return {
    winChanceF1: R,
    winChanceF2: q,
    predictedScore: {
      f1Score: O,
      f2Score: N,
      isOvertimeLikely: U
    },
    keyAdvantageText: o,
    factors: {
      eloDelta: Math.round(t - a),
      mapAdvantage: l,
      momentumAdvantage: {
        leader: D > Y ? "faction1" : Y > D ? "faction2" : "balanced",
        f1HotCount: A,
        f2HotCount: F,
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
        f2HighRiskCount: C,
        impactPercent: Math.round(H * 100)
      }
    },
    starMatchup: v && b ? { f1Star: v, f2Star: b } : void 0
  };
}
const T = (s, ...t) => {
  for (const a of t) {
    const e = s?.[a];
    if (e != null && e !== "") return e;
  }
};
function pe(s, t, a, e, n, i) {
  const r = a?.games?.cs2 || a?.games?.csgo || {}, u = r.faceit_elo || 1e3, d = r.skill_level || 1, y = r.game_player_id || a?.steam_id_64, _ = a?.nickname || t || "Player", M = a?.avatar || "", f = a?.country || "", l = Array.isArray(e) ? null : e, w = Array.isArray(n) ? null : n, A = l?.lifetime || w?.lifetime || {}, h = parseInt(T(A, "Total Matches", "Matches", "m1") || "0", 10), F = parseFloat(T(A, "Win Rate %", "k6") || "0"), P = parseFloat(T(A, "Average K/D Ratio", "K/D Ratio", "k5") || "1.0"), D = parseFloat(T(A, "Average Headshots %", "Headshots %", "k8") || "0"), Y = T(A, "ADR", "adr", "c3"), Q = Y ? parseFloat(Y) : void 0, B = {}, z = [
    ...Array.isArray(e) ? e : e?.segments || e?.items || [],
    ...Array.isArray(n) ? n : n?.segments || n?.items || []
  ];
  for (const o of z) {
    const v = (o._id?.segmentId || o._id?.label || o.label || o.segmentId || o.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (v) {
      const b = parseInt(T(o.stats, "Matches") ?? T(o, "m1", "matches") ?? "0", 10), p = parseFloat(T(o.stats, "Win Rate %") ?? T(o, "k6", "winRate") ?? "0"), m = parseFloat(T(o.stats, "Average K/D Ratio", "K/D Ratio") ?? T(o, "k5", "kd") ?? "1.0"), S = parseFloat(T(o.stats, "Average Headshots %") ?? T(o, "k8", "hsPercent") ?? "0"), I = parseFloat(T(o.stats, "Average Kills") ?? T(o, "k1", "avgKills") ?? "0"), k = T(o.stats, "ADR") ?? T(o, "c3", "adr"), V = k ? parseFloat(k) : void 0, K = parseInt(T(o.stats, "Wins") ?? T(o, "m2", "wins") ?? Math.round(b * p / 100).toString(), 10);
      (!B[v] || b > B[v].matches) && (B[v] = {
        mapName: v,
        matches: b,
        winRate: p,
        kd: m,
        hsPercent: S,
        avgKills: I,
        avgAdr: V,
        wins: K,
        losses: Math.max(0, b - K)
      });
    }
  }
  const E = [];
  let L = 0, J = "NONE", $ = !0;
  const C = {};
  if (Array.isArray(i))
    for (let o = 0; o < i.length; o++) {
      const g = i[o], v = g.i10 === "1" || g.result === "1" || g.stats?.Result === "1" || g.stats?.Win === "1", b = v ? "W" : "L";
      o === 0 ? (J = b, L = 1) : $ && (b === J ? L++ : $ = !1);
      const p = (g.i1 || g.stats?.Map || g.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), m = parseInt(g.i6 || g.stats?.Kills || g.kills || "0", 10), S = parseInt(g.i8 || g.stats?.Deaths || g.deaths || "0", 10), I = g.c3 || g.stats?.ADR || g.adr, k = I ? parseFloat(I) : void 0, V = g.c4 || g.stats?.["Headshots %"], K = V ? parseFloat(V) : void 0;
      p && (C[p] || (C[p] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), C[p].matches++, v && C[p].wins++, C[p].kills += m, C[p].deaths += S, k !== void 0 && (C[p].adrSum += k, C[p].adrCount++));
      const G = g.elo ? parseInt(g.elo.toString().replace(/,/g, ""), 10) : g.i15 ? parseInt(g.i15, 10) : void 0;
      let W;
      if (o < i.length - 1 && G) {
        const te = i[o + 1], ne = te?.elo ? parseInt(te.elo.toString().replace(/,/g, ""), 10) : te?.i15 ? parseInt(te.i15, 10) : void 0;
        if (typeof ne == "number" && !isNaN(ne)) {
          const re = G - ne;
          Math.abs(re) <= 60 && (W = re);
        }
      }
      W === void 0 && (W = v ? 25 : -25), E.push({
        matchId: g.matchId || g.i0 || `match-${o}`,
        playedAt: g.date || g.created_at || 0,
        map: p,
        result: b,
        score: g.i18 || g.stats?.Score || "13:0",
        kills: m,
        deaths: S,
        kd: parseFloat(g.c2 || g.stats?.["K/D Ratio"] || (S > 0 ? (m / S).toFixed(2) : m.toFixed(2))),
        hsPercent: K,
        adr: k,
        elo: G,
        eloDiff: W
      });
    }
  for (const [o, g] of Object.entries(C))
    if (!B[o] || B[o].matches === 0) {
      const v = g.matches, b = g.wins, p = v > 0 ? Math.round(b / v * 100) : 50, m = g.deaths > 0 ? parseFloat((g.kills / g.deaths).toFixed(2)) : 1, S = g.adrCount > 0 ? Math.round(g.adrSum / g.adrCount) : void 0;
      B[o] = {
        mapName: o,
        matches: v,
        winRate: p,
        kd: m,
        hsPercent: D,
        avgKills: v > 0 ? parseFloat((g.kills / v).toFixed(1)) : 15,
        avgAdr: S,
        wins: b,
        losses: v - b
      };
    }
  const H = E.slice(0, 30), X = H.length;
  let Z, R, q = 0, O, N;
  if (X > 0) {
    const o = H.reduce((m, S) => m + (S.kills || 0), 0), g = H.reduce((m, S) => m + (S.deaths || 0), 0);
    Z = g > 0 ? parseFloat((o / g).toFixed(2)) : void 0;
    const v = H.map((m) => m.adr).filter((m) => m !== void 0 && m > 0);
    q = v.length, R = v.length > 0 ? Math.round(v.reduce((m, S) => m + S, 0) / v.length) : void 0;
    const b = H.map((m) => m.hsPercent).filter((m) => m !== void 0);
    O = b.length > 0 ? Math.round(b.reduce((m, S) => m + S, 0) / b.length) : void 0;
    const p = H.filter((m) => m.result === "W").length;
    N = Math.round(p / X * 100);
  }
  const { formStatus: U, recentKd: j, recentAdr: c } = ge(E, P, Q);
  return {
    playerId: s,
    nickname: _,
    avatar: M,
    country: f,
    steamId64: y,
    elo: u,
    skillLevel: d,
    totalMatches: h,
    overallWinRate: F,
    overallKd: P,
    overallHsPercent: D,
    overallAdr: Q,
    last30Kd: Z,
    last30Adr: R,
    last30AdrMatches: q,
    last30HsPercent: O,
    last30WinRate: N,
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
    recentAdr: c
  };
}
async function ee(s, t = {}, a = 8e3) {
  const e = new AbortController(), n = setTimeout(() => e.abort(), a);
  try {
    return await fetch(s, { ...t, signal: e.signal });
  } finally {
    clearTimeout(n);
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
      const e = await a.json(), n = e.payload || e;
      return we(n);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${t}:`, a), null;
    }
  }
  async getPlayerStats(t, a) {
    if (!t || !/^[a-zA-Z0-9.\-_]+$/.test(t)) return null;
    const e = `${t}_${a || ""}`;
    if (this.inFlightPlayer.has(e))
      return this.inFlightPlayer.get(e);
    const n = this.fetchPlayerStatsInternal(t, a).finally(() => {
      this.inFlightPlayer.delete(e);
    });
    return this.inFlightPlayer.set(e, n), n;
  }
  async fetchPlayerStatsInternal(t, a) {
    try {
      const e = encodeURIComponent(t), [n, i, r, u] = await Promise.allSettled([
        ee(`https://api.faceit.com/users/v1/users/${e}`, { headers: { Accept: "application/json" } }),
        ee(`https://api.faceit.com/stats/v1/stats/users/${e}/games/cs2`, { headers: { Accept: "application/json" } }),
        ee(`https://api.faceit.com/stats/v1/stats/time/users/${e}/games/cs2?size=30`, { headers: { Accept: "application/json" } }),
        ee(`https://api.faceit.com/stats/v1/stats/users/${e}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let d = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const f = await n.value.json();
        d = f.payload || f;
      }
      let y = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const f = await i.value.json();
        y = f.payload || f;
      }
      let _ = null;
      if (u.status === "fulfilled" && u.value.ok) {
        const f = await u.value.json();
        _ = f.payload || f;
      }
      let M = [];
      if (r.status === "fulfilled" && r.value.ok) {
        const f = await r.value.json(), l = f.payload || f;
        M = Array.isArray(l) ? l : l?.items || l?.segments || [];
      }
      return pe(t, a, d, y, _, M);
    } catch (e) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${t}:`, e), null;
    }
  }
}
function we(s) {
  const t = s.teams?.faction1 || s.faction1 || {}, a = s.teams?.faction2 || s.faction2 || {}, e = s.voting?.map?.pick || [], n = e.length > 0 ? e[e.length - 1] : [...s.voting?.map?.entities || []].reverse().find((d) => d.status === "pick")?.name, i = s.configured_server_ip || s.server_ip, r = i && /^[a-zA-Z0-9.\-]+:\d+$/.test(i) ? i : void 0, u = (d) => (d || []).map((y) => ({
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
    selected_map: n,
    server_ip: r
  };
}
const he = new ye();
function Ae(s, t) {
  const a = !s.includes("<privacyState>public</privacyState>"), e = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), n = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), i = {
    steamId64: t,
    personaName: e ? e[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${t}`,
    avatar: n ? n[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let r = 0, u = 0;
  const d = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (d) {
    const l = d[1].split("</mostPlayedGame>");
    for (const w of l)
      if (w.includes("Counter-Strike 2") || w.includes("Counter-Strike: Global Offensive")) {
        const A = w.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        A && (r = parseFloat(A[1].replace(/,/g, "")));
        const h = w.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        h && (u = parseFloat(h[1].replace(/,/g, "")), r === 0 && (r = u));
        break;
      }
  }
  const y = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (y) {
    const l = new Date(y[1]);
    isNaN(l.getTime()) || (i.timeCreated = l.getTime() / 1e3, i.accountAgeYears = (Date.now() - l.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const _ = s.match(/<communityBanned>(.*?)<\/communityBanned>/), M = s.match(/<vacBanned>(.*?)<\/vacBanned>/), f = {
    steamId64: t,
    communityBanned: _ ? _[1] === "1" : !1,
    vacBanned: M ? M[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: i,
    playtime: {
      cs2HoursTotal: r,
      cs2HoursLast2Weeks: u
    },
    bans: f,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
async function ve(s, t = {}, a = 6e3) {
  const e = new AbortController(), n = setTimeout(() => e.abort(), a);
  try {
    return await fetch(s, { ...t, signal: e.signal });
  } finally {
    clearTimeout(n);
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
      const a = await ve(`https://steamcommunity.com/profiles/${t}/?xml=1`);
      if (!a.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const e = await a.text();
      return e.includes("<steamID>") ? Ae(e, t) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Me = new _e();
function Se(s, t) {
  const a = [];
  let e = 0;
  const n = s.totalMatches || 0, i = s.elo || 1e3, r = s.overallKd || 1, u = s.overallWinRate || 50, d = s.recentKd || r, y = s.recentAdr || 75;
  i >= 2200 && n < 100 ? (e += 45, a.push({
    id: "lvl10_extreme_low_matches",
    title: "High Elo on Very Fresh Account",
    description: `${i} Elo achieved in only ${n} matches`,
    weight: 45,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : i >= 2e3 && n < 150 ? (e += 35, a.push({
    id: "lvl10_low_matches",
    title: "Level 10 with Low Matches",
    description: `Level 10 (${i} Elo) in only ${n} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : i >= 1600 && n < 80 ? (e += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${i} Elo achieved in only ${n} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : i >= 1350 && n < 40 ? (e += 18, a.push({
    id: "mid_elo_fresh_account",
    title: "Level 7+ on New Account",
    description: `${i} Elo with only ${n} matches`,
    weight: 18,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : n < 20 ? (e += 10, a.push({
    id: "fresh_faceit_account",
    title: "New FACEIT Account",
    description: `Only ${n} total matches on record`,
    weight: 10,
    severity: "info",
    category: "MATCHES_ELO"
  })) : n >= 800 && (e -= 15), r >= 2 ? (e += 30, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${r.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : r >= 1.6 && n < 200 ? (e += 20, a.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${r.toFixed(2)} with ${n} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : r >= 1.4 && n < 150 ? (e += 12, a.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${r.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : r < 0.95 && n >= 50 && (e -= 10), s.overallAdr !== void 0 && s.overallAdr >= 95 && n < 300 && (e += 22, a.push({
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
  })) : s.overallHsPercent >= 60 && r >= 1.5 && (e += 8, a.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${r.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), u >= 80 && n >= 10 ? (e += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${u.toFixed(0)}% across ${n} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : u >= 70 && n >= 15 ? (e += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${u.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : u >= 62 && n >= 25 && (e += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${u.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), s.last30WinRate !== void 0 && (s.last30Matches ?? 0) >= 5 && (s.last30WinRate >= 85 && n < 300 ? (e += 15, a.push({
    id: "recent_dominance",
    title: "Recent Dominance (85%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 15,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : s.last30WinRate >= 75 && i >= 1500 && (e += 8, a.push({
    id: "elevated_recent_winrate",
    title: "High Recent Win Rate (75%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 8,
    severity: "info",
    category: "WINRATE_ANOMALY"
  }))), d >= 1.75 && d >= r * 1.35 && n >= 10 && (e += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${d.toFixed(2)}) is significantly higher than lifetime baseline (${r.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  })), s.last30Kd !== void 0 && s.last30Kd >= 1.5 && s.last30Kd >= r * 1.3 && n >= 30 && (e += 10, a.push({
    id: "midterm_kd_spike",
    title: "Mid-Term K/D Spike",
    description: `Last 30 games K/D (${s.last30Kd.toFixed(2)}) well above lifetime baseline (${r.toFixed(2)})`,
    weight: 10,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let _ = !0;
  if (t?.fetchError)
    _ = !1;
  else if (t && !t.isPrivate && t.summary) {
    _ = !1;
    const h = t.playtime?.cs2HoursTotal ?? 0;
    h > 0 && h < 150 && i >= 1600 ? (e += 30, a.push({
      id: "low_steam_hours",
      title: "Very Low CS2 Hours for Elo Rating",
      description: `Only ${h}h in CS2 with ${i} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : h > 0 && h < 350 && i >= 2e3 ? (e += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${h}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : h >= 2500 && (e -= 15);
    const F = t.summary.accountAgeYears;
    if (F !== void 0 && F < 1 && i >= 1400 && (e += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${F.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    })), t.bans?.vacBanned || t.bans?.numberOfGameBans) {
      const P = (t.bans.vacBanned ? 1 : 0) + (t.bans.numberOfGameBans || 0), D = 25;
      e += D, a.push({
        id: "steam_ban_history",
        title: "Past Ban on Record",
        description: `Account has ${P} ban(s) on record (${t.bans.daysSinceLastBan || 0} days ago)`,
        weight: D,
        severity: "danger",
        category: "BAN_HISTORY"
      });
    }
  } else if (t?.isPrivate) {
    _ = !0, a.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const h = i >= 2200 ? 25 : i >= 2e3 ? 22 : i >= 1600 ? 15 : i >= 1350 ? 10 : 6;
    h >= 15 && (e += h, a.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${i} Elo`,
      weight: h,
      severity: h >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), n < 100 && (e += 10, a.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${n} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const F = s.last30Kd ?? d;
    F >= 1.6 && (e += 8, a.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${F.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else
    _ = !1;
  const M = s.registrationDate ? new Date(s.registrationDate) : null;
  if (M && !isNaN(M.getTime())) {
    const h = (Date.now() - M.getTime()) / 315576e5;
    h < 0.5 && i >= 1350 ? (e += 22, a.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${h.toFixed(1)} years ago with ${i} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : h < 1 && i >= 1600 && (e += 18, a.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${h.toFixed(1)} years ago with ${i} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const f = Math.min(100, Math.max(0, Math.round(e)));
  let l = "LOW", w = "#10B981", A = "Legit";
  return f >= 70 ? (l = "CRITICAL", w = "#DC2626", A = "High Risk") : f >= 45 ? (l = "HIGH", w = "#EF4444", A = "Likely Smurf") : f >= 25 && (l = "MEDIUM", w = "#F59E0B", A = "Suspicious"), {
    score: f,
    level: l,
    flags: a,
    isPrivateSteam: _,
    summary: `${f}% Smurf Risk (${l})`,
    color: w,
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
function Fe(s, t) {
  const a = [];
  let e = 0;
  const n = [s.teams.faction1, s.teams.faction2];
  for (const i of n) {
    if (!i || !i.roster) continue;
    const r = /* @__PURE__ */ new Map();
    for (const l of i.roster)
      if (l.party_id) {
        const w = r.get(l.party_id) || [];
        w.push(l.player_id), r.set(l.party_id, w);
      }
    const u = /* @__PURE__ */ new Set();
    for (const [, l] of r.entries())
      if (l.length >= 2) {
        const w = String.fromCharCode(65 + e % 26);
        a.push({
          id: `party-${e}`,
          tag: `Party ${w} (${l.length})`,
          color: se[e % se.length],
          playerIds: l
        }), e++, l.forEach((A) => u.add(A));
      }
    const d = i.roster.map((l) => l.player_id).filter((l) => !u.has(l)), y = 15, _ = /* @__PURE__ */ new Map();
    for (const l of d) {
      const w = t[l];
      w?.recentMatches && _.set(l, new Set(w.recentMatches.slice(0, y).map((A) => A.matchId)));
    }
    const M = /* @__PURE__ */ new Set(), f = (l, w) => {
      const A = _.get(l), h = _.get(w);
      if (!A || !h) return !1;
      let F = 0;
      for (const P of A)
        if (h.has(P) && F++, F >= 2) return !0;
      return !1;
    };
    for (const l of d) {
      if (M.has(l)) continue;
      const w = [], A = [l];
      for (M.add(l); A.length > 0; ) {
        const h = A.shift();
        w.push(h);
        for (const F of d)
          !M.has(F) && f(h, F) && (M.add(F), A.push(F));
      }
      if (w.length >= 2) {
        w.forEach((F) => u.add(F));
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
const be = (s) => new Promise((t) => setTimeout(t, s));
async function Ce(s, t, a, e = 150) {
  const n = new Array(s.length);
  let i = 0;
  const r = async () => {
    for (; i < s.length; ) {
      const d = i++;
      n[d] = await a(s[d], d), e > 0 && await be(e);
    }
  }, u = Array.from({ length: Math.min(t, s.length) }, r);
  return await Promise.all(u), n;
}
class Ee {
  settings = { ...oe };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, x.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const t = await x.get("settings");
    return t && (this.settings = { ...oe, ...t }), this.settings;
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
    const { matchId: e, forceRefresh: n } = t, i = `match_analysis:${e}`;
    if (!n) {
      const u = await x.get(i);
      if (u && !u.isPartial)
        return { success: !0, data: u };
    }
    const r = await he.getMatchDetails(e);
    if (!r)
      return { success: !1, error: `Could not fetch match details for ${e}` };
    if (a?.tab?.id && (this.streamSubscribers.has(e) || this.streamSubscribers.set(e, /* @__PURE__ */ new Set()), this.streamSubscribers.get(e).add(a.tab.id)), !this.inFlightStreams.has(e) || n) {
      const u = this.streamLobbyData(e, r, n).finally(() => {
        this.inFlightStreams.delete(e), this.streamSubscribers.delete(e);
      });
      this.inFlightStreams.set(e, u);
    }
    return { success: !0, data: { match: r, isPartial: !0 } };
  }
  async streamLobbyData(t, a, e) {
    try {
      await this.streamLobbyDataInner(t, a, e);
    } catch (n) {
      console.error("[f-insight:Stream] Error:", n), this.broadcastToSubscribers(t, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: t, error: n?.message || "Match analysis stream failed" }
      });
    }
  }
  broadcastToSubscribers(t, a) {
    const e = this.streamSubscribers.get(t);
    if (!(!e || e.size === 0))
      for (const n of e)
        this.safeSendToTab(n, a);
  }
  async streamLobbyDataInner(t, a, e) {
    const n = `match_analysis:${t}`, i = a.teams?.faction1?.roster || [], r = a.teams?.faction2?.roster || [], u = [...i, ...r], d = {}, y = {}, _ = {};
    await Ce(
      u,
      3,
      async (c) => {
        const o = c.player_id;
        if (!o) return;
        const g = `player_stats:${o}`;
        let v = null;
        if (e || (v = await x.get(g)), v || (v = await he.getPlayerStats(o, c.nickname), v && await x.set(g, v, ae.PLAYER_STATS)), v) {
          d[o] = v;
          const b = v.steamId64 || c.game_player_id;
          if (b) {
            const p = `steam_data:${b}`;
            let m = null;
            e || (m = await x.get(p)), m || (m = await Me.getPlayerFullData(b), m && !m.fetchError && await x.set(p, m, ae.STEAM_PROFILE)), m && (y[o] = m);
          }
          _[o] = Se(v, y[o]), this.broadcastToSubscribers(t, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: t, playerId: o, stats: v, steam: y[o], risk: _[o] }
          });
        }
      },
      200
    );
    const M = i.map((c) => d[c.player_id]?.elo || c.elo || 1e3), f = r.map((c) => d[c.player_id]?.elo || c.elo || 1e3), l = M.reduce((c, o) => c + o, 0), w = f.reduce((c, o) => c + o, 0), A = M.length > 0 ? Math.round(l / M.length) : 1e3, h = f.length > 0 ? Math.round(w / f.length) : 1e3, F = A - h, P = me(A, h), D = i.map((c) => d[c.player_id]?.last30Kd ?? d[c.player_id]?.overallKd ?? 1), Y = r.map((c) => d[c.player_id]?.last30Kd ?? d[c.player_id]?.overallKd ?? 1), Q = D.length > 0 ? parseFloat((D.reduce((c, o) => c + o, 0) / D.length).toFixed(2)) : 1, B = Y.length > 0 ? parseFloat((Y.reduce((c, o) => c + o, 0) / Y.length).toFixed(2)) : 1, z = i.map((c) => d[c.player_id]?.overallHsPercent || 0), E = r.map((c) => d[c.player_id]?.overallHsPercent || 0), L = z.length > 0 ? Math.round(z.reduce((c, o) => c + o, 0) / z.length) : 0, J = E.length > 0 ? Math.round(E.reduce((c, o) => c + o, 0) / E.length) : 0, $ = i.map((c) => d[c.player_id]?.last30Adr ?? d[c.player_id]?.overallAdr ?? 75), C = r.map((c) => d[c.player_id]?.last30Adr ?? d[c.player_id]?.overallAdr ?? 75), H = $.length > 0 ? Math.round($.reduce((c, o) => c + o, 0) / $.length) : 75, X = C.length > 0 ? Math.round(C.reduce((c, o) => c + o, 0) / C.length) : 75, Z = i.map((c) => d[c.player_id]).filter(Boolean), R = r.map((c) => d[c.player_id]).filter(Boolean), q = le(Z), O = le(R);
    for (const [c, o] of Object.entries(q))
      d[c] && (d[c].fcrContributionPercent = o);
    for (const [c, o] of Object.entries(O))
      d[c] && (d[c].fcrContributionPercent = o);
    const N = Fe(a, d), U = ue({
      f1AvgElo: A,
      f2AvgElo: h,
      f1Players: Z,
      f2Players: R,
      selectedMap: a.selected_map,
      premadeGroups: N,
      riskAnalysis: _,
      f1Fcr: q,
      f2Fcr: O
    }), j = {
      match: a,
      playersStats: d,
      steamData: y,
      riskAnalysis: _,
      premadeGroups: N,
      teamSummary: {
        faction1: {
          totalElo: l,
          avgElo: A,
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
        eloDifference: Math.abs(F)
      },
      prediction: U,
      isPartial: !1
    };
    await x.set(n, j, ae.MATCH), this.broadcastToSubscribers(t, {
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
