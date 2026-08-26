const ge = {
  enableRedFlags: !0,
  enableVetoHelper: !0,
  enablePremadeDetection: !0,
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
}, q = {
  /** Minimum gap between any two api.faceit.com requests (tail-chained queue) */
  MIN_REQUEST_INTERVAL_MS: 400,
  /** Backoff cooldown injected into shared gate on 429/503/403 */
  BACKOFF_COOLDOWN_MS: 2e3,
  /** Base retry delay after throttle (plus jitter) */
  BACKOFF_RETRY_BASE_MS: 2500,
  /** Max jitter added to backoff retry */
  BACKOFF_RETRY_JITTER_MS: 2e3,
  /** Abort timeout for FACEIT API fetches */
  REQUEST_TIMEOUT_MS: 8e3,
  /** Regex for valid matchId/playerId (shared with interceptRules, steamApi) */
  ID_PATTERN: /^[a-zA-Z0-9.\-_]+$/,
  /** Valid room id pattern (allow hyphen) */
  ROOM_ID_PATTERN: /^[a-zA-Z0-9\-_]+$/
}, Ce = {
  REQUEST_TIMEOUT_MS: 6e3,
  STEAM_ID_PATTERN: /^\d{5,25}$/
}, se = {
  MAX_MEMORY_ENTRIES: 500,
  TTL: {
    /** Lobby analysis (match_analysis:*) */
    MATCH_MS: 180 * 1e3,
    /** Player stats (player_stats:*) */
    PLAYER_STATS_MS: 3600 * 1e3,
    /** Steam profile */
    STEAM_PROFILE_MS: 1440 * 60 * 1e3,
    /** Negative / partial payloads (also used for intercept staging ×3) */
    NEGATIVE_MS: 180 * 1e3,
    /** Settings never expire */
    SETTINGS_MS: Number.MAX_SAFE_INTEGER,
    /** Observed map pool */
    OBSERVED_MAPS_MS: 1440 * 60 * 1e3,
    /** Intercept staging window = NEGATIVE × factor */
    INTERCEPT_STAGE_FACTOR: 3
  }
}, ve = {
  /** Concurrent player fetches in streamLobbyData */
  CONCURRENCY: 2,
  /** Delay between players in the concurrency pool */
  CONCURRENCY_DELAY_MS: 400,
  /** Default delay in mapWithConcurrency (fallback) */
  MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS: 150
}, Z = {
  MATCH: se.TTL.MATCH_MS,
  PLAYER_STATS: se.TTL.PLAYER_STATS_MS,
  STEAM_PROFILE: se.TTL.STEAM_PROFILE_MS,
  NEGATIVE: se.TTL.NEGATIVE_MS,
  SETTINGS: se.TTL.SETTINGS_MS
}, he = "settings", Se = se.MAX_MEMORY_ENTRIES;
class Le {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= Se) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > Se; ) {
      const t = e.next();
      if (t.done) break;
      t.value !== he && this.memoryCache.delete(t.value);
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
        const e = await chrome.storage.local.get(null), t = Object.keys(e).filter((a) => a !== he);
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
          if (i === he) continue;
          const o = n;
          o && o.cachedAt && o.ttlMs && e - o.cachedAt >= o.ttlMs && a.push(i);
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
const C = new Le();
function Me(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const t = s.map((r) => {
    const p = Number.isFinite(r.elo) ? r.elo : 1e3, _ = Math.max(500, p || 1e3) / 1e3, f = Number.isFinite(r.last30Kd) ? r.last30Kd : Number.isFinite(r.overallKd) ? r.overallKd : 1, d = Math.min(2.5, Math.max(0.4, f ?? 1)), A = 1 + (((Number.isFinite(r.last30Adr) ? r.last30Adr : Number.isFinite(r.overallAdr) ? r.overallAdr : 75) ?? 75) - 75) / 150, M = _ * d * Math.max(0.6, A);
    return { id: r.playerId, power: Number.isFinite(M) && M > 0 ? M : 1 };
  }), a = t.reduce((r, p) => r + p.power, 0), i = Number.isFinite(a) && a > 0 ? a : 0;
  if (i <= 0) {
    const r = parseFloat((100 / s.length).toFixed(1));
    for (const p of t)
      e[p.id] = r;
    return e;
  }
  let n = 0, o = "", g = -1;
  for (const r of t) {
    const p = parseFloat((r.power / i * 100).toFixed(1));
    e[r.id] = p, n += p, p > g && (g = p, o = r.id);
  }
  const y = parseFloat((100 - n).toFixed(1));
  return y !== 0 && o && (e[o] = parseFloat((e[o] + y).toFixed(1))), e;
}
function ke(s, e, t) {
  const a = Number.isFinite(e) ? Math.max(0.5, e) : 1, i = Number.isFinite(t) ? Math.max(20, t) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: a,
      recentAdr: i
    };
  const n = s.slice(0, 5), o = n.filter(
    (f) => typeof f.kills == "number" && Number.isFinite(f.kills) && typeof f.deaths == "number" && Number.isFinite(f.deaths)
  );
  let g = a;
  if (o.length > 0) {
    const f = o.reduce((w, A) => w + (A.kills || 0), 0), d = o.reduce((w, A) => w + (A.deaths || 0), 0);
    g = d > 0 ? parseFloat((f / d).toFixed(2)) : parseFloat(Math.max(a, f / (o.length * 2)).toFixed(2));
  }
  const y = n.map((f) => f.adr).filter((f) => typeof f == "number" && Number.isFinite(f) && f > 0), r = y.length > 0 ? Math.round(y.reduce((f, d) => f + d, 0) / y.length) : i, p = g / a;
  let _ = "STABLE";
  return p >= 1.15 ? _ = "HOT" : p <= 1 / 1.15 && (_ = "COLD"), {
    formStatus: _,
    recentKd: g,
    recentAdr: r
  };
}
function $e(s) {
  const {
    f1Players: e,
    f2Players: t,
    selectedMap: a,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: g
  } = s, y = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, r = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, p = y, _ = r, f = _ - p, d = 1 / (1 + Math.pow(10, f / 400));
  let w = 0, A;
  const M = (a || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (M) {
    const u = e.reduce((K, X) => K + (X.mapStats?.[M]?.wins || 0), 0), E = e.reduce((K, X) => K + (X.mapStats?.[M]?.matches || 0), 0), P = t.reduce((K, X) => K + (X.mapStats?.[M]?.wins || 0), 0), k = t.reduce((K, X) => K + (X.mapStats?.[M]?.matches || 0), 0), U = Math.round((u + 2.5) / (E + 5) * 100), Y = Math.round((P + 2.5) / (k + 5) * 100), j = U - Y;
    E + k >= 10 && (w = Math.max(-0.12, Math.min(0.12, j / 100 * 0.25))), A = {
      leader: j >= 5 ? "faction1" : j <= -5 ? "faction2" : "balanced",
      mapName: M,
      f1WinRate: U,
      f2WinRate: Y,
      deltaWinRate: Math.abs(j)
    };
  }
  const l = e.filter((u) => u.formStatus === "HOT").length, F = e.filter((u) => u.formStatus === "COLD").length, N = t.filter((u) => u.formStatus === "HOT").length, G = t.filter((u) => u.formStatus === "COLD").length, V = l - F, z = N - G, W = Math.max(-0.1, Math.min(0.1, (V - z) * 0.03)), ie = new Set(e.map((u) => u.playerId)), ee = new Set(t.map((u) => u.playerId));
  let $ = 1, O = 1;
  for (const u of i) {
    const E = u.playerIds.filter((k) => ie.has(k)).length, P = u.playerIds.filter((k) => ee.has(k)).length;
    E > $ && ($ = E), P > O && (O = P);
  }
  const te = Math.max(-0.08, Math.min(0.08, ($ - O) * 0.02)), D = e.filter((u) => {
    const E = n[u.playerId]?.level;
    return E === "HIGH" || E === "CRITICAL";
  }).length, H = t.filter((u) => {
    const E = n[u.playerId]?.level;
    return E === "HIGH" || E === "CRITICAL";
  }).length, Q = Math.max(-0.06, Math.min(0.06, (D - H) * 0.02)), ne = d + w + W + te + Q, re = Math.max(0.06, Math.min(0.94, ne)), L = Math.round(re * 100), oe = 100 - L;
  let x = 13, J = 9;
  const h = Math.abs(L - 50), S = h <= 8;
  h <= 8 ? (x = L >= 50 ? 13 : 11, J = L >= 50 ? 11 : 13) : h <= 16 ? (x = L >= 50 ? 13 : 8, J = L >= 50 ? 8 : 13) : h <= 26 ? (x = L >= 50 ? 13 : 5, J = L >= 50 ? 5 : 13) : (x = L >= 50 ? 13 : 3, J = L >= 50 ? 3 : 13);
  const m = [];
  Math.abs(p - _) >= 60 && m.push(
    p > _ ? `Team 1 holds +${Math.round(p - _)} avg Elo edge` : `Team 2 holds +${Math.round(_ - p)} avg Elo edge`
  ), A && A.deltaWinRate >= 8 && m.push(
    A.leader === "faction1" ? `Team 1 dominates ${A.mapName} (+${A.deltaWinRate}% WR)` : `Team 2 dominates ${A.mapName} (+${A.deltaWinRate}% WR)`
  ), l > N && l >= 2 ? m.push(`Team 1 on hot momentum (${l} players On Fire)`) : N > l && N >= 2 && m.push(`Team 2 on hot momentum (${N} players On Fire)`), $ >= 3 && $ > O ? m.push(`Team 1 has ${$}-stack coordination`) : O >= 3 && O > $ && m.push(`Team 2 has ${O}-stack coordination`), Math.abs(Q) >= 0.04 && D + H > 0 && (D > H ? m.push(`Team 1 likely carries flagged accounts (${D} risk flagged)`) : H > D && m.push(`Team 2 likely carries flagged accounts (${H} risk flagged)`));
  const c = m.length > 0 ? m.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", v = (u, E) => {
    let P = u[0], k = -1;
    for (const U of u) {
      const j = (E[U.playerId] || 20) * 1.5 + (U.last30Kd ?? U.overallKd ?? 1) * 10;
      j > k && (k = j, P = U);
    }
    return P ? {
      nickname: P.nickname,
      fcr: E[P.playerId] || 20,
      kd: P.last30Kd ?? P.overallKd ?? 1,
      elo: P.elo || 1e3
    } : void 0;
  }, b = v(e, o), T = v(t, g);
  return {
    winChanceF1: L,
    winChanceF2: oe,
    predictedScore: {
      f1Score: x,
      f2Score: J,
      isOvertimeLikely: S
    },
    keyAdvantageText: c,
    factors: {
      eloDelta: Math.round(p - _),
      mapAdvantage: A,
      momentumAdvantage: {
        leader: V > z ? "faction1" : z > V ? "faction2" : "balanced",
        f1HotCount: l,
        f2HotCount: N,
        f1ColdCount: F,
        f2ColdCount: G
      },
      premadeAdvantage: {
        leader: $ > O ? "faction1" : O > $ ? "faction2" : "balanced",
        f1MaxPartySize: $,
        f2MaxPartySize: O
      },
      smurfRiskDelta: {
        f1HighRiskCount: D,
        f2HighRiskCount: H,
        impactPercent: Math.round(Q * 100)
      }
    },
    starMatchup: b && T ? { f1Star: b, f2Star: T } : void 0
  };
}
const I = (s, ...e) => {
  for (const t of e) {
    const a = s?.[t];
    if (a != null && a !== "") return a;
  }
}, ce = (s, e) => {
  if (s === void 0) return e;
  const t = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(t) ? t : e;
}, B = (s, e) => {
  if (s === void 0) return e;
  const t = parseFloat(s.replace(/[,\s]/g, ""));
  return Number.isFinite(t) ? t : e;
};
function Re(s, e, t, a, i, n) {
  const o = t?.games?.cs2 || t?.games?.csgo || {}, g = o.faceit_elo || 1e3, y = o.skill_level || 1, r = o.game_player_id || t?.steam_id_64, p = t?.nickname || e || "Player", _ = t?.avatar || "", f = t?.country || "", d = Array.isArray(a) ? null : a, w = Array.isArray(i) ? null : i, A = d?.lifetime || w?.lifetime || {}, M = Object.keys(A).length > 0, l = ce(I(A, "Total Matches", "Matches", "m1"), 0), F = B(I(A, "Win Rate %", "k6"), 0) ?? 0, N = B(I(A, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, G = B(I(A, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, V = I(A, "ADR", "adr", "c3");
  let z = V ? B(V, void 0) : void 0;
  const W = {}, ie = [
    ...Array.isArray(a) ? a : a?.segments || a?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const m of ie) {
    const v = (m._id?.segmentId || m._id?.label || m.label || m.segmentId || m.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (v) {
      const b = ce(I(m.stats, "Matches") ?? I(m, "m1", "matches"), 0), T = B(I(m.stats, "Win Rate %") ?? I(m, "k6", "winRate"), 0) ?? 0, u = B(I(m.stats, "Average K/D Ratio", "K/D Ratio") ?? I(m, "k5", "kd"), 1) ?? 1, E = B(I(m.stats, "Average Headshots %") ?? I(m, "k8", "hsPercent"), 0) ?? 0, P = B(I(m.stats, "Average Kills") ?? I(m, "k1", "avgKills"), 0) ?? 0, k = I(m.stats, "ADR") ?? I(m, "c3", "adr"), U = k ? B(k, void 0) : void 0, Y = ce(I(m.stats, "Wins") ?? I(m, "m2", "wins"), Math.round(b * T / 100));
      (!W[v] || b > W[v].matches) && (W[v] = {
        mapName: v,
        matches: b,
        winRate: T,
        kd: u,
        hsPercent: E,
        avgKills: P,
        avgAdr: U,
        wins: Y,
        losses: Math.max(0, b - Y)
      });
    }
  }
  const ee = [];
  let $ = 0, O = "NONE", te = !0;
  const D = {};
  if (Array.isArray(n))
    for (let m = 0; m < n.length; m++) {
      const c = n[m], v = c.i10 === "1" || c.result === "1" || c.stats?.Result === "1" || c.stats?.Win === "1", b = v ? "W" : "L";
      m === 0 ? (O = b, $ = 1) : te && (b === O ? $++ : te = !1);
      const T = (c.i1 || c.stats?.Map || c.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), u = ce(c.i6 ?? c.stats?.Kills ?? c.kills, 0), E = ce(c.i8 ?? c.stats?.Deaths ?? c.deaths, 0), P = c.stats && typeof c.stats == "object" ? c.stats : null, k = (R) => R !== void 0 && R >= 5 && R <= 200, U = ce(c.i9, 0), Y = u > 0 && U > 0 ? U / u * 100 : void 0, j = (R) => Y !== void 0 && Math.abs(R - Y) <= 5;
      let K;
      const X = P ? B(I(P, "ADR", "adr"), void 0) : void 0;
      if (k(X))
        K = X;
      else {
        const R = c.c3 !== void 0 && c.c3 !== "" ? B(c.c3, void 0) : void 0, ae = c.c4 !== void 0 && c.c4 !== "" ? B(c.c4, void 0) : void 0, ue = k(R) && !j(R) ? R : void 0, De = k(ae) && !j(ae) ? ae : void 0;
        if (K = ue ?? (Y !== void 0 ? De : void 0), K === void 0 && c.adr !== void 0) {
          const we = B(c.adr, void 0);
          k(we) && (K = we);
        }
      }
      let de;
      const fe = P ? B(P["Headshots %"], void 0) : void 0;
      if (fe !== void 0 && fe > 0 && fe <= 100)
        de = fe;
      else {
        const R = c.c4 !== void 0 && c.c4 !== "" ? B(c.c4, void 0) : void 0;
        R !== void 0 && R > 0 && R <= 100 && (Y === void 0 || j(R)) ? de = R : Y !== void 0 && (de = Math.round(Y * 10) / 10);
      }
      T && (D[T] || (D[T] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), D[T].matches++, v && D[T].wins++, D[T].kills += u, D[T].deaths += E, K !== void 0 && (D[T].adrSum += K, D[T].adrCount++));
      const Ae = c.elo ? parseInt(c.elo.toString().replace(/,/g, ""), 10) : c.i15 ? parseInt(c.i15, 10) : void 0;
      let me;
      if (m < n.length - 1 && Ae) {
        const R = n[m + 1], ae = R?.elo ? parseInt(R.elo.toString().replace(/,/g, ""), 10) : R?.i15 ? parseInt(R.i15, 10) : void 0;
        if (typeof ae == "number" && !isNaN(ae)) {
          const ue = Ae - ae;
          Math.abs(ue) <= 60 && (me = ue);
        }
      }
      me === void 0 && (me = v ? 25 : -25), ee.push({
        matchId: c.matchId || c.i0 || `match-${m}`,
        playedAt: c.date || c.created_at || 0,
        map: T,
        result: b,
        score: c.i18 || c.stats?.Score || "13:0",
        kills: u,
        deaths: E,
        kd: parseFloat(c.c2 || c.stats?.["K/D Ratio"] || (E > 0 ? (u / E).toFixed(2) : u.toFixed(2))),
        hsPercent: de,
        adr: K,
        elo: Ae,
        eloDiff: me
      });
    }
  for (const [m, c] of Object.entries(D))
    if (!W[m] || W[m].matches === 0) {
      const v = c.matches, b = c.wins, T = v > 0 ? Math.round(b / v * 100) : 50, u = c.deaths > 0 ? parseFloat((c.kills / c.deaths).toFixed(2)) : 1, E = c.adrCount > 0 ? Math.round(c.adrSum / c.adrCount) : void 0;
      W[m] = {
        mapName: m,
        matches: v,
        winRate: T,
        kd: u,
        hsPercent: G,
        avgKills: v > 0 ? parseFloat((c.kills / v).toFixed(1)) : 15,
        avgAdr: E,
        wins: b,
        losses: v - b
      };
    }
  if (z === void 0) {
    let m = 0, c = 0;
    for (const v of Object.values(W))
      v.avgAdr !== void 0 && v.matches > 0 && (m += v.avgAdr * v.matches, c += v.matches);
    c > 0 && (z = Math.round(m / c * 10) / 10);
  }
  const H = ee.slice(0, 30), Q = H.length;
  let ne, re, L = 0, oe, x;
  if (Q > 0) {
    const m = H.reduce((u, E) => u + (E.kills || 0), 0), c = H.reduce((u, E) => u + (E.deaths || 0), 0);
    ne = c > 0 ? parseFloat((m / c).toFixed(2)) : void 0;
    const v = H.map((u) => u.adr).filter((u) => u !== void 0 && u > 0);
    L = v.length, re = v.length > 0 ? Math.round(v.reduce((u, E) => u + E, 0) / v.length) : void 0;
    const b = H.map((u) => u.hsPercent).filter((u) => u !== void 0);
    oe = b.length > 0 ? Math.round(b.reduce((u, E) => u + E, 0) / b.length) : void 0;
    const T = H.filter((u) => u.result === "W").length;
    x = Math.round(T / Q * 100);
  }
  const { formStatus: J, recentKd: h, recentAdr: S } = ke(ee, N, z);
  return {
    playerId: s,
    nickname: p,
    avatar: _,
    country: f,
    steamId64: r,
    elo: Number.isFinite(g) ? g : 1e3,
    skillLevel: Number.isFinite(y) ? y : 1,
    totalMatches: l,
    overallWinRate: F,
    overallKd: N,
    overallHsPercent: G,
    overallAdr: z,
    statsAvailable: M,
    last30Kd: ne,
    last30Adr: re,
    last30AdrMatches: L,
    last30HsPercent: oe,
    last30WinRate: x,
    last30Matches: Q,
    currentStreak: { type: O, count: $ },
    recentMatches: ee,
    mapStats: W,
    registrationDate: t?.created_at,
    formStatus: J,
    recentKd: h,
    recentAdr: S
  };
}
function He(s, e) {
  return e.user !== void 0 || e.stats !== void 0 || Array.isArray(e.time) && e.time.length > 0 ? Re(
    s,
    void 0,
    e.user ?? null,
    e.stats ?? null,
    null,
    Array.isArray(e.time) ? e.time : []
  ) : null;
}
const Ke = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Be(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return Ke.includes(e) ? e : "VOTING";
}
function Ie(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, t = s.teams?.faction2 || s.faction2 || {}, a = s.voting?.map?.pick || [], i = a.length > 0 ? a[a.length - 1] : [...s.voting?.map?.entities || []].reverse().find((y) => y.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, o = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, g = (y) => (y || []).map((r) => ({
    player_id: r.id || r.player_id,
    nickname: r.nickname || "Player",
    avatar: r.avatar || "",
    game_player_id: r.game_player_id || r.gameId || r.steam_id_64,
    game_player_name: r.game_player_name || r.gameName,
    game_skill_level: r.skill_level || r.game_skill_level || 1,
    elo: r.elo || 1e3,
    membership: r.membership,
    party_id: r.party_id || r.partyId
  }));
  return {
    match_id: s.id || s.match_id,
    game: s.game || "cs2",
    region: s.region || "EU",
    status: Be(s.status),
    configured_at: s.configured_at,
    started_at: s.started_at,
    finished_at: s.finished_at,
    teams: {
      faction1: {
        faction_id: e.id || e.faction_id || "faction1",
        name: e.name || "Team 1",
        avatar: e.avatar,
        leader: e.leader,
        roster: g(e.roster)
      },
      faction2: {
        faction_id: t.id || t.faction_id || "faction2",
        name: t.name || "Team 2",
        avatar: t.avatar,
        leader: t.leader,
        roster: g(t.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: o
  };
}
const Pe = (s) => new Promise((e) => setTimeout(e, s));
async function We(s, e = {}, t = q.REQUEST_TIMEOUT_MS) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
let _e = 0, Ee = Promise.resolve();
function Te(s, e) {
  const t = async () => {
    const i = _e + q.MIN_REQUEST_INTERVAL_MS - Date.now();
    return i > 0 && await Pe(i), _e = Date.now(), We(s, { headers: { Accept: "application/json" } }, e);
  }, a = Ee.then(t, t);
  return Ee = a.catch(() => {
  }), a;
}
async function le(s, e = q.REQUEST_TIMEOUT_MS) {
  let t = await Te(s, e);
  if (t.status === 429 || t.status === 503 || t.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${t.status} from ${new URL(s).pathname} — backing off once`), _e = Date.now() + q.BACKOFF_COOLDOWN_MS, await Pe(q.BACKOFF_RETRY_BASE_MS + Math.floor(Math.random() * q.BACKOFF_RETRY_JITTER_MS));
    try {
      t = await Te(s, e);
    } catch {
    }
  }
  return t;
}
class Ge {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !q.ID_PATTERN.test(e)) return null;
    const t = await C.get(`intercepted_match:${e}`);
    if (t) return t;
    if (this.inFlightMatch.has(e)) return this.inFlightMatch.get(e);
    const a = this.fetchMatchDetailsInternal(e).finally(() => this.inFlightMatch.delete(e));
    return this.inFlightMatch.set(e, a), a;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const t = await le(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`);
      if (!t.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${t.status}`), null;
      const a = await t.json();
      return Ie(a.payload || a);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, t), null;
    }
  }
  async getPlayerStats(e, t) {
    if (!e || !q.ID_PATTERN.test(e)) return null;
    const a = `${e}_${t || ""}`;
    if (this.inFlightPlayer.has(a)) return this.inFlightPlayer.get(a);
    const i = this.fetchPlayerStatsInternal(e, t).finally(() => this.inFlightPlayer.delete(a));
    return this.inFlightPlayer.set(a, i), i;
  }
  async fetchPlayerStatsInternal(e, t) {
    try {
      const a = encodeURIComponent(e), [i, n, o] = await Promise.allSettled([
        le(`https://api.faceit.com/users/v1/users/${a}`),
        le(`https://api.faceit.com/stats/v1/stats/users/${a}/games/cs2`),
        le(`https://api.faceit.com/stats/v1/stats/time/users/${a}/games/cs2?size=30`)
      ]);
      let g = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const f = await i.value.json();
        g = f.payload || f;
      }
      let y = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const f = await n.value.json();
        y = f.payload || f;
      }
      let r = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const f = await o.value.json(), d = f.payload || f;
        r = Array.isArray(d) ? d : d?.items || d?.segments || [];
      }
      let p = null;
      if (!(!!(y?.lifetime && Object.keys(y.lifetime).length > 0) || Array.isArray(y?.segments) && y.segments.length > 0 || r.length > 0))
        try {
          const f = await le(`https://api.faceit.com/stats/v1/stats/users/${a}/games/csgo`);
          if (f.ok) {
            const d = await f.json();
            p = d.payload || d;
          }
        } catch {
        }
      return Re(e, t, g, y, p, r);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, a), null;
    }
  }
}
const be = new Ge();
function Ye(s, e) {
  const t = !s.includes("<privacyState>public</privacyState>"), a = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: a ? a[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: t ? 1 : 3
  };
  let o = 0, g = 0;
  const y = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (y) {
    const d = y[1].split("</mostPlayedGame>");
    for (const w of d)
      if (w.includes("Counter-Strike 2") || w.includes("Counter-Strike: Global Offensive")) {
        const A = w.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        A && (o = parseFloat(A[1].replace(/,/g, "")));
        const M = w.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        M && (g = parseFloat(M[1].replace(/,/g, "")), o === 0 && (o = g));
        break;
      }
  }
  const r = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (r) {
    const d = new Date(r[1]);
    isNaN(d.getTime()) || (n.timeCreated = d.getTime() / 1e3, n.accountAgeYears = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const p = s.match(/<communityBanned>(.*?)<\/communityBanned>/), _ = s.match(/<vacBanned>(.*?)<\/vacBanned>/), f = {
    steamId64: e,
    communityBanned: p ? p[1] === "1" : !1,
    vacBanned: _ ? _[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: o,
      cs2HoursLast2Weeks: g
    },
    bans: f,
    isPrivate: t,
    fetchedAt: Date.now()
  };
}
async function xe(s, e = {}, t = Ce.REQUEST_TIMEOUT_MS) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
class Ue {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(e) {
    if (!e || !Ce.STEAM_ID_PATTERN.test(e))
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
      const t = await xe(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!t.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const a = await t.text();
      return a.includes("<steamID>") ? Ye(a, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Ve = new Ue();
function je(s, e) {
  const t = [];
  let a = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, o = s.overallKd || 1, g = s.overallWinRate || 50, y = s.recentKd || o, r = s.recentAdr || 75, p = s.statsAvailable !== !1;
  p && (n >= 2200 && i < 100 ? (a += 45, t.push({
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
  })) : i >= 800 && (a -= 15)), p && o >= 2 ? (a += 30, t.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${o.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : o >= 1.6 && i < 200 ? (a += 20, t.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${o.toFixed(2)} with ${i} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : o >= 1.4 && i < 150 ? (a += 12, t.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${o.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : o < 0.95 && i >= 50 && (a -= 10), p && s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (a += 22, t.push({
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
  })), r >= 95 && s.overallAdr !== void 0 && r >= s.overallAdr * 1.2 && (a += 12, t.push({
    id: "recent_adr_spike",
    title: "Recent ADR Spike",
    description: `Last 5 games ADR (${r}) is 20%+ above lifetime baseline (${s.overallAdr.toFixed(0)})`,
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
  })) : s.overallHsPercent >= 60 && o >= 1.5 && (a += 8, t.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${o.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), p && g >= 80 && i >= 10 ? (a += 30, t.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${g.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : g >= 70 && i >= 15 ? (a += 20, t.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${g.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : g >= 62 && i >= 25 && (a += 10, t.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${g.toFixed(0)}%`,
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
  }))), y >= 1.75 && y >= o * 1.35 && i >= 10 && (a += 15, t.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${y.toFixed(2)}) is significantly higher than lifetime baseline (${o.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  })), s.last30Kd !== void 0 && s.last30Kd >= 1.5 && s.last30Kd >= o * 1.3 && i >= 30 && (a += 10, t.push({
    id: "midterm_kd_spike",
    title: "Mid-Term K/D Spike",
    description: `Last 30 games K/D (${s.last30Kd.toFixed(2)}) well above lifetime baseline (${o.toFixed(2)})`,
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
    const l = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    l >= 15 && (a += l, t.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: l,
      severity: l >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), p && i < 100 && (a += 10, t.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const F = s.last30Kd ?? y;
    F >= 1.6 && (a += 8, t.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${F.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (_ = !1, e.summary) {
    const l = e.playtime?.cs2HoursTotal !== void 0, F = l ? e.playtime.cs2HoursTotal ?? 0 : 0, N = l && F === 0;
    F > 0 && F < 150 && n >= 1600 || N && n >= 1600 ? (a += 30, t.push({
      id: "low_steam_hours",
      title: N ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
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
    })) : l && F >= 2500 && (a -= 15);
    const G = e.summary.accountAgeYears;
    G !== void 0 && G < 1 && n >= 1400 && (a += 18, t.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${G.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const l = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), F = 25;
    a += F, t.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${l} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: F,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const f = s.registrationDate ? new Date(s.registrationDate) : null;
  if (f && !isNaN(f.getTime())) {
    const l = (Date.now() - f.getTime()) / 315576e5;
    l < 0.5 && n >= 1350 ? (a += 22, t.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${l.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : l < 1 && n >= 1600 && (a += 18, t.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${l.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const d = Math.min(100, Math.max(0, Math.round(a)));
  let w = "LOW", A = "#10B981", M = "Legit";
  return d >= 70 ? (w = "CRITICAL", A = "#DC2626", M = "High Risk") : d >= 45 ? (w = "HIGH", A = "#EF4444", M = "Likely Smurf") : d >= 25 && (w = "MEDIUM", A = "#F59E0B", M = "Suspicious"), {
    score: d,
    level: w,
    flags: t,
    isPrivateSteam: _,
    summary: `${d}% Smurf Risk (${w})`,
    color: A,
    badgeText: M
  };
}
const ye = [
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
function ze(s, e) {
  const t = [];
  let a = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const o = /* @__PURE__ */ new Map();
    for (const d of n.roster)
      if (d.party_id) {
        const w = o.get(d.party_id) || [];
        w.push(d.player_id), o.set(d.party_id, w);
      }
    const g = /* @__PURE__ */ new Set();
    for (const [, d] of o.entries())
      if (d.length >= 2) {
        const w = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${w} (${d.length})`,
          color: ye[a % ye.length],
          playerIds: d
        }), a++, d.forEach((A) => g.add(A));
      }
    const y = n.roster.map((d) => d.player_id).filter((d) => !g.has(d)), r = 15, p = /* @__PURE__ */ new Map();
    for (const d of y) {
      const w = e[d];
      w?.recentMatches && p.set(d, new Set(w.recentMatches.slice(0, r).map((A) => A.matchId)));
    }
    const _ = /* @__PURE__ */ new Set(), f = (d, w) => {
      const A = p.get(d), M = p.get(w);
      if (!A || !M) return !1;
      let l = 0;
      for (const F of A)
        if (M.has(F) && l++, l >= 2) return !0;
      return !1;
    };
    for (const d of y) {
      if (_.has(d)) continue;
      const w = [], A = [d];
      for (_.add(d); A.length > 0; ) {
        const M = A.shift();
        w.push(M);
        for (const l of y)
          !_.has(l) && f(M, l) && (_.add(l), A.push(l));
      }
      if (w.length >= 2) {
        w.forEach((l) => g.add(l));
        const M = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${M} (${w.length})`,
          color: ye[a % ye.length],
          playerIds: w
        }), a++;
      }
    }
  }
  return t;
}
function Qe(s) {
  const e = [
    [/\/users\/v1\/users\/([^/?#]+)/, "user"],
    [/\/stats\/v1\/stats\/users\/([^/?#]+)\/games\/cs2/, "stats"],
    [/\/stats\/v1\/stats\/time\/users\/([^/?#]+)\/games\/cs2/, "time"]
  ];
  for (const [t, a] of e) {
    const i = s.match(t);
    if (i && i[1]) {
      const n = decodeURIComponent(i[1]);
      if (/^[a-zA-Z0-9.\-_]{1,64}$/.test(n))
        return { kind: a, playerId: n };
    }
  }
  return null;
}
const Fe = "maps_observed_cache", Je = se.TTL.OBSERVED_MAPS_MS;
function Ne(s) {
  return s.replace(/^(cs2_|csgo_|de_)/, "").toLowerCase().trim();
}
function Xe(s) {
  const e = s, t = [], a = e?.voting?.map?.entities ?? e?.payload?.voting?.map?.entities ?? e?.match?.voting?.map?.entities;
  if (Array.isArray(a))
    for (const n of a)
      typeof n?.name == "string" ? t.push(n.name) : typeof n?.id == "string" && t.push(n.id);
  const i = e?.map ?? e?.payload?.map ?? e?.match?.map;
  return typeof i == "string" ? t.push(i) : typeof i?.name == "string" && t.push(i.name), t.map(Ne).filter(Boolean);
}
async function Ze(s) {
  const e = s.map(Ne).filter(Boolean);
  if (e.length === 0) return;
  const t = await C.get(Fe) || [], a = Array.from(/* @__PURE__ */ new Set([...t, ...e]));
  await C.set(Fe, a, Je);
}
const qe = (s) => new Promise((e) => setTimeout(e, s));
async function et(s, e, t, a = ve.MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const y = n++;
      i[y] = await t(s[y], y), a > 0 && await qe(a);
    }
  }, g = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(g), i;
}
class tt {
  settings = { ...ge };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  // Monotonic per-match stream generation; superseded streams stop broadcasting.
  streamGenerations = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, C.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const e = await C.get(he);
    return e && (this.settings = { ...ge, ...e }), this.settings;
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
   * Consumes a payload intercepted from FACEIT's own page traffic.
   * Two kinds share this channel:
   *  - match details (`matchId` present) → cached under `intercepted_match:*`
   *  - player-profile payloads (users / lifetime stats / recent matches for a
   *    single player) → staged per-player and composed into a
   *    `player_stats:*` cache entry via parsePlayerPayload, so lobby analysis
   *    hydrates KD/Elo/maps WITHOUT spending any of our request budget.
   */
  async handleInterceptedMatchPayload(e) {
    try {
      const t = typeof e?.matchId == "string" ? e.matchId : "";
      if (!t)
        return await this.handleInterceptedProfilePayload(e);
      if (!q.ROOM_ID_PATTERN.test(t))
        return { success: !1, error: "Invalid intercepted matchId" };
      if (!e?.body || typeof e.body != "object")
        return { success: !1, error: "Invalid intercepted match body" };
      const a = e.body.payload ?? e.body, i = Ie(a);
      return await C.set(`intercepted_match:${t}`, i, Z.MATCH), Ze(Xe(e.body)).catch(() => {
      }), { success: !0, data: { status: i.status } };
    } catch (t) {
      return console.warn("[f-insight:Background] Intercepted match payload rejected:", t?.message || t), { success: !1, error: t?.message || "Intercepted payload parse failed" };
    }
  }
  /**
   * Stages an intercepted player-profile payload (users / stats / time).
   * Parts accumulate per player across page clicks (short TTL), and every new
   * part recomposes the best-known FaceitPlayerFullStats into the standard
   * `player_stats:*` cache — exactly what streamLobbyData reads, so badges
   * and the flyout hydrate from page traffic with zero own requests.
   */
  async handleInterceptedProfilePayload(e) {
    const t = typeof e?.url == "string" ? e.url : "", a = Qe(t);
    if (!a)
      return { success: !1, error: "Unrecognized intercepted URL" };
    if (!e?.body || typeof e.body != "object")
      return { success: !1, error: "Invalid intercepted profile body" };
    const { kind: i, playerId: n } = a, o = e.body.payload ?? e.body, g = `intercept_profile:${n}`, y = await C.get(g) || {};
    let r = !1, p;
    if (i === "user" && o && typeof o == "object" && !Array.isArray(o)) {
      y.user = o, r = !0;
      const f = o.nickname;
      typeof f == "string" && f.trim() && (p = { guid: n, nickname: f.trim() });
    } else if (i === "stats" && o && typeof o == "object" && !Array.isArray(o))
      y.stats = o, r = !0;
    else if (i === "time") {
      const f = Array.isArray(o) ? o : Array.isArray(o?.items) ? o.items : null;
      f && f.length > 0 && (y.time = f, r = !0);
    }
    if (!r)
      return { success: !1, error: `Intercepted ${i} payload had no usable shape` };
    await C.set(g, y, Z.NEGATIVE * se.TTL.INTERCEPT_STAGE_FACTOR);
    const _ = He(n, y);
    return _ ? (await C.set(
      `player_stats:${n}`,
      _,
      _.statsAvailable === !1 ? Z.NEGATIVE : Z.PLAYER_STATS
    ), console.warn(
      `[f-insight:Background] Hydrated player ${n} from intercepted ${i} payload (statsAvailable=${_.statsAvailable !== !1})`
    ), {
      success: !0,
      data: {
        kind: "profile-hydrated",
        playerId: n,
        statsAvailable: _.statsAvailable !== !1,
        selfCandidate: p
      }
    }) : { success: !0, data: { kind: "profile-staged", playerId: n, selfCandidate: p } };
  }
  async handleSaveSettings(e) {
    const t = {};
    for (const a of Object.keys(ge))
      if (e && typeof e == "object" && a in e) {
        const i = ge[a], n = e[a];
        typeof n == typeof i && (t[a] = n);
      }
    return this.settings = { ...this.settings, ...t }, await C.set(he, this.settings, Z.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, t) {
    const { matchId: a, forceRefresh: i } = e, n = `match_analysis:${a}`;
    if (t?.tab?.id && (this.streamSubscribers.has(a) || this.streamSubscribers.set(a, /* @__PURE__ */ new Set()), this.streamSubscribers.get(a).add(t.tab.id)), !i) {
      const g = await C.get(n);
      if (g && !g.isPartial)
        return { success: !0, data: g };
    }
    const o = await be.getMatchDetails(a);
    if (!o)
      return { success: !1, error: `Could not fetch match details for ${a}` };
    if (!this.inFlightStreams.has(a) || i) {
      const g = (this.streamGenerations.get(a) || 0) + 1;
      this.streamGenerations.set(a, g);
      const y = this.streamLobbyData(a, o, i, g).finally(() => {
        this.inFlightStreams.get(a) === y && (this.inFlightStreams.delete(a), this.streamSubscribers.delete(a));
      });
      this.inFlightStreams.set(a, y);
    }
    return { success: !0, data: { match: o, isPartial: !0 } };
  }
  async streamLobbyData(e, t, a, i) {
    try {
      await this.streamLobbyDataInner(e, t, a, i);
    } catch (n) {
      console.error("[f-insight:Stream] Error:", n), this.broadcastFromStream(e, i, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: e, error: n?.message || "Match analysis stream failed" }
      });
    }
  }
  broadcastToSubscribers(e, t) {
    const a = this.streamSubscribers.get(e);
    if (!(!a || a.size === 0))
      for (const i of a)
        this.safeSendToTab(i, t);
  }
  /**
   * Broadcast guarded by the stream generation: after a forceRefresh spawned
   * a newer stream, superseded ones must stay silent — otherwise a slow old
   * per-player snapshot would overwrite fresher data on the content side.
   */
  broadcastFromStream(e, t, a) {
    this.streamGenerations.get(e) === t && this.broadcastToSubscribers(e, a);
  }
  async streamLobbyDataInner(e, t, a, i) {
    const n = `match_analysis:${e}`, o = t.teams?.faction1?.roster || [], g = t.teams?.faction2?.roster || [], y = [...o, ...g], r = {}, p = {}, _ = {};
    await et(
      y,
      ve.CONCURRENCY,
      async (h) => {
        const S = h.player_id;
        if (!S) return;
        const m = `player_stats:${S}`;
        let c = null;
        if (a || (c = await C.get(m)), !c) {
          const v = await be.getPlayerStats(S, h.nickname);
          if (v && v.statsAvailable === !1) {
            const b = await C.get(m);
            b && b.statsAvailable !== !1 ? c = b : (await C.set(m, v, Z.NEGATIVE), c = v);
          } else v && (await C.set(m, v, Z.PLAYER_STATS), c = v);
        }
        if (c) {
          r[S] = c;
          const v = c.steamId64 || h.game_player_id;
          if (v) {
            const b = `steam_data:${v}`;
            let T = null;
            a || (T = await C.get(b)), T || (T = await Ve.getPlayerFullData(v), T && !T.fetchError && await C.set(b, T, Z.STEAM_PROFILE)), T && (p[S] = T);
          }
          _[S] = je(c, p[S]), this.broadcastFromStream(e, i, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: S, stats: c, steam: p[S], risk: _[S] }
          });
        }
      },
      ve.CONCURRENCY_DELAY_MS
    );
    const f = o.map((h) => r[h.player_id]?.elo || h.elo || 1e3), d = g.map((h) => r[h.player_id]?.elo || h.elo || 1e3), w = f.reduce((h, S) => h + S, 0), A = d.reduce((h, S) => h + S, 0), M = f.length > 0 ? Math.round(w / f.length) : 1e3, l = d.length > 0 ? Math.round(A / d.length) : 1e3, F = M - l, N = o.map((h) => r[h.player_id]?.last30Kd ?? r[h.player_id]?.overallKd ?? 1), G = g.map((h) => r[h.player_id]?.last30Kd ?? r[h.player_id]?.overallKd ?? 1), V = N.length > 0 ? parseFloat((N.reduce((h, S) => h + S, 0) / N.length).toFixed(2)) : 1, z = G.length > 0 ? parseFloat((G.reduce((h, S) => h + S, 0) / G.length).toFixed(2)) : 1, W = o.map((h) => r[h.player_id]?.overallHsPercent || 0), ie = g.map((h) => r[h.player_id]?.overallHsPercent || 0), ee = W.length > 0 ? Math.round(W.reduce((h, S) => h + S, 0) / W.length) : 0, $ = ie.length > 0 ? Math.round(ie.reduce((h, S) => h + S, 0) / ie.length) : 0, O = o.map((h) => r[h.player_id]?.last30Adr ?? r[h.player_id]?.overallAdr ?? 75), te = g.map((h) => r[h.player_id]?.last30Adr ?? r[h.player_id]?.overallAdr ?? 75), D = O.length > 0 ? Math.round(O.reduce((h, S) => h + S, 0) / O.length) : 75, H = te.length > 0 ? Math.round(te.reduce((h, S) => h + S, 0) / te.length) : 75, Q = o.map((h) => r[h.player_id]).filter(Boolean), ne = g.map((h) => r[h.player_id]).filter(Boolean), re = Me(Q), L = Me(ne);
    for (const [h, S] of Object.entries(re))
      r[h] && (r[h].fcrContributionPercent = S);
    for (const [h, S] of Object.entries(L))
      r[h] && (r[h].fcrContributionPercent = S);
    const oe = ze(t, r), x = $e({
      f1AvgElo: M,
      f2AvgElo: l,
      f1Players: Q,
      f2Players: ne,
      selectedMap: t.selected_map,
      premadeGroups: oe,
      riskAnalysis: _,
      f1Fcr: re,
      f2Fcr: L
    }), J = {
      match: t,
      playersStats: r,
      steamData: p,
      riskAnalysis: _,
      premadeGroups: oe,
      teamSummary: {
        faction1: {
          totalElo: w,
          avgElo: M,
          winChancePercent: x.winChanceF1,
          avgKd: V,
          avgHsPercent: ee,
          avgAdr: D
        },
        faction2: {
          totalElo: A,
          avgElo: l,
          winChancePercent: x.winChanceF2,
          avgKd: z,
          avgHsPercent: $,
          avgAdr: H
        },
        eloDifference: Math.abs(F)
      },
      prediction: x,
      isPartial: !1
    };
    this.streamGenerations.get(e) === i && (await C.set(n, J, Z.MATCH), this.broadcastFromStream(e, i, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: J
    }));
  }
  safeSendToTab(e, t) {
    chrome.tabs.sendMessage(e, t).catch((a) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", a?.message || a);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await C.getStats() };
  }
  async handleClearCache() {
    return await C.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const pe = new tt(), Oe = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), Oe(), await pe.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), Oe(), await pe.init();
});
chrome.runtime.onMessage.addListener((s, e, t) => (pe.init().then(() => pe.handleMessage(s, e)).then(t).catch((a) => {
  console.error("[f-insight:Background] Message handling failed:", a);
  try {
    t({ success: !1, error: a?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await C.cleanup());
});
