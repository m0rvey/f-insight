const Ae = {
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
}, re = {
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
}, Pe = {
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
}, ie = {
  MATCH: ne.TTL.MATCH_MS,
  PLAYER_STATS: ne.TTL.PLAYER_STATS_MS,
  STEAM_PROFILE: ne.TTL.STEAM_PROFILE_MS,
  NEGATIVE: ne.TTL.NEGATIVE_MS,
  SETTINGS: ne.TTL.SETTINGS_MS
}, pe = "settings", Ee = ne.MAX_MEMORY_ENTRIES;
class He {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= Ee) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > Ee; ) {
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
const C = new He();
function Te(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const a = s.map((r) => {
    const y = Number.isFinite(r.elo) ? r.elo : 1e3, A = Math.max(500, y || 1e3) / 1e3, m = Number.isFinite(r.last30Kd) ? r.last30Kd : Number.isFinite(r.overallKd) ? r.overallKd : 1, f = Math.min(2.5, Math.max(0.4, m ?? 1)), _ = 1 + (((Number.isFinite(r.last30Adr) ? r.last30Adr : Number.isFinite(r.overallAdr) ? r.overallAdr : 75) ?? 75) - 75) / 150, w = A * f * Math.max(0.6, _);
    return { id: r.playerId, power: Number.isFinite(w) && w > 0 ? w : 1 };
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
function Ke(s, e, a) {
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
    const m = o.reduce((v, _) => v + (_.kills || 0), 0), f = o.reduce((v, _) => v + (_.deaths || 0), 0);
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
function Be(s) {
  const {
    f1Players: e,
    f2Players: a,
    selectedMap: t,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: h
  } = s, l = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, r = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, y = l, A = r, m = A - y, f = 1 / (1 + Math.pow(10, m / 400));
  let v = 0, _;
  const w = (t || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (w) {
    const p = e.reduce((j, z) => j + (z.mapStats?.[w]?.wins || 0), 0), P = e.reduce((j, z) => j + (z.mapStats?.[w]?.matches || 0), 0), R = a.reduce((j, z) => j + (z.mapStats?.[w]?.wins || 0), 0), k = a.reduce((j, z) => j + (z.mapStats?.[w]?.matches || 0), 0), G = Math.round((p + 2.5) / (P + 5) * 100), q = Math.round((R + 2.5) / (k + 5) * 100), J = G - q;
    P + k >= 10 && (v = Math.max(-0.12, Math.min(0.12, J / 100 * 0.25))), _ = {
      leader: J >= 5 ? "faction1" : J <= -5 ? "faction2" : "balanced",
      mapName: w,
      f1WinRate: G,
      f2WinRate: q,
      deltaWinRate: Math.abs(J)
    };
  }
  let u = 0, b;
  const B = e.map((p) => p.last30Adr ?? p.overallAdr).filter((p) => typeof p == "number" && Number.isFinite(p) && p >= 5 && p <= 200), W = a.map((p) => p.last30Adr ?? p.overallAdr).filter((p) => typeof p == "number" && Number.isFinite(p) && p >= 5 && p <= 200);
  if (B.length >= 3 && W.length >= 3) {
    const p = Math.round(B.reduce((k, G) => k + G, 0) / B.length), P = Math.round(W.reduce((k, G) => k + G, 0) / W.length), R = p - P;
    u = Math.max(-0.08, Math.min(0.08, R / 130)), b = {
      leader: R >= 5 ? "faction1" : R <= -5 ? "faction2" : "balanced",
      f1AvgAdr: p,
      f2AvgAdr: P,
      delta: R
    };
  }
  const Y = e.filter((p) => p.formStatus === "HOT").length, le = e.filter((p) => p.formStatus === "COLD").length, H = a.filter((p) => p.formStatus === "HOT").length, K = a.filter((p) => p.formStatus === "COLD").length, de = Y - le, X = H - K, Z = Math.max(-0.1, Math.min(0.1, (de - X) * 0.03)), ee = new Set(e.map((p) => p.playerId)), me = new Set(a.map((p) => p.playerId));
  let I = 1, L = 1;
  for (const p of i) {
    const P = p.playerIds.filter((k) => ee.has(k)).length, R = p.playerIds.filter((k) => me.has(k)).length;
    P > I && (I = P), R > L && (L = R);
  }
  const oe = Math.max(-0.08, Math.min(0.08, (I - L) * 0.02)), x = e.filter((p) => {
    const P = n[p.playerId]?.level;
    return P === "HIGH" || P === "CRITICAL";
  }).length, U = a.filter((p) => {
    const P = n[p.playerId]?.level;
    return P === "HIGH" || P === "CRITICAL";
  }).length, te = Math.max(-0.06, Math.min(0.06, (x - U) * 0.02)), ce = f + v + u + Z + oe + te, he = Math.max(0.06, Math.min(0.94, ce)), d = Math.round(he * 100), E = 100 - d;
  let V = 13, g = 9;
  const c = Math.abs(d - 50), M = c <= 8;
  c <= 8 ? (V = d >= 50 ? 13 : 11, g = d >= 50 ? 11 : 13) : c <= 16 ? (V = d >= 50 ? 13 : 8, g = d >= 50 ? 8 : 13) : c <= 26 ? (V = d >= 50 ? 13 : 5, g = d >= 50 ? 5 : 13) : (V = d >= 50 ? 13 : 3, g = d >= 50 ? 3 : 13);
  const S = [];
  Math.abs(y - A) >= 60 && S.push(
    y > A ? `Team 1 holds +${Math.round(y - A)} avg Elo edge` : `Team 2 holds +${Math.round(A - y)} avg Elo edge`
  ), _ && _.deltaWinRate >= 8 && S.push(
    _.leader === "faction1" ? `Team 1 dominates ${_.mapName} (+${_.deltaWinRate}% WR)` : `Team 2 dominates ${_.mapName} (+${_.deltaWinRate}% WR)`
  ), b && Math.abs(b.delta) >= 8 && S.push(
    b.leader === "faction1" ? `Team 1 ADR edge +${b.delta} (firepower)` : `Team 2 ADR edge +${Math.abs(b.delta)} (firepower)`
  ), Y > H && Y >= 2 ? S.push(`Team 1 on hot momentum (${Y} players On Fire)`) : H > Y && H >= 2 && S.push(`Team 2 on hot momentum (${H} players On Fire)`), I >= 3 && I > L ? S.push(`Team 1 has ${I}-stack coordination`) : L >= 3 && L > I && S.push(`Team 2 has ${L}-stack coordination`), Math.abs(te) >= 0.04 && x + U > 0 && (x > U ? S.push(`Team 1 likely carries flagged accounts (${x} risk flagged)`) : U > x && S.push(`Team 2 likely carries flagged accounts (${U} risk flagged)`));
  const N = S.length > 0 ? S.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", T = (p, P) => {
    let R = p[0], k = -1;
    for (const G of p) {
      const J = (P[G.playerId] || 20) * 1.5 + (G.last30Kd ?? G.overallKd ?? 1) * 10;
      J > k && (k = J, R = G);
    }
    return R ? {
      nickname: R.nickname,
      fcr: P[R.playerId] || 20,
      kd: R.last30Kd ?? R.overallKd ?? 1,
      elo: R.elo || 1e3
    } : void 0;
  }, O = T(e, o), ae = T(a, h);
  return {
    winChanceF1: d,
    winChanceF2: E,
    predictedScore: {
      f1Score: V,
      f2Score: g,
      isOvertimeLikely: M
    },
    keyAdvantageText: N,
    factors: {
      eloDelta: Math.round(y - A),
      mapAdvantage: _,
      momentumAdvantage: {
        leader: de > X ? "faction1" : X > de ? "faction2" : "balanced",
        f1HotCount: Y,
        f2HotCount: H,
        f1ColdCount: le,
        f2ColdCount: K
      },
      premadeAdvantage: {
        leader: I > L ? "faction1" : L > I ? "faction2" : "balanced",
        f1MaxPartySize: I,
        f2MaxPartySize: L
      },
      smurfRiskDelta: {
        f1HighRiskCount: x,
        f2HighRiskCount: U,
        impactPercent: Math.round(te * 100)
      },
      adrAdvantage: b
    },
    starMatchup: O && ae ? { f1Star: O, f2Star: ae } : void 0
  };
}
const D = (s, ...e) => {
  for (const a of e) {
    const t = s?.[a];
    if (t != null && t !== "") return t;
  }
};
function De(s) {
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
  const a = typeof s == "number" ? String(s) : De(String(s)), t = parseFloat(a);
  return Number.isFinite(t) ? Math.round(t) : e;
}, $ = (s, e) => {
  if (s == null || s === "") return e;
  const a = typeof s == "number" ? String(s) : De(String(s)), t = parseFloat(a);
  return Number.isFinite(t) ? t : e;
};
function Le(s, e, a, t, i, n) {
  const o = a?.games?.cs2 || a?.games?.csgo || {}, h = o.faceit_elo || 1e3, l = o.skill_level || 1, r = o.game_player_id || a?.steam_id_64, y = a?.nickname || e || "Player", A = a?.avatar || "";
  let m = "";
  typeof A == "string" && A && (/^https:\/\/.*\.faceit-cdn\.net\//.test(A) || /^https:\/\/(www\.)?faceit\.com\//.test(A) ? m = A : A.startsWith("https://") || A.startsWith("data:") ? m = "" : m = A);
  const f = a?.country || "", v = Array.isArray(t) ? null : t, _ = Array.isArray(i) ? null : i, w = v?.lifetime || _?.lifetime || {}, u = Object.keys(w).length > 0, b = ue(D(w, "Total Matches", "Matches", "m1"), 0), B = $(D(w, "Win Rate %", "k6"), 0) ?? 0, W = $(D(w, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, Y = $(D(w, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, le = D(w, "ADR", "adr", "c3");
  let H = le ? $(le, void 0) : void 0;
  const K = {}, de = [
    ...Array.isArray(t) ? t : t?.segments || t?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const g of de) {
    const M = (g._id?.segmentId || g._id?.label || g.label || g.segmentId || g.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (M) {
      const S = ue(D(g.stats, "Matches") ?? D(g, "m1", "matches"), 0), N = $(D(g.stats, "Win Rate %") ?? D(g, "k6", "winRate"), 0) ?? 0, T = $(D(g.stats, "Average K/D Ratio", "K/D Ratio") ?? D(g, "k5", "kd"), 1) ?? 1, O = $(D(g.stats, "Average Headshots %") ?? D(g, "k8", "hsPercent"), 0) ?? 0, ae = $(D(g.stats, "Average Kills") ?? D(g, "k1", "avgKills"), 0) ?? 0, p = D(g.stats, "ADR") ?? D(g, "c3", "adr"), P = p ? $(p, void 0) : void 0, R = ue(D(g.stats, "Wins") ?? D(g, "m2", "wins"), Math.round(S * N / 100));
      (!K[M] || S > K[M].matches) && (K[M] = {
        mapName: M,
        matches: S,
        winRate: N,
        kd: T,
        hsPercent: O,
        avgKills: ae,
        avgAdr: P,
        wins: R,
        losses: Math.max(0, S - R)
      });
    }
  }
  const X = [];
  let Z = 0, ee = "NONE", me = !0;
  const I = {};
  if (Array.isArray(n))
    for (let g = 0; g < n.length; g++) {
      const c = n[g], M = c.i10 === "1" || c.result === "1" || c.stats?.Result === "1" || c.stats?.Win === "1", S = M ? "W" : "L";
      g === 0 ? (ee = S, Z = 1) : me && (S === ee ? Z++ : me = !1);
      const N = (c.i1 || c.stats?.Map || c.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), T = ue(c.i6 ?? c.stats?.Kills ?? c.kills, 0), O = ue(c.i8 ?? c.stats?.Deaths ?? c.deaths, 0), ae = c.stats && typeof c.stats == "object" ? c.stats : null, p = (F) => F !== void 0 && F >= 5 && F <= 200, P = ue(c.i9, 0), R = T > 0 && P > 0 ? P / T * 100 : void 0, k = (F) => R !== void 0 && Math.abs(F - R) <= 5, G = () => {
        const F = [];
        for (const se of Object.keys(c).filter((fe) => /^c\d+$/i.test(fe))) {
          const fe = c[se] !== void 0 && c[se] !== "" ? $(c[se], void 0) : void 0;
          p(fe) && !k(fe) && F.push({ key: se.toLowerCase(), val: fe });
        }
        if (F.length === 0) return;
        const Q = (se) => F.find((fe) => fe.key === se)?.val;
        return Q("c3") ?? Q("c4") ?? Q("c5") ?? Q("c2") ?? F[0].val;
      };
      let q;
      const J = ae ? $(D(ae, "ADR", "Average Damage", "Damage", "adr"), void 0) : void 0;
      if (p(J) && !k(J))
        q = J;
      else {
        const F = G();
        if (F !== void 0) q = F;
        else if (c.adr !== void 0) {
          const Q = $(c.adr, void 0);
          p(Q) && (q = Q);
        }
      }
      let j;
      const z = ae ? $(D(ae, "Headshots %", "HS%", "Headshots", "k8"), void 0) : void 0;
      if (z !== void 0 && z > 0 && z <= 100)
        j = z;
      else {
        const F = c.c4 !== void 0 && c.c4 !== "" ? $(c.c4, void 0) : void 0;
        F !== void 0 && F > 0 && F <= 100 && (R === void 0 || k(F)) ? j = F : R !== void 0 && (j = Math.round(R * 10) / 10);
      }
      N && (I[N] || (I[N] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), I[N].matches++, M && I[N].wins++, I[N].kills += T, I[N].deaths += O, q !== void 0 && (I[N].adrSum += q, I[N].adrCount++));
      const we = c.elo ? parseInt(c.elo.toString().replace(/,/g, ""), 10) : c.i15 ? parseInt(c.i15, 10) : void 0;
      let ye;
      if (g < n.length - 1 && we) {
        const F = n[g + 1], Q = F?.elo ? parseInt(F.elo.toString().replace(/,/g, ""), 10) : F?.i15 ? parseInt(F.i15, 10) : void 0;
        if (typeof Q == "number" && !isNaN(Q)) {
          const se = we - Q;
          Math.abs(se) <= 60 && (ye = se);
        }
      }
      ye === void 0 && (ye = M ? 25 : -25), X.push({
        matchId: c.matchId || c.i0 || `match-${g}`,
        playedAt: c.date || c.created_at || 0,
        map: N,
        result: S,
        score: c.i18 || c.stats?.Score || "13:0",
        kills: T,
        deaths: O,
        kd: $(c.c2, void 0) ?? $(c.stats?.["K/D Ratio"], void 0) ?? (O > 0 ? parseFloat((T / O).toFixed(2)) : T),
        hsPercent: j,
        adr: q,
        elo: we,
        eloDiff: ye
      });
    }
  for (const [g, c] of Object.entries(I))
    if (!K[g] || K[g].matches === 0) {
      const M = c.matches, S = c.wins, N = M > 0 ? Math.round(S / M * 100) : 50, T = c.deaths > 0 ? parseFloat((c.kills / c.deaths).toFixed(2)) : 1, O = c.adrCount > 0 ? Math.round(c.adrSum / c.adrCount) : void 0;
      K[g] = {
        mapName: g,
        matches: M,
        winRate: N,
        kd: T,
        hsPercent: Y,
        avgKills: M > 0 ? parseFloat((c.kills / M).toFixed(1)) : 15,
        avgAdr: O,
        wins: S,
        losses: M - S
      };
    }
  if (H === void 0) {
    let g = 0, c = 0;
    for (const M of Object.values(K))
      M.avgAdr !== void 0 && M.matches > 0 && (g += M.avgAdr * M.matches, c += M.matches);
    c > 0 && (H = Math.round(g / c * 10) / 10);
  }
  const L = X.slice(0, 30), oe = L.length;
  let x, U, te = 0, ce, he;
  if (oe > 0) {
    const g = L.reduce((T, O) => T + (O.kills || 0), 0), c = L.reduce((T, O) => T + (O.deaths || 0), 0);
    x = c > 0 ? parseFloat((g / c).toFixed(2)) : void 0;
    const M = L.map((T) => T.adr).filter((T) => T !== void 0 && T > 0);
    te = M.length, U = M.length > 0 ? Math.round(M.reduce((T, O) => T + O, 0) / M.length) : void 0;
    const S = L.map((T) => T.hsPercent).filter((T) => T !== void 0);
    ce = S.length > 0 ? Math.round(S.reduce((T, O) => T + O, 0) / S.length) : void 0;
    const N = L.filter((T) => T.result === "W").length;
    he = Math.round(N / oe * 100);
  }
  const { formStatus: d, recentKd: E, recentAdr: V } = Ke(X, W, H);
  return {
    playerId: s,
    nickname: y,
    avatar: m,
    country: f,
    steamId64: r,
    elo: Number.isFinite(h) ? h : 1e3,
    skillLevel: Number.isFinite(l) ? l : 1,
    totalMatches: b,
    overallWinRate: B,
    overallKd: W,
    overallHsPercent: Y,
    overallAdr: H,
    statsAvailable: u,
    last30Kd: x,
    last30Adr: U,
    last30AdrMatches: te,
    last30HsPercent: ce,
    last30WinRate: he,
    last30Matches: oe,
    currentStreak: { type: ee, count: Z },
    recentMatches: X,
    mapStats: K,
    registrationDate: a?.created_at,
    formStatus: d,
    recentKd: E,
    recentAdr: V
  };
}
function We(s, e) {
  return e.user !== void 0 || e.stats !== void 0 || Array.isArray(e.time) && e.time.length > 0 ? Le(
    s,
    void 0,
    e.user ?? null,
    e.stats ?? null,
    null,
    Array.isArray(e.time) ? e.time : []
  ) : null;
}
const Ye = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Ge(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return Ye.includes(e) ? e : "VOTING";
}
function Ne(s) {
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
const Oe = (s) => new Promise((e) => setTimeout(e, s));
async function xe(s, e = {}, a = re.REQUEST_TIMEOUT_MS) {
  const t = new AbortController(), i = setTimeout(() => t.abort(), a);
  try {
    return await fetch(s, { ...e, signal: t.signal });
  } finally {
    clearTimeout(i);
  }
}
let Me = 0, be = Promise.resolve();
function Re(s, e) {
  const a = async () => {
    const i = Me + re.MIN_REQUEST_INTERVAL_MS - Date.now();
    return i > 0 && await Oe(i), Me = Date.now(), xe(s, { headers: { Accept: "application/json" } }, e);
  }, t = be.then(a, a);
  return be = t.catch(() => {
  }), t;
}
async function ge(s, e = re.REQUEST_TIMEOUT_MS) {
  let a = await Re(s, e);
  if (a.status === 429 || a.status === 503 || a.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${a.status} from ${new URL(s).pathname} — backing off once`), Me = Date.now() + re.BACKOFF_COOLDOWN_MS, await Oe(re.BACKOFF_RETRY_BASE_MS + Math.floor(Math.random() * re.BACKOFF_RETRY_JITTER_MS));
    try {
      a = await Re(s, e);
    } catch {
    }
  }
  return a;
}
class Ue {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !re.ID_PATTERN.test(e)) return null;
    const a = await C.get(`intercepted_match:${e}`);
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
      return Ne(t.payload || t);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, a), null;
    }
  }
  async getPlayerStats(e, a) {
    if (!e || !re.ID_PATTERN.test(e)) return null;
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
      return Le(e, a, h, l, y, r);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
}
const Fe = new Ue();
function Ve(s, e) {
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
    for (const v of f)
      if (v.includes("Counter-Strike 2") || v.includes("Counter-Strike: Global Offensive")) {
        const _ = v.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        _ && (o = parseFloat(_[1].replace(/,/g, "")));
        const w = v.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        w && (h = parseFloat(w[1].replace(/,/g, "")), o === 0 && (o = h));
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
async function je(s, e = {}, a = Pe.REQUEST_TIMEOUT_MS) {
  const t = new AbortController(), i = setTimeout(() => t.abort(), a);
  try {
    return await fetch(s, { ...e, signal: t.signal });
  } finally {
    clearTimeout(i);
  }
}
class ze {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(e) {
    if (!e || !Pe.STEAM_ID_PATTERN.test(e))
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
      const a = await je(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!a.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const t = await a.text();
      return t.includes("<steamID>") ? Ve(t, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Qe = new ze();
function Je(s, e) {
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
    const b = s.last30Kd ?? l;
    b >= 1.6 && (t += 8, a.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${b.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (A = !1, e.summary) {
    const u = e.playtime?.cs2HoursTotal !== void 0, b = u ? e.playtime.cs2HoursTotal ?? 0 : 0, B = u && b === 0;
    b > 0 && b < 150 && n >= 1600 || B && n >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: B ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
      description: `Only ${b}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : b > 0 && b < 350 && n >= 2e3 ? (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${b}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : u && b >= 2500 && (t -= 15);
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
    const u = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), b = 25;
    t += b, a.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${u} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: b,
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
  let v = "LOW", _ = "#10B981", w = "Legit";
  return f >= 70 ? (v = "CRITICAL", _ = "#DC2626", w = "High Risk") : f >= 45 ? (v = "HIGH", _ = "#EF4444", w = "Likely Smurf") : f >= 25 && (v = "MEDIUM", _ = "#F59E0B", w = "Suspicious"), {
    score: f,
    level: v,
    flags: a,
    isPrivateSteam: A,
    summary: `${f}% Smurf Risk (${v})`,
    color: _,
    badgeText: w
  };
}
const ve = [
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
function Xe(s, e) {
  const a = [];
  let t = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const o = /* @__PURE__ */ new Map();
    for (const f of n.roster)
      if (f.party_id) {
        const v = o.get(f.party_id) || [];
        v.push(f.player_id), o.set(f.party_id, v);
      }
    const h = /* @__PURE__ */ new Set();
    for (const [, f] of o.entries())
      if (f.length >= 2) {
        const v = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${v} (${f.length})`,
          color: ve[t % ve.length],
          playerIds: f
        }), t++, f.forEach((_) => h.add(_));
      }
    const l = n.roster.map((f) => f.player_id).filter((f) => !h.has(f)), r = 15, y = /* @__PURE__ */ new Map();
    for (const f of l) {
      const v = e[f];
      v?.recentMatches && y.set(f, new Set(v.recentMatches.slice(0, r).map((_) => _.matchId)));
    }
    const A = /* @__PURE__ */ new Set(), m = (f, v) => {
      const _ = y.get(f), w = y.get(v);
      if (!_ || !w) return !1;
      let u = 0;
      for (const b of _)
        if (w.has(b) && u++, u >= 2) return !0;
      return !1;
    };
    for (const f of l) {
      if (A.has(f)) continue;
      const v = [], _ = [f];
      for (A.add(f); _.length > 0; ) {
        const w = _.shift();
        v.push(w);
        for (const u of l)
          !A.has(u) && m(w, u) && (A.add(u), _.push(u));
      }
      if (v.length >= 2) {
        v.forEach((u) => h.add(u));
        const w = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${w} (${v.length})`,
          color: ve[t % ve.length],
          playerIds: v
        }), t++;
      }
    }
  }
  return a;
}
function qe(s) {
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
const Ce = "maps_observed_cache", Ze = ne.TTL.OBSERVED_MAPS_MS, Ie = "maps_observed_v2", et = ne.TTL.OBSERVED_MAPS_MS * 7;
function ke(s) {
  return s.replace(/^(cs2_|csgo_|de_)/i, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "");
}
function tt(s) {
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
    const r = ke(l);
    r && o.push(r);
  }
  return Array.from(new Set(o));
}
async function at(s) {
  const e = s.map(ke).filter(Boolean);
  if (e.length === 0) return;
  const a = await C.get(Ie) || [], t = new Map(a.map((l) => [l.name, l])), i = Date.now();
  for (const l of e) {
    const r = t.get(l);
    t.set(l, { name: l, hits: (r?.hits || 0) + 1, lastSeen: i });
  }
  for (const [l, r] of [...t.entries()])
    i - r.lastSeen > 7 * 864e5 && r.hits < 3 && t.delete(l);
  const n = [...t.values()].sort((l, r) => r.lastSeen - l.lastSeen).slice(0, 20);
  await C.set(Ie, n, et);
  const o = await C.get(Ce) || [], h = Array.from(/* @__PURE__ */ new Set([...o, ...e]));
  await C.set(Ce, h.slice(-20), Ze);
}
const st = (s) => new Promise((e) => setTimeout(e, s));
async function it(s, e, a, t = Se.MAP_WITH_CONCURRENCY_DEFAULT_DELAY_MS) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const l = n++;
      i[l] = await a(s[l], l), t > 0 && await st(t);
    }
  }, h = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(h), i;
}
class nt {
  settings = { ...Ae };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  // Monotonic per-match stream generation; superseded streams stop broadcasting.
  streamGenerations = /* @__PURE__ */ new Map();
  async init() {
    if (!this.initialized) {
      await this.loadSettings(), this.initialized = !0, C.cleanup().catch(() => {
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
    const e = await C.get(pe);
    return e && (this.settings = { ...Ae, ...e }), this.settings;
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
      if (!re.ROOM_ID_PATTERN.test(a))
        return { success: !1, error: "Invalid intercepted matchId" };
      if (!e?.body || typeof e.body != "object")
        return { success: !1, error: "Invalid intercepted match body" };
      const t = e.body.payload ?? e.body, i = Ne(t);
      return await C.set(`intercepted_match:${a}`, i, ie.MATCH), at(tt(e.body)).catch(() => {
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
    const a = typeof e?.url == "string" ? e.url : "", t = qe(a);
    if (!t)
      return { success: !1, error: "Unrecognized intercepted URL" };
    if (!e?.body || typeof e.body != "object")
      return { success: !1, error: "Invalid intercepted profile body" };
    const { kind: i, playerId: n } = t, o = e.body.payload ?? e.body, h = `intercept_profile:${n}`, l = await C.get(h) || {};
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
    await C.set(h, l, ie.NEGATIVE * ne.TTL.INTERCEPT_STAGE_FACTOR);
    const A = We(n, l);
    return A ? (await C.set(
      `player_stats:${n}`,
      A,
      A.statsAvailable === !1 ? ie.NEGATIVE : ie.PLAYER_STATS
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
    for (const t of Object.keys(Ae))
      if (e && typeof e == "object" && t in e) {
        const i = Ae[t], n = e[t];
        typeof n == typeof i && (a[t] = n);
      }
    return this.settings = { ...this.settings, ...a }, await C.set(pe, this.settings, ie.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: i } = e, n = `match_analysis:${t}`;
    if (a?.tab?.id && (this.streamSubscribers.has(t) || this.streamSubscribers.set(t, /* @__PURE__ */ new Set()), this.streamSubscribers.get(t).add(a.tab.id)), !i) {
      const h = await C.get(n);
      if (h && !h.isPartial)
        return { success: !0, data: h };
    }
    const o = await Fe.getMatchDetails(t);
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
    await it(
      l,
      Se.CONCURRENCY,
      async (d) => {
        const E = d.player_id;
        if (!E) return;
        const V = `player_stats:${E}`;
        let g = null;
        if (t || (g = await C.get(V)), !g) {
          const c = await Fe.getPlayerStats(E, d.nickname);
          if (c && c.statsAvailable === !1) {
            const M = await C.get(V);
            M && M.statsAvailable !== !1 ? g = M : (await C.set(V, c, ie.NEGATIVE), g = c);
          } else c && (await C.set(V, c, ie.PLAYER_STATS), g = c);
        }
        if (g) {
          r[E] = g;
          const c = g.steamId64 || d.game_player_id;
          if (c) {
            const M = `steam_data:${c}`;
            let S = null;
            t || (S = await C.get(M)), S || (S = await Qe.getPlayerFullData(c), S && !S.fetchError && await C.set(M, S, ie.STEAM_PROFILE)), S && (y[E] = S);
          }
          A[E] = Je(g, y[E]), this.broadcastFromStream(e, i, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: E, stats: g, steam: y[E], risk: A[E] }
          });
        }
      },
      Se.CONCURRENCY_DELAY_MS
    );
    const m = o.map((d) => r[d.player_id]?.elo || d.elo || 1e3), f = h.map((d) => r[d.player_id]?.elo || d.elo || 1e3), v = m.reduce((d, E) => d + E, 0), _ = f.reduce((d, E) => d + E, 0), w = m.length > 0 ? Math.round(v / m.length) : 1e3, u = f.length > 0 ? Math.round(_ / f.length) : 1e3, b = w - u, B = o.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), W = h.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), Y = B.length > 0 ? parseFloat((B.reduce((d, E) => d + E, 0) / B.length).toFixed(2)) : 1, le = W.length > 0 ? parseFloat((W.reduce((d, E) => d + E, 0) / W.length).toFixed(2)) : 1, H = o.map((d) => r[d.player_id]?.overallHsPercent || 0), K = h.map((d) => r[d.player_id]?.overallHsPercent || 0), de = H.length > 0 ? Math.round(H.reduce((d, E) => d + E, 0) / H.length) : 0, X = K.length > 0 ? Math.round(K.reduce((d, E) => d + E, 0) / K.length) : 0, Z = o.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), ee = h.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), me = Z.length > 0 ? Math.round(Z.reduce((d, E) => d + E, 0) / Z.length) : 75, I = ee.length > 0 ? Math.round(ee.reduce((d, E) => d + E, 0) / ee.length) : 75, L = o.map((d) => r[d.player_id]).filter(Boolean), oe = h.map((d) => r[d.player_id]).filter(Boolean), x = Te(L), U = Te(oe);
    for (const [d, E] of Object.entries(x))
      r[d] && (r[d].fcrContributionPercent = E);
    for (const [d, E] of Object.entries(U))
      r[d] && (r[d].fcrContributionPercent = E);
    const te = Xe(a, r), ce = Be({
      f1AvgElo: w,
      f2AvgElo: u,
      f1Players: L,
      f2Players: oe,
      selectedMap: a.selected_map,
      premadeGroups: te,
      riskAnalysis: A,
      f1Fcr: x,
      f2Fcr: U
    }), he = {
      match: a,
      playersStats: r,
      steamData: y,
      riskAnalysis: A,
      premadeGroups: te,
      teamSummary: {
        faction1: {
          totalElo: v,
          avgElo: w,
          winChancePercent: ce.winChanceF1,
          avgKd: Y,
          avgHsPercent: de,
          avgAdr: me
        },
        faction2: {
          totalElo: _,
          avgElo: u,
          winChancePercent: ce.winChanceF2,
          avgKd: le,
          avgHsPercent: X,
          avgAdr: I
        },
        eloDifference: Math.abs(b)
      },
      prediction: ce,
      isPartial: !1
    };
    this.streamGenerations.get(e) === i && (await C.set(n, he, ie.MATCH), this.broadcastFromStream(e, i, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: he
    }));
  }
  safeSendToTab(e, a) {
    chrome.tabs.sendMessage(e, a).catch((t) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", t?.message || t);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await C.getStats() };
  }
  async handleClearCache() {
    return await C.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const _e = new nt(), $e = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), $e(), await _e.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), $e(), await _e.init();
});
chrome.runtime.onMessage.addListener((s, e, a) => (_e.init().then(() => _e.handleMessage(s, e)).then(a).catch((t) => {
  console.error("[f-insight:Background] Message handling failed:", t);
  try {
    a({ success: !1, error: t?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await C.cleanup());
});
