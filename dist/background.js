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
class pe {
  memoryCache = /* @__PURE__ */ new Map();
  isChromeStorageAvailable() {
    return typeof chrome < "u" && !!chrome.storage?.local;
  }
  enforceMemoryLimit() {
    if (this.memoryCache.size <= fe) return;
    const e = this.memoryCache.keys();
    for (; this.memoryCache.size > fe; ) {
      const a = e.next();
      if (a.done) break;
      a.value !== oe && this.memoryCache.delete(a.value);
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
        const e = await chrome.storage.local.get(null), a = Object.keys(e).filter((t) => t !== oe);
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
          if (i === oe) continue;
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
const G = new pe();
function ye(s, e) {
  const a = Number.isFinite(s) ? Math.max(100, Math.min(6e3, s)) : 1e3, i = (Number.isFinite(e) ? Math.max(100, Math.min(6e3, e)) : 1e3) - a, n = 1 / (1 + Math.pow(10, i / 400)), o = 1 - n, g = 50, c = Math.max(1, Math.min(49, Math.round(g * (1 - n)))), r = Math.max(1, Math.min(49, Math.round(g * n))), y = Math.max(1, Math.min(49, Math.round(g * (1 - o)))), A = Math.max(1, Math.min(49, Math.round(g * o)));
  return {
    faction1: {
      winGain: c,
      lossLoss: r
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
  const a = s.map((r) => {
    const y = Number.isFinite(r.elo) ? r.elo : 1e3, A = Math.max(500, y || 1e3) / 1e3, w = Number.isFinite(r.last30Kd) ? r.last30Kd : Number.isFinite(r.overallKd) ? r.overallKd : 1, f = Math.min(2.5, Math.max(0.4, w ?? 1)), p = 1 + (((Number.isFinite(r.last30Adr) ? r.last30Adr : Number.isFinite(r.overallAdr) ? r.overallAdr : 75) ?? 75) - 75) / 150, M = A * f * Math.max(0.6, p);
    return { id: r.playerId, power: Number.isFinite(M) && M > 0 ? M : 1 };
  }), t = a.reduce((r, y) => r + y.power, 0), i = Number.isFinite(t) && t > 0 ? t : 0;
  if (i <= 0) {
    const r = parseFloat((100 / s.length).toFixed(1));
    for (const y of a)
      e[y.id] = r;
    return e;
  }
  let n = 0, o = "", g = -1;
  for (const r of a) {
    const y = parseFloat((r.power / i * 100).toFixed(1));
    e[r.id] = y, n += y, y > g && (g = y, o = r.id);
  }
  const c = parseFloat((100 - n).toFixed(1));
  return c !== 0 && o && (e[o] = parseFloat((e[o] + c).toFixed(1))), e;
}
function we(s, e, a) {
  const t = Number.isFinite(e) ? Math.max(0.5, e) : 1, i = Number.isFinite(a) ? Math.max(20, a) : 75;
  if (!s || s.length < 2)
    return {
      formStatus: "STABLE",
      recentKd: t,
      recentAdr: i
    };
  const n = s.slice(0, 5), o = n.filter(
    (w) => typeof w.kills == "number" && Number.isFinite(w.kills) && typeof w.deaths == "number" && Number.isFinite(w.deaths)
  );
  let g = t;
  if (o.length > 0) {
    const w = o.reduce((v, p) => v + (p.kills || 0), 0), f = o.reduce((v, p) => v + (p.deaths || 0), 0);
    g = f > 0 ? parseFloat((w / f).toFixed(2)) : parseFloat(Math.max(t, w / (o.length * 2)).toFixed(2));
  }
  const c = n.map((w) => w.adr).filter((w) => typeof w == "number" && Number.isFinite(w) && w > 0), r = c.length > 0 ? Math.round(c.reduce((w, f) => w + f, 0) / c.length) : i, y = g / t;
  let A = "STABLE";
  return y >= 1.15 ? A = "HOT" : y <= 1 / 1.15 && (A = "COLD"), {
    formStatus: A,
    recentKd: g,
    recentAdr: r
  };
}
function ve(s) {
  const {
    f1Players: e,
    f2Players: a,
    selectedMap: t,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: g
  } = s, c = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, r = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, y = c, A = r, w = A - y, f = 1 / (1 + Math.pow(10, w / 400));
  let v = 0, p;
  const M = (t || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (M) {
    const m = e.reduce((W, B) => W + (B.mapStats?.[M]?.wins || 0), 0), S = e.reduce((W, B) => W + (B.mapStats?.[M]?.matches || 0), 0), D = a.reduce((W, B) => W + (B.mapStats?.[M]?.wins || 0), 0), $ = a.reduce((W, B) => W + (B.mapStats?.[M]?.matches || 0), 0), x = Math.round((m + 2.5) / (S + 5) * 100), q = Math.round((D + 2.5) / ($ + 5) * 100), j = x - q;
    S + $ >= 10 && (v = Math.max(-0.12, Math.min(0.12, j / 100 * 0.25))), p = {
      leader: j >= 5 ? "faction1" : j <= -5 ? "faction2" : "balanced",
      mapName: M,
      f1WinRate: x,
      f2WinRate: q,
      deltaWinRate: Math.abs(j)
    };
  }
  const d = e.filter((m) => m.formStatus === "HOT").length, E = e.filter((m) => m.formStatus === "COLD").length, T = a.filter((m) => m.formStatus === "HOT").length, H = a.filter((m) => m.formStatus === "COLD").length, Y = d - E, J = T - H, O = Math.max(-0.1, Math.min(0.1, (Y - J) * 0.03)), Q = new Set(e.map((m) => m.playerId)), Z = new Set(a.map((m) => m.playerId));
  let I = 1, P = 1;
  for (const m of i) {
    const S = m.playerIds.filter(($) => Q.has($)).length, D = m.playerIds.filter(($) => Z.has($)).length;
    S > I && (I = S), D > P && (P = D);
  }
  const X = Math.max(-0.08, Math.min(0.08, (I - P) * 0.02)), L = e.filter((m) => {
    const S = n[m.playerId]?.level;
    return S === "HIGH" || S === "CRITICAL";
  }).length, N = a.filter((m) => {
    const S = n[m.playerId]?.level;
    return S === "HIGH" || S === "CRITICAL";
  }).length, U = Math.max(-0.06, Math.min(0.06, (L - N) * 0.02)), ee = f + v + O + X + U, te = Math.max(0.06, Math.min(0.94, ee)), k = Math.round(te * 100), ae = 100 - k;
  let K = 13, z = 9;
  const l = Math.abs(k - 50), _ = l <= 8;
  l <= 8 ? (K = k >= 50 ? 13 : 11, z = k >= 50 ? 11 : 13) : l <= 16 ? (K = k >= 50 ? 13 : 8, z = k >= 50 ? 8 : 13) : l <= 26 ? (K = k >= 50 ? 13 : 5, z = k >= 50 ? 5 : 13) : (K = k >= 50 ? 13 : 3, z = k >= 50 ? 3 : 13);
  const u = [];
  Math.abs(y - A) >= 60 && u.push(
    y > A ? `Team 1 holds +${Math.round(y - A)} avg Elo edge` : `Team 2 holds +${Math.round(A - y)} avg Elo edge`
  ), p && p.deltaWinRate >= 8 && u.push(
    p.leader === "faction1" ? `Team 1 dominates ${p.mapName} (+${p.deltaWinRate}% WR)` : `Team 2 dominates ${p.mapName} (+${p.deltaWinRate}% WR)`
  ), d > T && d >= 2 ? u.push(`Team 1 on hot momentum (${d} players On Fire)`) : T > d && T >= 2 && u.push(`Team 2 on hot momentum (${T} players On Fire)`), I >= 3 && I > P ? u.push(`Team 1 has ${I}-stack coordination`) : P >= 3 && P > I && u.push(`Team 2 has ${P}-stack coordination`), Math.abs(U) >= 0.04 && L + N > 0 && (L > N ? u.push(`Team 1 likely carries flagged accounts (${L} risk flagged)`) : N > L && u.push(`Team 2 likely carries flagged accounts (${N} risk flagged)`));
  const h = u.length > 0 ? u.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", F = (m, S) => {
    let D = m[0], $ = -1;
    for (const x of m) {
      const j = (S[x.playerId] || 20) * 1.5 + (x.last30Kd ?? x.overallKd ?? 1) * 10;
      j > $ && ($ = j, D = x);
    }
    return D ? {
      nickname: D.nickname,
      fcr: S[D.playerId] || 20,
      kd: D.last30Kd ?? D.overallKd ?? 1,
      elo: D.elo || 1e3
    } : void 0;
  }, C = F(e, o), b = F(a, g);
  return {
    winChanceF1: k,
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
        f1HotCount: d,
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
        f1HighRiskCount: L,
        f2HighRiskCount: N,
        impactPercent: Math.round(U * 100)
      }
    },
    starMatchup: C && b ? { f1Star: C, f2Star: b } : void 0
  };
}
const R = (s, ...e) => {
  for (const a of e) {
    const t = s?.[a];
    if (t != null && t !== "") return t;
  }
}, ie = (s, e) => {
  if (s === void 0) return e;
  const a = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(a) ? a : e;
}, V = (s, e) => {
  if (s === void 0) return e;
  const a = parseFloat(s.replace(/[,\s]/g, ""));
  return Number.isFinite(a) ? a : e;
};
function Ae(s, e, a, t, i, n) {
  const o = a?.games?.cs2 || a?.games?.csgo || {}, g = o.faceit_elo || 1e3, c = o.skill_level || 1, r = o.game_player_id || a?.steam_id_64, y = a?.nickname || e || "Player", A = a?.avatar || "", w = a?.country || "", f = Array.isArray(t) ? null : t, v = Array.isArray(i) ? null : i, p = f?.lifetime || v?.lifetime || {}, M = Object.keys(p).length > 0, d = ie(R(p, "Total Matches", "Matches", "m1"), 0), E = V(R(p, "Win Rate %", "k6"), 0) ?? 0, T = V(R(p, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, H = V(R(p, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, Y = R(p, "ADR", "adr", "c3"), J = Y ? V(Y, void 0) : void 0, O = {}, Q = [
    ...Array.isArray(t) ? t : t?.segments || t?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const u of Q) {
    const F = (u._id?.segmentId || u._id?.label || u.label || u.segmentId || u.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (F) {
      const C = ie(R(u.stats, "Matches") ?? R(u, "m1", "matches"), 0), b = V(R(u.stats, "Win Rate %") ?? R(u, "k6", "winRate"), 0) ?? 0, m = V(R(u.stats, "Average K/D Ratio", "K/D Ratio") ?? R(u, "k5", "kd"), 1) ?? 1, S = V(R(u.stats, "Average Headshots %") ?? R(u, "k8", "hsPercent"), 0) ?? 0, D = V(R(u.stats, "Average Kills") ?? R(u, "k1", "avgKills"), 0) ?? 0, $ = R(u.stats, "ADR") ?? R(u, "c3", "adr"), x = $ ? V($, void 0) : void 0, q = ie(R(u.stats, "Wins") ?? R(u, "m2", "wins"), Math.round(C * b / 100));
      (!O[F] || C > O[F].matches) && (O[F] = {
        mapName: F,
        matches: C,
        winRate: b,
        kd: m,
        hsPercent: S,
        avgKills: D,
        avgAdr: x,
        wins: q,
        losses: Math.max(0, C - q)
      });
    }
  }
  const Z = [];
  let I = 0, P = "NONE", X = !0;
  const L = {};
  if (Array.isArray(n))
    for (let u = 0; u < n.length; u++) {
      const h = n[u], F = h.i10 === "1" || h.result === "1" || h.stats?.Result === "1" || h.stats?.Win === "1", C = F ? "W" : "L";
      u === 0 ? (P = C, I = 1) : X && (C === P ? I++ : X = !1);
      const b = (h.i1 || h.stats?.Map || h.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), m = ie(h.i6 ?? h.stats?.Kills ?? h.kills, 0), S = ie(h.i8 ?? h.stats?.Deaths ?? h.deaths, 0), D = h.c3 || h.stats?.ADR || h.adr, $ = D ? V(D, void 0) : void 0, x = h.c4 || h.stats?.["Headshots %"], q = x ? V(x, void 0) : void 0;
      b && (L[b] || (L[b] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), L[b].matches++, F && L[b].wins++, L[b].kills += m, L[b].deaths += S, $ !== void 0 && (L[b].adrSum += $, L[b].adrCount++));
      const j = h.elo ? parseInt(h.elo.toString().replace(/,/g, ""), 10) : h.i15 ? parseInt(h.i15, 10) : void 0;
      let W;
      if (u < n.length - 1 && j) {
        const B = n[u + 1], he = B?.elo ? parseInt(B.elo.toString().replace(/,/g, ""), 10) : B?.i15 ? parseInt(B.i15, 10) : void 0;
        if (typeof he == "number" && !isNaN(he)) {
          const de = j - he;
          Math.abs(de) <= 60 && (W = de);
        }
      }
      W === void 0 && (W = F ? 25 : -25), Z.push({
        matchId: h.matchId || h.i0 || `match-${u}`,
        playedAt: h.date || h.created_at || 0,
        map: b,
        result: C,
        score: h.i18 || h.stats?.Score || "13:0",
        kills: m,
        deaths: S,
        kd: parseFloat(h.c2 || h.stats?.["K/D Ratio"] || (S > 0 ? (m / S).toFixed(2) : m.toFixed(2))),
        hsPercent: q,
        adr: $,
        elo: j,
        eloDiff: W
      });
    }
  for (const [u, h] of Object.entries(L))
    if (!O[u] || O[u].matches === 0) {
      const F = h.matches, C = h.wins, b = F > 0 ? Math.round(C / F * 100) : 50, m = h.deaths > 0 ? parseFloat((h.kills / h.deaths).toFixed(2)) : 1, S = h.adrCount > 0 ? Math.round(h.adrSum / h.adrCount) : void 0;
      O[u] = {
        mapName: u,
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
  let ee, te, k = 0, ae, K;
  if (U > 0) {
    const u = N.reduce((m, S) => m + (S.kills || 0), 0), h = N.reduce((m, S) => m + (S.deaths || 0), 0);
    ee = h > 0 ? parseFloat((u / h).toFixed(2)) : void 0;
    const F = N.map((m) => m.adr).filter((m) => m !== void 0 && m > 0);
    k = F.length, te = F.length > 0 ? Math.round(F.reduce((m, S) => m + S, 0) / F.length) : void 0;
    const C = N.map((m) => m.hsPercent).filter((m) => m !== void 0);
    ae = C.length > 0 ? Math.round(C.reduce((m, S) => m + S, 0) / C.length) : void 0;
    const b = N.filter((m) => m.result === "W").length;
    K = Math.round(b / U * 100);
  }
  const { formStatus: z, recentKd: l, recentAdr: _ } = we(Z, T, J);
  return {
    playerId: s,
    nickname: y,
    avatar: A,
    country: w,
    steamId64: r,
    elo: Number.isFinite(g) ? g : 1e3,
    skillLevel: Number.isFinite(c) ? c : 1,
    totalMatches: d,
    overallWinRate: E,
    overallKd: T,
    overallHsPercent: H,
    overallAdr: J,
    statsAvailable: M,
    last30Kd: ee,
    last30Adr: te,
    last30AdrMatches: k,
    last30HsPercent: ae,
    last30WinRate: K,
    last30Matches: U,
    currentStreak: {
      type: P,
      count: I
    },
    recentMatches: Z,
    mapStats: O,
    registrationDate: a?.created_at,
    formStatus: z,
    recentKd: l,
    recentAdr: _
  };
}
async function ne(s, e = {}, a = 8e3) {
  const t = new AbortController(), i = setTimeout(() => t.abort(), a);
  try {
    return await fetch(s, { ...e, signal: t.signal });
  } finally {
    clearTimeout(i);
  }
}
class _e {
  inFlightMatch = /* @__PURE__ */ new Map();
  inFlightPlayer = /* @__PURE__ */ new Map();
  async getMatchDetails(e) {
    if (!e || !/^[a-zA-Z0-9.\-_]+$/.test(e)) return null;
    if (this.inFlightMatch.has(e))
      return this.inFlightMatch.get(e);
    const a = this.fetchMatchDetailsInternal(e).finally(() => {
      this.inFlightMatch.delete(e);
    });
    return this.inFlightMatch.set(e, a), a;
  }
  async fetchMatchDetailsInternal(e) {
    try {
      const a = await ne(`https://api.faceit.com/match/v2/match/${encodeURIComponent(e)}`, {
        headers: { Accept: "application/json" }
      });
      if (!a.ok)
        return console.warn(`[f-insight:FaceitApi] Match ${e} returned HTTP ${a.status}`), null;
      const t = await a.json(), i = t.payload || t;
      return Fe(i);
    } catch (a) {
      return console.error(`[f-insight:FaceitApi] Error fetching match ${e}:`, a), null;
    }
  }
  async getPlayerStats(e, a) {
    if (!e || !/^[a-zA-Z0-9.\-_]+$/.test(e)) return null;
    const t = `${e}_${a || ""}`;
    if (this.inFlightPlayer.has(t))
      return this.inFlightPlayer.get(t);
    const i = this.fetchPlayerStatsInternal(e, a).finally(() => {
      this.inFlightPlayer.delete(t);
    });
    return this.inFlightPlayer.set(t, i), i;
  }
  async fetchPlayerStatsInternal(e, a) {
    try {
      const t = encodeURIComponent(e), [i, n, o, g] = await Promise.allSettled([
        ne(`https://api.faceit.com/users/v1/users/${t}`, { headers: { Accept: "application/json" } }),
        ne(`https://api.faceit.com/stats/v1/stats/users/${t}/games/cs2`, { headers: { Accept: "application/json" } }),
        ne(`https://api.faceit.com/stats/v1/stats/time/users/${t}/games/cs2?size=30`, { headers: { Accept: "application/json" } }),
        ne(`https://api.faceit.com/stats/v1/stats/users/${t}/games/csgo`, { headers: { Accept: "application/json" } })
      ]);
      let c = null;
      if (i.status === "fulfilled" && i.value.ok) {
        const w = await i.value.json();
        c = w.payload || w;
      }
      let r = null;
      if (n.status === "fulfilled" && n.value.ok) {
        const w = await n.value.json();
        r = w.payload || w;
      }
      let y = null;
      if (g.status === "fulfilled" && g.value.ok) {
        const w = await g.value.json();
        y = w.payload || w;
      }
      let A = [];
      if (o.status === "fulfilled" && o.value.ok) {
        const w = await o.value.json(), f = w.payload || w;
        A = Array.isArray(f) ? f : f?.items || f?.segments || [];
      }
      return Ae(e, a, c, r, y, A);
    } catch (t) {
      return console.error(`[f-insight:FaceitApi] Error fetching player ${e}:`, t), null;
    }
  }
}
const Me = ["VOTING", "CONFIGURING", "READY", "ON_GOING", "CANCELLED", "FINISHED"];
function Se(s) {
  const e = typeof s == "string" ? s.toUpperCase() : "";
  return Me.includes(e) ? e : "VOTING";
}
function Fe(s) {
  const e = s.teams?.faction1 || s.faction1 || {}, a = s.teams?.faction2 || s.faction2 || {}, t = s.voting?.map?.pick || [], i = t.length > 0 ? t[t.length - 1] : [...s.voting?.map?.entities || []].reverse().find((c) => c.status === "pick")?.name, n = s.configured_server_ip || s.server_ip, o = n && /^[a-zA-Z0-9.\-]+:\d+$/.test(n) ? n : void 0, g = (c) => (c || []).map((r) => ({
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
    status: Se(s.status),
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
        faction_id: a.id || a.faction_id || "faction2",
        name: a.name || "Team 2",
        avatar: a.avatar,
        leader: a.leader,
        roster: g(a.roster)
      }
    },
    voting: s.voting,
    selected_map: i,
    server_ip: o
  };
}
const ge = new _e();
function be(s, e) {
  const a = !s.includes("<privacyState>public</privacyState>"), t = s.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/), i = s.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/), n = {
    steamId64: e,
    personaName: t ? t[1] : "Steam User",
    profileUrl: `https://steamcommunity.com/profiles/${e}`,
    avatar: i ? i[1] : "",
    communityVisibilityState: a ? 1 : 3
  };
  let o = 0, g = 0;
  const c = s.match(/<mostPlayedGames>([\s\S]*?)<\/mostPlayedGames>/);
  if (c) {
    const f = c[1].split("</mostPlayedGame>");
    for (const v of f)
      if (v.includes("Counter-Strike 2") || v.includes("Counter-Strike: Global Offensive")) {
        const p = v.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        p && (o = parseFloat(p[1].replace(/,/g, "")));
        const M = v.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        M && (g = parseFloat(M[1].replace(/,/g, "")), o === 0 && (o = g));
        break;
      }
  }
  const r = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (r) {
    const f = new Date(r[1]);
    isNaN(f.getTime()) || (n.timeCreated = f.getTime() / 1e3, n.accountAgeYears = (Date.now() - f.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
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
      cs2HoursLast2Weeks: g
    },
    bans: w,
    isPrivate: a,
    fetchedAt: Date.now()
  };
}
async function Ee(s, e = {}, a = 6e3) {
  const t = new AbortController(), i = setTimeout(() => t.abort(), a);
  try {
    return await fetch(s, { ...e, signal: t.signal });
  } finally {
    clearTimeout(i);
  }
}
class Ce {
  inFlightSteam = /* @__PURE__ */ new Map();
  async getPlayerFullData(e) {
    if (!e || !/^\d{5,25}$/.test(e))
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
      const a = await Ee(`https://steamcommunity.com/profiles/${e}/?xml=1`);
      if (!a.ok)
        return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
      const t = await a.text();
      return t.includes("<steamID>") ? be(t, e) : { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    } catch {
      return { isPrivate: !0, fetchError: !0, fetchedAt: Date.now() };
    }
  }
}
const Re = new Ce();
function Te(s, e) {
  const a = [];
  let t = 0;
  const i = s.totalMatches || 0, n = s.elo || 1e3, o = s.overallKd || 1, g = s.overallWinRate || 50, c = s.recentKd || o, r = s.recentAdr || 75, y = s.statsAvailable !== !1;
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
  })), y && g >= 80 && i >= 10 ? (t += 30, a.push({
    id: "extreme_winrate",
    title: "Extreme Win Rate (80%+)",
    description: `Lifetime win rate of ${g.toFixed(0)}% across ${i} matches`,
    weight: 30,
    severity: "danger",
    category: "WINRATE_ANOMALY"
  })) : g >= 70 && i >= 15 ? (t += 20, a.push({
    id: "high_winrate",
    title: "Very High Win Rate (70%+)",
    description: `Lifetime win rate of ${g.toFixed(0)}%`,
    weight: 20,
    severity: "warning",
    category: "WINRATE_ANOMALY"
  })) : g >= 62 && i >= 25 && (t += 10, a.push({
    id: "elevated_winrate",
    title: "Elevated Win Rate",
    description: `Lifetime win rate of ${g.toFixed(0)}%`,
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
  }))), c >= 1.75 && c >= o * 1.35 && i >= 10 && (t += 15, a.push({
    id: "recent_kd_spike",
    title: "Recent Performance Hard Spike",
    description: `Recent 5 games K/D (${c.toFixed(2)}) is significantly higher than lifetime baseline (${o.toFixed(2)})`,
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
    const d = n >= 2200 ? 25 : n >= 2e3 ? 22 : n >= 1600 ? 15 : n >= 1350 ? 10 : 6;
    d >= 15 && (t += d, a.push({
      id: "hidden_high_elo",
      title: "Hidden Account with High Elo",
      description: `Private Steam profile with ${n} Elo`,
      weight: d,
      severity: d >= 22 ? "danger" : "warning",
      category: "PRIVATE_PROFILE"
    })), y && i < 100 && (t += 10, a.push({
      id: "private_steam_fresh_account",
      title: "Hidden Account on Fresh FACEIT Account",
      description: `Private Steam profile with only ${i} matches on record`,
      weight: 10,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
    const E = s.last30Kd ?? c;
    E >= 1.6 && (t += 8, a.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${E.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (A = !1, e.summary) {
    const d = e.playtime?.cs2HoursTotal !== void 0, E = d ? e.playtime.cs2HoursTotal ?? 0 : 0, T = d && E === 0;
    E > 0 && E < 150 && n >= 1600 || T && n >= 1600 ? (t += 30, a.push({
      id: "low_steam_hours",
      title: T ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
      description: `Only ${E}h in CS2 with ${n} Elo`,
      weight: 30,
      severity: "danger",
      category: "STEAM_HOURS"
    })) : E > 0 && E < 350 && n >= 2e3 ? (t += 20, a.push({
      id: "moderate_hours_high_elo",
      title: "Low Hours for Level 10",
      description: `${E}h total on Level 10 account`,
      weight: 20,
      severity: "warning",
      category: "STEAM_HOURS"
    })) : d && E >= 2500 && (t -= 15);
    const H = e.summary.accountAgeYears;
    H !== void 0 && H < 1 && n >= 1400 && (t += 18, a.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${H.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const d = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), E = 25;
    t += E, a.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${d} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: E,
      severity: "danger",
      category: "BAN_HISTORY"
    });
  }
  const w = s.registrationDate ? new Date(s.registrationDate) : null;
  if (w && !isNaN(w.getTime())) {
    const d = (Date.now() - w.getTime()) / 315576e5;
    d < 0.5 && n >= 1350 ? (t += 22, a.push({
      id: "fresh_faceit_high_elo",
      title: "Fresh FACEIT Account (<6 Months)",
      description: `FACEIT account created ${d.toFixed(1)} years ago with ${n} Elo`,
      weight: 22,
      severity: "danger",
      category: "ACCOUNT_AGE"
    })) : d < 1 && n >= 1600 && (t += 18, a.push({
      id: "young_faceit_high_elo",
      title: "Young FACEIT Account (<1 Year)",
      description: `FACEIT account created ${d.toFixed(1)} years ago with ${n} Elo`,
      weight: 18,
      severity: "warning",
      category: "ACCOUNT_AGE"
    }));
  }
  const f = Math.min(100, Math.max(0, Math.round(t)));
  let v = "LOW", p = "#10B981", M = "Legit";
  return f >= 70 ? (v = "CRITICAL", p = "#DC2626", M = "High Risk") : f >= 45 ? (v = "HIGH", p = "#EF4444", M = "Likely Smurf") : f >= 25 && (v = "MEDIUM", p = "#F59E0B", M = "Suspicious"), {
    score: f,
    level: v,
    flags: a,
    isPrivateSteam: A,
    summary: `${f}% Smurf Risk (${v})`,
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
function Pe(s, e) {
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
    const g = /* @__PURE__ */ new Set();
    for (const [, f] of o.entries())
      if (f.length >= 2) {
        const v = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${v} (${f.length})`,
          color: ce[t % ce.length],
          playerIds: f
        }), t++, f.forEach((p) => g.add(p));
      }
    const c = n.roster.map((f) => f.player_id).filter((f) => !g.has(f)), r = 15, y = /* @__PURE__ */ new Map();
    for (const f of c) {
      const v = e[f];
      v?.recentMatches && y.set(f, new Set(v.recentMatches.slice(0, r).map((p) => p.matchId)));
    }
    const A = /* @__PURE__ */ new Set(), w = (f, v) => {
      const p = y.get(f), M = y.get(v);
      if (!p || !M) return !1;
      let d = 0;
      for (const E of p)
        if (M.has(E) && d++, d >= 2) return !0;
      return !1;
    };
    for (const f of c) {
      if (A.has(f)) continue;
      const v = [], p = [f];
      for (A.add(f); p.length > 0; ) {
        const M = p.shift();
        v.push(M);
        for (const d of c)
          !A.has(d) && w(M, d) && (A.add(d), p.push(d));
      }
      if (v.length >= 2) {
        v.forEach((d) => g.add(d));
        const M = String.fromCharCode(65 + t % 26);
        a.push({
          id: `party-${t}`,
          tag: `Party ${M} (${v.length})`,
          color: ce[t % ce.length],
          playerIds: v
        }), t++;
      }
    }
  }
  return a;
}
const Le = (s) => new Promise((e) => setTimeout(e, s));
async function ke(s, e, a, t = 150) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const c = n++;
      i[c] = await a(s[c], c), t > 0 && await Le(t);
    }
  }, g = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(g), i;
}
class De {
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
  async handleMessage(e, a) {
    try {
      switch (e.type) {
        case "GET_SETTINGS":
          return this.handleGetSettings();
        case "SAVE_SETTINGS":
          return this.handleSaveSettings(e.payload);
        case "FETCH_LOBBY_INSIGHT":
          return this.handleFetchLobbyInsight(e.payload, a);
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
  async handleSaveSettings(e) {
    const a = {};
    for (const t of Object.keys(re))
      if (e && typeof e == "object" && t in e) {
        const i = re[t], n = e[t];
        typeof n == typeof i && (a[t] = n);
      }
    return this.settings = { ...this.settings, ...a }, await G.set(oe, this.settings, se.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, a) {
    const { matchId: t, forceRefresh: i } = e, n = `match_analysis:${t}`;
    if (!i) {
      const g = await G.get(n);
      if (g && !g.isPartial)
        return { success: !0, data: g };
    }
    const o = await ge.getMatchDetails(t);
    if (!o)
      return { success: !1, error: `Could not fetch match details for ${t}` };
    if (a?.tab?.id && (this.streamSubscribers.has(t) || this.streamSubscribers.set(t, /* @__PURE__ */ new Set()), this.streamSubscribers.get(t).add(a.tab.id)), !this.inFlightStreams.has(t) || i) {
      const g = this.streamLobbyData(t, o, i).finally(() => {
        this.inFlightStreams.get(t) === g && this.inFlightStreams.delete(t), this.streamSubscribers.delete(t);
      });
      this.inFlightStreams.set(t, g);
    }
    return { success: !0, data: { match: o, isPartial: !0 } };
  }
  async streamLobbyData(e, a, t) {
    try {
      await this.streamLobbyDataInner(e, a, t);
    } catch (i) {
      console.error("[f-insight:Stream] Error:", i), this.broadcastToSubscribers(e, {
        type: "LOBBY_ANALYSIS_ERROR",
        payload: { matchId: e, error: i?.message || "Match analysis stream failed" }
      });
    }
  }
  broadcastToSubscribers(e, a) {
    const t = this.streamSubscribers.get(e);
    if (!(!t || t.size === 0))
      for (const i of t)
        this.safeSendToTab(i, a);
  }
  async streamLobbyDataInner(e, a, t) {
    const i = `match_analysis:${e}`, n = a.teams?.faction1?.roster || [], o = a.teams?.faction2?.roster || [], g = [...n, ...o], c = {}, r = {}, y = {};
    await ke(
      g,
      3,
      async (l) => {
        const _ = l.player_id;
        if (!_) return;
        const u = `player_stats:${_}`;
        let h = null;
        if (t || (h = await G.get(u)), !h && (h = await ge.getPlayerStats(_, l.nickname), h)) {
          const F = h.statsAvailable === !1 ? se.NEGATIVE : se.PLAYER_STATS;
          await G.set(u, h, F);
        }
        if (h) {
          c[_] = h;
          const F = h.steamId64 || l.game_player_id;
          if (F) {
            const C = `steam_data:${F}`;
            let b = null;
            t || (b = await G.get(C)), b || (b = await Re.getPlayerFullData(F), b && !b.fetchError && await G.set(C, b, se.STEAM_PROFILE)), b && (r[_] = b);
          }
          y[_] = Te(h, r[_]), this.broadcastToSubscribers(e, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: _, stats: h, steam: r[_], risk: y[_] }
          });
        }
      },
      200
    );
    const A = n.map((l) => c[l.player_id]?.elo || l.elo || 1e3), w = o.map((l) => c[l.player_id]?.elo || l.elo || 1e3), f = A.reduce((l, _) => l + _, 0), v = w.reduce((l, _) => l + _, 0), p = A.length > 0 ? Math.round(f / A.length) : 1e3, M = w.length > 0 ? Math.round(v / w.length) : 1e3, d = p - M, E = ye(p, M), T = n.map((l) => c[l.player_id]?.last30Kd ?? c[l.player_id]?.overallKd ?? 1), H = o.map((l) => c[l.player_id]?.last30Kd ?? c[l.player_id]?.overallKd ?? 1), Y = T.length > 0 ? parseFloat((T.reduce((l, _) => l + _, 0) / T.length).toFixed(2)) : 1, J = H.length > 0 ? parseFloat((H.reduce((l, _) => l + _, 0) / H.length).toFixed(2)) : 1, O = n.map((l) => c[l.player_id]?.overallHsPercent || 0), Q = o.map((l) => c[l.player_id]?.overallHsPercent || 0), Z = O.length > 0 ? Math.round(O.reduce((l, _) => l + _, 0) / O.length) : 0, I = Q.length > 0 ? Math.round(Q.reduce((l, _) => l + _, 0) / Q.length) : 0, P = n.map((l) => c[l.player_id]?.last30Adr ?? c[l.player_id]?.overallAdr ?? 75), X = o.map((l) => c[l.player_id]?.last30Adr ?? c[l.player_id]?.overallAdr ?? 75), L = P.length > 0 ? Math.round(P.reduce((l, _) => l + _, 0) / P.length) : 75, N = X.length > 0 ? Math.round(X.reduce((l, _) => l + _, 0) / X.length) : 75, U = n.map((l) => c[l.player_id]).filter(Boolean), ee = o.map((l) => c[l.player_id]).filter(Boolean), te = me(U), k = me(ee);
    for (const [l, _] of Object.entries(te))
      c[l] && (c[l].fcrContributionPercent = _);
    for (const [l, _] of Object.entries(k))
      c[l] && (c[l].fcrContributionPercent = _);
    const ae = Pe(a, c), K = ve({
      f1AvgElo: p,
      f2AvgElo: M,
      f1Players: U,
      f2Players: ee,
      selectedMap: a.selected_map,
      premadeGroups: ae,
      riskAnalysis: y,
      f1Fcr: te,
      f2Fcr: k
    }), z = {
      match: a,
      playersStats: c,
      steamData: r,
      riskAnalysis: y,
      premadeGroups: ae,
      teamSummary: {
        faction1: {
          totalElo: f,
          avgElo: p,
          winChancePercent: K.winChanceF1,
          avgKd: Y,
          avgHsPercent: Z,
          avgAdr: L,
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
        eloDifference: Math.abs(d)
      },
      prediction: K,
      isPartial: !1
    };
    await G.set(i, z, se.MATCH), this.broadcastToSubscribers(e, {
      type: "LOBBY_ANALYSIS_COMPLETE",
      payload: z
    });
  }
  safeSendToTab(e, a) {
    chrome.tabs.sendMessage(e, a).catch((t) => {
      console.debug("[f-insight:Background] Tab unavailable, skipping message:", t?.message || t);
    });
  }
  async handleGetCacheStats() {
    return { success: !0, data: await G.getStats() };
  }
  async handleClearCache() {
    return await G.clear(), { success: !0, data: { cleared: !0 } };
  }
}
const le = new De(), ue = () => {
  chrome.alarms.create("cache_cleanup", { periodInMinutes: 30 });
};
chrome.runtime.onInstalled.addListener(async (s) => {
  console.log("[f-insight:Background] Extension installed/updated:", s.reason), ue(), await le.init();
});
chrome.runtime.onStartup.addListener(async () => {
  console.log("[f-insight:Background] Extension started"), ue(), await le.init();
});
chrome.runtime.onMessage.addListener((s, e, a) => (le.init().then(() => le.handleMessage(s, e)).then(a).catch((t) => {
  console.error("[f-insight:Background] Message handling failed:", t);
  try {
    a({ success: !1, error: t?.message || "Internal background error" });
  } catch {
  }
}), !0));
chrome.alarms.onAlarm.addListener(async (s) => {
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await G.cleanup());
});
