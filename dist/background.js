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
}, Q = {
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
const T = new Ie();
function we(s) {
  const e = {};
  if (!s || s.length === 0) return e;
  const t = s.map((r) => {
    const p = Number.isFinite(r.elo) ? r.elo : 1e3, w = Math.max(500, p || 1e3) / 1e3, f = Number.isFinite(r.last30Kd) ? r.last30Kd : Number.isFinite(r.overallKd) ? r.overallKd : 1, h = Math.min(2.5, Math.max(0.4, f ?? 1)), v = 1 + (((Number.isFinite(r.last30Adr) ? r.last30Adr : Number.isFinite(r.overallAdr) ? r.overallAdr : 75) ?? 75) - 75) / 150, M = w * h * Math.max(0.6, v);
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
    const f = o.reduce((_, v) => _ + (v.kills || 0), 0), h = o.reduce((_, v) => _ + (v.deaths || 0), 0);
    g = h > 0 ? parseFloat((f / h).toFixed(2)) : parseFloat(Math.max(a, f / (o.length * 2)).toFixed(2));
  }
  const y = n.map((f) => f.adr).filter((f) => typeof f == "number" && Number.isFinite(f) && f > 0), r = y.length > 0 ? Math.round(y.reduce((f, h) => f + h, 0) / y.length) : i, p = g / a;
  let w = "STABLE";
  return p >= 1.15 ? w = "HOT" : p <= 1 / 1.15 && (w = "COLD"), {
    formStatus: w,
    recentKd: g,
    recentAdr: r
  };
}
function De(s) {
  const {
    f1Players: e,
    f2Players: t,
    selectedMap: a,
    premadeGroups: i,
    riskAnalysis: n,
    f1Fcr: o,
    f2Fcr: g
  } = s, y = Number.isFinite(s.f1AvgElo) ? Math.max(100, Math.min(6e3, s.f1AvgElo)) : 1e3, r = Number.isFinite(s.f2AvgElo) ? Math.max(100, Math.min(6e3, s.f2AvgElo)) : 1e3, p = y, w = r, f = w - p, h = 1 / (1 + Math.pow(10, f / 400));
  let _ = 0, v;
  const M = (a || "").replace(/^(cs2_|csgo_|de_)/, "").toLowerCase();
  if (M) {
    const u = e.reduce((K, q) => K + (q.mapStats?.[M]?.wins || 0), 0), b = e.reduce((K, q) => K + (q.mapStats?.[M]?.matches || 0), 0), I = t.reduce((K, q) => K + (q.mapStats?.[M]?.wins || 0), 0), H = t.reduce((K, q) => K + (q.mapStats?.[M]?.matches || 0), 0), V = Math.round((u + 2.5) / (b + 5) * 100), G = Math.round((I + 2.5) / (H + 5) * 100), j = V - G;
    b + H >= 10 && (_ = Math.max(-0.12, Math.min(0.12, j / 100 * 0.25))), v = {
      leader: j >= 5 ? "faction1" : j <= -5 ? "faction2" : "balanced",
      mapName: M,
      f1WinRate: V,
      f2WinRate: G,
      deltaWinRate: Math.abs(j)
    };
  }
  const l = e.filter((u) => u.formStatus === "HOT").length, C = e.filter((u) => u.formStatus === "COLD").length, k = t.filter((u) => u.formStatus === "HOT").length, x = t.filter((u) => u.formStatus === "COLD").length, U = l - C, z = k - x, W = Math.max(-0.1, Math.min(0.1, (U - z) * 0.03)), ae = new Set(e.map((u) => u.playerId)), X = new Set(t.map((u) => u.playerId));
  let N = 1, D = 1;
  for (const u of i) {
    const b = u.playerIds.filter((H) => ae.has(H)).length, I = u.playerIds.filter((H) => X.has(H)).length;
    b > N && (N = b), I > D && (D = I);
  }
  const ee = Math.max(-0.08, Math.min(0.08, (N - D) * 0.02)), $ = e.filter((u) => {
    const b = n[u.playerId]?.level;
    return b === "HIGH" || b === "CRITICAL";
  }).length, O = t.filter((u) => {
    const b = n[u.playerId]?.level;
    return b === "HIGH" || b === "CRITICAL";
  }).length, Z = Math.max(-0.06, Math.min(0.06, ($ - O) * 0.02)), se = h + _ + W + ee + Z, ie = Math.max(0.06, Math.min(0.94, se)), L = Math.round(ie * 100), ne = 100 - L;
  let Y = 13, J = 9;
  const d = Math.abs(L - 50), S = d <= 8;
  d <= 8 ? (Y = L >= 50 ? 13 : 11, J = L >= 50 ? 11 : 13) : d <= 16 ? (Y = L >= 50 ? 13 : 8, J = L >= 50 ? 8 : 13) : d <= 26 ? (Y = L >= 50 ? 13 : 5, J = L >= 50 ? 5 : 13) : (Y = L >= 50 ? 13 : 3, J = L >= 50 ? 3 : 13);
  const m = [];
  Math.abs(p - w) >= 60 && m.push(
    p > w ? `Team 1 holds +${Math.round(p - w)} avg Elo edge` : `Team 2 holds +${Math.round(w - p)} avg Elo edge`
  ), v && v.deltaWinRate >= 8 && m.push(
    v.leader === "faction1" ? `Team 1 dominates ${v.mapName} (+${v.deltaWinRate}% WR)` : `Team 2 dominates ${v.mapName} (+${v.deltaWinRate}% WR)`
  ), l > k && l >= 2 ? m.push(`Team 1 on hot momentum (${l} players On Fire)`) : k > l && k >= 2 && m.push(`Team 2 on hot momentum (${k} players On Fire)`), N >= 3 && N > D ? m.push(`Team 1 has ${N}-stack coordination`) : D >= 3 && D > N && m.push(`Team 2 has ${D}-stack coordination`), Math.abs(Z) >= 0.04 && $ + O > 0 && ($ > O ? m.push(`Team 1 likely carries flagged accounts (${$} risk flagged)`) : O > $ && m.push(`Team 2 likely carries flagged accounts (${O} risk flagged)`));
  const c = m.length > 0 ? m.join(" • ") : "Evenly matched teams with balanced firepower & map proficiency", A = (u, b) => {
    let I = u[0], H = -1;
    for (const V of u) {
      const j = (b[V.playerId] || 20) * 1.5 + (V.last30Kd ?? V.overallKd ?? 1) * 10;
      j > H && (H = j, I = V);
    }
    return I ? {
      nickname: I.nickname,
      fcr: b[I.playerId] || 20,
      kd: I.last30Kd ?? I.overallKd ?? 1,
      elo: I.elo || 1e3
    } : void 0;
  }, E = A(e, o), F = A(t, g);
  return {
    winChanceF1: L,
    winChanceF2: ne,
    predictedScore: {
      f1Score: Y,
      f2Score: J,
      isOvertimeLikely: S
    },
    keyAdvantageText: c,
    factors: {
      eloDelta: Math.round(p - w),
      mapAdvantage: v,
      momentumAdvantage: {
        leader: U > z ? "faction1" : z > U ? "faction2" : "balanced",
        f1HotCount: l,
        f2HotCount: k,
        f1ColdCount: C,
        f2ColdCount: x
      },
      premadeAdvantage: {
        leader: N > D ? "faction1" : D > N ? "faction2" : "balanced",
        f1MaxPartySize: N,
        f2MaxPartySize: D
      },
      smurfRiskDelta: {
        f1HighRiskCount: $,
        f2HighRiskCount: O,
        impactPercent: Math.round(Z * 100)
      }
    },
    starMatchup: E && F ? { f1Star: E, f2Star: F } : void 0
  };
}
const P = (s, ...e) => {
  for (const t of e) {
    const a = s?.[t];
    if (a != null && a !== "") return a;
  }
}, re = (s, e) => {
  if (s === void 0) return e;
  const t = parseInt(s.replace(/[,\s]/g, ""), 10);
  return Number.isFinite(t) ? t : e;
}, B = (s, e) => {
  if (s === void 0) return e;
  const t = parseFloat(s.replace(/[,\s]/g, ""));
  return Number.isFinite(t) ? t : e;
};
function Fe(s, e, t, a, i, n) {
  const o = t?.games?.cs2 || t?.games?.csgo || {}, g = o.faceit_elo || 1e3, y = o.skill_level || 1, r = o.game_player_id || t?.steam_id_64, p = t?.nickname || e || "Player", w = t?.avatar || "", f = t?.country || "", h = Array.isArray(a) ? null : a, _ = Array.isArray(i) ? null : i, v = h?.lifetime || _?.lifetime || {}, M = Object.keys(v).length > 0, l = re(P(v, "Total Matches", "Matches", "m1"), 0), C = B(P(v, "Win Rate %", "k6"), 0) ?? 0, k = B(P(v, "Average K/D Ratio", "K/D Ratio", "k5"), 1) ?? 1, x = B(P(v, "Average Headshots %", "Headshots %", "k8"), 0) ?? 0, U = P(v, "ADR", "adr", "c3");
  let z = U ? B(U, void 0) : void 0;
  const W = {}, ae = [
    ...Array.isArray(a) ? a : a?.segments || a?.items || [],
    ...Array.isArray(i) ? i : i?.segments || i?.items || []
  ];
  for (const m of ae) {
    const A = (m._id?.segmentId || m._id?.label || m.label || m.segmentId || m.name || "").replace(/^cs2_/, "").replace(/^csgo_/, "").replace(/^de_/, "").trim().toLowerCase();
    if (A) {
      const E = re(P(m.stats, "Matches") ?? P(m, "m1", "matches"), 0), F = B(P(m.stats, "Win Rate %") ?? P(m, "k6", "winRate"), 0) ?? 0, u = B(P(m.stats, "Average K/D Ratio", "K/D Ratio") ?? P(m, "k5", "kd"), 1) ?? 1, b = B(P(m.stats, "Average Headshots %") ?? P(m, "k8", "hsPercent"), 0) ?? 0, I = B(P(m.stats, "Average Kills") ?? P(m, "k1", "avgKills"), 0) ?? 0, H = P(m.stats, "ADR") ?? P(m, "c3", "adr"), V = H ? B(H, void 0) : void 0, G = re(P(m.stats, "Wins") ?? P(m, "m2", "wins"), Math.round(E * F / 100));
      (!W[A] || E > W[A].matches) && (W[A] = {
        mapName: A,
        matches: E,
        winRate: F,
        kd: u,
        hsPercent: b,
        avgKills: I,
        avgAdr: V,
        wins: G,
        losses: Math.max(0, E - G)
      });
    }
  }
  const X = [];
  let N = 0, D = "NONE", ee = !0;
  const $ = {};
  if (Array.isArray(n))
    for (let m = 0; m < n.length; m++) {
      const c = n[m], A = c.i10 === "1" || c.result === "1" || c.stats?.Result === "1" || c.stats?.Win === "1", E = A ? "W" : "L";
      m === 0 ? (D = E, N = 1) : ee && (E === D ? N++ : ee = !1);
      const F = (c.i1 || c.stats?.Map || c.map || "").replace(/^cs2_/, "").replace(/^de_/, "").toLowerCase(), u = re(c.i6 ?? c.stats?.Kills ?? c.kills, 0), b = re(c.i8 ?? c.stats?.Deaths ?? c.deaths, 0), I = c.stats && typeof c.stats == "object" ? c.stats : null, H = (R) => R !== void 0 && R >= 5 && R <= 200, V = re(c.i9, 0), G = u > 0 && V > 0 ? V / u * 100 : void 0, j = (R) => G !== void 0 && Math.abs(R - G) <= 5;
      let K;
      const q = I ? B(P(I, "ADR", "adr"), void 0) : void 0;
      if (H(q))
        K = q;
      else {
        const R = c.c3 !== void 0 && c.c3 !== "" ? B(c.c3, void 0) : void 0, te = c.c4 !== void 0 && c.c4 !== "" ? B(c.c4, void 0) : void 0, fe = H(R) && !j(R) ? R : void 0, Pe = H(te) && !j(te) ? te : void 0;
        if (K = fe ?? (G !== void 0 ? Pe : void 0), K === void 0 && c.adr !== void 0) {
          const ve = B(c.adr, void 0);
          H(ve) && (K = ve);
        }
      }
      let le;
      const de = I ? B(I["Headshots %"], void 0) : void 0;
      if (de !== void 0 && de > 0 && de <= 100)
        le = de;
      else {
        const R = c.c4 !== void 0 && c.c4 !== "" ? B(c.c4, void 0) : void 0;
        R !== void 0 && R > 0 && R <= 100 && (G === void 0 || j(R)) ? le = R : G !== void 0 && (le = Math.round(G * 10) / 10);
      }
      F && ($[F] || ($[F] = { matches: 0, wins: 0, kills: 0, deaths: 0, adrSum: 0, adrCount: 0 }), $[F].matches++, A && $[F].wins++, $[F].kills += u, $[F].deaths += b, K !== void 0 && ($[F].adrSum += K, $[F].adrCount++));
      const ye = c.elo ? parseInt(c.elo.toString().replace(/,/g, ""), 10) : c.i15 ? parseInt(c.i15, 10) : void 0;
      let he;
      if (m < n.length - 1 && ye) {
        const R = n[m + 1], te = R?.elo ? parseInt(R.elo.toString().replace(/,/g, ""), 10) : R?.i15 ? parseInt(R.i15, 10) : void 0;
        if (typeof te == "number" && !isNaN(te)) {
          const fe = ye - te;
          Math.abs(fe) <= 60 && (he = fe);
        }
      }
      he === void 0 && (he = A ? 25 : -25), X.push({
        matchId: c.matchId || c.i0 || `match-${m}`,
        playedAt: c.date || c.created_at || 0,
        map: F,
        result: E,
        score: c.i18 || c.stats?.Score || "13:0",
        kills: u,
        deaths: b,
        kd: parseFloat(c.c2 || c.stats?.["K/D Ratio"] || (b > 0 ? (u / b).toFixed(2) : u.toFixed(2))),
        hsPercent: le,
        adr: K,
        elo: ye,
        eloDiff: he
      });
    }
  for (const [m, c] of Object.entries($))
    if (!W[m] || W[m].matches === 0) {
      const A = c.matches, E = c.wins, F = A > 0 ? Math.round(E / A * 100) : 50, u = c.deaths > 0 ? parseFloat((c.kills / c.deaths).toFixed(2)) : 1, b = c.adrCount > 0 ? Math.round(c.adrSum / c.adrCount) : void 0;
      W[m] = {
        mapName: m,
        matches: A,
        winRate: F,
        kd: u,
        hsPercent: x,
        avgKills: A > 0 ? parseFloat((c.kills / A).toFixed(1)) : 15,
        avgAdr: b,
        wins: E,
        losses: A - E
      };
    }
  if (z === void 0) {
    let m = 0, c = 0;
    for (const A of Object.values(W))
      A.avgAdr !== void 0 && A.matches > 0 && (m += A.avgAdr * A.matches, c += A.matches);
    c > 0 && (z = Math.round(m / c * 10) / 10);
  }
  const O = X.slice(0, 30), Z = O.length;
  let se, ie, L = 0, ne, Y;
  if (Z > 0) {
    const m = O.reduce((u, b) => u + (b.kills || 0), 0), c = O.reduce((u, b) => u + (b.deaths || 0), 0);
    se = c > 0 ? parseFloat((m / c).toFixed(2)) : void 0;
    const A = O.map((u) => u.adr).filter((u) => u !== void 0 && u > 0);
    L = A.length, ie = A.length > 0 ? Math.round(A.reduce((u, b) => u + b, 0) / A.length) : void 0;
    const E = O.map((u) => u.hsPercent).filter((u) => u !== void 0);
    ne = E.length > 0 ? Math.round(E.reduce((u, b) => u + b, 0) / E.length) : void 0;
    const F = O.filter((u) => u.result === "W").length;
    Y = Math.round(F / Z * 100);
  }
  const { formStatus: J, recentKd: d, recentAdr: S } = ke(X, k, z);
  return {
    playerId: s,
    nickname: p,
    avatar: w,
    country: f,
    steamId64: r,
    elo: Number.isFinite(g) ? g : 1e3,
    skillLevel: Number.isFinite(y) ? y : 1,
    totalMatches: l,
    overallWinRate: C,
    overallKd: k,
    overallHsPercent: x,
    overallAdr: z,
    statsAvailable: M,
    last30Kd: se,
    last30Adr: ie,
    last30AdrMatches: L,
    last30HsPercent: ne,
    last30WinRate: Y,
    last30Matches: Z,
    currentStreak: {
      type: D,
      count: N
    },
    recentMatches: X,
    mapStats: W,
    registrationDate: t?.created_at,
    formStatus: J,
    recentKd: d,
    recentAdr: S
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
    const t = await T.get(
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
      const a = encodeURIComponent(e), [i, n, o] = await Promise.allSettled([
        oe(`https://api.faceit.com/users/v1/users/${a}`),
        oe(`https://api.faceit.com/stats/v1/stats/users/${a}/games/cs2`),
        oe(`https://api.faceit.com/stats/v1/stats/time/users/${a}/games/cs2?size=30`)
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
        const f = await o.value.json(), h = f.payload || f;
        r = Array.isArray(h) ? h : h?.items || h?.segments || [];
      }
      let p = null;
      if (!(!!(y?.lifetime && Object.keys(y.lifetime).length > 0) || Array.isArray(y?.segments) && y.segments.length > 0 || r.length > 0))
        try {
          const f = await oe(`https://api.faceit.com/stats/v1/stats/users/${a}/games/csgo`);
          if (f.ok) {
            const h = await f.json();
            p = h.payload || h;
          }
        } catch {
        }
      return Fe(e, t, g, y, p, r);
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
const Me = new He();
function Be(s, e) {
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
    const h = y[1].split("</mostPlayedGame>");
    for (const _ of h)
      if (_.includes("Counter-Strike 2") || _.includes("Counter-Strike: Global Offensive")) {
        const v = _.match(/<hoursOnRecord>(.*?)<\/hoursOnRecord>/);
        v && (o = parseFloat(v[1].replace(/,/g, "")));
        const M = _.match(/<hoursPlayed>(.*?)<\/hoursPlayed>/);
        M && (g = parseFloat(M[1].replace(/,/g, "")), o === 0 && (o = g));
        break;
      }
  }
  const r = s.match(/<memberSince>(.*?)<\/memberSince>/);
  if (r) {
    const h = new Date(r[1]);
    isNaN(h.getTime()) || (n.timeCreated = h.getTime() / 1e3, n.accountAgeYears = (Date.now() - h.getTime()) / (1e3 * 60 * 60 * 24 * 365.25));
  }
  const p = s.match(/<communityBanned>(.*?)<\/communityBanned>/), w = s.match(/<vacBanned>(.*?)<\/vacBanned>/), f = {
    steamId64: e,
    communityBanned: p ? p[1] === "1" : !1,
    vacBanned: w ? w[1] === "1" : !1,
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
    const C = s.last30Kd ?? y;
    C >= 1.6 && (a += 8, t.push({
      id: "hidden_strong_performance",
      title: "Hidden Profile with Strong Recent Performance",
      description: `Hidden Steam profile with recent K/D of ${C.toFixed(2)}`,
      weight: 8,
      severity: "warning",
      category: "PRIVATE_PROFILE"
    }));
  } else if (w = !1, e.summary) {
    const l = e.playtime?.cs2HoursTotal !== void 0, C = l ? e.playtime.cs2HoursTotal ?? 0 : 0, k = l && C === 0;
    C > 0 && C < 150 && n >= 1600 || k && n >= 1600 ? (a += 30, t.push({
      id: "low_steam_hours",
      title: k ? "Zero CS2 Hours for Elo Rating" : "Very Low CS2 Hours for Elo Rating",
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
    })) : l && C >= 2500 && (a -= 15);
    const x = e.summary.accountAgeYears;
    x !== void 0 && x < 1 && n >= 1400 && (a += 18, t.push({
      id: "fresh_steam_account",
      title: "Fresh Steam Account (<1 Year)",
      description: `Steam account created only ${x.toFixed(1)} years ago`,
      weight: 18,
      severity: "warning",
      category: "STEAM_AGE"
    }));
  }
  if (e && !e.fetchError && !e.isPrivate && e.bans && (e.bans.vacBanned || e.bans.numberOfGameBans)) {
    const l = (e.bans.vacBanned ? 1 : 0) + (e.bans.numberOfGameBans || 0), C = 25;
    a += C, t.push({
      id: "steam_ban_history",
      title: "Past Ban on Record",
      description: `Account has ${l} ban(s) on record (${e.bans.daysSinceLastBan || 0} days ago)`,
      weight: C,
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
  const h = Math.min(100, Math.max(0, Math.round(a)));
  let _ = "LOW", v = "#10B981", M = "Legit";
  return h >= 70 ? (_ = "CRITICAL", v = "#DC2626", M = "High Risk") : h >= 45 ? (_ = "HIGH", v = "#EF4444", M = "Likely Smurf") : h >= 25 && (_ = "MEDIUM", v = "#F59E0B", M = "Suspicious"), {
    score: h,
    level: _,
    flags: t,
    isPrivateSteam: w,
    summary: `${h}% Smurf Risk (${_})`,
    color: v,
    badgeText: M
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
    const o = /* @__PURE__ */ new Map();
    for (const h of n.roster)
      if (h.party_id) {
        const _ = o.get(h.party_id) || [];
        _.push(h.player_id), o.set(h.party_id, _);
      }
    const g = /* @__PURE__ */ new Set();
    for (const [, h] of o.entries())
      if (h.length >= 2) {
        const _ = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${_} (${h.length})`,
          color: ue[a % ue.length],
          playerIds: h
        }), a++, h.forEach((v) => g.add(v));
      }
    const y = n.roster.map((h) => h.player_id).filter((h) => !g.has(h)), r = 15, p = /* @__PURE__ */ new Map();
    for (const h of y) {
      const _ = e[h];
      _?.recentMatches && p.set(h, new Set(_.recentMatches.slice(0, r).map((v) => v.matchId)));
    }
    const w = /* @__PURE__ */ new Set(), f = (h, _) => {
      const v = p.get(h), M = p.get(_);
      if (!v || !M) return !1;
      let l = 0;
      for (const C of v)
        if (M.has(C) && l++, l >= 2) return !0;
      return !1;
    };
    for (const h of y) {
      if (w.has(h)) continue;
      const _ = [], v = [h];
      for (w.add(h); v.length > 0; ) {
        const M = v.shift();
        _.push(M);
        for (const l of y)
          !w.has(l) && f(M, l) && (w.add(l), v.push(l));
      }
      if (_.length >= 2) {
        _.forEach((l) => g.add(l));
        const M = String.fromCharCode(65 + a % 26);
        t.push({
          id: `party-${a}`,
          tag: `Party ${M} (${_.length})`,
          color: ue[a % ue.length],
          playerIds: _
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
const be = "maps_observed_cache", je = 1440 * 60 * 1e3;
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
  const t = await T.get(be) || [], a = Array.from(/* @__PURE__ */ new Set([...t, ...e]));
  await T.set(be, a, je);
}
const Je = (s) => new Promise((e) => setTimeout(e, s));
async function qe(s, e, t, a = 150) {
  const i = new Array(s.length);
  let n = 0;
  const o = async () => {
    for (; n < s.length; ) {
      const y = n++;
      i[y] = await t(s[y], y), a > 0 && await Je(a);
    }
  }, g = Array.from({ length: Math.min(e, s.length) }, o);
  return await Promise.all(g), i;
}
class Qe {
  settings = { ...me };
  initialized = !1;
  inFlightStreams = /* @__PURE__ */ new Map();
  streamSubscribers = /* @__PURE__ */ new Map();
  // Monotonic per-match stream generation; superseded streams stop broadcasting.
  streamGenerations = /* @__PURE__ */ new Map();
  async init() {
    this.initialized || (await this.loadSettings(), this.initialized = !0, T.cleanup().catch(() => {
    }));
  }
  async loadSettings() {
    const e = await T.get(ce);
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
      return await T.set(`intercepted_match:${t}`, i, Q.MATCH), Ze(ze(e.body)).catch(() => {
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
    const { kind: i, playerId: n } = a, o = e.body.payload ?? e.body, g = `intercept_profile:${n}`, y = await T.get(g) || {};
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
    await T.set(g, y, Q.NEGATIVE * 3);
    const w = Ne(n, y);
    return w ? (await T.set(
      `player_stats:${n}`,
      w,
      w.statsAvailable === !1 ? Q.NEGATIVE : Q.PLAYER_STATS
    ), console.warn(
      `[f-insight:Background] Hydrated player ${n} from intercepted ${i} payload (statsAvailable=${w.statsAvailable !== !1})`
    ), {
      success: !0,
      data: {
        kind: "profile-hydrated",
        playerId: n,
        statsAvailable: w.statsAvailable !== !1,
        selfCandidate: p
      }
    }) : { success: !0, data: { kind: "profile-staged", playerId: n, selfCandidate: p } };
  }
  async handleSaveSettings(e) {
    const t = {};
    for (const a of Object.keys(me))
      if (e && typeof e == "object" && a in e) {
        const i = me[a], n = e[a];
        typeof n == typeof i && (t[a] = n);
      }
    return this.settings = { ...this.settings, ...t }, await T.set(ce, this.settings, Q.SETTINGS), { success: !0, data: this.settings };
  }
  async handleFetchLobbyInsight(e, t) {
    const { matchId: a, forceRefresh: i } = e, n = `match_analysis:${a}`;
    if (t?.tab?.id && (this.streamSubscribers.has(a) || this.streamSubscribers.set(a, /* @__PURE__ */ new Set()), this.streamSubscribers.get(a).add(t.tab.id)), !i) {
      const g = await T.get(n);
      if (g && !g.isPartial)
        return { success: !0, data: g };
    }
    const o = await Me.getMatchDetails(a);
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
    const n = `match_analysis:${e}`, o = t.teams?.faction1?.roster || [], g = t.teams?.faction2?.roster || [], y = [...o, ...g], r = {}, p = {}, w = {};
    await qe(
      y,
      2,
      async (d) => {
        const S = d.player_id;
        if (!S) return;
        const m = `player_stats:${S}`;
        let c = null;
        if (a || (c = await T.get(m)), !c) {
          const A = await Me.getPlayerStats(S, d.nickname);
          if (A && A.statsAvailable === !1) {
            const E = await T.get(m);
            E && E.statsAvailable !== !1 ? c = E : (await T.set(m, A, Q.NEGATIVE), c = A);
          } else A && (await T.set(m, A, Q.PLAYER_STATS), c = A);
        }
        if (c) {
          r[S] = c;
          const A = c.steamId64 || d.game_player_id;
          if (A) {
            const E = `steam_data:${A}`;
            let F = null;
            a || (F = await T.get(E)), F || (F = await Ge.getPlayerFullData(A), F && !F.fetchError && await T.set(E, F, Q.STEAM_PROFILE)), F && (p[S] = F);
          }
          w[S] = Ye(c, p[S]), this.broadcastFromStream(e, i, {
            type: "PLAYER_STATS_UPDATE",
            payload: { matchId: e, playerId: S, stats: c, steam: p[S], risk: w[S] }
          });
        }
      },
      400
    );
    const f = o.map((d) => r[d.player_id]?.elo || d.elo || 1e3), h = g.map((d) => r[d.player_id]?.elo || d.elo || 1e3), _ = f.reduce((d, S) => d + S, 0), v = h.reduce((d, S) => d + S, 0), M = f.length > 0 ? Math.round(_ / f.length) : 1e3, l = h.length > 0 ? Math.round(v / h.length) : 1e3, C = M - l, k = o.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), x = g.map((d) => r[d.player_id]?.last30Kd ?? r[d.player_id]?.overallKd ?? 1), U = k.length > 0 ? parseFloat((k.reduce((d, S) => d + S, 0) / k.length).toFixed(2)) : 1, z = x.length > 0 ? parseFloat((x.reduce((d, S) => d + S, 0) / x.length).toFixed(2)) : 1, W = o.map((d) => r[d.player_id]?.overallHsPercent || 0), ae = g.map((d) => r[d.player_id]?.overallHsPercent || 0), X = W.length > 0 ? Math.round(W.reduce((d, S) => d + S, 0) / W.length) : 0, N = ae.length > 0 ? Math.round(ae.reduce((d, S) => d + S, 0) / ae.length) : 0, D = o.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), ee = g.map((d) => r[d.player_id]?.last30Adr ?? r[d.player_id]?.overallAdr ?? 75), $ = D.length > 0 ? Math.round(D.reduce((d, S) => d + S, 0) / D.length) : 75, O = ee.length > 0 ? Math.round(ee.reduce((d, S) => d + S, 0) / ee.length) : 75, Z = o.map((d) => r[d.player_id]).filter(Boolean), se = g.map((d) => r[d.player_id]).filter(Boolean), ie = we(Z), L = we(se);
    for (const [d, S] of Object.entries(ie))
      r[d] && (r[d].fcrContributionPercent = S);
    for (const [d, S] of Object.entries(L))
      r[d] && (r[d].fcrContributionPercent = S);
    const ne = Ve(t, r), Y = De({
      f1AvgElo: M,
      f2AvgElo: l,
      f1Players: Z,
      f2Players: se,
      selectedMap: t.selected_map,
      premadeGroups: ne,
      riskAnalysis: w,
      f1Fcr: ie,
      f2Fcr: L
    }), J = {
      match: t,
      playersStats: r,
      steamData: p,
      riskAnalysis: w,
      premadeGroups: ne,
      teamSummary: {
        faction1: {
          totalElo: _,
          avgElo: M,
          winChancePercent: Y.winChanceF1,
          avgKd: U,
          avgHsPercent: X,
          avgAdr: $
        },
        faction2: {
          totalElo: v,
          avgElo: l,
          winChancePercent: Y.winChanceF2,
          avgKd: z,
          avgHsPercent: N,
          avgAdr: O
        },
        eloDifference: Math.abs(C)
      },
      prediction: Y,
      isPartial: !1
    };
    this.streamGenerations.get(e) === i && (await T.set(n, J, Q.MATCH), this.broadcastFromStream(e, i, {
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
    return { success: !0, data: await T.getStats() };
  }
  async handleClearCache() {
    return await T.clear(), { success: !0, data: { cleared: !0 } };
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
  s.name === "cache_cleanup" && (console.log("[f-insight:Background] Running scheduled cache cleanup..."), await T.cleanup());
});
