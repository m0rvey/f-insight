const _e = {
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
}, ne = {
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
}, Le = {
  REQUEST_TIMEOUT_MS: 6e3,
  STEAM_ID_PATTERN: /^\d{5,25}$/
}, ie = {
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
}, Ee = {
  /** Concurrent player fetches in streamLobbyData */
  CONCURRENCY: 2,
  /** Delay between players in the concurrency pool */
  CONCURRENCY_DELAY_MS: 400,
  /** Default delay in mapWithConcurrency (fallback) */
  MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS: 150
}, se = {
  MATCH: ie.TTL.MATCH_MS,
  PLAYER_STATS: ie.TTL.PLAYER_STATS_MS,
  STEAM_PROFILE: ie.TTL.STEAM_PROFILE_MS,
  NEGATIVE: ie.TTL.NEGATIVE_MS,
  SETTINGS: ie.TTL.SETTINGS_MS
}, pe = "settings", be = ie.MAX_MEMORY_ENTRIES;
class Be {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= be) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > be; ) {
      const a = e.next();
      if (a.done) break;
      a.value !== pe && this.memoryCache.delete(a.value);
    }
  }
  async get(e) {
    const a = Date.now(), t = this.memoryCache.get(e);
    if (t) {
      if (a - t.cachedAt < t.ttlMs)
        return this.memoryCache.delete(e), this.memoryCache.set(e, t), t.value;
      this.memoryCache.delete(e);
    }
    if (this.isChromeStorageAvailable())
      try {
        const n = (await chrome.storage.local.get([e]))[e];
        if (n && n.cachedAt && n.ttlMs) {
          if (a - n.cachedAt < n.ttlMs)
            return this.memoryCache.set(e, n), this.enforceMemoryLimit(), n.value;
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
      } catch (a) {
        console.warn(`[f-insight:Cache] Failed to remove ${e}`, a);
      }
  }
  async clear() {
    if (this.memoryCache.clear(), this.isChromeStorageAvailable())
      try {
        const e = await chrome.storage.local.get(null), a = Object.keys(e).filter((t) => t !== pe);
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
        for (const [i, n] of Object.entries(a)) {
          if (i === pe) continue;
          const o = n;
          o && o.cachedAt && o.ttlMs && e - o.cachedAt >= o.ttlMs && t.push(i);
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
const P = new Be();
function Re(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const a = s.map((r) => {
    const y = Number.isFinite(r.elo) ? r.elo : 1e3, A = Math.max(500, y || 1e3) / 1e3, m = Number.isFinite(r.last30Kd) ? r.last30Kd : Number.isFinite(r.overallKd) ? r.overallKd : 1, f = Math.min(2.5, Math.max(0.4, m ?? 1)), w = 1 + (((Number.isFinite(r.last30Adr) ? r.last30Adr : Number.isFinite(r.overallAdr) ? r.overallAdr : 75) ?? 75) - 75) / 150, S = A * f * Math.max(0.6, w);
    return { id: r.playerId, power: Number.isFinite(S) && S > 0 ? S : 1 };
  }), t = a.reduce((r, y) => r + y.power, 0), i = Number.isFinite(t) && t > 0 ? t : 0;
  if (i <= 0) {
    const r = parseFloat((100 / s.length).toFixed(1));
    for (const y of a)
      e[y.id] = r;
    return e;
  }
  let n = 0, o = "", h = -1;
  for (const r of a) {
    const y = parseFloat((r.power / i * 100).toFixed(1));
    e[r.id] = y, n += y, y > h && (h = y, o = r.id);
  }
  const l = parseFloat((100 - n).toFixed(1));
  return l !== 0 && o && (e[o] = parseFloat((e[o] + l).toFixed(1))), e;
}
function We(s, e, a) {
  const t = Number.isFinite(e) ? Math.max(0.5, e) : 1, i = Number.isFinite(a) ? Math.max(20, a) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: t,
      recentAdr: i
    };
  const n = s.slice(0, 5), o = n.filter(
    (m) => typeof m.kills == "number" && Number.isFinite(m.kills) && typeof m.deaths == "number" && Number.isFinite(m.deaths)
  );
  let h = t;
  if (o.length > 0) {
    const m = o.reduce((_, w) => _ + (w.kills || 0), 0), f = o.reduce((_, w) => _ + (w.deaths || 0), 0);
    h = f > 0 ? parseFloat((m / f).toFixed(2)) : parseFloat(Math.max(t, m / (o.length * 2)).toFixed(2));
  }
  const l = n.map((m) => m.adr).filter((m) => typeof m == "number" && Number.isFinite(m) && m > 0), r = l.length > 0 ? Math.round(l.reduce((m, f) => m + f, 0) / l.length) : i, y = h / t;
  let A = "STABLE";
  return y >= 1.15 ? A = "HOT" : y <= 1 / 1.15 && (A = "COLD"), {
    formStatus: A,
    recentKd: h,
    recentAdr: r
  };
}
function Ye(s) {
  const {
    f1Players: e,
    f2Players: a,
    selectedMap: t,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: h
  } = s, l = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, r = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, y = l, A = r, m = A - y, f = 1 / (1 + Math.pow(10, m / 400));
  let _ = 0, w;
  const S = (t || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (S) {
    const g = e.reduce((G, X) => G + (X.mapStats?.[S]?.wins || 0), 0), F = e.reduce((G, X) => G + (X.mapStats?.[S]?.matches || 0), 0), C = a.reduce((G, X) => G + (X.mapStats?.[S]?.wins || 0), 0), k = a.reduce((G, X) => G + (X.mapStats?.[S]?.matches || 0), 0), O = Math.round((g + 2.5) / (F + 5) * 100), he = Math.round((C + 2.5) / (k + 5) * 100), te = O - he;
    F + k >= 10 && (_ = Math.max(-0.12, Math.min(0.12, te / 100 * 0.25))), w = {
      leader: te >= 5 ? "faction1" : te <= -5 ? "faction2" : "balanced",
      mapName: S,
      f1WinRate: O,
      f2WinRate: he,
      deltaWinRate: Math.abs(te)
    };
  }
  let u = 0, T;
  const B = e.map((g) => g.last30Adr ?? g.overallAdr).filter((g) => typeof g == "number" && Number.isFinite(g) && g >= 5 && g <= 200), W = a.map((g) => g.last30Adr ?? g.overallAdr).filter((g) => typeof g == "number" && Number.isFinite(g) && g >= 5 && g <= 200);
  if (B.length >= 3 && W.length >= 3) {
    const g = Math.round(B.reduce((k, O) => k + O, 0) / B.length), F = Math.round(W.reduce((k, O) => k + O, 0) / W.length), C = g - F;
    u = Math.max(-0.08, Math.min(0.08, C / 130)), T = {
      leader: C >= 5 ? "faction1" : C <= -5 ? "faction2" : "balanced",
      f1AvgAdr: g,
      f2AvgAdr: F,
      delta: C
    };
  }
  const Y = e.filter((g) => g.formStatus === "HOT").length, ce = e.filter((g) => g.formStatus === "COLD").length, H = a.filter((g) => g.formStatus === "HOT").length, K = a.filter((g) => g.formStatus === "COLD").length, le = Y - ce, x = H - K, q = Math.max(-0.1, Math.min(0.1, (le - x) * 0.03)), Z = new Set(e.map((g) => g.playerId)), me = new Set(a.map((g) => g.playerId));
  let D = 1, N = 1;
  for (const g of i) {
    const F = g.playerIds.filter((k) => Z.has(k)).length, C = g.playerIds.filter((k) => me.has(k)).length;
    F > D && (D = F), C > N && (N = C);
  }
  const re = Math.max(-0.08, Math.min(0.08, (D - N) * 0.02)), U = e.filter((g) => {
    const F = n[g.playerId]?.level;
    return F === "HIGH" || F === "CRITICAL";
  }).length, V = a.filter((g) => {
    const F = n[g.playerId]?.level;
    return F === "HIGH" || F === "CRITICAL";
  }).length, ee = Math.max(-0.06, Math.min(0.06, (U - V) * 0.02)), oe = f + _ + u + q + re + ee, de = Math.max(0.06, Math.min(0.94, oe)), d = Math.round(de * 100), E = 100 - d;
  let j = 13, p = 9;
  const M = Math.abs(d - 50), v = M <= 8;
  M <= 8 ? (j = d >= 50 ? 13 : 11, p = d >= 50 ? 11 : 13) : M <= 16 ? (j = d >= 50 ? 13 : 8, p = d >= 50 ? 8 : 13) : M <= 26 ? (j = d >= 50 ? 13 : 5, p = d >= 50 ? 5 : 13) : (j = d >= 50 ? 13 : 3, p = d >= 50 ? 3 : 13);
  const c = [];
  Math.abs(y - A) >= 60 && c.push(
    y > A ? `Team 1 holds +${Math.round(y - A)} avg Elo edge` : `Team 2 holds +${Math.round(A - y)} avg Elo edge`
  ), w && w.deltaWinRate >= 8 && c.push(
    w.leader === "faction1" ? `Team 1 dominates ${w.mapName} (+${w.deltaWinRate}% WR)` : `Team 2 dominates ${w.mapName} (+${w.deltaWinRate}% WR)`
  ), T && Math.abs(T.delta) >= 8 && c.push(
    T.leader === "faction1" ? `Team 1 ADR edge +${T.delta} (firepower)` : `Team 2 ADR edge +${Math.abs(T.delta)} (firepower)`
  ), Y > H && Y >= 2 ? c.push(`Team 1 on hot momentum (${Y} players On Fire)`) : H > Y && H >= 2 && c.push(`Team 2 on hot momentum (${H} players On Fire)`), D >= 3 && D > N ? c.push(`Team 1 has ${D}-stack coordination`) : N >= 3 && N > D && c.push(`Team 2 has ${N}-stack coordination`), Math.abs(ee) >= 0.04 && U + V > 0 && (U > V ? c.push(`Team 1 likely carries flagged accounts (${U} risk flagged)`) : V > U && c.push(`Team 2 likely carries flagged accounts (${V} risk flagged)`));
  const z = c.length > 0 ? c.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", b = (g, F) => {
    let C = g[0], k = -1;
    for (const O of g) {
      const te = (F[O.playerId] || 20) * 1.5 + (O.last30Kd ?? O.overallKd ?? 1) * 10;
      te > k && (k = te, C = O);
    }
    return C ? {
      nickname: C.nickname,
      fcr: F[C.playerId] || 20,
      kd: C.last30Kd ?? C.overallKd ?? 1,
      elo: C.elo || 1e3
    } : void 0;
  }, R = b(e, o), J = b(a, h);
  return {
    winChanceF1: d,
    winChanceF2: E,
    predictedScore: {
      f1Score: j,
      f2Score: p,
      isOvertimeLikely: v
    },
    keyAdvantageText: z,
    factors: {
      eloDelta: Math.round(y - A),
      mapAdvantage: w,
      momentumAdvantage: {
        leader: le > x ? "faction1" : x > le ? "faction2" : "balanced",
        f1HotCount: Y,
        f2HotCount: H,
        f1ColdCount: ce,
        f2ColdCount: K
      },
      premadeAdvantage: {
        leader: D > N ? "faction1" : N > D ? "faction2" : "balanced",
        f1MaxPartySize: D,
        f2MaxPartySize: N
      },
      smurfRiskDelta: {
        f1HighRiskCount: U,
        f2HighRiskCount: V,
        impactPercent: Math.round(ee * 100)
      },
      adrAdvantage: T
    },
    starMatchup: R && J ? { f1Star: R, f2Star: J } : void 0
  };
}
const L = (s, ...e) => {
  for (const a of e) {
    const t = s?.[a];
    if (t != null && t !== "") return t;
  }
};
function Ne(s) {
  let e = String(s).trim().replace(/[\u00A0\s]/g, "").replace("%", "");
  const a = e.includes(","), t = e.includes(".");
  if (a && t)
    e = e.replace(/,/g, "");
  else if (a)
    if (/^\d{1,3}(,\d{3})+$/.test(e))
      e = e.replace(/,/g, "");
    else {
      const i = e.split(","), n = i[i.length - 1];
      n.length === 3 && i.length > 1 && /^\d+$/.test(n) && e.split(",").every((o) => /^\d+$/.test(o.replace(/^-/, ""))) ? e = e.replace(/,/g, "") : e = e.replace(",", ".");
    }
  return e;
}
const ue = (s, e) => {
  if (s == null || s === "") return e;
  const a = typeof s == "number" ? String(s) : Ne(String(s)), t = parseFloat(a);
  return Number.isFinite(t) ? Math.round(t) : e;
}, $ = (s, e) => {
  if (s == null || s === "") return e;
  const a = typeof s == "number" ? String(s) : Ne(String(s)), t = parseFloat(a);
  return Number.isFinite(t) ? t : e;
};
function Oe(s, e, a, t, i, n) {
  const o = a?.games?.cs2 || a?.games?.csgo || {}, h = o.faceit_elo || 1e3, l = o.skill_level || 1, r = o.game_player_id || a?.steam_id_64, y = a?.nickname || e || "Player", A = a?.avatar || "";
  let m = "";
  typeof A == "string" && A && (/^https:\/\/.*\.faceit-cdn\.net\//.test(A) || /^https:\/\/(www\.)?faceit\.com\//.test(A) ? m = A : A.startsWith("https://") || A.startsWith("data:") ? m = "" : m = A);
  const f = a?.country || "", _ = Array.isArray(t) ? null : t, w = Array.isArray(i) ? null : i, S = _?.lifetime || w?.lifetime || {}, u = Object.keys(S).length > 0, T = ue(L(S, "Total Matches", "Matches", "m1"), 0), B = $(L(S, "Win Rate %", "k6"), 0) ?? 0, W = $(L(S, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, Y = $(L(S, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, ce = L(S, "ADR", "adr", "c3");
  let H = ce ? $(ce, void 0) : void 0;
  const K = {}, le = [
    ...Array.isArray(t) ? t : t?.segments || t?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const p of le) {
    const v = (p._id?.segmentId || p._id?.label || p.label || p.segmentId || p.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (v) {
      const c = ue(L(p.stats, "Matches") ?? L(p, "m1", "matches"), 0), z = $(L(p.stats, "Win Rate %") ?? L(p, "k6", "winRate"), 0) ?? 0, b = $(L(p.stats, "Average K/D Ratio", "K/D Ratio") ?? L(p, "k5", "kd"), 1) ?? 1, R = $(L(p.stats, "Average Headshots %") ?? L(p, "k8", "hsPercent"), 0) ?? 0, J = $(L(p.stats, "Average Kills") ?? L(p, "k1", "avgKills"), 0) ?? 0, g = L(p.stats, "ADR") ?? L(p, "c3", "adr"), F = g ? $(g, void 0) : void 0, C = ue(L(p.stats, "Wins") ?? L(p, "m2", "wins"), Math.round(c * z / 100));
      (!K[v] || c > K[v].matches) && (K[v] = {
        mapName: v,
        matches: c,
        winRate: z,
        kd: b,
        hsPercent: R,
        avgKills: J,
        avgAdr: F,
        wins: C,
        losses: Math.max(0, c - C)
      });
    }
  }
  const x = [];
  let q = 0, Z = "NONE", me = !0;
  const D = {};
  if (Array.isArray(n)) {
    for (let v = 0; v < n.length; v++) {
      const c = n[v], z = c.i10 === "1" || c.result === "1" || c.stats?.Result === "1" || c.stats?.Win === "1", b = z ? "W" : "L";
      v === 0 ? (Z = b, q = 1) : me && (b === Z ? q++ : me = !1);
      const R = (c.i1 || c.stats?.Map || c.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), J = ue(c.i6 ?? c.stats?.Kills ?? c.kills, 0), g = ue(c.i8 ?? c.stats?.Deaths ?? c.deaths, 0), F = c.stats && typeof c.stats == "object" ? c.stats : null, C = (I) => I !== void 0 && I >= 5 && I <= 200, k = ue(c.i9, 0), O = J > 0 && k > 0 ? k / J * 100 : void 0, he = (I) => O !== void 0 && Math.abs(I - O) <= 5, te = () => {
        const I = [];
        for (const ae of Object.keys(c).filter((fe) => /^c\d+$/i.test(fe))) {
          const fe = c[ae] !== void 0 && c[ae] !== "" ? $(c[ae], void 0) : void 0;
          C(fe) && !he(fe) && I.push({ key: ae.toLowerCase(), val: fe });
        }
        if (I.length === 0) return;
        const Q = (ae) => I.find((fe) => fe.key === ae)?.val;
        return Q("c3") ?? Q("c4") ?? Q("c5") ?? Q("c2") ?? I[0].val;
      };
      let G;
      const X = F ? $(L(F, "ADR", "Average Damage", "Damage", "adr"), void 0) : void 0;
      if (C(X) && !he(X))
        G = X;
      else {
        const I = te();
        if (I !== void 0) G = I;
        else if (c.adr !== void 0) {
          const Q = $(c.adr, void 0);
          C(Q) && (G = Q);
        }
      }
      let ye;
      const Ae = F ? $(L(F, "Headshots %", "HS%", "Headshots", "k8"), void 0) : void 0;
      if (Ae !== void 0 && Ae > 0 && Ae <= 100)
        ye = Ae;
      else {
        const I = c.c4 !== void 0 && c.c4 !== "" ? $(c.c4, void 0) : void 0;
        I !== void 0 && I > 0 && I <= 100 && (O === void 0 || he(I)) ? ye = I : O !== void 0 && (ye = Math.round(O * 10) / 10);
      }
      R && (D[R] || (D[R] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), D[R].matches++, z && D[R].wins++, D[R].kills += J, D[R].deaths += g, G !== void 0 && (D[R].adrSum += G, D[R].adrCount++));
      const Me = c.elo ? parseInt(c.elo.toString().replace(/,/g, ""), 10) : c.i15 ? parseInt(c.i15, 10) : void 0;
      let ve;
      if (v < n.length - 1 && Me) {
        const I = n[v + 1], Q = I?.elo ? parseInt(I.elo.toString().replace(/,/g, ""), 10) : I?.i15 ? parseInt(I.i15, 10) : void 0;
        if (typeof Q == "number" && !isNaN(Q)) {
          const ae = Me - Q;
          Math.abs(ae) <= 60 && (ve = ae);
        }
      }
      ve === void 0 && (ve = z ? 25 : -25), x.push({
        matchId: c.matchId || c.i0 || `match-${v}`,
        playedAt: c.date || c.created_at || 0,
        map: R,
        result: b,
        score: c.i18 || c.stats?.Score || "13:0",
        kills: J,
        deaths: g,
        kd: $(c.c2, void 0) ?? $(c.stats?.["K/D Ratio"], void 0) ?? (g > 0 ? parseFloat((J / g).toFixed(2)) : J),
        hsPercent: ye,
        adr: G,
        elo: Me,
        eloDiff: ve
      });
    }
    const p = /* @__PURE__ */ new Set(), M = [];
    for (const v of x)
      p.has(v.matchId) || (p.add(v.matchId), M.push(v));
    x.length = 0, x.push(...M);
  }
  for (const [p, M] of Object.entries(D))
    if (!K[p] || K[p].matches === 0) {
      const v = M.matches, c = M.wins, z = v > 0 ? Math.round(c / v * 100) : 50, b = M.deaths > 0 ? parseFloat((M.kills / M.deaths).toFixed(2)) : 1, R = M.adrCount > 0 ? Math.round(M.adrSum / M.adrCount) : void 0;
      K[p] = {
        mapName: p,
        matches: v,
        winRate: z,
        kd: b,
        hsPercent: Y,
        avgKills: v > 0 ? parseFloat((M.kills / v).toFixed(1)) : 15,
        avgAdr: R,
        wins: c,
        losses: v - c
      };
    }
  if (H === void 0) {
    let p = 0, M = 0;
    for (const v of Object.values(K))
      v.avgAdr !== void 0 && v.matches > 0 && (p += v.avgAdr * v.matches, M += v.matches);
    M > 0 && (H = Math.round(p / M * 10) / 10);
  }
  const N = x.slice(0, 30), re = N.length;
  let U, V, ee = 0, oe, de;
  if (re > 0) {
    const p = N.reduce((b, R) => b + (R.kills || 0), 0), M = N.reduce((b, R) => b + (R.deaths || 0), 0);
    U = M > 0 ? parseFloat((p / M).toFixed(2)) : void 0;
    const v = N.map((b) => b.adr).filter((b) => b !== void 0 && b > 0);
    ee = v.length, V = v.length > 0 ? Math.round(v.reduce((b, R) => b + R, 0) / v.length) : void 0;
    const c = N.map((b) => b.hsPercent).filter((b) => b !== void 0);
    oe = c.length > 0 ? Math.round(c.reduce((b, R) => b + R, 0) / c.length) : void 0;
    const z = N.filter((b) => b.result === "W").length;
    de = Math.round(z / re * 100);
  }
  const { formStatus: d, recentKd: E, recentAdr: j } = We(x, W, H);
  return {
    playerId: s,
    nickname: y,
    avatar: m,
    country: f,
    steamId64: r,
    elo: Number.isFinite(h) ? h : 1e3,
    skillLevel: Number.isFinite(l) ? l : 1,
    totalMatches: T,
    overallWinRate: B,
    overallKd: W,
    overallHsPercent: Y,
    overallAdr: H,
    statsAvailable: u,
    last30Kd: U,
    last30Adr: V,
    last30AdrMatches: ee,
    last30HsPercent: oe,
    last30WinRate: de,
    last30Matches: re,
    currentStreak: { type: Z, count: q },
    recentMatches: x,
    mapStats: K,
    registrationDate: a?.created_at,
    formStatus: d,
    recentKd: E,
    recentAdr: j
  };
}
function Ge(s, e) {
  return e.user !== void 0 || e.stats !== void 0 || Array.isArray(e.time) && e.time.length > 0 ? Oe(
    s,
    void 0,
    e.user ?? null,
    e.stats ?? null,
    null,
    Array.isArray(e.time) ? e.time : []
  ) : null;
}
const xe = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Ue(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return xe.includes(e) ? e : "VOTING";
}
function ke(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, a = s.teams?.faction2 || s.faction2 || {}, t = s.voting?.map?.pick || [], i = t.length > 0 ? t[t.length - 1] : [...s.voting?.map?.entities || []].reverse().find((l) => l.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, o = n && /^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(n) ? n : void 0, h = (l) => (l || []).map((r) => ({
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
    status: Ue(s.status),
    configured_at: s.configured_at,
    started_at: s.started_at,
    finished_at: s.finished_at,
    teams: {
      faction1: {
        faction_id: e.id || e.faction_id || "faction1",
        name: e.name || "Team 1",
        avatar: e.avatar,
        leader: e.leader,
        roster: h(e.roster)
      },
      faction2: {
        faction_id: a.id || a.faction_id || "faction2",
        name: a.name || "Team 2",
        avatar: a.avatar,
        leader: a.leader,
        roster: h(a.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: o
  };
}
const $e = (s) => new Promise((e) => setTimeout(e, s));
async function Ve(s, e = {}, a = ne.REQUEST_TIMEOUT_MS) {
  const t = new AbortController(), i = setTimeout(() => t.abort(), a);
  try {
    return await fetch(s, { ...e, signal: t.signal });
  } finally {
    clearTimeout(i);
  }
}
let Te = 0, Fe = Promise.resolve();
function Ce(s, e) {
  const a = async () => {
    const i = Te + ne.MIN_REQUEST_INTERVAL_MS - Date.now();
    return i > 0 && await $e(i), Te = Date.now(), Ve(s, { headers: { Accept: "application/json" } }, e);
  }, t = Fe.then(a, a);
  return Fe = t.catch(() => {
  }), t;
}
async function ge(s, e = ne.REQUEST_TIMEOUT_MS) {
  let a = await Ce(s, e);
  if (a.status === 429 || a.status === 503 || a.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${a.status} from ${new URL(s).pathname} — backing off once`), Te = Date.now() + ne.BACKOFF_COOLDOWN_MS, await $e(ne.BACKOFF_RETRY_BASE_MS + Math.floor(Math.random() * ne.BACKOFF_RETRY_JITTER_MS));
    try {
      a = await Ce(s, e);
    } catch {
    }
  }
  return a;
}
class je {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !ne.ID_PATTERN.test(e)) return null;
    const a = await P.get(`intercepted_match:${e}`);
    if (a) return a;
    if (this.inFlightMatch.has(e)) return this.inFlightMatch.get(e);
    const t = this.fetchMatchDetailsInternal(e).finally(() => this.inFlightMatch.delete(e));
    return this.inFlightMatch.set(e, t), t;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const a = await ge(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`);
      if (!a.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${a.status}`), null;
      const t = await a.json();
      return ke(t.payload || t);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, a), null;
    }
  }
  async getPlayerStats(e, a) {
    if (!e || !ne.ID_PATTERN.test(e)) return null;
    const t = `${e}_${a || ""}`;
    if (this.inFlightPlayer.has(t)) return this.inFlightPlayer.get(t);
    const i = this.fetchPlayerStatsInternal(e, a).finally(() => this.inFlightPlayer.delete(t));
    return this.inFlightPlayer.set(t, i), i;
  }
  async fetchPlayerStatsInternal(e, a) {
    try {
      const t = encodeURIComponent(e), [i, n, o] = await Promise.allSettled([
        ge(`https://api.faceit.com/users/v1/users/${t}`),
        ge(`https://api.faceit.com/stats/v1/stats/users/${t}/games/cs2`),
        ge(`https://api.faceit.com/stats/v1/stats/time/users/${t}/games/cs2?size=30`)
      ]);
      let h = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const m = await i.value.json();
        h = m.payload || m;
      }
      let l = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const m = await n.value.json();
        l = m.payload || m;
      }
      let r = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const m = await o.value.json(), f = m.payload || m;
        r = Array.isArray(f) ? f : f?.items || f?.segments || [];
      }
      let y = null;
      if (!(!!(l?.lifetime && Object.keys(l.lifetime).length > 0) || Array.isArray(l?.segments) && l.segments.length > 0 || r.length > 0))
        try {
          const m = await ge(`https://api.faceit.com/stats/v1/stats/users/${t}/games/csgo`);
          if (m.ok) {
            const f = await m.json();
            y = f.payload || f;
          }
        } catch {
        }
      return Oe(e, a, h, l, y, r);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
}
const Ie = new je();
function ze(s, e) {
  const a = !s.includes("<privacyState>public</privacyState>"), t = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: t ? t[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let o = 0, h = 0;
  const l = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (l) {
    const f = l[1].split("</mostPlayedGame>");
    for (const _ of f)
      if (_.includes("Counter-Strike 2") || _.includes("Counter-Strike: Global Offensive")) {
        const w = _.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        w && (o = parseFloat(w[1].replace(/,/g, "")));
        const S = _.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        S && (h = parseFloat(S[1].replace(/,/g, "")), o === 0 && (o = h));
        break;
      }
  }
  const r = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (r) {
    const f = new Date(r[1]);
    isNaN(f.getTime()) || (n.timeCreated = f.getTime() / 1e3, n.accountAgeYears = (Date.now() - f.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const y = s.match(/<communityBanned>(.*?)<\/communityBanned>/), A = s.match(/<vacBanned>(.*?)<\/vacBanned>/), m = {
    steamId64: e,
    communityBanned: y ? y[1] === "1" : !1,
    vacBanned: A ? A[1] === "1" : !1,
    numberOfVACBans: parseInt(s.match(/<numberOfVACBans>(.*?)<\/numberOfVACBans>/)?.[1] || "0", 10),
    daysSinceLastBan: parseInt(s.match(/<daysSinceLastBan>(.*?)<\/daysSinceLastBan>/)?.[1] || "0", 10),
    numberOfGameBans: parseInt(s.match(/<numberOfGameBans>(.*?)<\/numberOfGameBans>/)?.[1] || "0", 10),
    economyBan: s.match(/<economyBan>(.*?)<\/economyBan>/)?.[1] || "none"
  };
  return {
    summary: n,
    playtime: {
      cs2HoursTotal: o,
      cs2HoursLast2Weeks: h
    },
    bans: m,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
async function Qe(s, e = {}, a = Le.REQUEST_TIMEOUT_MS) {
  const t = new AbortController(), i = setTimeout(() => t.abort(), a);
  try {
    return await fetch(s, { ...e, signal: t.signal });
  } finally {
    clearTimeout(i);
  }
}
class Je {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(e) {
    if (!e || !Le.STEAM_ID_PATTERN.test(e))
      return { isPrivate: !1, fetchError: !0, fetchedAt: Date.now() };
    if (this.inFlightSteam.has(e))
      return this.inFlightSteam.get(e);
    const a = this.fetchSteamDataInternal(e).finally(() => {
      this.inFlightSteam.delete(e);
    });
    return this.inFlightSteam.set(e, a), a;
  }
  async fetchSteamDataInternal(e) {
    try {
      const a = await Qe(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!a.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const t = await a.text();
      return t.includes("<steamID>") ? ze(t, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Xe = new Je();
function qe(s, e) {
  const a = [];
  let t = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, o = s.overallKd || 1, h = s.overallWinRate || 50, l = s.recentKd || o, r = s.recentAdr || 75, y = s.statsAvailable !== !1;
  y && (n >= 2200 && i < 100 ? (t += 45, a.push({
    id: "lvl10_extreme_low_matches",
    title: "High Elo on Very Fresh Account",
    description: `${n} Elo achieved in only ${i} matches`,
    weight: 45,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 2e3 && i < 150 ? (t += 35, a.push({
    id: "lvl10_low_matches",
    title: "Level 10 with Low Matches",
    description: `Level 10 (${n} Elo) in only ${i} matches`,
    weight: 35,
    severity: "danger",
    category: "MATCHES_ELO"
  })) : n >= 1600 && i < 80 ? (t += 25, a.push({
    id: "high_elo_low_matches",
    title: "High Level on Fresh Account",
    description: `${n} Elo achieved in only ${i} matches`,
    weight: 25,
    severity: "warning",
    category: "MATCHES_ELO"
  })) : n >= 1350 && i < 40 ? (t += 18, a.push({
    id: "mid_elo_fresh_account",
    title: "Level 7+ on New Account",
    description: `${n} Elo with only ${i} matches`,
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
  })) : i >= 800 && (t -= 15)), y && o >= 2 ? (t += 30, a.push({
    id: "extreme_kd",
    title: "Exceptional K/D Ratio (2.0+)",
    description: `Lifetime K/D of ${o.toFixed(2)} is drastically above normal distribution`,
    weight: 30,
    severity: "danger",
    category: "KD_ANOMALY"
  })) : o >= 1.6 && i < 200 ? (t += 20, a.push({
    id: "high_kd_fresh",
    title: "High K/D Ratio on Recent Account",
    description: `K/D of ${o.toFixed(2)} with ${i} matches`,
    weight: 20,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : o >= 1.4 && i < 150 ? (t += 12, a.push({
    id: "elevated_kd",
    title: "Elevated K/D Ratio",
    description: `Overall K/D of ${o.toFixed(2)}`,
    weight: 12,
    severity: "warning",
    category: "KD_ANOMALY"
  })) : o < 0.95 && i >= 50 && (t -= 10), y && s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (t += 22, a.push({
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
  })), r >= 95 && s.overallAdr !== void 0 && r >= s.overallAdr * 1.2 && (t += 12, a.push({
    id: "recent_adr_spike",
    title: "Recent ADR Spike",
    description: `Last 5 games ADR (${r}) is 20%+ above lifetime baseline (${s.overallAdr.toFixed(0)})`,
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
  })) : s.overallHsPercent >= 60 && o >= 1.5 && (t += 8, a.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${o.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), y && h >= 80 && i >= 10 ? (t += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${h.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : h >= 70 && i >= 15 ? (t += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${h.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : h >= 62 && i >= 25 && (t += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${h.toFixed(0)}%`,
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
  })) : s.last30WinRate >= 75 && n >= 1500 && (t += 8, a.push({
    id: "elevated_recent_winrate",
    title: "High Recent Win Rate (75%+)",
    description: `Won ${s.last30WinRate}% of the last ${s.last30Matches} matches`,
    weight: 8,
    severity: "info",
    category: "WINRATE_ANOMALY"
  }))), l >= 1.75 && l >= o * 1.35 && i >= 10 && (t += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${l.toFixed(2)}) is significantly higher than lifetime baseline (${o.toFixed(2)})`,
    weight: 15,
    severity: "warning",
    category: "KD_ANOMALY"
  })), s.last30Kd !== void 0 && s.last30Kd >= 1.5 && s.last30Kd >= o * 1.3 && i >= 30 && (t += 10, a.push({
    id: "midterm_kd_spike",
    title: "Mid-Term K/D Spike",
    description: `Last 30 games K/D (${s.last30Kd.toFixed(2)}) well above lifetime baseline (${o.toFixed(2)})`,
    weight: 10,
    severity: "warning",
    category: "KD_ANOMALY"
  }));
  let A = !0;
  if (!e || e.fetchError)
    A = !1;
  else if (e.isPrivate) {
    A = !0, a.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const u = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    u >= 15 && (t += u, a.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: u,
      severity: u >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), y && i < 100 && (t += 10, a.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const T = s.last30Kd ?? l;
    T >= 1.6 && (t += 8, a.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${T.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (A = !1, e.summary) {
    const u = e.playtime?.cs2HoursTotal !== void 0, T = u ? e.playtime.cs2HoursTotal ?? 0 : 0, B = u && T === 0;
    T > 0 && T < 150 && n >= 1600 || B && n >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: B ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
      description: `Only ${T}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : T > 0 && T < 350 && n >= 2e3 ? (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${T}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : u && T >= 2500 && (t -= 15);
    const W = e.summary.accountAgeYears;
    W !== void 0 && W < 1 && n >= 1400 && (t += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${W.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const u = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), T = 25;
    t += T, a.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${u} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: T,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const m = s.registrationDate ? new Date(s.registrationDate) : null;
  if (m && !isNaN(m.getTime())) {
    const u = (Date.now() - m.getTime()) / 315576e5;
    u < 0.5 && n >= 1350 ? (t += 22, a.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${u.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : u < 1 && n >= 1600 && (t += 18, a.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${u.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const f = Math.min(100, Math.max(0, Math.round(t)));
  let _ = "LOW", w = "#10B981", S = "Legit";
  return f >= 70 ? (_ = "CRITICAL", w = "#DC2626", S = "High Risk") : f >= 45 ? (_ = "HIGH", w = "#EF4444", S = "Likely Smurf") : f >= 25 && (_ = "MEDIUM", w = "#F59E0B", S = "Suspicious"), {
    score: f,
    level: _,
    flags: a,
    isPrivateSteam: A,
    summary: `${f}% Smurf Risk (${_})`,
    color: w,
    badgeText: S
  };
}
const we = [
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
function Ze(s, e) {
  const a = [];
  let t = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const o = /* @__PURE__ */ new Map();
    for (const f of n.roster)
      if (f.party_id) {
        const _ = o.get(f.party_id) || [];
        _.push(f.player_id), o.set(f.party_id, _);
      }
    const h = /* @__PURE__ */ new Set();
    for (const [, f] of o.entries())
      if (f.length >= 2) {
        const _ = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${_} (${f.length})`,
          color: we[t % we.length],
          playerIds: f
        }), t++, f.forEach((w) => h.add(w));
      }
    const l = n.roster.map((f) => f.player_id).filter((f) => !h.has(f)), r = 15, y = /* @__PURE__ */ new Map();
    for (const f of l) {
      const _ = e[f];
      _?.recentMatches && y.set(f, new Set(_.recentMatches.slice(0, r).map((w) => w.matchId)));
    }
    const A = /* @__PURE__ */ new Set(), m = (f, _) => {
      const w = y.get(f), S = y.get(_);
      if (!w || !S) return !1;
      let u = 0;
      for (const T of w)
        if (S.has(T) && u++, u >= 2) return !0;
      return !1;
    };
    for (const f of l) {
      if (A.has(f)) continue;
      const _ = [], w = [f];
      for (A.add(f); w.length > 0; ) {
        const S = w.shift();
        _.push(S);
        for (const u of l)
          !A.has(u) && m(S, u) && (A.add(u), w.push(u));
      }
      if (_.length >= 2) {
        _.forEach((u) => h.add(u));
        const S = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${S} (${_.length})`,
          color: we[t % we.length],
          playerIds: _
        }), t++;
      }
    }
  }
  return a;
}
function et(s) {
  const e = [
    [/\/users\/v1\/users\/([^/?#]+)/, "user"],
    [/\/stats\/v1\/stats\/users\/([^/?#]+)\/games\/cs2/, "stats"],
    [/\/stats\/v1\/stats\/time\/users\/([^/?#]+)\/games\/cs2/, "time"]
  ];
  for (const [a, t] of e) {
    const i = s.match(a);
    if (i && i[1]) {
      let n;
      try {
        n = decodeURIComponent(i[1]);
      } catch {
        n = i[1];
      }
      if (/^[^/?#\s]{1,64}$/.test(n) && n.trim() === n)
        return { kind: t, playerId: n };
    }
  }
  return null;
}
const Pe = "maps_observed_cache", tt = ie.TTL.OBSERVED_MAPS_MS, De = "maps_observed_v2", at = ie.TTL.OBSERVED_MAPS_MS * 7;
function He(s) {
  return s.replace(/^(cs2_|csgo_|de_)/i, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
}
function st(s) {
  const e = s, a = [], t = e?.voting?.map?.entities ?? e?.payload?.voting?.map?.entities ?? e?.match?.voting?.map?.entities ?? e?.voting?.veto?.entities ?? e?.payload?.voting?.veto?.entities;
  Array.isArray(t) && a.push(...t);
  const i = e?.voting?.map?.pick ?? e?.payload?.voting?.map?.pick ?? e?.match?.voting?.map?.pick;
  if (Array.isArray(i))
    for (const h of i) typeof h == "string" && a.push({ name: h });
  const n = e?.map ?? e?.payload?.map ?? e?.match?.map ?? e?.selected_map ?? e?.payload?.selected_map;
  typeof n == "string" ? a.push({ name: n }) : n && typeof n?.name == "string" && a.push({ name: n.name });
  const o = [];
  for (const h of a) {
    let l = typeof h == "string" ? h : h?.name ?? h?.id ?? h?.guid ?? h?.map_name ?? "";
    if (!l || typeof l != "string" || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(l)) continue;
    const r = He(l);
    r && o.push(r);
  }
  return Array.from(new Set(o));
}
async function it(s) {
  const e = s.map(He).filter(Boolean);
  if (e.length === 0) return;
  const a = await P.get(De) || [], t = new Map(a.map((l) => [l.name, l])), i = Date.now();
  for (const l of e) {
    const r = t.get(l);
    t.set(l, { name: l, hits: (r?.hits || 0) + 1, lastSeen: i });
  }
  for (const [l, r] of [...t.entries()])
    i - r.lastSeen > 7 * 864e5 && r.hits < 3 && t.delete(l);
  const n = [...t.values()].sort((l, r) => r.lastSeen - l.lastSeen).slice(0, 20);
  await P.set(De, n, at);
  const o = await P.get(Pe) || [], h = Array.from(/* @__PURE__ */ new Set([...o, ...e]));
  await P.set(Pe, h.slice(-20), tt);
}
const nt = (s) => new Promise((e) => setTimeout(e, s));
async function rt(s, e, a, t = Ee.MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const l = n++;
      i[l] = await a(s[l], l), t > 0 && await nt(t);
    }
  }, h = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(h), i;
}
class ot {
  settings = { ..._e };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  // Monotonic per-match stream generation; superseded streams stop broadcasting.
  streamGenerations = /* @__PURE__ */ new Map();
  async init() {
    if (!this.initialized) {
      await this.loadSettings(), this.initialized = !0, P.cleanup().catch(() => {
      });
      try {
        typeof chrome < "u" && chrome.tabs?.onRemoved && chrome.tabs.onRemoved.addListener((e) => {
          for (const a of this.streamSubscribers.values()) a.delete(e);
          for (const [a, t] of this.streamSubscribers.entries()) t.size === 0 && this.streamSubscribers.delete(a);
        });
      } catch {
      }
    }
  }
  async loadSettings() {
    const e = await P.get(pe);
    return e && (this.settings = { ..._e, ...e }), this.settings;
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
        case "INTERCEPTED_MATCH_PAYLOAD":
          return this.handleInterceptedMatchPayload(e.payload);
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
      const a = typeof e?.matchId == "string" ? e.matchId : "";
      if (!a)
        return await this.handleInterceptedProfilePayload(e);
      if (!ne.ROOM_ID_PATTERN.test(a))
        return { success: !1, error: "Invalid intercepted matchId" };
      if (!e?.body || typeof e.body != "object")
        return { success: !1, error: "Invalid intercepted match body" };
      const t = e.body.payload ?? e.body, i = ke(t);
      return await P.set(`intercepted_match:${a}`, i, se.MATCH), it(st(e.body)).catch(() => {
      }), { success: !0, data: { status: i.status } };
    } catch (a) {
      return console.warn("[f-insight:Background] Intercepted match payload rejected:", a?.message || a), { success: !1, error: a?.message || "Intercepted payload parse failed" };
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
    const a = typeof e?.url == "string" ? e.url : "", t = et(a);
    if (!t)
      return { success: !1, error: "Unrecognized intercepted URL" };
    if (!e?.body || typeof e.body != "object")
      return { success: !1, error: "Invalid intercepted profile body" };
    const { kind: i, playerId: n } = t, o = e.body.payload ?? e.body, h = `intercept_profile:${n}`, l = await P.get(h) || {};
    let r = !1, y;
    if (i === "user" && o && typeof o == "object" && !Array.isArray(o)) {
      l.user = o, r = !0;
      const m = o.nickname;
      typeof m == "string" && m.trim() && (y = { guid: n, nickname: m.trim() });
    } else if (i === "stats" && o && typeof o == "object" && !Array.isArray(o))
      l.stats = o, r = !0;
    else if (i === "time") {
      const m = Array.isArray(o) ? o : Array.isArray(o?.items) ? o.items : null;
      m && m.length > 0 && (l.time = m, r = !0);
    }
    if (!r)
      return { success: !1, error: `Intercepted ${i} payload had no usable shape` };
    await P.set(h, l, se.NEGATIVE * ie.TTL.INTERCEPT_STAGE_FACTOR);
    const A = Ge(n, l);
    return A ? (await P.set(
      `player_stats:${n}`,
      A,
      A.statsAvailable === !1 ? se.NEGATIVE : se.PLAYER_STATS
    ), console.warn(
      `[f-insight:Background] Hydrated player ${n} from intercepted ${i} payload (statsAvailable=${A.statsAvailable !== !1})`
    ), {
      success: !0,
      data: {
        kind: "profile-hydrated",
        playerId: n,
        statsAvailable: A.statsAvailable !== !1,
        selfCandidate: y
      }
    }) : { success: !0, data: { kind: "profile-staged", playerId: n, selfCandidate: y } };
  }
  async handleSaveSettings(e) {
    const a = {};
    for (const t of Object.keys(_e))
      if (e && typeof e == "object" && t in e) {
        const i = _e[t], n = e[t];
        typeof n == typeof i && (a[t] = n);
      }
    return this.settings = { ...this.settings, ...a }, await P.set(pe, this.settings, se.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: i } = e, n = `match_analysis:${t}`;
    if (a?.tab?.id && (this.streamSubscribers.has(t) || this.streamSubscribers.set(t, /* @__PURE__ */ new Set()), this.streamSubscribers.get(t).add(a.tab.id)), !i) {
      const h = await P.get(n);
      if (h && !h.isPartial)
        return { success: !0, data: h };
    }
    const o = await Ie.getMatchDetails(t);
    if (!o)
      return { success: !1, error: `Could not fetch match details for ${t}` };
    if (!this.inFlightStreams.has(t) || i) {
      const h = (this.streamGenerations.get(t) || 0) + 1;
      this.streamGenerations.set(t, h);
      const l = this.streamLobbyData(t, o, i, h).finally(() => {
        this.inFlightStreams.get(t) === l && (this.inFlightStreams.delete(t), this.streamSubscribers.delete(t));
      });
      this.inFlightStreams.set(t, l);
    }
    return { success: !0, data: { match: o, isPartial: !0 } };
  }
  async streamLobbyData(e, a, t, i) {
    try {
      await this.streamLobbyDataInner(e, a, t, i);
    } catch (n) {
      console.error("[f-insight:Stream] Error:", n), this.broadcastFromStream(e, i, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: e, error: n?.message || "Match analysis stream failed" }
      });
    }
  }
  broadcastToSubscribers(e, a) {
    const t = this.streamSubscribers.get(e);
    if (!(!t || t.size === 0))
      for (const i of t)
        this.safeSendToTab(i, a);
  }
  /**
   * Broadcast guarded by the stream generation: after a forceRefresh spawned
   * a newer stream, superseded ones must stay silent — otherwise a slow old
   * per-player snapshot would overwrite fresher data on the content side.
   */
  broadcastFromStream(e, a, t) {
    this.streamGenerations.get(e) === a && this.broadcastToSubscribers(e, t);
  }
  async streamLobbyDataInner(e, a, t, i) {
    const n = `match_analysis:${e}`, o = a.teams?.faction1?.roster || [], h = a.teams?.faction2?.roster || [], l = [...o, ...h], r = {}, y = {}, A = {};
    await rt(
      l,
      Ee.CONCURRENCY,
      async (d) => {
        const E = d.player_id;
        if (!E) return;
        const j = `player_stats:${E}`;
        let p = null;
        if (t || (p = await P.get(j)), !p) {
          const M = await Ie.getPlayerStats(E, d.nickname);
          if (M && M.statsAvailable === !1) {
            const v = await P.get(j);
            v && v.statsAvailable !== !1 ? p = v : (await P.set(j, M, se.NEGATIVE), p = M);
          } else M && (await P.set(j, M, se.PLAYER_STATS), p = M);
        }
        if (p) {
          r[E] = p;
          const M = p.steamId64 || d.game_player_id;
          if (M) {
            const v = `steam_data:${M}`;
            let c = null;
            t || (c = await P.get(v)), c || (c = await Xe.getPlayerFullData(M), c && !c.fetchError && await P.set(v, c, se.STEAM_PROFILE)), c && (y[E] = c);
          }
          A[E] = qe(p, y[E]), this.broadcastFromStream(e, i, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: E, stats: p, steam: y[E], risk: A[E] }
          });
        }
      },
      Ee.CONCURRENCY_DELAY_MS
    );
    const m = o.map((d) => r[d.player_id]?.elo || d.elo || 1e3), f = h.map((d) => r[d.player_id]?.elo || d.elo || 1e3), _ = m.reduce((d, E) => d + E, 0), w = f.reduce((d, E) => d + E, 0), S = m.length > 0 ? Math.round(_ / m.length) : 1e3, u = f.length > 0 ? Math.round(w / f.length) : 1e3, T = S - u, B = o.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), W = h.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), Y = B.length > 0 ? parseFloat((B.reduce((d, E) => d + E, 0) / B.length).toFixed(2)) : 1, ce = W.length > 0 ? parseFloat((W.reduce((d, E) => d + E, 0) / W.length).toFixed(2)) : 1, H = o.map((d) => r[d.player_id]?.overallHsPercent || 0), K = h.map((d) => r[d.player_id]?.overallHsPercent || 0), le = H.length > 0 ? Math.round(H.reduce((d, E) => d + E, 0) / H.length) : 0, x = K.length > 0 ? Math.round(K.reduce((d, E) => d + E, 0) / K.length) : 0, q = o.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), Z = h.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), me = q.length > 0 ? Math.round(q.reduce((d, E) => d + E, 0) / q.length) : 75, D = Z.length > 0 ? Math.round(Z.reduce((d, E) => d + E, 0) / Z.length) : 75, N = o.map((d) => r[d.player_id]).filter(Boolean), re = h.map((d) => r[d.player_id]).filter(Boolean), U = Re(N), V = Re(re);
    for (const [d, E] of Object.entries(U))
      r[d] && (r[d].fcrContributionPercent = E);
    for (const [d, E] of Object.entries(V))
      r[d] && (r[d].fcrContributionPercent = E);
    const ee = Ze(a, r), oe = Ye({
      f1AvgElo: S,
      f2AvgElo: u,
      f1Players: N,
      f2Players: re,
      selectedMap: a.selected_map,
      premadeGroups: ee,
      riskAnalysis: A,
      f1Fcr: U,
      f2Fcr: V
    }), de = {
      match: a,
      playersStats: r,
      steamData: y,
      riskAnalysis: A,
      premadeGroups: ee,
      teamSummary: {
        faction1: {
          totalElo: _,
          avgElo: S,
          winChancePercent: oe.winChanceF1,
          avgKd: Y,
          avgHsPercent: le,
          avgAdr: me
        },
        faction2: {
          totalElo: w,
          avgElo: u,
          winChancePercent: oe.winChanceF2,
          avgKd: ce,
          avgHsPercent: x,
          avgAdr: D
        },
        eloDifference: Math.abs(T)
      },
      prediction: oe,
      isPartial: !1
    };
    this.streamGenerations.get(e) === i && (await P.set(n, de, se.MATCH), this.broadcastFromStream(e, i, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: de
    }));
  }
  safeSendToTab(e, a) {
    chrome.tabs.sendMessage(e, a).catch((t) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", t?.message || t);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await P.getStats() };
  }
  async handleClearCache() {
    return await P.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const Se = new ot(), Ke = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), Ke(), await Se.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), Ke(), await Se.init();
});
chrome.runtime.onMessage.addListener((s, e, a) => (Se.init().then(() => Se.handleMessage(s, e)).then(a).catch((t) => {
  console.error("[f-insight:Background] Message handling failed:", t);
  try {
    a({ success: !1, error: t?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await P.cleanup());
});
