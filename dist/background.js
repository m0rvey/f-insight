const oe = {
  enableRedFlags: !0,
  enableVetoHelper: !0,
  enablePremadeDetection: !0,
  enableFloatingControls: !0,
  compactMode: !1,
  disableOnHomeScreen: !1,
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
  NEGATIVE: 180 * 1e3,
  // 3 minutes for failed / unreachable queries
  SETTINGS: Number.MAX_SAFE_INTEGER
}, re = "settings", fe = 500;
class _e {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= fe) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > fe; ) {
      const t = e.next();
      if (t.done) break;
      t.value !== re && this.memoryCache.delete(t.value);
    }
  }
  async get(e) {
    const t = Date.now(), a = this.memoryCache.get(e);
    if (a) {
      if (t - a.cachedAt < a.ttlMs)
        return this.memoryCache.delete(e), this.memoryCache.set(e, a), a.value;
      this.memoryCache.delete(e);
    }
    if (this.isChromeStorageAvailable())
      try {
        const n = (await chrome.storage.local.get([e]))[e];
        if (n && n.cachedAt && n.ttlMs) {
          if (t - n.cachedAt < n.ttlMs)
            return this.memoryCache.set(e, n), this.enforceMemoryLimit(), n.value;
          await chrome.storage.local.remove([e]);
        }
      } catch (i) {
        console.warn(`[f-insight:Cache] Failed to read ${e} from storage`, i);
      }
    return null;
  }
  async set(e, t, a) {
    const i = {
      value: t,
      cachedAt: Date.now(),
      ttlMs: a
    };
    if (this.memoryCache.delete(e), this.memoryCache.set(e, i), this.enforceMemoryLimit(), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.set({ [e]: i });
      } catch (n) {
        console.warn(`[f-insight:Cache] Failed to save ${e} to storage`, n);
      }
  }
  async remove(e) {
    if (this.memoryCache.delete(e), this.isChromeStorageAvailable())
      try {
        await chrome.storage.local.remove([e]);
      } catch (t) {
        console.warn(`[f-insight:Cache] Failed to remove ${e}`, t);
      }
  }
  async clear() {
    if (this.memoryCache.clear(), this.isChromeStorageAvailable())
      try {
        const e = await chrome.storage.local.get(null), t = Object.keys(e).filter((a) => a !== re);
        t.length > 0 && await chrome.storage.local.remove(t);
      } catch (e) {
        console.warn("[f-insight:Cache] Failed to clear storage", e);
      }
  }
  async cleanup() {
    const e = Date.now();
    for (const [t, a] of this.memoryCache.entries())
      e - a.cachedAt >= a.ttlMs && this.memoryCache.delete(t);
    if (this.isChromeStorageAvailable())
      try {
        const t = await chrome.storage.local.get(null), a = [];
        for (const [i, n] of Object.entries(t)) {
          if (i === re) continue;
          const r = n;
          r && r.cachedAt && r.ttlMs && e - r.cachedAt >= r.ttlMs && a.push(i);
        }
        a.length > 0 && await chrome.storage.local.remove(a);
      } catch (t) {
        console.warn("[f-insight:Cache] Failed to cleanup storage", t);
      }
  }
  async getStats() {
    if (this.isChromeStorageAvailable())
      try {
        const e = await chrome.storage.local.get(null), t = Object.keys(e), a = await chrome.storage.local.getBytesInUse(null);
        return {
          totalEntries: t.length,
          bytesInUse: a,
          keys: t
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
const H = new _e();
function me(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const t = s.map((c) => {
    const w = Number.isFinite(c.elo) ? c.elo : 1e3, _ = Math.max(500, w || 1e3) / 1e3, u = Number.isFinite(c.last30Kd) ? c.last30Kd : Number.isFinite(c.overallKd) ? c.overallKd : 1, d = Math.min(2.5, Math.max(0.4, u ?? 1)), y = 1 + (((Number.isFinite(c.last30Adr) ? c.last30Adr : Number.isFinite(c.overallAdr) ? c.overallAdr : 75) ?? 75) - 75) / 150, S = _ * d * Math.max(0.6, y);
    return { id: c.playerId, power: Number.isFinite(S) && S > 0 ? S : 1 };
  }), a = t.reduce((c, w) => c + w.power, 0), i = Number.isFinite(a) && a > 0 ? a : 0;
  if (i <= 0) {
    const c = parseFloat((100 / s.length).toFixed(1));
    for (const w of t)
      e[w.id] = c;
    return e;
  }
  let n = 0, r = "", p = -1;
  for (const c of t) {
    const w = parseFloat((c.power / i * 100).toFixed(1));
    e[c.id] = w, n += w, w > p && (p = w, r = c.id);
  }
  const o = parseFloat((100 - n).toFixed(1));
  return o !== 0 && r && (e[r] = parseFloat((e[r] + o).toFixed(1))), e;
}
function Se(s, e, t) {
  const a = Number.isFinite(e) ? Math.max(0.5, e) : 1, i = Number.isFinite(t) ? Math.max(20, t) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: a,
      recentAdr: i
    };
  const n = s.slice(0, 5), r = n.filter(
    (u) => typeof u.kills == "number" && Number.isFinite(u.kills) && typeof u.deaths == "number" && Number.isFinite(u.deaths)
  );
  let p = a;
  if (r.length > 0) {
    const u = r.reduce((A, y) => A + (y.kills || 0), 0), d = r.reduce((A, y) => A + (y.deaths || 0), 0);
    p = d > 0 ? parseFloat((u / d).toFixed(2)) : parseFloat(Math.max(a, u / (r.length * 2)).toFixed(2));
  }
  const o = n.map((u) => u.adr).filter((u) => typeof u == "number" && Number.isFinite(u) && u > 0), c = o.length > 0 ? Math.round(o.reduce((u, d) => u + d, 0) / o.length) : i, w = p / a;
  let _ = "STABLE";
  return w >= 1.15 ? _ = "HOT" : w <= 1 / 1.15 && (_ = "COLD"), {
    formStatus: _,
    recentKd: p,
    recentAdr: c
  };
}
function Me(s) {
  const {
    f1Players: e,
    f2Players: t,
    selectedMap: a,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: r,
    f2Fcr: p
  } = s, o = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, c = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, w = o, _ = c, u = _ - w, d = 1 / (1 + Math.pow(10, u / 400));
  let A = 0, y;
  const S = (a || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (S) {
    const g = e.reduce((W, x) => W + (x.mapStats?.[S]?.wins || 0), 0), M = e.reduce((W, x) => W + (x.mapStats?.[S]?.matches || 0), 0), L = t.reduce((W, x) => W + (x.mapStats?.[S]?.wins || 0), 0), N = t.reduce((W, x) => W + (x.mapStats?.[S]?.matches || 0), 0), K = Math.round((g + 2.5) / (M + 5) * 100), q = Math.round((L + 2.5) / (N + 5) * 100), V = K - q;
    M + N >= 10 && (A = Math.max(-0.12, Math.min(0.12, V / 100 * 0.25))), y = {
      leader: V >= 5 ? "faction1" : V <= -5 ? "faction2" : "balanced",
      mapName: S,
      f1WinRate: K,
      f2WinRate: q,
      deltaWinRate: Math.abs(V)
    };
  }
  const f = e.filter((g) => g.formStatus === "HOT").length, F = e.filter((g) => g.formStatus === "COLD").length, R = t.filter((g) => g.formStatus === "HOT").length, B = t.filter((g) => g.formStatus === "COLD").length, G = f - F, U = R - B, O = Math.max(-0.1, Math.min(0.1, (G - U) * 0.03)), se = new Set(e.map((g) => g.playerId)), Z = new Set(t.map((g) => g.playerId));
  let P = 1, I = 1;
  for (const g of i) {
    const M = g.playerIds.filter((N) => se.has(N)).length, L = g.playerIds.filter((N) => Z.has(N)).length;
    M > P && (P = M), L > I && (I = L);
  }
  const ee = Math.max(-0.08, Math.min(0.08, (P - I) * 0.02)), D = e.filter((g) => {
    const M = n[g.playerId]?.level;
    return M === "HIGH" || M === "CRITICAL";
  }).length, $ = t.filter((g) => {
    const M = n[g.playerId]?.level;
    return M === "HIGH" || M === "CRITICAL";
  }).length, z = Math.max(-0.06, Math.min(0.06, (D - $) * 0.02)), Q = d + A + O + ee + z, X = Math.max(0.06, Math.min(0.94, Q)), k = Math.round(X * 100), J = 100 - k;
  let Y = 13, l = 9;
  const v = Math.abs(k - 50), te = v <= 8;
  v <= 8 ? (Y = k >= 50 ? 13 : 11, l = k >= 50 ? 11 : 13) : v <= 16 ? (Y = k >= 50 ? 13 : 8, l = k >= 50 ? 8 : 13) : v <= 26 ? (Y = k >= 50 ? 13 : 5, l = k >= 50 ? 5 : 13) : (Y = k >= 50 ? 13 : 3, l = k >= 50 ? 3 : 13);
  const h = [];
  Math.abs(w - _) >= 60 && h.push(
    w > _ ? `Team 1 holds +${Math.round(w - _)} avg Elo edge` : `Team 2 holds +${Math.round(_ - w)} avg Elo edge`
  ), y && y.deltaWinRate >= 8 && h.push(
    y.leader === "faction1" ? `Team 1 dominates ${y.mapName} (+${y.deltaWinRate}% WR)` : `Team 2 dominates ${y.mapName} (+${y.deltaWinRate}% WR)`
  ), f > R && f >= 2 ? h.push(`Team 1 on hot momentum (${f} players On Fire)`) : R > f && R >= 2 && h.push(`Team 2 on hot momentum (${R} players On Fire)`), P >= 3 && P > I ? h.push(`Team 1 has ${P}-stack coordination`) : I >= 3 && I > P && h.push(`Team 2 has ${I}-stack coordination`), Math.abs(z) >= 0.04 && D + $ > 0 && (D > $ ? h.push(`Team 1 likely carries flagged accounts (${D} risk flagged)`) : $ > D && h.push(`Team 2 likely carries flagged accounts (${$} risk flagged)`));
  const m = h.length > 0 ? h.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", E = (g, M) => {
    let L = g[0], N = -1;
    for (const K of g) {
      const V = (M[K.playerId] || 20) * 1.5 + (K.last30Kd ?? K.overallKd ?? 1) * 10;
      V > N && (N = V, L = K);
    }
    return L ? {
      nickname: L.nickname,
      fcr: M[L.playerId] || 20,
      kd: L.last30Kd ?? L.overallKd ?? 1,
      elo: L.elo || 1e3
    } : void 0;
  }, b = E(e, r), C = E(t, p);
  return {
    winChanceF1: k,
    winChanceF2: J,
    predictedScore: {
      f1Score: Y,
      f2Score: l,
      isOvertimeLikely: te
    },
    keyAdvantageText: m,
    factors: {
      eloDelta: Math.round(w - _),
      mapAdvantage: y,
      momentumAdvantage: {
        leader: G > U ? "faction1" : U > G ? "faction2" : "balanced",
        f1HotCount: f,
        f2HotCount: R,
        f1ColdCount: F,
        f2ColdCount: B
      },
      premadeAdvantage: {
        leader: P > I ? "faction1" : I > P ? "faction2" : "balanced",
        f1MaxPartySize: P,
        f2MaxPartySize: I
      },
      smurfRiskDelta: {
        f1HighRiskCount: D,
        f2HighRiskCount: $,
        impactPercent: Math.round(z * 100)
      }
    },
    starMatchup: b && C ? { f1Star: b, f2Star: C } : void 0
  };
}
const T = (s, ...e) => {
  for (const t of e) {
    const a = s?.[t];
    if (a != null && a !== "") return a;
  }
}, ie = (s, e) => {
  if (s === void 0) return e;
  const t = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(t) ? t : e;
}, j = (s, e) => {
  if (s === void 0) return e;
  const t = parseFloat(s.replace(/[,\s]/g, ""));
  return Number.isFinite(t) ? t : e;
};
function be(s, e, t, a, i, n) {
  const r = t?.games?.cs2 || t?.games?.csgo || {}, p = r.faceit_elo || 1e3, o = r.skill_level || 1, c = r.game_player_id || t?.steam_id_64, w = t?.nickname || e || "Player", _ = t?.avatar || "", u = t?.country || "", d = Array.isArray(a) ? null : a, A = Array.isArray(i) ? null : i, y = d?.lifetime || A?.lifetime || {}, S = Object.keys(y).length > 0, f = ie(T(y, "Total Matches", "Matches", "m1"), 0), F = j(T(y, "Win Rate %", "k6"), 0) ?? 0, R = j(T(y, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, B = j(T(y, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, G = T(y, "ADR", "adr", "c3"), U = G ? j(G, void 0) : void 0, O = {}, se = [
    ...Array.isArray(a) ? a : a?.segments || a?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const h of se) {
    const E = (h._id?.segmentId || h._id?.label || h.label || h.segmentId || h.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (E) {
      const b = ie(T(h.stats, "Matches") ?? T(h, "m1", "matches"), 0), C = j(T(h.stats, "Win Rate %") ?? T(h, "k6", "winRate"), 0) ?? 0, g = j(T(h.stats, "Average K/D Ratio", "K/D Ratio") ?? T(h, "k5", "kd"), 1) ?? 1, M = j(T(h.stats, "Average Headshots %") ?? T(h, "k8", "hsPercent"), 0) ?? 0, L = j(T(h.stats, "Average Kills") ?? T(h, "k1", "avgKills"), 0) ?? 0, N = T(h.stats, "ADR") ?? T(h, "c3", "adr"), K = N ? j(N, void 0) : void 0, q = ie(T(h.stats, "Wins") ?? T(h, "m2", "wins"), Math.round(b * C / 100));
      (!O[E] || b > O[E].matches) && (O[E] = {
        mapName: E,
        matches: b,
        winRate: C,
        kd: g,
        hsPercent: M,
        avgKills: L,
        avgAdr: K,
        wins: q,
        losses: Math.max(0, b - q)
      });
    }
  }
  const Z = [];
  let P = 0, I = "NONE", ee = !0;
  const D = {};
  if (Array.isArray(n))
    for (let h = 0; h < n.length; h++) {
      const m = n[h], E = m.i10 === "1" || m.result === "1" || m.stats?.Result === "1" || m.stats?.Win === "1", b = E ? "W" : "L";
      h === 0 ? (I = b, P = 1) : ee && (b === I ? P++ : ee = !1);
      const C = (m.i1 || m.stats?.Map || m.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), g = ie(m.i6 ?? m.stats?.Kills ?? m.kills, 0), M = ie(m.i8 ?? m.stats?.Deaths ?? m.deaths, 0), L = m.c3 || m.stats?.ADR || m.adr, N = L ? j(L, void 0) : void 0, K = m.c4 || m.stats?.["Headshots %"], q = K ? j(K, void 0) : void 0;
      C && (D[C] || (D[C] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), D[C].matches++, E && D[C].wins++, D[C].kills += g, D[C].deaths += M, N !== void 0 && (D[C].adrSum += N, D[C].adrCount++));
      const V = m.elo ? parseInt(m.elo.toString().replace(/,/g, ""), 10) : m.i15 ? parseInt(m.i15, 10) : void 0;
      let W;
      if (h < n.length - 1 && V) {
        const x = n[h + 1], he = x?.elo ? parseInt(x.elo.toString().replace(/,/g, ""), 10) : x?.i15 ? parseInt(x.i15, 10) : void 0;
        if (typeof he == "number" && !isNaN(he)) {
          const de = V - he;
          Math.abs(de) <= 60 && (W = de);
        }
      }
      W === void 0 && (W = E ? 25 : -25), Z.push({
        matchId: m.matchId || m.i0 || `match-${h}`,
        playedAt: m.date || m.created_at || 0,
        map: C,
        result: b,
        score: m.i18 || m.stats?.Score || "13:0",
        kills: g,
        deaths: M,
        kd: parseFloat(m.c2 || m.stats?.["K/D Ratio"] || (M > 0 ? (g / M).toFixed(2) : g.toFixed(2))),
        hsPercent: q,
        adr: N,
        elo: V,
        eloDiff: W
      });
    }
  for (const [h, m] of Object.entries(D))
    if (!O[h] || O[h].matches === 0) {
      const E = m.matches, b = m.wins, C = E > 0 ? Math.round(b / E * 100) : 50, g = m.deaths > 0 ? parseFloat((m.kills / m.deaths).toFixed(2)) : 1, M = m.adrCount > 0 ? Math.round(m.adrSum / m.adrCount) : void 0;
      O[h] = {
        mapName: h,
        matches: E,
        winRate: C,
        kd: g,
        hsPercent: B,
        avgKills: E > 0 ? parseFloat((m.kills / E).toFixed(1)) : 15,
        avgAdr: M,
        wins: b,
        losses: E - b
      };
    }
  const $ = Z.slice(0, 30), z = $.length;
  let Q, X, k = 0, J, Y;
  if (z > 0) {
    const h = $.reduce((g, M) => g + (M.kills || 0), 0), m = $.reduce((g, M) => g + (M.deaths || 0), 0);
    Q = m > 0 ? parseFloat((h / m).toFixed(2)) : void 0;
    const E = $.map((g) => g.adr).filter((g) => g !== void 0 && g > 0);
    k = E.length, X = E.length > 0 ? Math.round(E.reduce((g, M) => g + M, 0) / E.length) : void 0;
    const b = $.map((g) => g.hsPercent).filter((g) => g !== void 0);
    J = b.length > 0 ? Math.round(b.reduce((g, M) => g + M, 0) / b.length) : void 0;
    const C = $.filter((g) => g.result === "W").length;
    Y = Math.round(C / z * 100);
  }
  const { formStatus: l, recentKd: v, recentAdr: te } = Se(Z, R, U);
  return {
    playerId: s,
    nickname: w,
    avatar: _,
    country: u,
    steamId64: c,
    elo: Number.isFinite(p) ? p : 1e3,
    skillLevel: Number.isFinite(o) ? o : 1,
    totalMatches: f,
    overallWinRate: F,
    overallKd: R,
    overallHsPercent: B,
    overallAdr: U,
    statsAvailable: S,
    last30Kd: Q,
    last30Adr: X,
    last30AdrMatches: k,
    last30HsPercent: J,
    last30WinRate: Y,
    last30Matches: z,
    currentStreak: {
      type: I,
      count: P
    },
    recentMatches: Z,
    mapStats: O,
    registrationDate: t?.created_at,
    formStatus: l,
    recentKd: v,
    recentAdr: te
  };
}
const we = (s) => new Promise((e) => setTimeout(e, s));
async function Fe(s, e = {}, t = 8e3) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
const Ee = 120;
let ge = 0, ue = Promise.resolve();
function ye(s, e) {
  const t = async () => {
    const i = ge + Ee - Date.now();
    return i > 0 && await we(i), ge = Date.now(), Fe(s, { headers: { Accept: "application/json" } }, e);
  }, a = ue.then(t, t);
  return ue = a.catch(() => {
  }), a;
}
async function ne(s, e = 8e3) {
  let t = await ye(s, e);
  if (t.status === 429 || t.status === 503 || t.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${t.status} from ${new URL(s).pathname} — backing off once`), await we(1400 + Math.floor(Math.random() * 600));
    try {
      t = await ye(s, e);
    } catch {
    }
  }
  return t;
}
class Ce {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !/^[a-zA-Z0-9.\-_]+$/.test(e)) return null;
    const t = await H.get(
      `intercepted_match:${e}`
    );
    if (t) return t;
    if (this.inFlightMatch.has(e))
      return this.inFlightMatch.get(e);
    const a = this.fetchMatchDetailsInternal(e).finally(() => {
      this.inFlightMatch.delete(e);
    });
    return this.inFlightMatch.set(e, a), a;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const t = await ne(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`);
      if (!t.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${t.status}`), null;
      const a = await t.json(), i = a.payload || a;
      return Ae(i);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, t), null;
    }
  }
  async getPlayerStats(e, t) {
    if (!e || !/^[a-zA-Z0-9.\-_]+$/.test(e)) return null;
    const a = `${e}_${t || ""}`;
    if (this.inFlightPlayer.has(a))
      return this.inFlightPlayer.get(a);
    const i = this.fetchPlayerStatsInternal(e, t).finally(() => {
      this.inFlightPlayer.delete(a);
    });
    return this.inFlightPlayer.set(a, i), i;
  }
  async fetchPlayerStatsInternal(e, t) {
    try {
      const a = encodeURIComponent(e), [i, n, r] = await Promise.allSettled([
        ne(`https://api.faceit.com/users/v1/users/${a}`),
        ne(`https://api.faceit.com/stats/v1/stats/users/${a}/games/cs2`),
        ne(`https://api.faceit.com/stats/v1/stats/time/users/${a}/games/cs2?size=30`)
      ]);
      let p = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const u = await i.value.json();
        p = u.payload || u;
      }
      let o = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const u = await n.value.json();
        o = u.payload || u;
      }
      let c = [];
      if (r.status === "fulfilled" && r.value.ok) {
        const u = await r.value.json(), d = u.payload || u;
        c = Array.isArray(d) ? d : d?.items || d?.segments || [];
      }
      let w = null;
      if (!(!!(o?.lifetime && Object.keys(o.lifetime).length > 0) || Array.isArray(o?.segments) && o.segments.length > 0 || c.length > 0))
        try {
          const u = await ne(`https://api.faceit.com/stats/v1/stats/users/${a}/games/csgo`);
          if (u.ok) {
            const d = await u.json();
            w = d.payload || d;
          }
        } catch {
        }
      return be(e, t, p, o, w, c);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, a), null;
    }
  }
}
const Te = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Re(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return Te.includes(e) ? e : "VOTING";
}
function Ae(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, t = s.teams?.faction2 || s.faction2 || {}, a = s.voting?.map?.pick || [], i = a.length > 0 ? a[a.length - 1] : [...s.voting?.map?.entities || []].reverse().find((o) => o.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, r = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, p = (o) => (o || []).map((c) => ({
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
    match_id: s.id || s.match_id,
    game: s.game || "cs2",
    region: s.region || "EU",
    status: Re(s.status),
    configured_at: s.configured_at,
    started_at: s.started_at,
    finished_at: s.finished_at,
    teams: {
      faction1: {
        faction_id: e.id || e.faction_id || "faction1",
        name: e.name || "Team 1",
        avatar: e.avatar,
        leader: e.leader,
        roster: p(e.roster)
      },
      faction2: {
        faction_id: t.id || t.faction_id || "faction2",
        name: t.name || "Team 2",
        avatar: t.avatar,
        leader: t.leader,
        roster: p(t.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: r
  };
}
const pe = new Ce();
function Pe(s, e) {
  const t = !s.includes("<privacyState>public</privacyState>"), a = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: a ? a[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: t ? 1 : 3
  };
  let r = 0, p = 0;
  const o = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (o) {
    const d = o[1].split("</mostPlayedGame>");
    for (const A of d)
      if (A.includes("Counter-Strike 2") || A.includes("Counter-Strike: Global Offensive")) {
        const y = A.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        y && (r = parseFloat(y[1].replace(/,/g, "")));
        const S = A.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        S && (p = parseFloat(S[1].replace(/,/g, "")), r === 0 && (r = p));
        break;
      }
  }
  const c = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (c) {
    const d = new Date(c[1]);
    isNaN(d.getTime()) || (n.timeCreated = d.getTime() / 1e3, n.accountAgeYears = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const w = s.match(/<communityBanned>(.*?)<\/communityBanned>/), _ = s.match(/<vacBanned>(.*?)<\/vacBanned>/), u = {
    steamId64: e,
    communityBanned: w ? w[1] === "1" : !1,
    vacBanned: _ ? _[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: r,
      cs2HoursLast2Weeks: p
    },
    bans: u,
    isPrivate: t,
    fetchedAt: Date.now()
  };
}
async function Ie(s, e = {}, t = 6e3) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
class De {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(e) {
    if (!e || !/^\d{5,25}$/.test(e))
      return { isPrivate: !1, fetchError: !0, fetchedAt: Date.now() };
    if (this.inFlightSteam.has(e))
      return this.inFlightSteam.get(e);
    const t = this.fetchSteamDataInternal(e).finally(() => {
      this.inFlightSteam.delete(e);
    });
    return this.inFlightSteam.set(e, t), t;
  }
  async fetchSteamDataInternal(e) {
    try {
      const t = await Ie(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!t.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const a = await t.text();
      return a.includes("<steamID>") ? Pe(a, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const ke = new De();
function Le(s, e) {
  const t = [];
  let a = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, r = s.overallKd || 1, p = s.overallWinRate || 50, o = s.recentKd || r, c = s.recentAdr || 75, w = s.statsAvailable !== !1;
  w && (n >= 2200 && i < 100 ? (a += 45, t.push({
    id: "lvl10_extreme_low_matches",
    title: "High Elo on Very Fresh Account",
    description: `${n} Elo achieved in only ${i} matches`,
    weight: 45,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 2e3 && i < 150 ? (a += 35, t.push({
    id: "lvl10_low_matches",
    title: "Level 10 with Low Matches",
    description: `Level 10 (${n} Elo) in only ${i} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 1600 && i < 80 ? (a += 25, t.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${n} Elo achieved in only ${i} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : n >= 1350 && i < 40 ? (a += 18, t.push({
    id: "mid_elo_fresh_account",
    title: "Level 7+ on New Account",
    description: `${n} Elo with only ${i} matches`,
    weight: 18,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : i < 20 ? (a += 10, t.push({
    id: "fresh_faceit_account",
    title: "New FACEIT Account",
    description: `Only ${i} total matches on record`,
    weight: 10,
    severity: "info",
    category: "MATCHES_ELO"
  })) : i >= 800 && (a -= 15)), w && r >= 2 ? (a += 30, t.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${r.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : r >= 1.6 && i < 200 ? (a += 20, t.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${r.toFixed(2)} with ${i} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : r >= 1.4 && i < 150 ? (a += 12, t.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${r.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : r < 0.95 && i >= 50 && (a -= 10), w && s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (a += 22, t.push({
    id: "extreme_adr",
    title: "Exceptional Average Damage (95+)",
    description: `Lifetime ADR of ${s.overallAdr.toFixed(0)} is far above the typical range`,
    weight: 22,
    severity: "danger",
    category: "ADR_ANOMALY"
  })), s.last30Adr !== void 0 && s.last30Adr >= 100 && (s.last30AdrMatches ?? 0) >= 3 && (a += 18, t.push({
    id: "recent_extreme_adr",
    title: "Recent ADR Anomaly (100+)",
    description: `ADR of ${s.last30Adr} across the last 30 matches`,
    weight: 18,
    severity: "warning",
    category: "ADR_ANOMALY"
  })), c >= 95 && s.overallAdr !== void 0 && c >= s.overallAdr * 1.2 && (a += 12, t.push({
    id: "recent_adr_spike",
    title: "Recent ADR Spike",
    description: `Last 5 games ADR (${c}) is 20%+ above lifetime baseline (${s.overallAdr.toFixed(0)})`,
    weight: 12,
    severity: "warning",
    category: "ADR_ANOMALY"
  })), (s.last30HsPercent ?? 0) >= 60 ? (a += 10, t.push({
    id: "extreme_hs_recent",
    title: "Extreme Headshot Rate (60%+)",
    description: `Average ${s.last30HsPercent}% headshots over the last 30 matches`,
    weight: 10,
    severity: "warning",
    category: "HS_ANOMALY"
  })) : s.overallHsPercent >= 60 && r >= 1.5 && (a += 8, t.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${r.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), w && p >= 80 && i >= 10 ? (a += 30, t.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${p.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : p >= 70 && i >= 15 ? (a += 20, t.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${p.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : p >= 62 && i >= 25 && (a += 10, t.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${p.toFixed(0)}%`,
    weight: 10,
    severity: "info",
    category: "WINRATE_ANOMALY"
  })), s.last30WinRate !== void 0 && (s.last30Matches ?? 0) >= 5 && (s.last30WinRate >= 85 && i < 300 ? (a += 15, t.push({
    id: "recent_dominance",
    title: "Recent Dominance (85%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 15,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : s.last30WinRate >= 75 && n >= 1500 && (a += 8, t.push({
    id: "elevated_recent_winrate",
    title: "High Recent Win Rate (75%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 8,
    severity: "info",
    category: "WINRATE_ANOMALY"
  }))), o >= 1.75 && o >= r * 1.35 && i >= 10 && (a += 15, t.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${o.toFixed(2)}) is significantly higher than lifetime baseline (${r.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  })), s.last30Kd !== void 0 && s.last30Kd >= 1.5 && s.last30Kd >= r * 1.3 && i >= 30 && (a += 10, t.push({
    id: "midterm_kd_spike",
    title: "Mid-Term K/D Spike",
    description: `Last 30 games K/D (${s.last30Kd.toFixed(2)}) well above lifetime baseline (${r.toFixed(2)})`,
    weight: 10,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let _ = !0;
  if (!e || e.fetchError)
    _ = !1;
  else if (e.isPrivate) {
    _ = !0, t.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const f = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    f >= 15 && (a += f, t.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: f,
      severity: f >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), w && i < 100 && (a += 10, t.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const F = s.last30Kd ?? o;
    F >= 1.6 && (a += 8, t.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${F.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (_ = !1, e.summary) {
    const f = e.playtime?.cs2HoursTotal !== void 0, F = f ? e.playtime.cs2HoursTotal ?? 0 : 0, R = f && F === 0;
    F > 0 && F < 150 && n >= 1600 || R && n >= 1600 ? (a += 30, t.push({
      id: "low_steam_hours",
      title: R ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
      description: `Only ${F}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : F > 0 && F < 350 && n >= 2e3 ? (a += 20, t.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${F}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : f && F >= 2500 && (a -= 15);
    const B = e.summary.accountAgeYears;
    B !== void 0 && B < 1 && n >= 1400 && (a += 18, t.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${B.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const f = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), F = 25;
    a += F, t.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${f} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: F,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const u = s.registrationDate ? new Date(s.registrationDate) : null;
  if (u && !isNaN(u.getTime())) {
    const f = (Date.now() - u.getTime()) / 315576e5;
    f < 0.5 && n >= 1350 ? (a += 22, t.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${f.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : f < 1 && n >= 1600 && (a += 18, t.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${f.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const d = Math.min(100, Math.max(0, Math.round(a)));
  let A = "LOW", y = "#10B981", S = "Legit";
  return d >= 70 ? (A = "CRITICAL", y = "#DC2626", S = "High Risk") : d >= 45 ? (A = "HIGH", y = "#EF4444", S = "Likely Smurf") : d >= 25 && (A = "MEDIUM", y = "#F59E0B", S = "Suspicious"), {
    score: d,
    level: A,
    flags: t,
    isPrivateSteam: _,
    summary: `${d}% Smurf Risk (${A})`,
    color: y,
    badgeText: S
  };
}
const ce = [
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
function $e(s, e) {
  const t = [];
  let a = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const r = /* @__PURE__ */ new Map();
    for (const d of n.roster)
      if (d.party_id) {
        const A = r.get(d.party_id) || [];
        A.push(d.player_id), r.set(d.party_id, A);
      }
    const p = /* @__PURE__ */ new Set();
    for (const [, d] of r.entries())
      if (d.length >= 2) {
        const A = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${A} (${d.length})`,
          color: ce[a % ce.length],
          playerIds: d
        }), a++, d.forEach((y) => p.add(y));
      }
    const o = n.roster.map((d) => d.player_id).filter((d) => !p.has(d)), c = 15, w = /* @__PURE__ */ new Map();
    for (const d of o) {
      const A = e[d];
      A?.recentMatches && w.set(d, new Set(A.recentMatches.slice(0, c).map((y) => y.matchId)));
    }
    const _ = /* @__PURE__ */ new Set(), u = (d, A) => {
      const y = w.get(d), S = w.get(A);
      if (!y || !S) return !1;
      let f = 0;
      for (const F of y)
        if (S.has(F) && f++, f >= 2) return !0;
      return !1;
    };
    for (const d of o) {
      if (_.has(d)) continue;
      const A = [], y = [d];
      for (_.add(d); y.length > 0; ) {
        const S = y.shift();
        A.push(S);
        for (const f of o)
          !_.has(f) && u(S, f) && (_.add(f), y.push(f));
      }
      if (A.length >= 2) {
        A.forEach((f) => p.add(f));
        const S = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${S} (${A.length})`,
          color: ce[a % ce.length],
          playerIds: A
        }), a++;
      }
    }
  }
  return t;
}
const Ne = (s) => new Promise((e) => setTimeout(e, s));
async function He(s, e, t, a = 150) {
  const i = new Array(s.length);
  let n = 0;
  const r = async () => {
    for (; n < s.length; ) {
      const o = n++;
      i[o] = await t(s[o], o), a > 0 && await Ne(a);
    }
  }, p = Array.from({ length: Math.min(e, s.length) }, r);
  return await Promise.all(p), i;
}
class Oe {
  settings = { ...oe };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, H.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const e = await H.get(re);
    return e && (this.settings = { ...oe, ...e }), this.settings;
  }
  async handleMessage(e, t) {
    try {
      switch (e.type) {
        case "GET_SETTINGS":
          return this.handleGetSettings();
        case "SAVE_SETTINGS":
          return this.handleSaveSettings(e.payload);
        case "FETCH_LOBBY_INSIGHT":
          return this.handleFetchLobbyInsight(e.payload, t);
        case "INTERCEPTED_MATCH_PAYLOAD":
          return this.handleInterceptedMatchPayload(e.payload);
        case "GET_CACHE_STATS":
          return this.handleGetCacheStats();
        case "CLEAR_CACHE":
          return this.handleClearCache();
        default:
          return { success: !1, error: "Unknown message type" };
      }
    } catch (a) {
      return console.error("[f-insight:Background] Message handler error:", a), { success: !1, error: a.message || "Internal error" };
    }
  }
  async handleGetSettings() {
    return { success: !0, data: await this.loadSettings() };
  }
  /**
   * Consumes a match payload intercepted from FACEIT's own page traffic.
   * Parsed details are cached under `intercepted_match:*` — getMatchDetails
   * serves that cache first, so the regular analysis flow runs without
   * spending any of our api.faceit.com request budget.
   */
  async handleInterceptedMatchPayload(e) {
    try {
      const t = typeof e?.matchId == "string" ? e.matchId : "";
      if (!t || !/^[a-zA-Z0-9\-_]+$/.test(t))
        return { success: !1, error: "Invalid intercepted matchId" };
      if (!e?.body || typeof e.body != "object")
        return { success: !1, error: "Invalid intercepted match body" };
      const a = e.body.payload ?? e.body, i = Ae(a);
      return await H.set(`intercepted_match:${t}`, i, ae.MATCH), { success: !0, data: { status: i.status } };
    } catch (t) {
      return console.warn("[f-insight:Background] Intercepted match payload rejected:", t?.message || t), { success: !1, error: t?.message || "Intercepted payload parse failed" };
    }
  }
  async handleSaveSettings(e) {
    const t = {};
    for (const a of Object.keys(oe))
      if (e && typeof e == "object" && a in e) {
        const i = oe[a], n = e[a];
        typeof n == typeof i && (t[a] = n);
      }
    return this.settings = { ...this.settings, ...t }, await H.set(re, this.settings, ae.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, t) {
    const { matchId: a, forceRefresh: i } = e, n = `match_analysis:${a}`;
    if (!i) {
      const p = await H.get(n);
      if (p && !p.isPartial)
        return { success: !0, data: p };
    }
    const r = await pe.getMatchDetails(a);
    if (!r)
      return { success: !1, error: `Could not fetch match details for ${a}` };
    if (t?.tab?.id && (this.streamSubscribers.has(a) || this.streamSubscribers.set(a, /* @__PURE__ */ new Set()), this.streamSubscribers.get(a).add(t.tab.id)), !this.inFlightStreams.has(a) || i) {
      const p = this.streamLobbyData(a, r, i).finally(() => {
        this.inFlightStreams.get(a) === p && this.inFlightStreams.delete(a), this.streamSubscribers.delete(a);
      });
      this.inFlightStreams.set(a, p);
    }
    return { success: !0, data: { match: r, isPartial: !0 } };
  }
  async streamLobbyData(e, t, a) {
    try {
      await this.streamLobbyDataInner(e, t, a);
    } catch (i) {
      console.error("[f-insight:Stream] Error:", i), this.broadcastToSubscribers(e, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: e, error: i?.message || "Match analysis stream failed" }
      });
    }
  }
  broadcastToSubscribers(e, t) {
    const a = this.streamSubscribers.get(e);
    if (!(!a || a.size === 0))
      for (const i of a)
        this.safeSendToTab(i, t);
  }
  async streamLobbyDataInner(e, t, a) {
    const i = `match_analysis:${e}`, n = t.teams?.faction1?.roster || [], r = t.teams?.faction2?.roster || [], p = [...n, ...r], o = {}, c = {}, w = {};
    await He(
      p,
      3,
      async (l) => {
        const v = l.player_id;
        if (!v) return;
        const te = `player_stats:${v}`;
        let h = null;
        if (a || (h = await H.get(te)), !h && (h = await pe.getPlayerStats(v, l.nickname), h)) {
          const m = h.statsAvailable === !1 ? ae.NEGATIVE : ae.PLAYER_STATS;
          await H.set(te, h, m);
        }
        if (h) {
          o[v] = h;
          const m = h.steamId64 || l.game_player_id;
          if (m) {
            const E = `steam_data:${m}`;
            let b = null;
            a || (b = await H.get(E)), b || (b = await ke.getPlayerFullData(m), b && !b.fetchError && await H.set(E, b, ae.STEAM_PROFILE)), b && (c[v] = b);
          }
          w[v] = Le(h, c[v]), this.broadcastToSubscribers(e, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: v, stats: h, steam: c[v], risk: w[v] }
          });
        }
      },
      200
    );
    const _ = n.map((l) => o[l.player_id]?.elo || l.elo || 1e3), u = r.map((l) => o[l.player_id]?.elo || l.elo || 1e3), d = _.reduce((l, v) => l + v, 0), A = u.reduce((l, v) => l + v, 0), y = _.length > 0 ? Math.round(d / _.length) : 1e3, S = u.length > 0 ? Math.round(A / u.length) : 1e3, f = y - S, F = n.map((l) => o[l.player_id]?.last30Kd ?? o[l.player_id]?.overallKd ?? 1), R = r.map((l) => o[l.player_id]?.last30Kd ?? o[l.player_id]?.overallKd ?? 1), B = F.length > 0 ? parseFloat((F.reduce((l, v) => l + v, 0) / F.length).toFixed(2)) : 1, G = R.length > 0 ? parseFloat((R.reduce((l, v) => l + v, 0) / R.length).toFixed(2)) : 1, U = n.map((l) => o[l.player_id]?.overallHsPercent || 0), O = r.map((l) => o[l.player_id]?.overallHsPercent || 0), se = U.length > 0 ? Math.round(U.reduce((l, v) => l + v, 0) / U.length) : 0, Z = O.length > 0 ? Math.round(O.reduce((l, v) => l + v, 0) / O.length) : 0, P = n.map((l) => o[l.player_id]?.last30Adr ?? o[l.player_id]?.overallAdr ?? 75), I = r.map((l) => o[l.player_id]?.last30Adr ?? o[l.player_id]?.overallAdr ?? 75), ee = P.length > 0 ? Math.round(P.reduce((l, v) => l + v, 0) / P.length) : 75, D = I.length > 0 ? Math.round(I.reduce((l, v) => l + v, 0) / I.length) : 75, $ = n.map((l) => o[l.player_id]).filter(Boolean), z = r.map((l) => o[l.player_id]).filter(Boolean), Q = me($), X = me(z);
    for (const [l, v] of Object.entries(Q))
      o[l] && (o[l].fcrContributionPercent = v);
    for (const [l, v] of Object.entries(X))
      o[l] && (o[l].fcrContributionPercent = v);
    const k = $e(t, o), J = Me({
      f1AvgElo: y,
      f2AvgElo: S,
      f1Players: $,
      f2Players: z,
      selectedMap: t.selected_map,
      premadeGroups: k,
      riskAnalysis: w,
      f1Fcr: Q,
      f2Fcr: X
    }), Y = {
      match: t,
      playersStats: o,
      steamData: c,
      riskAnalysis: w,
      premadeGroups: k,
      teamSummary: {
        faction1: {
          totalElo: d,
          avgElo: y,
          winChancePercent: J.winChanceF1,
          avgKd: B,
          avgHsPercent: se,
          avgAdr: ee
        },
        faction2: {
          totalElo: A,
          avgElo: S,
          winChancePercent: J.winChanceF2,
          avgKd: G,
          avgHsPercent: Z,
          avgAdr: D
        },
        eloDifference: Math.abs(f)
      },
      prediction: J,
      isPartial: !1
    };
    await H.set(i, Y, ae.MATCH), this.broadcastToSubscribers(e, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: Y
    });
  }
  safeSendToTab(e, t) {
    chrome.tabs.sendMessage(e, t).catch((a) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", a?.message || a);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await H.getStats() };
  }
  async handleClearCache() {
    return await H.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const le = new Oe(), ve = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), ve(), await le.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), ve(), await le.init();
});
chrome.runtime.onMessage.addListener((s, e, t) => (le.init().then(() => le.handleMessage(s, e)).then(t).catch((a) => {
  console.error("[f-insight:Background] Message handling failed:", a);
  try {
    t({ success: !1, error: a?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await H.cleanup());
});
