const me = {
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
  MATCH: 180 * 1e3,
  // 3 minutes
  PLAYER_STATS: 3600 * 1e3,
  // 1 hour (Aggressive caching)
  STEAM_PROFILE: 1440 * 60 * 1e3,
  // 24 hours
  NEGATIVE: 180 * 1e3,
  // 3 minutes for failed / unreachable queries
  SETTINGS: Number.MAX_SAFE_INTEGER
}, ce = "settings", Ae = 500;
class Ie {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= Ae) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > Ae; ) {
      const t = e.next();
      if (t.done) break;
      t.value !== ce && this.memoryCache.delete(t.value);
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
        const e = await chrome.storage.local.get(null), t = Object.keys(e).filter((a) => a !== ce);
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
          if (i === ce) continue;
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
const C = new Ie();
function we(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const t = s.map((l) => {
    const y = Number.isFinite(l.elo) ? l.elo : 1e3, w = Math.max(500, y || 1e3) / 1e3, u = Number.isFinite(l.last30Kd) ? l.last30Kd : Number.isFinite(l.overallKd) ? l.overallKd : 1, f = Math.min(2.5, Math.max(0.4, u ?? 1)), v = 1 + (((Number.isFinite(l.last30Adr) ? l.last30Adr : Number.isFinite(l.overallAdr) ? l.overallAdr : 75) ?? 75) - 75) / 150, b = w * f * Math.max(0.6, v);
    return { id: l.playerId, power: Number.isFinite(b) && b > 0 ? b : 1 };
  }), a = t.reduce((l, y) => l + y.power, 0), i = Number.isFinite(a) && a > 0 ? a : 0;
  if (i <= 0) {
    const l = parseFloat((100 / s.length).toFixed(1));
    for (const y of t)
      e[y.id] = l;
    return e;
  }
  let n = 0, r = "", p = -1;
  for (const l of t) {
    const y = parseFloat((l.power / i * 100).toFixed(1));
    e[l.id] = y, n += y, y > p && (p = y, r = l.id);
  }
  const c = parseFloat((100 - n).toFixed(1));
  return c !== 0 && r && (e[r] = parseFloat((e[r] + c).toFixed(1))), e;
}
function ke(s, e, t) {
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
    const u = r.reduce((A, v) => A + (v.kills || 0), 0), f = r.reduce((A, v) => A + (v.deaths || 0), 0);
    p = f > 0 ? parseFloat((u / f).toFixed(2)) : parseFloat(Math.max(a, u / (r.length * 2)).toFixed(2));
  }
  const c = n.map((u) => u.adr).filter((u) => typeof u == "number" && Number.isFinite(u) && u > 0), l = c.length > 0 ? Math.round(c.reduce((u, f) => u + f, 0) / c.length) : i, y = p / a;
  let w = "STABLE";
  return y >= 1.15 ? w = "HOT" : y <= 1 / 1.15 && (w = "COLD"), {
    formStatus: w,
    recentKd: p,
    recentAdr: l
  };
}
function De(s) {
  const {
    f1Players: e,
    f2Players: t,
    selectedMap: a,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: r,
    f2Fcr: p
  } = s, c = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, l = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, y = c, w = l, u = w - y, f = 1 / (1 + Math.pow(10, u / 400));
  let A = 0, v;
  const b = (a || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (b) {
    const g = e.reduce((K, J) => K + (J.mapStats?.[b]?.wins || 0), 0), M = e.reduce((K, J) => K + (J.mapStats?.[b]?.matches || 0), 0), I = t.reduce((K, J) => K + (J.mapStats?.[b]?.wins || 0), 0), N = t.reduce((K, J) => K + (J.mapStats?.[b]?.matches || 0), 0), Y = Math.round((g + 2.5) / (M + 5) * 100), x = Math.round((I + 2.5) / (N + 5) * 100), z = Y - x;
    M + N >= 10 && (A = Math.max(-0.12, Math.min(0.12, z / 100 * 0.25))), v = {
      leader: z >= 5 ? "faction1" : z <= -5 ? "faction2" : "balanced",
      mapName: b,
      f1WinRate: Y,
      f2WinRate: x,
      deltaWinRate: Math.abs(z)
    };
  }
  const m = e.filter((g) => g.formStatus === "HOT").length, E = e.filter((g) => g.formStatus === "COLD").length, k = t.filter((g) => g.formStatus === "HOT").length, V = t.filter((g) => g.formStatus === "COLD").length, U = m - E, G = k - V, W = Math.max(-0.1, Math.min(0.1, (U - G) * 0.03)), re = new Set(e.map((g) => g.playerId)), Q = new Set(t.map((g) => g.playerId));
  let D = 1, $ = 1;
  for (const g of i) {
    const M = g.playerIds.filter((N) => re.has(N)).length, I = g.playerIds.filter((N) => Q.has(N)).length;
    M > D && (D = M), I > $ && ($ = I);
  }
  const ie = Math.max(-0.08, Math.min(0.08, (D - $) * 0.02)), L = e.filter((g) => {
    const M = n[g.playerId]?.level;
    return M === "HIGH" || M === "CRITICAL";
  }).length, O = t.filter((g) => {
    const M = n[g.playerId]?.level;
    return M === "HIGH" || M === "CRITICAL";
  }).length, Z = Math.max(-0.06, Math.min(0.06, (L - O) * 0.02)), ae = f + A + W + ie + Z, se = Math.max(0.06, Math.min(0.94, ae)), H = Math.round(se * 100), X = 100 - H;
  let j = 13, d = 9;
  const _ = Math.abs(H - 50), ee = _ <= 8;
  _ <= 8 ? (j = H >= 50 ? 13 : 11, d = H >= 50 ? 11 : 13) : _ <= 16 ? (j = H >= 50 ? 13 : 8, d = H >= 50 ? 8 : 13) : _ <= 26 ? (j = H >= 50 ? 13 : 5, d = H >= 50 ? 5 : 13) : (j = H >= 50 ? 13 : 3, d = H >= 50 ? 3 : 13);
  const h = [];
  Math.abs(y - w) >= 60 && h.push(
    y > w ? `Team 1 holds +${Math.round(y - w)} avg Elo edge` : `Team 2 holds +${Math.round(w - y)} avg Elo edge`
  ), v && v.deltaWinRate >= 8 && h.push(
    v.leader === "faction1" ? `Team 1 dominates ${v.mapName} (+${v.deltaWinRate}% WR)` : `Team 2 dominates ${v.mapName} (+${v.deltaWinRate}% WR)`
  ), m > k && m >= 2 ? h.push(`Team 1 on hot momentum (${m} players On Fire)`) : k > m && k >= 2 && h.push(`Team 2 on hot momentum (${k} players On Fire)`), D >= 3 && D > $ ? h.push(`Team 1 has ${D}-stack coordination`) : $ >= 3 && $ > D && h.push(`Team 2 has ${$}-stack coordination`), Math.abs(Z) >= 0.04 && L + O > 0 && (L > O ? h.push(`Team 1 likely carries flagged accounts (${L} risk flagged)`) : O > L && h.push(`Team 2 likely carries flagged accounts (${O} risk flagged)`));
  const o = h.length > 0 ? h.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", S = (g, M) => {
    let I = g[0], N = -1;
    for (const Y of g) {
      const z = (M[Y.playerId] || 20) * 1.5 + (Y.last30Kd ?? Y.overallKd ?? 1) * 10;
      z > N && (N = z, I = Y);
    }
    return I ? {
      nickname: I.nickname,
      fcr: M[I.playerId] || 20,
      kd: I.last30Kd ?? I.overallKd ?? 1,
      elo: I.elo || 1e3
    } : void 0;
  }, F = S(e, r), T = S(t, p);
  return {
    winChanceF1: H,
    winChanceF2: X,
    predictedScore: {
      f1Score: j,
      f2Score: d,
      isOvertimeLikely: ee
    },
    keyAdvantageText: o,
    factors: {
      eloDelta: Math.round(y - w),
      mapAdvantage: v,
      momentumAdvantage: {
        leader: U > G ? "faction1" : G > U ? "faction2" : "balanced",
        f1HotCount: m,
        f2HotCount: k,
        f1ColdCount: E,
        f2ColdCount: V
      },
      premadeAdvantage: {
        leader: D > $ ? "faction1" : $ > D ? "faction2" : "balanced",
        f1MaxPartySize: D,
        f2MaxPartySize: $
      },
      smurfRiskDelta: {
        f1HighRiskCount: L,
        f2HighRiskCount: O,
        impactPercent: Math.round(Z * 100)
      }
    },
    starMatchup: F && T ? { f1Star: F, f2Star: T } : void 0
  };
}
const P = (s, ...e) => {
  for (const t of e) {
    const a = s?.[t];
    if (a != null && a !== "") return a;
  }
}, ne = (s, e) => {
  if (s === void 0) return e;
  const t = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(t) ? t : e;
}, B = (s, e) => {
  if (s === void 0) return e;
  const t = parseFloat(s.replace(/[,\s]/g, ""));
  return Number.isFinite(t) ? t : e;
};
function Fe(s, e, t, a, i, n) {
  const r = t?.games?.cs2 || t?.games?.csgo || {}, p = r.faceit_elo || 1e3, c = r.skill_level || 1, l = r.game_player_id || t?.steam_id_64, y = t?.nickname || e || "Player", w = t?.avatar || "", u = t?.country || "", f = Array.isArray(a) ? null : a, A = Array.isArray(i) ? null : i, v = f?.lifetime || A?.lifetime || {}, b = Object.keys(v).length > 0, m = ne(P(v, "Total Matches", "Matches", "m1"), 0), E = B(P(v, "Win Rate %", "k6"), 0) ?? 0, k = B(P(v, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, V = B(P(v, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, U = P(v, "ADR", "adr", "c3");
  let G = U ? B(U, void 0) : void 0;
  const W = {}, re = [
    ...Array.isArray(a) ? a : a?.segments || a?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const h of re) {
    const S = (h._id?.segmentId || h._id?.label || h.label || h.segmentId || h.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (S) {
      const F = ne(P(h.stats, "Matches") ?? P(h, "m1", "matches"), 0), T = B(P(h.stats, "Win Rate %") ?? P(h, "k6", "winRate"), 0) ?? 0, g = B(P(h.stats, "Average K/D Ratio", "K/D Ratio") ?? P(h, "k5", "kd"), 1) ?? 1, M = B(P(h.stats, "Average Headshots %") ?? P(h, "k8", "hsPercent"), 0) ?? 0, I = B(P(h.stats, "Average Kills") ?? P(h, "k1", "avgKills"), 0) ?? 0, N = P(h.stats, "ADR") ?? P(h, "c3", "adr"), Y = N ? B(N, void 0) : void 0, x = ne(P(h.stats, "Wins") ?? P(h, "m2", "wins"), Math.round(F * T / 100));
      (!W[S] || F > W[S].matches) && (W[S] = {
        mapName: S,
        matches: F,
        winRate: T,
        kd: g,
        hsPercent: M,
        avgKills: I,
        avgAdr: Y,
        wins: x,
        losses: Math.max(0, F - x)
      });
    }
  }
  const Q = [];
  let D = 0, $ = "NONE", ie = !0;
  const L = {};
  if (Array.isArray(n))
    for (let h = 0; h < n.length; h++) {
      const o = n[h], S = o.i10 === "1" || o.result === "1" || o.stats?.Result === "1" || o.stats?.Win === "1", F = S ? "W" : "L";
      h === 0 ? ($ = F, D = 1) : ie && (F === $ ? D++ : ie = !1);
      const T = (o.i1 || o.stats?.Map || o.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), g = ne(o.i6 ?? o.stats?.Kills ?? o.kills, 0), M = ne(o.i8 ?? o.stats?.Deaths ?? o.deaths, 0), I = o.stats && typeof o.stats == "object" ? o.stats : null, N = (R) => R !== void 0 && R >= 5 && R <= 200, Y = ne(o.i9, 0), x = g > 0 && Y > 0 ? Y / g * 100 : void 0, z = (R) => x !== void 0 && Math.abs(R - x) <= 5;
      let K;
      const J = I ? B(P(I, "ADR", "adr"), void 0) : void 0;
      if (N(J))
        K = J;
      else {
        const R = o.c3 !== void 0 && o.c3 !== "" ? B(o.c3, void 0) : void 0, te = o.c4 !== void 0 && o.c4 !== "" ? B(o.c4, void 0) : void 0, fe = N(R) && !z(R) ? R : void 0, Pe = N(te) && !z(te) ? te : void 0;
        if (K = fe ?? (x !== void 0 ? Pe : void 0), K === void 0 && o.adr !== void 0) {
          const ve = B(o.adr, void 0);
          N(ve) && (K = ve);
        }
      }
      let le;
      const de = I ? B(I["Headshots %"], void 0) : void 0;
      if (de !== void 0 && de > 0 && de <= 100)
        le = de;
      else {
        const R = o.c4 !== void 0 && o.c4 !== "" ? B(o.c4, void 0) : void 0;
        R !== void 0 && R > 0 && R <= 100 && (x === void 0 || z(R)) ? le = R : x !== void 0 && (le = Math.round(x * 10) / 10);
      }
      T && (L[T] || (L[T] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), L[T].matches++, S && L[T].wins++, L[T].kills += g, L[T].deaths += M, K !== void 0 && (L[T].adrSum += K, L[T].adrCount++));
      const ye = o.elo ? parseInt(o.elo.toString().replace(/,/g, ""), 10) : o.i15 ? parseInt(o.i15, 10) : void 0;
      let he;
      if (h < n.length - 1 && ye) {
        const R = n[h + 1], te = R?.elo ? parseInt(R.elo.toString().replace(/,/g, ""), 10) : R?.i15 ? parseInt(R.i15, 10) : void 0;
        if (typeof te == "number" && !isNaN(te)) {
          const fe = ye - te;
          Math.abs(fe) <= 60 && (he = fe);
        }
      }
      he === void 0 && (he = S ? 25 : -25), Q.push({
        matchId: o.matchId || o.i0 || `match-${h}`,
        playedAt: o.date || o.created_at || 0,
        map: T,
        result: F,
        score: o.i18 || o.stats?.Score || "13:0",
        kills: g,
        deaths: M,
        kd: parseFloat(o.c2 || o.stats?.["K/D Ratio"] || (M > 0 ? (g / M).toFixed(2) : g.toFixed(2))),
        hsPercent: le,
        adr: K,
        elo: ye,
        eloDiff: he
      });
    }
  for (const [h, o] of Object.entries(L))
    if (!W[h] || W[h].matches === 0) {
      const S = o.matches, F = o.wins, T = S > 0 ? Math.round(F / S * 100) : 50, g = o.deaths > 0 ? parseFloat((o.kills / o.deaths).toFixed(2)) : 1, M = o.adrCount > 0 ? Math.round(o.adrSum / o.adrCount) : void 0;
      W[h] = {
        mapName: h,
        matches: S,
        winRate: T,
        kd: g,
        hsPercent: V,
        avgKills: S > 0 ? parseFloat((o.kills / S).toFixed(1)) : 15,
        avgAdr: M,
        wins: F,
        losses: S - F
      };
    }
  if (G === void 0) {
    let h = 0, o = 0;
    for (const S of Object.values(W))
      S.avgAdr !== void 0 && S.matches > 0 && (h += S.avgAdr * S.matches, o += S.matches);
    o > 0 && (G = Math.round(h / o * 10) / 10);
  }
  const O = Q.slice(0, 30), Z = O.length;
  let ae, se, H = 0, X, j;
  if (Z > 0) {
    const h = O.reduce((g, M) => g + (M.kills || 0), 0), o = O.reduce((g, M) => g + (M.deaths || 0), 0);
    ae = o > 0 ? parseFloat((h / o).toFixed(2)) : void 0;
    const S = O.map((g) => g.adr).filter((g) => g !== void 0 && g > 0);
    H = S.length, se = S.length > 0 ? Math.round(S.reduce((g, M) => g + M, 0) / S.length) : void 0;
    const F = O.map((g) => g.hsPercent).filter((g) => g !== void 0);
    X = F.length > 0 ? Math.round(F.reduce((g, M) => g + M, 0) / F.length) : void 0;
    const T = O.filter((g) => g.result === "W").length;
    j = Math.round(T / Z * 100);
  }
  const { formStatus: d, recentKd: _, recentAdr: ee } = ke(Q, k, G);
  return {
    playerId: s,
    nickname: y,
    avatar: w,
    country: u,
    steamId64: l,
    elo: Number.isFinite(p) ? p : 1e3,
    skillLevel: Number.isFinite(c) ? c : 1,
    totalMatches: m,
    overallWinRate: E,
    overallKd: k,
    overallHsPercent: V,
    overallAdr: G,
    statsAvailable: b,
    last30Kd: ae,
    last30Adr: se,
    last30AdrMatches: H,
    last30HsPercent: X,
    last30WinRate: j,
    last30Matches: Z,
    currentStreak: {
      type: $,
      count: D
    },
    recentMatches: Q,
    mapStats: W,
    registrationDate: t?.created_at,
    formStatus: d,
    recentKd: _,
    recentAdr: ee
  };
}
const Ee = (s) => new Promise((e) => setTimeout(e, s));
async function $e(s, e = {}, t = 8e3) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
const Le = 400;
let pe = 0, _e = Promise.resolve();
function Se(s, e) {
  const t = async () => {
    const i = pe + Le - Date.now();
    return i > 0 && await Ee(i), pe = Date.now(), $e(s, { headers: { Accept: "application/json" } }, e);
  }, a = _e.then(t, t);
  return _e = a.catch(() => {
  }), a;
}
async function oe(s, e = 8e3) {
  let t = await Se(s, e);
  if (t.status === 429 || t.status === 503 || t.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${t.status} from ${new URL(s).pathname} — backing off once`), pe = Date.now() + 2e3, await Ee(2500 + Math.floor(Math.random() * 2e3));
    try {
      t = await Se(s, e);
    } catch {
    }
  }
  return t;
}
class He {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !/^[a-zA-Z0-9.\-_]+$/.test(e)) return null;
    const t = await C.get(
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
      const t = await oe(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`);
      if (!t.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${t.status}`), null;
      const a = await t.json(), i = a.payload || a;
      return Ce(i);
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
        oe(`https://api.faceit.com/users/v1/users/${a}`),
        oe(`https://api.faceit.com/stats/v1/stats/users/${a}/games/cs2`),
        oe(`https://api.faceit.com/stats/v1/stats/time/users/${a}/games/cs2?size=30`)
      ]);
      let p = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const u = await i.value.json();
        p = u.payload || u;
      }
      let c = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const u = await n.value.json();
        c = u.payload || u;
      }
      let l = [];
      if (r.status === "fulfilled" && r.value.ok) {
        const u = await r.value.json(), f = u.payload || u;
        l = Array.isArray(f) ? f : f?.items || f?.segments || [];
      }
      let y = null;
      if (!(!!(c?.lifetime && Object.keys(c.lifetime).length > 0) || Array.isArray(c?.segments) && c.segments.length > 0 || l.length > 0))
        try {
          const u = await oe(`https://api.faceit.com/stats/v1/stats/users/${a}/games/csgo`);
          if (u.ok) {
            const f = await u.json();
            y = f.payload || f;
          }
        } catch {
        }
      return Fe(e, t, p, c, y, l);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, a), null;
    }
  }
}
function Ne(s, e) {
  return e.user !== void 0 || e.stats !== void 0 || Array.isArray(e.time) && e.time.length > 0 ? Fe(
    s,
    void 0,
    e.user ?? null,
    e.stats ?? null,
    null,
    Array.isArray(e.time) ? e.time : []
  ) : null;
}
const Oe = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Ke(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return Oe.includes(e) ? e : "VOTING";
}
function Ce(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, t = s.teams?.faction2 || s.faction2 || {}, a = s.voting?.map?.pick || [], i = a.length > 0 ? a[a.length - 1] : [...s.voting?.map?.entities || []].reverse().find((c) => c.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, r = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, p = (c) => (c || []).map((l) => ({
    player_id: l.id || l.player_id,
    nickname: l.nickname || "Player",
    avatar: l.avatar || "",
    game_player_id: l.game_player_id || l.gameId || l.steam_id_64,
    game_player_name: l.game_player_name || l.gameName,
    game_skill_level: l.skill_level || l.game_skill_level || 1,
    elo: l.elo || 1e3,
    membership: l.membership,
    party_id: l.party_id || l.partyId
  }));
  return {
    match_id: s.id || s.match_id,
    game: s.game || "cs2",
    region: s.region || "EU",
    status: Ke(s.status),
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
const be = new He();
function Be(s, e) {
  const t = !s.includes("<privacyState>public</privacyState>"), a = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: a ? a[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: t ? 1 : 3
  };
  let r = 0, p = 0;
  const c = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (c) {
    const f = c[1].split("</mostPlayedGame>");
    for (const A of f)
      if (A.includes("Counter-Strike 2") || A.includes("Counter-Strike: Global Offensive")) {
        const v = A.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        v && (r = parseFloat(v[1].replace(/,/g, "")));
        const b = A.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        b && (p = parseFloat(b[1].replace(/,/g, "")), r === 0 && (r = p));
        break;
      }
  }
  const l = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (l) {
    const f = new Date(l[1]);
    isNaN(f.getTime()) || (n.timeCreated = f.getTime() / 1e3, n.accountAgeYears = (Date.now() - f.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const y = s.match(/<communityBanned>(.*?)<\/communityBanned>/), w = s.match(/<vacBanned>(.*?)<\/vacBanned>/), u = {
    steamId64: e,
    communityBanned: y ? y[1] === "1" : !1,
    vacBanned: w ? w[1] === "1" : !1,
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
async function We(s, e = {}, t = 6e3) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
class xe {
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
      const t = await We(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!t.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const a = await t.text();
      return a.includes("<steamID>") ? Be(a, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Ge = new xe();
function Ye(s, e) {
  const t = [];
  let a = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, r = s.overallKd || 1, p = s.overallWinRate || 50, c = s.recentKd || r, l = s.recentAdr || 75, y = s.statsAvailable !== !1;
  y && (n >= 2200 && i < 100 ? (a += 45, t.push({
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
  })) : i >= 800 && (a -= 15)), y && r >= 2 ? (a += 30, t.push({
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
  })) : r < 0.95 && i >= 50 && (a -= 10), y && s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (a += 22, t.push({
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
  })), l >= 95 && s.overallAdr !== void 0 && l >= s.overallAdr * 1.2 && (a += 12, t.push({
    id: "recent_adr_spike",
    title: "Recent ADR Spike",
    description: `Last 5 games ADR (${l}) is 20%+ above lifetime baseline (${s.overallAdr.toFixed(0)})`,
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
  })), y && p >= 80 && i >= 10 ? (a += 30, t.push({
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
  }))), c >= 1.75 && c >= r * 1.35 && i >= 10 && (a += 15, t.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${c.toFixed(2)}) is significantly higher than lifetime baseline (${r.toFixed(2)})`,
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
  let w = !0;
  if (!e || e.fetchError)
    w = !1;
  else if (e.isPrivate) {
    w = !0, t.push({
      id: "private_steam",
      title: "Hidden Account (Private Steam)",
      description: "Steam hours and profile details are hidden by user privacy settings",
      weight: 0,
      severity: "info",
      category: "PRIVATE_PROFILE"
    });
    const m = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    m >= 15 && (a += m, t.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: m,
      severity: m >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), y && i < 100 && (a += 10, t.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const E = s.last30Kd ?? c;
    E >= 1.6 && (a += 8, t.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${E.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (w = !1, e.summary) {
    const m = e.playtime?.cs2HoursTotal !== void 0, E = m ? e.playtime.cs2HoursTotal ?? 0 : 0, k = m && E === 0;
    E > 0 && E < 150 && n >= 1600 || k && n >= 1600 ? (a += 30, t.push({
      id: "low_steam_hours",
      title: k ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
      description: `Only ${E}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : E > 0 && E < 350 && n >= 2e3 ? (a += 20, t.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${E}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : m && E >= 2500 && (a -= 15);
    const V = e.summary.accountAgeYears;
    V !== void 0 && V < 1 && n >= 1400 && (a += 18, t.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${V.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const m = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), E = 25;
    a += E, t.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${m} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: E,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const u = s.registrationDate ? new Date(s.registrationDate) : null;
  if (u && !isNaN(u.getTime())) {
    const m = (Date.now() - u.getTime()) / 315576e5;
    m < 0.5 && n >= 1350 ? (a += 22, t.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${m.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : m < 1 && n >= 1600 && (a += 18, t.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${m.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const f = Math.min(100, Math.max(0, Math.round(a)));
  let A = "LOW", v = "#10B981", b = "Legit";
  return f >= 70 ? (A = "CRITICAL", v = "#DC2626", b = "High Risk") : f >= 45 ? (A = "HIGH", v = "#EF4444", b = "Likely Smurf") : f >= 25 && (A = "MEDIUM", v = "#F59E0B", b = "Suspicious"), {
    score: f,
    level: A,
    flags: t,
    isPrivateSteam: w,
    summary: `${f}% Smurf Risk (${A})`,
    color: v,
    badgeText: b
  };
}
const ue = [
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
function Ve(s, e) {
  const t = [];
  let a = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const r = /* @__PURE__ */ new Map();
    for (const f of n.roster)
      if (f.party_id) {
        const A = r.get(f.party_id) || [];
        A.push(f.player_id), r.set(f.party_id, A);
      }
    const p = /* @__PURE__ */ new Set();
    for (const [, f] of r.entries())
      if (f.length >= 2) {
        const A = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${A} (${f.length})`,
          color: ue[a % ue.length],
          playerIds: f
        }), a++, f.forEach((v) => p.add(v));
      }
    const c = n.roster.map((f) => f.player_id).filter((f) => !p.has(f)), l = 15, y = /* @__PURE__ */ new Map();
    for (const f of c) {
      const A = e[f];
      A?.recentMatches && y.set(f, new Set(A.recentMatches.slice(0, l).map((v) => v.matchId)));
    }
    const w = /* @__PURE__ */ new Set(), u = (f, A) => {
      const v = y.get(f), b = y.get(A);
      if (!v || !b) return !1;
      let m = 0;
      for (const E of v)
        if (b.has(E) && m++, m >= 2) return !0;
      return !1;
    };
    for (const f of c) {
      if (w.has(f)) continue;
      const A = [], v = [f];
      for (w.add(f); v.length > 0; ) {
        const b = v.shift();
        A.push(b);
        for (const m of c)
          !w.has(m) && u(b, m) && (w.add(m), v.push(m));
      }
      if (A.length >= 2) {
        A.forEach((m) => p.add(m));
        const b = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${b} (${A.length})`,
          color: ue[a % ue.length],
          playerIds: A
        }), a++;
      }
    }
  }
  return t;
}
function Ue(s) {
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
const Me = "maps_observed_cache", je = 1440 * 60 * 1e3;
function Te(s) {
  return s.replace(/^(cs2_|csgo_|de_)/, "").toLowerCase().trim();
}
function ze(s) {
  const e = s, t = [], a = e?.voting?.map?.entities ?? e?.payload?.voting?.map?.entities ?? e?.match?.voting?.map?.entities;
  if (Array.isArray(a))
    for (const n of a)
      typeof n?.name == "string" ? t.push(n.name) : typeof n?.id == "string" && t.push(n.id);
  const i = e?.map ?? e?.payload?.map ?? e?.match?.map;
  return typeof i == "string" ? t.push(i) : typeof i?.name == "string" && t.push(i.name), t.map(Te).filter(Boolean);
}
async function Ze(s) {
  const e = s.map(Te).filter(Boolean);
  if (e.length === 0) return;
  const t = await C.get(Me) || [], a = Array.from(/* @__PURE__ */ new Set([...t, ...e]));
  await C.set(Me, a, je);
}
const Je = (s) => new Promise((e) => setTimeout(e, s));
async function qe(s, e, t, a = 150) {
  const i = new Array(s.length);
  let n = 0;
  const r = async () => {
    for (; n < s.length; ) {
      const c = n++;
      i[c] = await t(s[c], c), a > 0 && await Je(a);
    }
  }, p = Array.from({ length: Math.min(e, s.length) }, r);
  return await Promise.all(p), i;
}
class Qe {
  settings = { ...me };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, C.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const e = await C.get(ce);
    return e && (this.settings = { ...me, ...e }), this.settings;
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
      if (!/^[a-zA-Z0-9\-_]+$/.test(t))
        return { success: !1, error: "Invalid intercepted matchId" };
      if (!e?.body || typeof e.body != "object")
        return { success: !1, error: "Invalid intercepted match body" };
      const a = e.body.payload ?? e.body, i = Ce(a);
      return await C.set(`intercepted_match:${t}`, i, q.MATCH), Ze(ze(e.body)).catch(() => {
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
    const t = typeof e?.url == "string" ? e.url : "", a = Ue(t);
    if (!a)
      return { success: !1, error: "Unrecognized intercepted URL" };
    if (!e?.body || typeof e.body != "object")
      return { success: !1, error: "Invalid intercepted profile body" };
    const { kind: i, playerId: n } = a, r = e.body.payload ?? e.body, p = `intercept_profile:${n}`, c = await C.get(p) || {};
    let l = !1, y;
    if (i === "user" && r && typeof r == "object" && !Array.isArray(r)) {
      c.user = r, l = !0;
      const u = r.nickname;
      typeof u == "string" && u.trim() && (y = { guid: n, nickname: u.trim() });
    } else if (i === "stats" && r && typeof r == "object" && !Array.isArray(r))
      c.stats = r, l = !0;
    else if (i === "time") {
      const u = Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : null;
      u && u.length > 0 && (c.time = u, l = !0);
    }
    if (!l)
      return { success: !1, error: `Intercepted ${i} payload had no usable shape` };
    await C.set(p, c, q.NEGATIVE * 3);
    const w = Ne(n, c);
    return w ? (await C.set(
      `player_stats:${n}`,
      w,
      w.statsAvailable === !1 ? q.NEGATIVE : q.PLAYER_STATS
    ), console.warn(
      `[f-insight:Background] Hydrated player ${n} from intercepted ${i} payload (statsAvailable=${w.statsAvailable !== !1})`
    ), {
      success: !0,
      data: {
        kind: "profile-hydrated",
        playerId: n,
        statsAvailable: w.statsAvailable !== !1,
        selfCandidate: y
      }
    }) : { success: !0, data: { kind: "profile-staged", playerId: n, selfCandidate: y } };
  }
  async handleSaveSettings(e) {
    const t = {};
    for (const a of Object.keys(me))
      if (e && typeof e == "object" && a in e) {
        const i = me[a], n = e[a];
        typeof n == typeof i && (t[a] = n);
      }
    return this.settings = { ...this.settings, ...t }, await C.set(ce, this.settings, q.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, t) {
    const { matchId: a, forceRefresh: i } = e, n = `match_analysis:${a}`;
    if (!i) {
      const p = await C.get(n);
      if (p && !p.isPartial)
        return { success: !0, data: p };
    }
    const r = await be.getMatchDetails(a);
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
    const i = `match_analysis:${e}`, n = t.teams?.faction1?.roster || [], r = t.teams?.faction2?.roster || [], p = [...n, ...r], c = {}, l = {}, y = {};
    await qe(
      p,
      2,
      async (d) => {
        const _ = d.player_id;
        if (!_) return;
        const ee = `player_stats:${_}`;
        let h = null;
        if (a || (h = await C.get(ee)), !h) {
          const o = await be.getPlayerStats(_, d.nickname);
          if (o && o.statsAvailable === !1) {
            const S = await C.get(ee);
            S && S.statsAvailable !== !1 ? h = S : (await C.set(ee, o, q.NEGATIVE), h = o);
          } else o && (await C.set(ee, o, q.PLAYER_STATS), h = o);
        }
        if (h) {
          c[_] = h;
          const o = h.steamId64 || d.game_player_id;
          if (o) {
            const S = `steam_data:${o}`;
            let F = null;
            a || (F = await C.get(S)), F || (F = await Ge.getPlayerFullData(o), F && !F.fetchError && await C.set(S, F, q.STEAM_PROFILE)), F && (l[_] = F);
          }
          y[_] = Ye(h, l[_]), this.broadcastToSubscribers(e, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: _, stats: h, steam: l[_], risk: y[_] }
          });
        }
      },
      400
    );
    const w = n.map((d) => c[d.player_id]?.elo || d.elo || 1e3), u = r.map((d) => c[d.player_id]?.elo || d.elo || 1e3), f = w.reduce((d, _) => d + _, 0), A = u.reduce((d, _) => d + _, 0), v = w.length > 0 ? Math.round(f / w.length) : 1e3, b = u.length > 0 ? Math.round(A / u.length) : 1e3, m = v - b, E = n.map((d) => c[d.player_id]?.last30Kd ?? c[d.player_id]?.overallKd ?? 1), k = r.map((d) => c[d.player_id]?.last30Kd ?? c[d.player_id]?.overallKd ?? 1), V = E.length > 0 ? parseFloat((E.reduce((d, _) => d + _, 0) / E.length).toFixed(2)) : 1, U = k.length > 0 ? parseFloat((k.reduce((d, _) => d + _, 0) / k.length).toFixed(2)) : 1, G = n.map((d) => c[d.player_id]?.overallHsPercent || 0), W = r.map((d) => c[d.player_id]?.overallHsPercent || 0), re = G.length > 0 ? Math.round(G.reduce((d, _) => d + _, 0) / G.length) : 0, Q = W.length > 0 ? Math.round(W.reduce((d, _) => d + _, 0) / W.length) : 0, D = n.map((d) => c[d.player_id]?.last30Adr ?? c[d.player_id]?.overallAdr ?? 75), $ = r.map((d) => c[d.player_id]?.last30Adr ?? c[d.player_id]?.overallAdr ?? 75), ie = D.length > 0 ? Math.round(D.reduce((d, _) => d + _, 0) / D.length) : 75, L = $.length > 0 ? Math.round($.reduce((d, _) => d + _, 0) / $.length) : 75, O = n.map((d) => c[d.player_id]).filter(Boolean), Z = r.map((d) => c[d.player_id]).filter(Boolean), ae = we(O), se = we(Z);
    for (const [d, _] of Object.entries(ae))
      c[d] && (c[d].fcrContributionPercent = _);
    for (const [d, _] of Object.entries(se))
      c[d] && (c[d].fcrContributionPercent = _);
    const H = Ve(t, c), X = De({
      f1AvgElo: v,
      f2AvgElo: b,
      f1Players: O,
      f2Players: Z,
      selectedMap: t.selected_map,
      premadeGroups: H,
      riskAnalysis: y,
      f1Fcr: ae,
      f2Fcr: se
    }), j = {
      match: t,
      playersStats: c,
      steamData: l,
      riskAnalysis: y,
      premadeGroups: H,
      teamSummary: {
        faction1: {
          totalElo: f,
          avgElo: v,
          winChancePercent: X.winChanceF1,
          avgKd: V,
          avgHsPercent: re,
          avgAdr: ie
        },
        faction2: {
          totalElo: A,
          avgElo: b,
          winChancePercent: X.winChanceF2,
          avgKd: U,
          avgHsPercent: Q,
          avgAdr: L
        },
        eloDifference: Math.abs(m)
      },
      prediction: X,
      isPartial: !1
    };
    await C.set(i, j, q.MATCH), this.broadcastToSubscribers(e, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: j
    });
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
const ge = new Qe(), Re = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), Re(), await ge.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), Re(), await ge.init();
});
chrome.runtime.onMessage.addListener((s, e, t) => (ge.init().then(() => ge.handleMessage(s, e)).then(t).catch((a) => {
  console.error("[f-insight:Background] Message handling failed:", a);
  try {
    t({ success: !1, error: a?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await C.cleanup());
});
