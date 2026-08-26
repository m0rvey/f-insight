const ye = {
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
}, te = {
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
}, Ie = {
  REQUEST_TIMEOUT_MS: 6e3,
  STEAM_ID_PATTERN: /^\d{5,25}$/
}, ne = {
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
}, Se = {
  /** Concurrent player fetches in streamLobbyData */
  CONCURRENCY: 2,
  /** Delay between players in the concurrency pool */
  CONCURRENCY_DELAY_MS: 400,
  /** Default delay in mapWithConcurrency (fallback) */
  MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS: 150
}, ee = {
  MATCH: ne.TTL.MATCH_MS,
  PLAYER_STATS: ne.TTL.PLAYER_STATS_MS,
  STEAM_PROFILE: ne.TTL.STEAM_PROFILE_MS,
  NEGATIVE: ne.TTL.NEGATIVE_MS,
  SETTINGS: ne.TTL.SETTINGS_MS
}, me = "settings", Ee = ne.MAX_MEMORY_ENTRIES;
class $e {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= Ee) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > Ee; ) {
      const t = e.next();
      if (t.done) break;
      t.value !== me && this.memoryCache.delete(t.value);
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
        const e = await chrome.storage.local.get(null), t = Object.keys(e).filter((a) => a !== me);
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
          if (i === me) continue;
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
const I = new $e();
function Te(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const t = s.map((r) => {
    const p = Number.isFinite(r.elo) ? r.elo : 1e3, y = Math.max(500, p || 1e3) / 1e3, m = Number.isFinite(r.last30Kd) ? r.last30Kd : Number.isFinite(r.overallKd) ? r.overallKd : 1, f = Math.min(2.5, Math.max(0.4, m ?? 1)), w = 1 + (((Number.isFinite(r.last30Adr) ? r.last30Adr : Number.isFinite(r.overallAdr) ? r.overallAdr : 75) ?? 75) - 75) / 150, S = y * f * Math.max(0.6, w);
    return { id: r.playerId, power: Number.isFinite(S) && S > 0 ? S : 1 };
  }), a = t.reduce((r, p) => r + p.power, 0), i = Number.isFinite(a) && a > 0 ? a : 0;
  if (i <= 0) {
    const r = parseFloat((100 / s.length).toFixed(1));
    for (const p of t)
      e[p.id] = r;
    return e;
  }
  let n = 0, o = "", l = -1;
  for (const r of t) {
    const p = parseFloat((r.power / i * 100).toFixed(1));
    e[r.id] = p, n += p, p > l && (l = p, o = r.id);
  }
  const u = parseFloat((100 - n).toFixed(1));
  return u !== 0 && o && (e[o] = parseFloat((e[o] + u).toFixed(1))), e;
}
function He(s, e, t) {
  const a = Number.isFinite(e) ? Math.max(0.5, e) : 1, i = Number.isFinite(t) ? Math.max(20, t) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: a,
      recentAdr: i
    };
  const n = s.slice(0, 5), o = n.filter(
    (m) => typeof m.kills == "number" && Number.isFinite(m.kills) && typeof m.deaths == "number" && Number.isFinite(m.deaths)
  );
  let l = a;
  if (o.length > 0) {
    const m = o.reduce((_, w) => _ + (w.kills || 0), 0), f = o.reduce((_, w) => _ + (w.deaths || 0), 0);
    l = f > 0 ? parseFloat((m / f).toFixed(2)) : parseFloat(Math.max(a, m / (o.length * 2)).toFixed(2));
  }
  const u = n.map((m) => m.adr).filter((m) => typeof m == "number" && Number.isFinite(m) && m > 0), r = u.length > 0 ? Math.round(u.reduce((m, f) => m + f, 0) / u.length) : i, p = l / a;
  let y = "STABLE";
  return p >= 1.15 ? y = "HOT" : p <= 1 / 1.15 && (y = "COLD"), {
    formStatus: y,
    recentKd: l,
    recentAdr: r
  };
}
function Ke(s) {
  const {
    f1Players: e,
    f2Players: t,
    selectedMap: a,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: l
  } = s, u = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, r = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, p = u, y = r, m = y - p, f = 1 / (1 + Math.pow(10, m / 400));
  let _ = 0, w;
  const S = (a || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (S) {
    const v = e.reduce((Q, q) => Q + (q.mapStats?.[S]?.wins || 0), 0), A = e.reduce((Q, q) => Q + (q.mapStats?.[S]?.matches || 0), 0), T = t.reduce((Q, q) => Q + (q.mapStats?.[S]?.wins || 0), 0), $ = t.reduce((Q, q) => Q + (q.mapStats?.[S]?.matches || 0), 0), W = Math.round((v + 2.5) / (A + 5) * 100), ie = Math.round((T + 2.5) / ($ + 5) * 100), H = W - ie;
    A + $ >= 10 && (_ = Math.max(-0.12, Math.min(0.12, H / 100 * 0.25))), w = {
      leader: H >= 5 ? "faction1" : H <= -5 ? "faction2" : "balanced",
      mapName: S,
      f1WinRate: W,
      f2WinRate: ie,
      deltaWinRate: Math.abs(H)
    };
  }
  const h = e.filter((v) => v.formStatus === "HOT").length, C = e.filter((v) => v.formStatus === "COLD").length, D = t.filter((v) => v.formStatus === "HOT").length, G = t.filter((v) => v.formStatus === "COLD").length, V = h - C, ae = D - G, J = Math.max(-0.1, Math.min(0.1, (V - ae) * 0.03)), B = new Set(e.map((v) => v.playerId)), de = new Set(t.map((v) => v.playerId));
  let O = 1, P = 1;
  for (const v of i) {
    const A = v.playerIds.filter(($) => B.has($)).length, T = v.playerIds.filter(($) => de.has($)).length;
    A > O && (O = A), T > P && (P = T);
  }
  const X = Math.max(-0.08, Math.min(0.08, (O - P) * 0.02)), j = e.filter((v) => {
    const A = n[v.playerId]?.level;
    return A === "HIGH" || A === "CRITICAL";
  }).length, N = t.filter((v) => {
    const A = n[v.playerId]?.level;
    return A === "HIGH" || A === "CRITICAL";
  }).length, Y = Math.max(-0.06, Math.min(0.06, (j - N) * 0.02)), se = f + _ + J + X + Y, re = Math.max(0.06, Math.min(0.94, se)), L = Math.round(re * 100), oe = 100 - L;
  let x = 13, z = 9;
  const d = Math.abs(L - 50), E = d <= 8;
  d <= 8 ? (x = L >= 50 ? 13 : 11, z = L >= 50 ? 11 : 13) : d <= 16 ? (x = L >= 50 ? 13 : 8, z = L >= 50 ? 8 : 13) : d <= 26 ? (x = L >= 50 ? 13 : 5, z = L >= 50 ? 5 : 13) : (x = L >= 50 ? 13 : 3, z = L >= 50 ? 3 : 13);
  const k = [];
  Math.abs(p - y) >= 60 && k.push(
    p > y ? `Team 1 holds +${Math.round(p - y)} avg Elo edge` : `Team 2 holds +${Math.round(y - p)} avg Elo edge`
  ), w && w.deltaWinRate >= 8 && k.push(
    w.leader === "faction1" ? `Team 1 dominates ${w.mapName} (+${w.deltaWinRate}% WR)` : `Team 2 dominates ${w.mapName} (+${w.deltaWinRate}% WR)`
  ), h > D && h >= 2 ? k.push(`Team 1 on hot momentum (${h} players On Fire)`) : D > h && D >= 2 && k.push(`Team 2 on hot momentum (${D} players On Fire)`), O >= 3 && O > P ? k.push(`Team 1 has ${O}-stack coordination`) : P >= 3 && P > O && k.push(`Team 2 has ${P}-stack coordination`), Math.abs(Y) >= 0.04 && j + N > 0 && (j > N ? k.push(`Team 1 likely carries flagged accounts (${j} risk flagged)`) : N > j && k.push(`Team 2 likely carries flagged accounts (${N} risk flagged)`));
  const g = k.length > 0 ? k.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", c = (v, A) => {
    let T = v[0], $ = -1;
    for (const W of v) {
      const H = (A[W.playerId] || 20) * 1.5 + (W.last30Kd ?? W.overallKd ?? 1) * 10;
      H > $ && ($ = H, T = W);
    }
    return T ? {
      nickname: T.nickname,
      fcr: A[T.playerId] || 20,
      kd: T.last30Kd ?? T.overallKd ?? 1,
      elo: T.elo || 1e3
    } : void 0;
  }, M = c(e, o), b = c(t, l);
  return {
    winChanceF1: L,
    winChanceF2: oe,
    predictedScore: {
      f1Score: x,
      f2Score: z,
      isOvertimeLikely: E
    },
    keyAdvantageText: g,
    factors: {
      eloDelta: Math.round(p - y),
      mapAdvantage: w,
      momentumAdvantage: {
        leader: V > ae ? "faction1" : ae > V ? "faction2" : "balanced",
        f1HotCount: h,
        f2HotCount: D,
        f1ColdCount: C,
        f2ColdCount: G
      },
      premadeAdvantage: {
        leader: O > P ? "faction1" : P > O ? "faction2" : "balanced",
        f1MaxPartySize: O,
        f2MaxPartySize: P
      },
      smurfRiskDelta: {
        f1HighRiskCount: j,
        f2HighRiskCount: N,
        impactPercent: Math.round(Y * 100)
      }
    },
    starMatchup: M && b ? { f1Star: M, f2Star: b } : void 0
  };
}
const R = (s, ...e) => {
  for (const t of e) {
    const a = s?.[t];
    if (a != null && a !== "") return a;
  }
};
function Pe(s) {
  let e = String(s).trim().replace(/[\u00A0\s]/g, "").replace("%", "");
  const t = e.includes(","), a = e.includes(".");
  if (t && a)
    e = e.replace(/,/g, "");
  else if (t)
    if (/^\d{1,3}(,\d{3})+$/.test(e))
      e = e.replace(/,/g, "");
    else {
      const i = e.split(","), n = i[i.length - 1];
      n.length === 3 && i.length > 1 && /^\d+$/.test(n) && e.split(",").every((o) => /^\d+$/.test(o.replace(/^-/, ""))) ? e = e.replace(/,/g, "") : e = e.replace(",", ".");
    }
  return e;
}
const he = (s, e) => {
  if (s == null || s === "") return e;
  const t = typeof s == "number" ? String(s) : Pe(String(s)), a = parseFloat(t);
  return Number.isFinite(a) ? Math.round(a) : e;
}, K = (s, e) => {
  if (s == null || s === "") return e;
  const t = typeof s == "number" ? String(s) : Pe(String(s)), a = parseFloat(t);
  return Number.isFinite(a) ? a : e;
};
function Ne(s, e, t, a, i, n) {
  const o = t?.games?.cs2 || t?.games?.csgo || {}, l = o.faceit_elo || 1e3, u = o.skill_level || 1, r = o.game_player_id || t?.steam_id_64, p = t?.nickname || e || "Player", y = t?.avatar || "";
  let m = "";
  typeof y == "string" && y && (/^https:\/\/.*\.faceit-cdn\.net\//.test(y) || /^https:\/\/(www\.)?faceit\.com\//.test(y) ? m = y : y.startsWith("https://") || y.startsWith("data:") ? m = "" : m = y);
  const f = t?.country || "", _ = Array.isArray(a) ? null : a, w = Array.isArray(i) ? null : i, S = _?.lifetime || w?.lifetime || {}, h = Object.keys(S).length > 0, C = he(R(S, "Total Matches", "Matches", "m1"), 0), D = K(R(S, "Win Rate %", "k6"), 0) ?? 0, G = K(R(S, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, V = K(R(S, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, ae = R(S, "ADR", "adr", "c3");
  let J = ae ? K(ae, void 0) : void 0;
  const B = {}, de = [
    ...Array.isArray(a) ? a : a?.segments || a?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const g of de) {
    const M = (g._id?.segmentId || g._id?.label || g.label || g.segmentId || g.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (M) {
      const b = he(R(g.stats, "Matches") ?? R(g, "m1", "matches"), 0), v = K(R(g.stats, "Win Rate %") ?? R(g, "k6", "winRate"), 0) ?? 0, A = K(R(g.stats, "Average K/D Ratio", "K/D Ratio") ?? R(g, "k5", "kd"), 1) ?? 1, T = K(R(g.stats, "Average Headshots %") ?? R(g, "k8", "hsPercent"), 0) ?? 0, $ = K(R(g.stats, "Average Kills") ?? R(g, "k1", "avgKills"), 0) ?? 0, W = R(g.stats, "ADR") ?? R(g, "c3", "adr"), ie = W ? K(W, void 0) : void 0, H = he(R(g.stats, "Wins") ?? R(g, "m2", "wins"), Math.round(b * v / 100));
      (!B[M] || b > B[M].matches) && (B[M] = {
        mapName: M,
        matches: b,
        winRate: v,
        kd: A,
        hsPercent: T,
        avgKills: $,
        avgAdr: ie,
        wins: H,
        losses: Math.max(0, b - H)
      });
    }
  }
  const O = [];
  let P = 0, X = "NONE", j = !0;
  const N = {};
  if (Array.isArray(n))
    for (let g = 0; g < n.length; g++) {
      const c = n[g], M = c.i10 === "1" || c.result === "1" || c.stats?.Result === "1" || c.stats?.Win === "1", b = M ? "W" : "L";
      g === 0 ? (X = b, P = 1) : j && (b === X ? P++ : j = !1);
      const v = (c.i1 || c.stats?.Map || c.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), A = he(c.i6 ?? c.stats?.Kills ?? c.kills, 0), T = he(c.i8 ?? c.stats?.Deaths ?? c.deaths, 0), $ = c.stats && typeof c.stats == "object" ? c.stats : null, W = (F) => F !== void 0 && F >= 5 && F <= 200, ie = he(c.i9, 0), H = A > 0 && ie > 0 ? ie / A * 100 : void 0, Q = (F) => H !== void 0 && Math.abs(F - H) <= 5, q = () => {
        const F = [];
        for (const Z of Object.keys(c).filter((ce) => /^c\d+$/i.test(ce))) {
          const ce = c[Z] !== void 0 && c[Z] !== "" ? K(c[Z], void 0) : void 0;
          W(ce) && !Q(ce) && F.push({ key: Z.toLowerCase(), val: ce });
        }
        if (F.length === 0) return;
        const U = (Z) => F.find((ce) => ce.key === Z)?.val;
        return U("c3") ?? U("c4") ?? U("c5") ?? U("c2") ?? F[0].val;
      };
      let le;
      const _e = $ ? K(R($, "ADR", "Average Damage", "Damage", "adr"), void 0) : void 0;
      if (W(_e) && !Q(_e))
        le = _e;
      else {
        const F = q();
        if (F !== void 0) le = F;
        else if (c.adr !== void 0) {
          const U = K(c.adr, void 0);
          W(U) && (le = U);
        }
      }
      let ue;
      const ge = $ ? K(R($, "Headshots %", "HS%", "Headshots", "k8"), void 0) : void 0;
      if (ge !== void 0 && ge > 0 && ge <= 100)
        ue = ge;
      else {
        const F = c.c4 !== void 0 && c.c4 !== "" ? K(c.c4, void 0) : void 0;
        F !== void 0 && F > 0 && F <= 100 && (H === void 0 || Q(F)) ? ue = F : H !== void 0 && (ue = Math.round(H * 10) / 10);
      }
      v && (N[v] || (N[v] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), N[v].matches++, M && N[v].wins++, N[v].kills += A, N[v].deaths += T, le !== void 0 && (N[v].adrSum += le, N[v].adrCount++));
      const we = c.elo ? parseInt(c.elo.toString().replace(/,/g, ""), 10) : c.i15 ? parseInt(c.i15, 10) : void 0;
      let pe;
      if (g < n.length - 1 && we) {
        const F = n[g + 1], U = F?.elo ? parseInt(F.elo.toString().replace(/,/g, ""), 10) : F?.i15 ? parseInt(F.i15, 10) : void 0;
        if (typeof U == "number" && !isNaN(U)) {
          const Z = we - U;
          Math.abs(Z) <= 60 && (pe = Z);
        }
      }
      pe === void 0 && (pe = M ? 25 : -25), O.push({
        matchId: c.matchId || c.i0 || `match-${g}`,
        playedAt: c.date || c.created_at || 0,
        map: v,
        result: b,
        score: c.i18 || c.stats?.Score || "13:0",
        kills: A,
        deaths: T,
        kd: K(c.c2, void 0) ?? K(c.stats?.["K/D Ratio"], void 0) ?? (T > 0 ? parseFloat((A / T).toFixed(2)) : A),
        hsPercent: ue,
        adr: le,
        elo: we,
        eloDiff: pe
      });
    }
  for (const [g, c] of Object.entries(N))
    if (!B[g] || B[g].matches === 0) {
      const M = c.matches, b = c.wins, v = M > 0 ? Math.round(b / M * 100) : 50, A = c.deaths > 0 ? parseFloat((c.kills / c.deaths).toFixed(2)) : 1, T = c.adrCount > 0 ? Math.round(c.adrSum / c.adrCount) : void 0;
      B[g] = {
        mapName: g,
        matches: M,
        winRate: v,
        kd: A,
        hsPercent: V,
        avgKills: M > 0 ? parseFloat((c.kills / M).toFixed(1)) : 15,
        avgAdr: T,
        wins: b,
        losses: M - b
      };
    }
  if (J === void 0) {
    let g = 0, c = 0;
    for (const M of Object.values(B))
      M.avgAdr !== void 0 && M.matches > 0 && (g += M.avgAdr * M.matches, c += M.matches);
    c > 0 && (J = Math.round(g / c * 10) / 10);
  }
  const Y = O.slice(0, 30), se = Y.length;
  let re, L, oe = 0, x, z;
  if (se > 0) {
    const g = Y.reduce((A, T) => A + (T.kills || 0), 0), c = Y.reduce((A, T) => A + (T.deaths || 0), 0);
    re = c > 0 ? parseFloat((g / c).toFixed(2)) : void 0;
    const M = Y.map((A) => A.adr).filter((A) => A !== void 0 && A > 0);
    oe = M.length, L = M.length > 0 ? Math.round(M.reduce((A, T) => A + T, 0) / M.length) : void 0;
    const b = Y.map((A) => A.hsPercent).filter((A) => A !== void 0);
    x = b.length > 0 ? Math.round(b.reduce((A, T) => A + T, 0) / b.length) : void 0;
    const v = Y.filter((A) => A.result === "W").length;
    z = Math.round(v / se * 100);
  }
  const { formStatus: d, recentKd: E, recentAdr: k } = He(O, G, J);
  return {
    playerId: s,
    nickname: p,
    avatar: m,
    country: f,
    steamId64: r,
    elo: Number.isFinite(l) ? l : 1e3,
    skillLevel: Number.isFinite(u) ? u : 1,
    totalMatches: C,
    overallWinRate: D,
    overallKd: G,
    overallHsPercent: V,
    overallAdr: J,
    statsAvailable: h,
    last30Kd: re,
    last30Adr: L,
    last30AdrMatches: oe,
    last30HsPercent: x,
    last30WinRate: z,
    last30Matches: se,
    currentStreak: { type: X, count: P },
    recentMatches: O,
    mapStats: B,
    registrationDate: t?.created_at,
    formStatus: d,
    recentKd: E,
    recentAdr: k
  };
}
function Be(s, e) {
  return e.user !== void 0 || e.stats !== void 0 || Array.isArray(e.time) && e.time.length > 0 ? Ne(
    s,
    void 0,
    e.user ?? null,
    e.stats ?? null,
    null,
    Array.isArray(e.time) ? e.time : []
  ) : null;
}
const We = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Ge(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return We.includes(e) ? e : "VOTING";
}
function De(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, t = s.teams?.faction2 || s.faction2 || {}, a = s.voting?.map?.pick || [], i = a.length > 0 ? a[a.length - 1] : [...s.voting?.map?.entities || []].reverse().find((u) => u.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, o = n && /^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(n) ? n : void 0, l = (u) => (u || []).map((r) => ({
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
    status: Ge(s.status),
    configured_at: s.configured_at,
    started_at: s.started_at,
    finished_at: s.finished_at,
    teams: {
      faction1: {
        faction_id: e.id || e.faction_id || "faction1",
        name: e.name || "Team 1",
        avatar: e.avatar,
        leader: e.leader,
        roster: l(e.roster)
      },
      faction2: {
        faction_id: t.id || t.faction_id || "faction2",
        name: t.name || "Team 2",
        avatar: t.avatar,
        leader: t.leader,
        roster: l(t.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: o
  };
}
const Oe = (s) => new Promise((e) => setTimeout(e, s));
async function Ye(s, e = {}, t = te.REQUEST_TIMEOUT_MS) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
let Me = 0, be = Promise.resolve();
function Ce(s, e) {
  const t = async () => {
    const i = Me + te.MIN_REQUEST_INTERVAL_MS - Date.now();
    return i > 0 && await Oe(i), Me = Date.now(), Ye(s, { headers: { Accept: "application/json" } }, e);
  }, a = be.then(t, t);
  return be = a.catch(() => {
  }), a;
}
async function fe(s, e = te.REQUEST_TIMEOUT_MS) {
  let t = await Ce(s, e);
  if (t.status === 429 || t.status === 503 || t.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${t.status} from ${new URL(s).pathname} — backing off once`), Me = Date.now() + te.BACKOFF_COOLDOWN_MS, await Oe(te.BACKOFF_RETRY_BASE_MS + Math.floor(Math.random() * te.BACKOFF_RETRY_JITTER_MS));
    try {
      t = await Ce(s, e);
    } catch {
    }
  }
  return t;
}
class xe {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !te.ID_PATTERN.test(e)) return null;
    const t = await I.get(`intercepted_match:${e}`);
    if (t) return t;
    if (this.inFlightMatch.has(e)) return this.inFlightMatch.get(e);
    const a = this.fetchMatchDetailsInternal(e).finally(() => this.inFlightMatch.delete(e));
    return this.inFlightMatch.set(e, a), a;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const t = await fe(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`);
      if (!t.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${t.status}`), null;
      const a = await t.json();
      return De(a.payload || a);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, t), null;
    }
  }
  async getPlayerStats(e, t) {
    if (!e || !te.ID_PATTERN.test(e)) return null;
    const a = `${e}_${t || ""}`;
    if (this.inFlightPlayer.has(a)) return this.inFlightPlayer.get(a);
    const i = this.fetchPlayerStatsInternal(e, t).finally(() => this.inFlightPlayer.delete(a));
    return this.inFlightPlayer.set(a, i), i;
  }
  async fetchPlayerStatsInternal(e, t) {
    try {
      const a = encodeURIComponent(e), [i, n, o] = await Promise.allSettled([
        fe(`https://api.faceit.com/users/v1/users/${a}`),
        fe(`https://api.faceit.com/stats/v1/stats/users/${a}/games/cs2`),
        fe(`https://api.faceit.com/stats/v1/stats/time/users/${a}/games/cs2?size=30`)
      ]);
      let l = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const m = await i.value.json();
        l = m.payload || m;
      }
      let u = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const m = await n.value.json();
        u = m.payload || m;
      }
      let r = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const m = await o.value.json(), f = m.payload || m;
        r = Array.isArray(f) ? f : f?.items || f?.segments || [];
      }
      let p = null;
      if (!(!!(u?.lifetime && Object.keys(u.lifetime).length > 0) || Array.isArray(u?.segments) && u.segments.length > 0 || r.length > 0))
        try {
          const m = await fe(`https://api.faceit.com/stats/v1/stats/users/${a}/games/csgo`);
          if (m.ok) {
            const f = await m.json();
            p = f.payload || f;
          }
        } catch {
        }
      return Ne(e, t, l, u, p, r);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, a), null;
    }
  }
}
const Fe = new xe();
function Ue(s, e) {
  const t = !s.includes("<privacyState>public</privacyState>"), a = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: a ? a[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: t ? 1 : 3
  };
  let o = 0, l = 0;
  const u = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (u) {
    const f = u[1].split("</mostPlayedGame>");
    for (const _ of f)
      if (_.includes("Counter-Strike 2") || _.includes("Counter-Strike: Global Offensive")) {
        const w = _.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        w && (o = parseFloat(w[1].replace(/,/g, "")));
        const S = _.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        S && (l = parseFloat(S[1].replace(/,/g, "")), o === 0 && (o = l));
        break;
      }
  }
  const r = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (r) {
    const f = new Date(r[1]);
    isNaN(f.getTime()) || (n.timeCreated = f.getTime() / 1e3, n.accountAgeYears = (Date.now() - f.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const p = s.match(/<communityBanned>(.*?)<\/communityBanned>/), y = s.match(/<vacBanned>(.*?)<\/vacBanned>/), m = {
    steamId64: e,
    communityBanned: p ? p[1] === "1" : !1,
    vacBanned: y ? y[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: o,
      cs2HoursLast2Weeks: l
    },
    bans: m,
    isPrivate: t,
    fetchedAt: Date.now()
  };
}
async function Ve(s, e = {}, t = Ie.REQUEST_TIMEOUT_MS) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
class je {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(e) {
    if (!e || !Ie.STEAM_ID_PATTERN.test(e))
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
      const t = await Ve(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!t.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const a = await t.text();
      return a.includes("<steamID>") ? Ue(a, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const ze = new je();
function Qe(s, e) {
  const t = [];
  let a = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, o = s.overallKd || 1, l = s.overallWinRate || 50, u = s.recentKd || o, r = s.recentAdr || 75, p = s.statsAvailable !== !1;
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
  })), p && l >= 80 && i >= 10 ? (a += 30, t.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${l.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : l >= 70 && i >= 15 ? (a += 20, t.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${l.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : l >= 62 && i >= 25 && (a += 10, t.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${l.toFixed(0)}%`,
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
  }))), u >= 1.75 && u >= o * 1.35 && i >= 10 && (a += 15, t.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${u.toFixed(2)}) is significantly higher than lifetime baseline (${o.toFixed(2)})`,
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
  let y = !0;
  if (!e || e.fetchError)
    y = !1;
  else if (e.isPrivate) {
    y = !0, t.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const h = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    h >= 15 && (a += h, t.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: h,
      severity: h >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), p && i < 100 && (a += 10, t.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const C = s.last30Kd ?? u;
    C >= 1.6 && (a += 8, t.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${C.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (y = !1, e.summary) {
    const h = e.playtime?.cs2HoursTotal !== void 0, C = h ? e.playtime.cs2HoursTotal ?? 0 : 0, D = h && C === 0;
    C > 0 && C < 150 && n >= 1600 || D && n >= 1600 ? (a += 30, t.push({
      id: "low_steam_hours",
      title: D ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
      description: `Only ${C}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : C > 0 && C < 350 && n >= 2e3 ? (a += 20, t.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${C}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : h && C >= 2500 && (a -= 15);
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
    const h = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), C = 25;
    a += C, t.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${h} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: C,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const m = s.registrationDate ? new Date(s.registrationDate) : null;
  if (m && !isNaN(m.getTime())) {
    const h = (Date.now() - m.getTime()) / 315576e5;
    h < 0.5 && n >= 1350 ? (a += 22, t.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${h.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : h < 1 && n >= 1600 && (a += 18, t.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${h.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const f = Math.min(100, Math.max(0, Math.round(a)));
  let _ = "LOW", w = "#10B981", S = "Legit";
  return f >= 70 ? (_ = "CRITICAL", w = "#DC2626", S = "High Risk") : f >= 45 ? (_ = "HIGH", w = "#EF4444", S = "Likely Smurf") : f >= 25 && (_ = "MEDIUM", w = "#F59E0B", S = "Suspicious"), {
    score: f,
    level: _,
    flags: t,
    isPrivateSteam: y,
    summary: `${f}% Smurf Risk (${_})`,
    color: w,
    badgeText: S
  };
}
const Ae = [
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
function Je(s, e) {
  const t = [];
  let a = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const o = /* @__PURE__ */ new Map();
    for (const f of n.roster)
      if (f.party_id) {
        const _ = o.get(f.party_id) || [];
        _.push(f.player_id), o.set(f.party_id, _);
      }
    const l = /* @__PURE__ */ new Set();
    for (const [, f] of o.entries())
      if (f.length >= 2) {
        const _ = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${_} (${f.length})`,
          color: Ae[a % Ae.length],
          playerIds: f
        }), a++, f.forEach((w) => l.add(w));
      }
    const u = n.roster.map((f) => f.player_id).filter((f) => !l.has(f)), r = 15, p = /* @__PURE__ */ new Map();
    for (const f of u) {
      const _ = e[f];
      _?.recentMatches && p.set(f, new Set(_.recentMatches.slice(0, r).map((w) => w.matchId)));
    }
    const y = /* @__PURE__ */ new Set(), m = (f, _) => {
      const w = p.get(f), S = p.get(_);
      if (!w || !S) return !1;
      let h = 0;
      for (const C of w)
        if (S.has(C) && h++, h >= 2) return !0;
      return !1;
    };
    for (const f of u) {
      if (y.has(f)) continue;
      const _ = [], w = [f];
      for (y.add(f); w.length > 0; ) {
        const S = w.shift();
        _.push(S);
        for (const h of u)
          !y.has(h) && m(S, h) && (y.add(h), w.push(h));
      }
      if (_.length >= 2) {
        _.forEach((h) => l.add(h));
        const S = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${S} (${_.length})`,
          color: Ae[a % Ae.length],
          playerIds: _
        }), a++;
      }
    }
  }
  return t;
}
function Xe(s) {
  const e = [
    [/\/users\/v1\/users\/([^/?#]+)/, "user"],
    [/\/stats\/v1\/stats\/users\/([^/?#]+)\/games\/cs2/, "stats"],
    [/\/stats\/v1\/stats\/time\/users\/([^/?#]+)\/games\/cs2/, "time"]
  ];
  for (const [t, a] of e) {
    const i = s.match(t);
    if (i && i[1]) {
      let n;
      try {
        n = decodeURIComponent(i[1]);
      } catch {
        n = i[1];
      }
      if (/^[^/?#\s]{1,64}$/.test(n) && n.trim() === n)
        return { kind: a, playerId: n };
    }
  }
  return null;
}
const Re = "maps_observed_cache", qe = ne.TTL.OBSERVED_MAPS_MS;
function Le(s) {
  return s.replace(/^(cs2_|csgo_|de_)/i, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
}
function Ze(s) {
  const e = s, t = [], a = e?.voting?.map?.entities ?? e?.payload?.voting?.map?.entities ?? e?.match?.voting?.map?.entities ?? e?.voting?.veto?.entities ?? e?.payload?.voting?.veto?.entities;
  Array.isArray(a) && t.push(...a);
  const i = e?.voting?.map?.pick ?? e?.payload?.voting?.map?.pick ?? e?.match?.voting?.map?.pick;
  if (Array.isArray(i))
    for (const l of i) typeof l == "string" && t.push({ name: l });
  const n = e?.map ?? e?.payload?.map ?? e?.match?.map ?? e?.selected_map ?? e?.payload?.selected_map;
  typeof n == "string" ? t.push({ name: n }) : n && typeof n?.name == "string" && t.push({ name: n.name });
  const o = [];
  for (const l of t) {
    let u = typeof l == "string" ? l : l?.name ?? l?.id ?? l?.guid ?? l?.map_name ?? "";
    if (!u || typeof u != "string" || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(u)) continue;
    const r = Le(u);
    r && o.push(r);
  }
  return Array.from(new Set(o));
}
async function et(s) {
  const e = s.map(Le).filter(Boolean);
  if (e.length === 0) return;
  const t = await I.get(Re) || [], a = Array.from(/* @__PURE__ */ new Set([...t, ...e]));
  await I.set(Re, a, qe);
}
const tt = (s) => new Promise((e) => setTimeout(e, s));
async function at(s, e, t, a = Se.MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const u = n++;
      i[u] = await t(s[u], u), a > 0 && await tt(a);
    }
  }, l = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(l), i;
}
class st {
  settings = { ...ye };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  // Monotonic per-match stream generation; superseded streams stop broadcasting.
  streamGenerations = /* @__PURE__ */ new Map();
  async init() {
    if (!this.initialized) {
      await this.loadSettings(), this.initialized = !0, I.cleanup().catch(() => {
      });
      try {
        typeof chrome < "u" && chrome.tabs?.onRemoved && chrome.tabs.onRemoved.addListener((e) => {
          for (const t of this.streamSubscribers.values()) t.delete(e);
          for (const [t, a] of this.streamSubscribers.entries()) a.size === 0 && this.streamSubscribers.delete(t);
        });
      } catch {
      }
    }
  }
  async loadSettings() {
    const e = await I.get(me);
    return e && (this.settings = { ...ye, ...e }), this.settings;
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
      if (!te.ROOM_ID_PATTERN.test(t))
        return { success: !1, error: "Invalid intercepted matchId" };
      if (!e?.body || typeof e.body != "object")
        return { success: !1, error: "Invalid intercepted match body" };
      const a = e.body.payload ?? e.body, i = De(a);
      return await I.set(`intercepted_match:${t}`, i, ee.MATCH), et(Ze(e.body)).catch(() => {
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
    const t = typeof e?.url == "string" ? e.url : "", a = Xe(t);
    if (!a)
      return { success: !1, error: "Unrecognized intercepted URL" };
    if (!e?.body || typeof e.body != "object")
      return { success: !1, error: "Invalid intercepted profile body" };
    const { kind: i, playerId: n } = a, o = e.body.payload ?? e.body, l = `intercept_profile:${n}`, u = await I.get(l) || {};
    let r = !1, p;
    if (i === "user" && o && typeof o == "object" && !Array.isArray(o)) {
      u.user = o, r = !0;
      const m = o.nickname;
      typeof m == "string" && m.trim() && (p = { guid: n, nickname: m.trim() });
    } else if (i === "stats" && o && typeof o == "object" && !Array.isArray(o))
      u.stats = o, r = !0;
    else if (i === "time") {
      const m = Array.isArray(o) ? o : Array.isArray(o?.items) ? o.items : null;
      m && m.length > 0 && (u.time = m, r = !0);
    }
    if (!r)
      return { success: !1, error: `Intercepted ${i} payload had no usable shape` };
    await I.set(l, u, ee.NEGATIVE * ne.TTL.INTERCEPT_STAGE_FACTOR);
    const y = Be(n, u);
    return y ? (await I.set(
      `player_stats:${n}`,
      y,
      y.statsAvailable === !1 ? ee.NEGATIVE : ee.PLAYER_STATS
    ), console.warn(
      `[f-insight:Background] Hydrated player ${n} from intercepted ${i} payload (statsAvailable=${y.statsAvailable !== !1})`
    ), {
      success: !0,
      data: {
        kind: "profile-hydrated",
        playerId: n,
        statsAvailable: y.statsAvailable !== !1,
        selfCandidate: p
      }
    }) : { success: !0, data: { kind: "profile-staged", playerId: n, selfCandidate: p } };
  }
  async handleSaveSettings(e) {
    const t = {};
    for (const a of Object.keys(ye))
      if (e && typeof e == "object" && a in e) {
        const i = ye[a], n = e[a];
        typeof n == typeof i && (t[a] = n);
      }
    return this.settings = { ...this.settings, ...t }, await I.set(me, this.settings, ee.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, t) {
    const { matchId: a, forceRefresh: i } = e, n = `match_analysis:${a}`;
    if (t?.tab?.id && (this.streamSubscribers.has(a) || this.streamSubscribers.set(a, /* @__PURE__ */ new Set()), this.streamSubscribers.get(a).add(t.tab.id)), !i) {
      const l = await I.get(n);
      if (l && !l.isPartial)
        return { success: !0, data: l };
    }
    const o = await Fe.getMatchDetails(a);
    if (!o)
      return { success: !1, error: `Could not fetch match details for ${a}` };
    if (!this.inFlightStreams.has(a) || i) {
      const l = (this.streamGenerations.get(a) || 0) + 1;
      this.streamGenerations.set(a, l);
      const u = this.streamLobbyData(a, o, i, l).finally(() => {
        this.inFlightStreams.get(a) === u && (this.inFlightStreams.delete(a), this.streamSubscribers.delete(a));
      });
      this.inFlightStreams.set(a, u);
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
    const n = `match_analysis:${e}`, o = t.teams?.faction1?.roster || [], l = t.teams?.faction2?.roster || [], u = [...o, ...l], r = {}, p = {}, y = {};
    await at(
      u,
      Se.CONCURRENCY,
      async (d) => {
        const E = d.player_id;
        if (!E) return;
        const k = `player_stats:${E}`;
        let g = null;
        if (a || (g = await I.get(k)), !g) {
          const c = await Fe.getPlayerStats(E, d.nickname);
          if (c && c.statsAvailable === !1) {
            const M = await I.get(k);
            M && M.statsAvailable !== !1 ? g = M : (await I.set(k, c, ee.NEGATIVE), g = c);
          } else c && (await I.set(k, c, ee.PLAYER_STATS), g = c);
        }
        if (g) {
          r[E] = g;
          const c = g.steamId64 || d.game_player_id;
          if (c) {
            const M = `steam_data:${c}`;
            let b = null;
            a || (b = await I.get(M)), b || (b = await ze.getPlayerFullData(c), b && !b.fetchError && await I.set(M, b, ee.STEAM_PROFILE)), b && (p[E] = b);
          }
          y[E] = Qe(g, p[E]), this.broadcastFromStream(e, i, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: E, stats: g, steam: p[E], risk: y[E] }
          });
        }
      },
      Se.CONCURRENCY_DELAY_MS
    );
    const m = o.map((d) => r[d.player_id]?.elo || d.elo || 1e3), f = l.map((d) => r[d.player_id]?.elo || d.elo || 1e3), _ = m.reduce((d, E) => d + E, 0), w = f.reduce((d, E) => d + E, 0), S = m.length > 0 ? Math.round(_ / m.length) : 1e3, h = f.length > 0 ? Math.round(w / f.length) : 1e3, C = S - h, D = o.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), G = l.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), V = D.length > 0 ? parseFloat((D.reduce((d, E) => d + E, 0) / D.length).toFixed(2)) : 1, ae = G.length > 0 ? parseFloat((G.reduce((d, E) => d + E, 0) / G.length).toFixed(2)) : 1, J = o.map((d) => r[d.player_id]?.overallHsPercent || 0), B = l.map((d) => r[d.player_id]?.overallHsPercent || 0), de = J.length > 0 ? Math.round(J.reduce((d, E) => d + E, 0) / J.length) : 0, O = B.length > 0 ? Math.round(B.reduce((d, E) => d + E, 0) / B.length) : 0, P = o.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), X = l.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), j = P.length > 0 ? Math.round(P.reduce((d, E) => d + E, 0) / P.length) : 75, N = X.length > 0 ? Math.round(X.reduce((d, E) => d + E, 0) / X.length) : 75, Y = o.map((d) => r[d.player_id]).filter(Boolean), se = l.map((d) => r[d.player_id]).filter(Boolean), re = Te(Y), L = Te(se);
    for (const [d, E] of Object.entries(re))
      r[d] && (r[d].fcrContributionPercent = E);
    for (const [d, E] of Object.entries(L))
      r[d] && (r[d].fcrContributionPercent = E);
    const oe = Je(t, r), x = Ke({
      f1AvgElo: S,
      f2AvgElo: h,
      f1Players: Y,
      f2Players: se,
      selectedMap: t.selected_map,
      premadeGroups: oe,
      riskAnalysis: y,
      f1Fcr: re,
      f2Fcr: L
    }), z = {
      match: t,
      playersStats: r,
      steamData: p,
      riskAnalysis: y,
      premadeGroups: oe,
      teamSummary: {
        faction1: {
          totalElo: _,
          avgElo: S,
          winChancePercent: x.winChanceF1,
          avgKd: V,
          avgHsPercent: de,
          avgAdr: j
        },
        faction2: {
          totalElo: w,
          avgElo: h,
          winChancePercent: x.winChanceF2,
          avgKd: ae,
          avgHsPercent: O,
          avgAdr: N
        },
        eloDifference: Math.abs(C)
      },
      prediction: x,
      isPartial: !1
    };
    this.streamGenerations.get(e) === i && (await I.set(n, z, ee.MATCH), this.broadcastFromStream(e, i, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: z
    }));
  }
  safeSendToTab(e, t) {
    chrome.tabs.sendMessage(e, t).catch((a) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", a?.message || a);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await I.getStats() };
  }
  async handleClearCache() {
    return await I.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const ve = new st(), ke = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), ke(), await ve.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), ke(), await ve.init();
});
chrome.runtime.onMessage.addListener((s, e, t) => (ve.init().then(() => ve.handleMessage(s, e)).then(t).catch((a) => {
  console.error("[f-insight:Background] Message handling failed:", a);
  try {
    t({ success: !1, error: a?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await I.cleanup());
});
