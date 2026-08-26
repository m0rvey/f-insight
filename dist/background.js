const re = {
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
}, se = {
  MATCH: 180 * 1e3,
  // 3 minutes
  PLAYER_STATS: 3600 * 1e3,
  // 1 hour (Aggressive caching)
  STEAM_PROFILE: 1440 * 60 * 1e3,
  // 24 hours
  NEGATIVE: 180 * 1e3,
  // 3 minutes for failed / unreachable queries
  SETTINGS: Number.MAX_SAFE_INTEGER
}, oe = "settings", fe = 500;
class Ae {
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
      t.value !== oe && this.memoryCache.delete(t.value);
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
        const e = await chrome.storage.local.get(null), t = Object.keys(e).filter((a) => a !== oe);
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
          if (i === oe) continue;
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
const G = new Ae();
function _e(s, e) {
  const t = Number.isFinite(s) ? Math.max(100, Math.min(6e3, s)) : 1e3, i = (Number.isFinite(e) ? Math.max(100, Math.min(6e3, e)) : 1e3) - t, n = 1 / (1 + Math.pow(10, i / 400)), o = 1 - n, u = 50, r = Math.max(1, Math.min(49, Math.round(u * (1 - n)))), c = Math.max(1, Math.min(49, Math.round(u * n))), y = Math.max(1, Math.min(49, Math.round(u * (1 - o)))), A = Math.max(1, Math.min(49, Math.round(u * o)));
  return {
    faction1: {
      winGain: r,
      lossLoss: c
    },
    faction2: {
      winGain: y,
      lossLoss: A
    }
  };
}
function me(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const t = s.map((c) => {
    const y = Number.isFinite(c.elo) ? c.elo : 1e3, A = Math.max(500, y || 1e3) / 1e3, w = Number.isFinite(c.last30Kd) ? c.last30Kd : Number.isFinite(c.overallKd) ? c.overallKd : 1, d = Math.min(2.5, Math.max(0.4, w ?? 1)), p = 1 + (((Number.isFinite(c.last30Adr) ? c.last30Adr : Number.isFinite(c.overallAdr) ? c.overallAdr : 75) ?? 75) - 75) / 150, M = A * d * Math.max(0.6, p);
    return { id: c.playerId, power: Number.isFinite(M) && M > 0 ? M : 1 };
  }), a = t.reduce((c, y) => c + y.power, 0), i = Number.isFinite(a) && a > 0 ? a : 0;
  if (i <= 0) {
    const c = parseFloat((100 / s.length).toFixed(1));
    for (const y of t)
      e[y.id] = c;
    return e;
  }
  let n = 0, o = "", u = -1;
  for (const c of t) {
    const y = parseFloat((c.power / i * 100).toFixed(1));
    e[c.id] = y, n += y, y > u && (u = y, o = c.id);
  }
  const r = parseFloat((100 - n).toFixed(1));
  return r !== 0 && o && (e[o] = parseFloat((e[o] + r).toFixed(1))), e;
}
function Me(s, e, t) {
  const a = Number.isFinite(e) ? Math.max(0.5, e) : 1, i = Number.isFinite(t) ? Math.max(20, t) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: a,
      recentAdr: i
    };
  const n = s.slice(0, 5), o = n.filter(
    (w) => typeof w.kills == "number" && Number.isFinite(w.kills) && typeof w.deaths == "number" && Number.isFinite(w.deaths)
  );
  let u = a;
  if (o.length > 0) {
    const w = o.reduce((v, p) => v + (p.kills || 0), 0), d = o.reduce((v, p) => v + (p.deaths || 0), 0);
    u = d > 0 ? parseFloat((w / d).toFixed(2)) : parseFloat(Math.max(a, w / (o.length * 2)).toFixed(2));
  }
  const r = n.map((w) => w.adr).filter((w) => typeof w == "number" && Number.isFinite(w) && w > 0), c = r.length > 0 ? Math.round(r.reduce((w, d) => w + d, 0) / r.length) : i, y = u / a;
  let A = "STABLE";
  return y >= 1.15 ? A = "HOT" : y <= 1 / 1.15 && (A = "COLD"), {
    formStatus: A,
    recentKd: u,
    recentAdr: c
  };
}
function Se(s) {
  const {
    f1Players: e,
    f2Players: t,
    selectedMap: a,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: u
  } = s, r = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, c = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, y = r, A = c, w = A - y, d = 1 / (1 + Math.pow(10, w / 400));
  let v = 0, p;
  const M = (a || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (M) {
    const m = e.reduce((W, B) => W + (B.mapStats?.[M]?.wins || 0), 0), S = e.reduce((W, B) => W + (B.mapStats?.[M]?.matches || 0), 0), k = t.reduce((W, B) => W + (B.mapStats?.[M]?.wins || 0), 0), $ = t.reduce((W, B) => W + (B.mapStats?.[M]?.matches || 0), 0), x = Math.round((m + 2.5) / (S + 5) * 100), Q = Math.round((k + 2.5) / ($ + 5) * 100), j = x - Q;
    S + $ >= 10 && (v = Math.max(-0.12, Math.min(0.12, j / 100 * 0.25))), p = {
      leader: j >= 5 ? "faction1" : j <= -5 ? "faction2" : "balanced",
      mapName: M,
      f1WinRate: x,
      f2WinRate: Q,
      deltaWinRate: Math.abs(j)
    };
  }
  const f = e.filter((m) => m.formStatus === "HOT").length, E = e.filter((m) => m.formStatus === "COLD").length, T = t.filter((m) => m.formStatus === "HOT").length, H = t.filter((m) => m.formStatus === "COLD").length, Y = f - E, J = T - H, O = Math.max(-0.1, Math.min(0.1, (Y - J) * 0.03)), X = new Set(e.map((m) => m.playerId)), Z = new Set(t.map((m) => m.playerId));
  let I = 1, P = 1;
  for (const m of i) {
    const S = m.playerIds.filter(($) => X.has($)).length, k = m.playerIds.filter(($) => Z.has($)).length;
    S > I && (I = S), k > P && (P = k);
  }
  const q = Math.max(-0.08, Math.min(0.08, (I - P) * 0.02)), D = e.filter((m) => {
    const S = n[m.playerId]?.level;
    return S === "HIGH" || S === "CRITICAL";
  }).length, N = t.filter((m) => {
    const S = n[m.playerId]?.level;
    return S === "HIGH" || S === "CRITICAL";
  }).length, U = Math.max(-0.06, Math.min(0.06, (D - N) * 0.02)), ee = d + v + O + q + U, te = Math.max(0.06, Math.min(0.94, ee)), L = Math.round(te * 100), ae = 100 - L;
  let K = 13, z = 9;
  const l = Math.abs(L - 50), _ = l <= 8;
  l <= 8 ? (K = L >= 50 ? 13 : 11, z = L >= 50 ? 11 : 13) : l <= 16 ? (K = L >= 50 ? 13 : 8, z = L >= 50 ? 8 : 13) : l <= 26 ? (K = L >= 50 ? 13 : 5, z = L >= 50 ? 5 : 13) : (K = L >= 50 ? 13 : 3, z = L >= 50 ? 3 : 13);
  const g = [];
  Math.abs(y - A) >= 60 && g.push(
    y > A ? `Team 1 holds +${Math.round(y - A)} avg Elo edge` : `Team 2 holds +${Math.round(A - y)} avg Elo edge`
  ), p && p.deltaWinRate >= 8 && g.push(
    p.leader === "faction1" ? `Team 1 dominates ${p.mapName} (+${p.deltaWinRate}% WR)` : `Team 2 dominates ${p.mapName} (+${p.deltaWinRate}% WR)`
  ), f > T && f >= 2 ? g.push(`Team 1 on hot momentum (${f} players On Fire)`) : T > f && T >= 2 && g.push(`Team 2 on hot momentum (${T} players On Fire)`), I >= 3 && I > P ? g.push(`Team 1 has ${I}-stack coordination`) : P >= 3 && P > I && g.push(`Team 2 has ${P}-stack coordination`), Math.abs(U) >= 0.04 && D + N > 0 && (D > N ? g.push(`Team 1 likely carries flagged accounts (${D} risk flagged)`) : N > D && g.push(`Team 2 likely carries flagged accounts (${N} risk flagged)`));
  const h = g.length > 0 ? g.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", F = (m, S) => {
    let k = m[0], $ = -1;
    for (const x of m) {
      const j = (S[x.playerId] || 20) * 1.5 + (x.last30Kd ?? x.overallKd ?? 1) * 10;
      j > $ && ($ = j, k = x);
    }
    return k ? {
      nickname: k.nickname,
      fcr: S[k.playerId] || 20,
      kd: k.last30Kd ?? k.overallKd ?? 1,
      elo: k.elo || 1e3
    } : void 0;
  }, C = F(e, o), b = F(t, u);
  return {
    winChanceF1: L,
    winChanceF2: ae,
    predictedScore: {
      f1Score: K,
      f2Score: z,
      isOvertimeLikely: _
    },
    keyAdvantageText: h,
    factors: {
      eloDelta: Math.round(y - A),
      mapAdvantage: p,
      momentumAdvantage: {
        leader: Y > J ? "faction1" : J > Y ? "faction2" : "balanced",
        f1HotCount: f,
        f2HotCount: T,
        f1ColdCount: E,
        f2ColdCount: H
      },
      premadeAdvantage: {
        leader: I > P ? "faction1" : P > I ? "faction2" : "balanced",
        f1MaxPartySize: I,
        f2MaxPartySize: P
      },
      smurfRiskDelta: {
        f1HighRiskCount: D,
        f2HighRiskCount: N,
        impactPercent: Math.round(U * 100)
      }
    },
    starMatchup: C && b ? { f1Star: C, f2Star: b } : void 0
  };
}
const R = (s, ...e) => {
  for (const t of e) {
    const a = s?.[t];
    if (a != null && a !== "") return a;
  }
}, ie = (s, e) => {
  if (s === void 0) return e;
  const t = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(t) ? t : e;
}, V = (s, e) => {
  if (s === void 0) return e;
  const t = parseFloat(s.replace(/[,\s]/g, ""));
  return Number.isFinite(t) ? t : e;
};
function Fe(s, e, t, a, i, n) {
  const o = t?.games?.cs2 || t?.games?.csgo || {}, u = o.faceit_elo || 1e3, r = o.skill_level || 1, c = o.game_player_id || t?.steam_id_64, y = t?.nickname || e || "Player", A = t?.avatar || "", w = t?.country || "", d = Array.isArray(a) ? null : a, v = Array.isArray(i) ? null : i, p = d?.lifetime || v?.lifetime || {}, M = Object.keys(p).length > 0, f = ie(R(p, "Total Matches", "Matches", "m1"), 0), E = V(R(p, "Win Rate %", "k6"), 0) ?? 0, T = V(R(p, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, H = V(R(p, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, Y = R(p, "ADR", "adr", "c3"), J = Y ? V(Y, void 0) : void 0, O = {}, X = [
    ...Array.isArray(a) ? a : a?.segments || a?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const g of X) {
    const F = (g._id?.segmentId || g._id?.label || g.label || g.segmentId || g.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (F) {
      const C = ie(R(g.stats, "Matches") ?? R(g, "m1", "matches"), 0), b = V(R(g.stats, "Win Rate %") ?? R(g, "k6", "winRate"), 0) ?? 0, m = V(R(g.stats, "Average K/D Ratio", "K/D Ratio") ?? R(g, "k5", "kd"), 1) ?? 1, S = V(R(g.stats, "Average Headshots %") ?? R(g, "k8", "hsPercent"), 0) ?? 0, k = V(R(g.stats, "Average Kills") ?? R(g, "k1", "avgKills"), 0) ?? 0, $ = R(g.stats, "ADR") ?? R(g, "c3", "adr"), x = $ ? V($, void 0) : void 0, Q = ie(R(g.stats, "Wins") ?? R(g, "m2", "wins"), Math.round(C * b / 100));
      (!O[F] || C > O[F].matches) && (O[F] = {
        mapName: F,
        matches: C,
        winRate: b,
        kd: m,
        hsPercent: S,
        avgKills: k,
        avgAdr: x,
        wins: Q,
        losses: Math.max(0, C - Q)
      });
    }
  }
  const Z = [];
  let I = 0, P = "NONE", q = !0;
  const D = {};
  if (Array.isArray(n))
    for (let g = 0; g < n.length; g++) {
      const h = n[g], F = h.i10 === "1" || h.result === "1" || h.stats?.Result === "1" || h.stats?.Win === "1", C = F ? "W" : "L";
      g === 0 ? (P = C, I = 1) : q && (C === P ? I++ : q = !1);
      const b = (h.i1 || h.stats?.Map || h.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), m = ie(h.i6 ?? h.stats?.Kills ?? h.kills, 0), S = ie(h.i8 ?? h.stats?.Deaths ?? h.deaths, 0), k = h.c3 || h.stats?.ADR || h.adr, $ = k ? V(k, void 0) : void 0, x = h.c4 || h.stats?.["Headshots %"], Q = x ? V(x, void 0) : void 0;
      b && (D[b] || (D[b] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), D[b].matches++, F && D[b].wins++, D[b].kills += m, D[b].deaths += S, $ !== void 0 && (D[b].adrSum += $, D[b].adrCount++));
      const j = h.elo ? parseInt(h.elo.toString().replace(/,/g, ""), 10) : h.i15 ? parseInt(h.i15, 10) : void 0;
      let W;
      if (g < n.length - 1 && j) {
        const B = n[g + 1], he = B?.elo ? parseInt(B.elo.toString().replace(/,/g, ""), 10) : B?.i15 ? parseInt(B.i15, 10) : void 0;
        if (typeof he == "number" && !isNaN(he)) {
          const de = j - he;
          Math.abs(de) <= 60 && (W = de);
        }
      }
      W === void 0 && (W = F ? 25 : -25), Z.push({
        matchId: h.matchId || h.i0 || `match-${g}`,
        playedAt: h.date || h.created_at || 0,
        map: b,
        result: C,
        score: h.i18 || h.stats?.Score || "13:0",
        kills: m,
        deaths: S,
        kd: parseFloat(h.c2 || h.stats?.["K/D Ratio"] || (S > 0 ? (m / S).toFixed(2) : m.toFixed(2))),
        hsPercent: Q,
        adr: $,
        elo: j,
        eloDiff: W
      });
    }
  for (const [g, h] of Object.entries(D))
    if (!O[g] || O[g].matches === 0) {
      const F = h.matches, C = h.wins, b = F > 0 ? Math.round(C / F * 100) : 50, m = h.deaths > 0 ? parseFloat((h.kills / h.deaths).toFixed(2)) : 1, S = h.adrCount > 0 ? Math.round(h.adrSum / h.adrCount) : void 0;
      O[g] = {
        mapName: g,
        matches: F,
        winRate: b,
        kd: m,
        hsPercent: H,
        avgKills: F > 0 ? parseFloat((h.kills / F).toFixed(1)) : 15,
        avgAdr: S,
        wins: C,
        losses: F - C
      };
    }
  const N = Z.slice(0, 30), U = N.length;
  let ee, te, L = 0, ae, K;
  if (U > 0) {
    const g = N.reduce((m, S) => m + (S.kills || 0), 0), h = N.reduce((m, S) => m + (S.deaths || 0), 0);
    ee = h > 0 ? parseFloat((g / h).toFixed(2)) : void 0;
    const F = N.map((m) => m.adr).filter((m) => m !== void 0 && m > 0);
    L = F.length, te = F.length > 0 ? Math.round(F.reduce((m, S) => m + S, 0) / F.length) : void 0;
    const C = N.map((m) => m.hsPercent).filter((m) => m !== void 0);
    ae = C.length > 0 ? Math.round(C.reduce((m, S) => m + S, 0) / C.length) : void 0;
    const b = N.filter((m) => m.result === "W").length;
    K = Math.round(b / U * 100);
  }
  const { formStatus: z, recentKd: l, recentAdr: _ } = Me(Z, T, J);
  return {
    playerId: s,
    nickname: y,
    avatar: A,
    country: w,
    steamId64: c,
    elo: Number.isFinite(u) ? u : 1e3,
    skillLevel: Number.isFinite(r) ? r : 1,
    totalMatches: f,
    overallWinRate: E,
    overallKd: T,
    overallHsPercent: H,
    overallAdr: J,
    statsAvailable: M,
    last30Kd: ee,
    last30Adr: te,
    last30AdrMatches: L,
    last30HsPercent: ae,
    last30WinRate: K,
    last30Matches: U,
    currentStreak: {
      type: P,
      count: I
    },
    recentMatches: Z,
    mapStats: O,
    registrationDate: t?.created_at,
    formStatus: z,
    recentKd: l,
    recentAdr: _
  };
}
const we = (s) => new Promise((e) => setTimeout(e, s));
async function be(s, e = {}, t = 8e3) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
const Ee = 120;
let ue = 0, ge = Promise.resolve();
function pe(s, e) {
  const t = async () => {
    const i = ue + Ee - Date.now();
    return i > 0 && await we(i), ue = Date.now(), be(s, { headers: { Accept: "application/json" } }, e);
  }, a = ge.then(t, t);
  return ge = a.catch(() => {
  }), a;
}
async function ne(s, e = 8e3) {
  let t = await pe(s, e);
  if (t.status === 429 || t.status === 503 || t.status === 403) {
    console.warn(`[f-insight:FaceitApi] HTTP ${t.status} from ${new URL(s).pathname} — backing off once`), await we(1400 + Math.floor(Math.random() * 600));
    try {
      t = await pe(s, e);
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
    if (this.inFlightMatch.has(e))
      return this.inFlightMatch.get(e);
    const t = this.fetchMatchDetailsInternal(e).finally(() => {
      this.inFlightMatch.delete(e);
    });
    return this.inFlightMatch.set(e, t), t;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const t = await ne(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`);
      if (!t.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${t.status}`), null;
      const a = await t.json(), i = a.payload || a;
      return Pe(i);
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
      const a = encodeURIComponent(e), [i, n, o] = await Promise.allSettled([
        ne(`https://api.faceit.com/users/v1/users/${a}`),
        ne(`https://api.faceit.com/stats/v1/stats/users/${a}/games/cs2`),
        ne(`https://api.faceit.com/stats/v1/stats/time/users/${a}/games/cs2?size=30`)
      ]);
      let u = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const w = await i.value.json();
        u = w.payload || w;
      }
      let r = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const w = await n.value.json();
        r = w.payload || w;
      }
      let c = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const w = await o.value.json(), d = w.payload || w;
        c = Array.isArray(d) ? d : d?.items || d?.segments || [];
      }
      let y = null;
      if (!(!!(r?.lifetime && Object.keys(r.lifetime).length > 0) || Array.isArray(r?.segments) && r.segments.length > 0 || c.length > 0))
        try {
          const w = await ne(`https://api.faceit.com/stats/v1/stats/users/${a}/games/csgo`);
          if (w.ok) {
            const d = await w.json();
            y = d.payload || d;
          }
        } catch {
        }
      return Fe(e, t, u, r, y, c);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, a), null;
    }
  }
}
const Re = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Te(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return Re.includes(e) ? e : "VOTING";
}
function Pe(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, t = s.teams?.faction2 || s.faction2 || {}, a = s.voting?.map?.pick || [], i = a.length > 0 ? a[a.length - 1] : [...s.voting?.map?.entities || []].reverse().find((r) => r.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, o = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, u = (r) => (r || []).map((c) => ({
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
    status: Te(s.status),
    configured_at: s.configured_at,
    started_at: s.started_at,
    finished_at: s.finished_at,
    teams: {
      faction1: {
        faction_id: e.id || e.faction_id || "faction1",
        name: e.name || "Team 1",
        avatar: e.avatar,
        leader: e.leader,
        roster: u(e.roster)
      },
      faction2: {
        faction_id: t.id || t.faction_id || "faction2",
        name: t.name || "Team 2",
        avatar: t.avatar,
        leader: t.leader,
        roster: u(t.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: o
  };
}
const ye = new Ce();
function De(s, e) {
  const t = !s.includes("<privacyState>public</privacyState>"), a = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: a ? a[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: t ? 1 : 3
  };
  let o = 0, u = 0;
  const r = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (r) {
    const d = r[1].split("</mostPlayedGame>");
    for (const v of d)
      if (v.includes("Counter-Strike 2") || v.includes("Counter-Strike: Global Offensive")) {
        const p = v.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        p && (o = parseFloat(p[1].replace(/,/g, "")));
        const M = v.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        M && (u = parseFloat(M[1].replace(/,/g, "")), o === 0 && (o = u));
        break;
      }
  }
  const c = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (c) {
    const d = new Date(c[1]);
    isNaN(d.getTime()) || (n.timeCreated = d.getTime() / 1e3, n.accountAgeYears = (Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const y = s.match(/<communityBanned>(.*?)<\/communityBanned>/), A = s.match(/<vacBanned>(.*?)<\/vacBanned>/), w = {
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
      cs2HoursLast2Weeks: u
    },
    bans: w,
    isPrivate: t,
    fetchedAt: Date.now()
  };
}
async function Le(s, e = {}, t = 6e3) {
  const a = new AbortController(), i = setTimeout(() => a.abort(), t);
  try {
    return await fetch(s, { ...e, signal: a.signal });
  } finally {
    clearTimeout(i);
  }
}
class ke {
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
      const t = await Le(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!t.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const a = await t.text();
      return a.includes("<steamID>") ? De(a, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Ie = new ke();
function $e(s, e) {
  const t = [];
  let a = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, o = s.overallKd || 1, u = s.overallWinRate || 50, r = s.recentKd || o, c = s.recentAdr || 75, y = s.statsAvailable !== !1;
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
  })) : i >= 800 && (a -= 15)), y && o >= 2 ? (a += 30, t.push({
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
  })) : o < 0.95 && i >= 50 && (a -= 10), y && s.overallAdr !== void 0 && s.overallAdr >= 95 && i < 300 && (a += 22, t.push({
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
  })) : s.overallHsPercent >= 60 && o >= 1.5 && (a += 8, t.push({
    id: "extreme_hs",
    title: "High Headshot Rate (60%+)",
    description: `Lifetime headshot rate of ${s.overallHsPercent.toFixed(0)}% with K/D ${o.toFixed(2)}`,
    weight: 8,
    severity: "info",
    category: "HS_ANOMALY"
  })), y && u >= 80 && i >= 10 ? (a += 30, t.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${u.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : u >= 70 && i >= 15 ? (a += 20, t.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${u.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : u >= 62 && i >= 25 && (a += 10, t.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${u.toFixed(0)}%`,
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
  }))), r >= 1.75 && r >= o * 1.35 && i >= 10 && (a += 15, t.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${r.toFixed(2)}) is significantly higher than lifetime baseline (${o.toFixed(2)})`,
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
  let A = !0;
  if (!e || e.fetchError)
    A = !1;
  else if (e.isPrivate) {
    A = !0, t.push({
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
    })), y && i < 100 && (a += 10, t.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const E = s.last30Kd ?? r;
    E >= 1.6 && (a += 8, t.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${E.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (A = !1, e.summary) {
    const f = e.playtime?.cs2HoursTotal !== void 0, E = f ? e.playtime.cs2HoursTotal ?? 0 : 0, T = f && E === 0;
    E > 0 && E < 150 && n >= 1600 || T && n >= 1600 ? (a += 30, t.push({
      id: "low_steam_hours",
      title: T ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
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
    })) : f && E >= 2500 && (a -= 15);
    const H = e.summary.accountAgeYears;
    H !== void 0 && H < 1 && n >= 1400 && (a += 18, t.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${H.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const f = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), E = 25;
    a += E, t.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${f} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: E,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const w = s.registrationDate ? new Date(s.registrationDate) : null;
  if (w && !isNaN(w.getTime())) {
    const f = (Date.now() - w.getTime()) / 315576e5;
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
  let v = "LOW", p = "#10B981", M = "Legit";
  return d >= 70 ? (v = "CRITICAL", p = "#DC2626", M = "High Risk") : d >= 45 ? (v = "HIGH", p = "#EF4444", M = "Likely Smurf") : d >= 25 && (v = "MEDIUM", p = "#F59E0B", M = "Suspicious"), {
    score: d,
    level: v,
    flags: t,
    isPrivateSteam: A,
    summary: `${d}% Smurf Risk (${v})`,
    color: p,
    badgeText: M
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
function Ne(s, e) {
  const t = [];
  let a = 0;
  const i = [s.teams.faction1, s.teams.faction2];
  for (const n of i) {
    if (!n || !n.roster) continue;
    const o = /* @__PURE__ */ new Map();
    for (const d of n.roster)
      if (d.party_id) {
        const v = o.get(d.party_id) || [];
        v.push(d.player_id), o.set(d.party_id, v);
      }
    const u = /* @__PURE__ */ new Set();
    for (const [, d] of o.entries())
      if (d.length >= 2) {
        const v = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${v} (${d.length})`,
          color: ce[a % ce.length],
          playerIds: d
        }), a++, d.forEach((p) => u.add(p));
      }
    const r = n.roster.map((d) => d.player_id).filter((d) => !u.has(d)), c = 15, y = /* @__PURE__ */ new Map();
    for (const d of r) {
      const v = e[d];
      v?.recentMatches && y.set(d, new Set(v.recentMatches.slice(0, c).map((p) => p.matchId)));
    }
    const A = /* @__PURE__ */ new Set(), w = (d, v) => {
      const p = y.get(d), M = y.get(v);
      if (!p || !M) return !1;
      let f = 0;
      for (const E of p)
        if (M.has(E) && f++, f >= 2) return !0;
      return !1;
    };
    for (const d of r) {
      if (A.has(d)) continue;
      const v = [], p = [d];
      for (A.add(d); p.length > 0; ) {
        const M = p.shift();
        v.push(M);
        for (const f of r)
          !A.has(f) && w(M, f) && (A.add(f), p.push(f));
      }
      if (v.length >= 2) {
        v.forEach((f) => u.add(f));
        const M = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${M} (${v.length})`,
          color: ce[a % ce.length],
          playerIds: v
        }), a++;
      }
    }
  }
  return t;
}
const He = (s) => new Promise((e) => setTimeout(e, s));
async function Oe(s, e, t, a = 150) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const r = n++;
      i[r] = await t(s[r], r), a > 0 && await He(a);
    }
  }, u = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(u), i;
}
class Ke {
  settings = { ...re };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, G.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const e = await G.get(oe);
    return e && (this.settings = { ...re, ...e }), this.settings;
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
  async handleSaveSettings(e) {
    const t = {};
    for (const a of Object.keys(re))
      if (e && typeof e == "object" && a in e) {
        const i = re[a], n = e[a];
        typeof n == typeof i && (t[a] = n);
      }
    return this.settings = { ...this.settings, ...t }, await G.set(oe, this.settings, se.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, t) {
    const { matchId: a, forceRefresh: i } = e, n = `match_analysis:${a}`;
    if (!i) {
      const u = await G.get(n);
      if (u && !u.isPartial)
        return { success: !0, data: u };
    }
    const o = await ye.getMatchDetails(a);
    if (!o)
      return { success: !1, error: `Could not fetch match details for ${a}` };
    if (t?.tab?.id && (this.streamSubscribers.has(a) || this.streamSubscribers.set(a, /* @__PURE__ */ new Set()), this.streamSubscribers.get(a).add(t.tab.id)), !this.inFlightStreams.has(a) || i) {
      const u = this.streamLobbyData(a, o, i).finally(() => {
        this.inFlightStreams.get(a) === u && this.inFlightStreams.delete(a), this.streamSubscribers.delete(a);
      });
      this.inFlightStreams.set(a, u);
    }
    return { success: !0, data: { match: o, isPartial: !0 } };
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
    const i = `match_analysis:${e}`, n = t.teams?.faction1?.roster || [], o = t.teams?.faction2?.roster || [], u = [...n, ...o], r = {}, c = {}, y = {};
    await Oe(
      u,
      3,
      async (l) => {
        const _ = l.player_id;
        if (!_) return;
        const g = `player_stats:${_}`;
        let h = null;
        if (a || (h = await G.get(g)), !h && (h = await ye.getPlayerStats(_, l.nickname), h)) {
          const F = h.statsAvailable === !1 ? se.NEGATIVE : se.PLAYER_STATS;
          await G.set(g, h, F);
        }
        if (h) {
          r[_] = h;
          const F = h.steamId64 || l.game_player_id;
          if (F) {
            const C = `steam_data:${F}`;
            let b = null;
            a || (b = await G.get(C)), b || (b = await Ie.getPlayerFullData(F), b && !b.fetchError && await G.set(C, b, se.STEAM_PROFILE)), b && (c[_] = b);
          }
          y[_] = $e(h, c[_]), this.broadcastToSubscribers(e, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: _, stats: h, steam: c[_], risk: y[_] }
          });
        }
      },
      200
    );
    const A = n.map((l) => r[l.player_id]?.elo || l.elo || 1e3), w = o.map((l) => r[l.player_id]?.elo || l.elo || 1e3), d = A.reduce((l, _) => l + _, 0), v = w.reduce((l, _) => l + _, 0), p = A.length > 0 ? Math.round(d / A.length) : 1e3, M = w.length > 0 ? Math.round(v / w.length) : 1e3, f = p - M, E = _e(p, M), T = n.map((l) => r[l.player_id]?.last30Kd ?? r[l.player_id]?.overallKd ?? 1), H = o.map((l) => r[l.player_id]?.last30Kd ?? r[l.player_id]?.overallKd ?? 1), Y = T.length > 0 ? parseFloat((T.reduce((l, _) => l + _, 0) / T.length).toFixed(2)) : 1, J = H.length > 0 ? parseFloat((H.reduce((l, _) => l + _, 0) / H.length).toFixed(2)) : 1, O = n.map((l) => r[l.player_id]?.overallHsPercent || 0), X = o.map((l) => r[l.player_id]?.overallHsPercent || 0), Z = O.length > 0 ? Math.round(O.reduce((l, _) => l + _, 0) / O.length) : 0, I = X.length > 0 ? Math.round(X.reduce((l, _) => l + _, 0) / X.length) : 0, P = n.map((l) => r[l.player_id]?.last30Adr ?? r[l.player_id]?.overallAdr ?? 75), q = o.map((l) => r[l.player_id]?.last30Adr ?? r[l.player_id]?.overallAdr ?? 75), D = P.length > 0 ? Math.round(P.reduce((l, _) => l + _, 0) / P.length) : 75, N = q.length > 0 ? Math.round(q.reduce((l, _) => l + _, 0) / q.length) : 75, U = n.map((l) => r[l.player_id]).filter(Boolean), ee = o.map((l) => r[l.player_id]).filter(Boolean), te = me(U), L = me(ee);
    for (const [l, _] of Object.entries(te))
      r[l] && (r[l].fcrContributionPercent = _);
    for (const [l, _] of Object.entries(L))
      r[l] && (r[l].fcrContributionPercent = _);
    const ae = Ne(t, r), K = Se({
      f1AvgElo: p,
      f2AvgElo: M,
      f1Players: U,
      f2Players: ee,
      selectedMap: t.selected_map,
      premadeGroups: ae,
      riskAnalysis: y,
      f1Fcr: te,
      f2Fcr: L
    }), z = {
      match: t,
      playersStats: r,
      steamData: c,
      riskAnalysis: y,
      premadeGroups: ae,
      teamSummary: {
        faction1: {
          totalElo: d,
          avgElo: p,
          winChancePercent: K.winChanceF1,
          avgKd: Y,
          avgHsPercent: Z,
          avgAdr: D,
          projectedElo: E.faction1
        },
        faction2: {
          totalElo: v,
          avgElo: M,
          winChancePercent: K.winChanceF2,
          avgKd: J,
          avgHsPercent: I,
          avgAdr: N,
          projectedElo: E.faction2
        },
        eloDifference: Math.abs(f)
      },
      prediction: K,
      isPartial: !1
    };
    await G.set(i, z, se.MATCH), this.broadcastToSubscribers(e, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: z
    });
  }
  safeSendToTab(e, t) {
    chrome.tabs.sendMessage(e, t).catch((a) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", a?.message || a);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await G.getStats() };
  }
  async handleClearCache() {
    return await G.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const le = new Ke(), ve = () => {
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
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await G.cleanup());
});
