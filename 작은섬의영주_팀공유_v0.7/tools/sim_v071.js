/* ============================================================
   tools/sim_v071.js — v0.7.1 성향 4축 + 5영주(C1) 시뮬레이션
   ------------------------------------------------------------
   작은섬의영주_v0.7.1.html의 함수를 그대로 쓴다: springAdvice · sellAdvice · followAdvice(봄 · 가을 동료 추천),
   freshDims · dimsAddLog · dimsRaw(4축 원점수), lordOf(5영주 C1). → 게임과 시뮬레이션의 점수 계산이 같다
   하는 일: ① 판 수(1 · 2 · 3판)별 z점수 기준(평균 · 표준편차)을 만든다 → CFG.dimNorms에 넣을 값
            ② 그 기준으로 정확도 · 분류(C1 vs C2 · 규칙 나무) · 3축/4축/5축 비교를 낸다
   돌리는 법: 작은섬의영주_v0.7.1.html 콘솔에 붙여 넣고  SIM71.norms({N:1500})  /  SIM71.run({N:1500, games:3})
   행동 가정(BEH)은 tools/sim_compare.js와 같다. 가정 · 근사값이므로 실제 아이와는 파일럿에서 비교
   ============================================================ */
(function(){
  'use strict';
  const BEH = { tau: 1.0, cBuild: 0.5, cRest: -0.3, guard: 0.8, follow: 1.2, cardJ: 1.0,
    undo: [-2.4, 1.0, 0.4], codex: [0.0, 0.7, 0.4], patrol: [-0.2, 0.8, 0.5], seed: [0.25, 0.15] };
  const PAPER5 = { sun: [-0.54, 1.21, -0.15, 0.46, -0.41], fire: [-0.22, -0.33, -0.50, -0.95, -0.32], tree: [0.43, -0.57, -0.67, 0.64, -0.71],
                   bolt: [-0.32, -0.04, 1.05, -1.17, 0.91], wave: [0.56, -0.40, 0.67, 0.54, 0.92] };
  const IDS = Object.keys(LORDS);
  const C5 = Object.fromEntries(IDS.map(id => { const p = PAPER5[id]; return [id, [p[0], p[1], -p[2], p[3], p[4]]]; }));   // 우리 부호 [불안, 관심, 의사결정+, 저축, 지출]

  let rnd = Math.random;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const N01 = () => { let u = 0, v = 0; while(!u) u = rnd(); while(!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const gum = () => -Math.log(-Math.log(Math.max(1e-12, rnd())));
  const sig = x => 1 / (1 + Math.exp(-x));
  const pois = l => { const L = Math.exp(-l); let k = 0, p = 1; do{ k++; p *= rnd(); }while(p > L); return k - 1; };
  const clampV = (v, a, b) => Math.max(a, Math.min(b, v));
  const makePlayer = () => ({ A: N01(), I: N01(), S: N01(), R: N01(), T: N01(), G: N01(), D: N01() });

  function playGame(pl, seed, ev, randomKid){
    setRng(seeded(seed));
    let s = newState(pick(HEROES), DECK, null, pick(BIRTHS));
    const U = p => pl.R * ((p && p[0]) || 0) + pl.T * ((p && p[1]) || 0) + BEH.cardJ * pl.S * ((p && p[2]) || 0);
    const choose = (list, util) => { let best = -1e9, bi = 0; list.forEach((c, i) => { const u = (randomKid ? 0 : util(c)) + gum() * BEH.tau; if(u > best){ best = u; bi = i; } }); return list[bi]; };
    const follows = () => randomKid ? rnd() < 0.5 : rnd() < sig(BEH.follow * pl.S);
    const pUndo = () => randomKid ? 0.08 : sig(BEH.undo[0] + BEH.undo[1] * pl.A + BEH.undo[2] * pl.G);
    function withUndo(act){   // 게임의 UNDOSTAT처럼: 결과를 볼 때마다 기회 +1, 다시 고르면 사용 +1
      const snap0 = cloneState(s); const r = act(); if(r && r.noUndo) return; ev.opp++;
      for(let k = 0; k < 2 && rnd() < pUndo(); k++){ ev.undo++; s = cloneState(snap0); act(); ev.opp++; }
    }
    function springAct(){
      const f = DISASTERS[s.forecast], opts = buildOptions(s), bets = betOptions(s), SA = springAdvice(s, opts, bets);
      const c = [{ k: 'rest', p: [0, -1, 0], c: BEH.cRest }];
      opts.forEach(o => { const id = o.b.id, prot = PROTECT.includes(id), g = Object.values(DISASTERS).some(x => x.guard === id && x === f), cb = BEH.cBuild + (g ? BEH.guard : 0);
        if(o.free) c.push({ k: 'build', id, pay: 'free', p: [0, 0, 0], c: cb });
        else { if(o.canCash) c.push({ k: 'build', id, pay: 'cash', p: [prot ? -1 : 0, 1, 0], c: cb }); if(o.canCredit) c.push({ k: 'build', id, pay: 'credit', p: [prot ? -1 : 0, -1, 0], c: cb - 0.2 }); } });
      bets.forEach(o => o.stakes.forEach(st => c.push({ k: 'bet', id: o.b.id, stake: st, p: BET_PERSONA[o.b.id], c: st === 20 ? 0.3 * pl.R - 0.15 : 0 })));
      const util = x => U(x.p) + x.c;
      let pool = c;
      if(SA && follows()){ const inCat = c.filter(x => x.k === SA.cat); if(inCat.length) pool = inCat; }   // 추천을 따르면 그 대분류 안에서 고름
      let ch = choose(pool, util);
      followAdvice(s, SA ? SA.idx : null, SPRING_CATS.indexOf(ch.k), SA ? SA.k : 2);
      if(ch.k === 'rest') personaAdd(s, 'rest', [0, -1, 0]);
      else if(ch.k === 'build'){ if(!doBuild(s, ch.id, ch.pay)) personaAdd(s, 'rest', [0, -1, 0]); }
      else doBet(s, ch.id, ch.stake);
    }
    function summer(){
      for(const card of drawCards(s)){
        let pr = null;
        if(patrolOk(card)){ const go = randomKid ? rnd() < 0.5 : rnd() < sig(BEH.patrol[0] + BEH.patrol[1] * pl.D + BEH.patrol[2] * pl.I); pr = doPatrol(s, card, go ? patrolZone(rnd()) : 'skip'); }
        const view = cardView(card, pr);
        withUndo(() => {
          const ok = view.choices.map((c, i) => choiceOk(s, c) ? i : -1).filter(i => i >= 0); if(!ok.length) return { noUndo: true };
          const adv = adviceFor(s, card);
          let i; if(adv != null && ok.includes(adv) && !randomKid && rnd() < sig(BEH.follow * pl.S)) i = adv;
          else i = choose(ok, j => U(view.choices[j].persona));
          followAdvice(s, adv, i, ok.length); const ch = view.choices[i]; applyChoice(s, view, i);
          if(ch.risk && ch.risk.now) return { noUndo: true };
        });
        if(s.dead) return;
      }
    }
    function autumn(){
      doAutumn(s, true); if(s.dead) return;
      const I = splitInfo(s), r = I.need, avail = Math.max(0, I.H - r);
      const frac = randomKid ? rnd() * 0.6 : clampV(BEH.seed[0] + BEH.seed[1] * pl.T + N01() * 0.1, 0, 0.9);
      doSplit(s, r, I.seedOk ? Math.round(avail * frac) : 0, { untouched: false }); if(s.dead) return;
      doRepay(s); if(s.dead) return;
      withUndo(() => {
        const opts = sellOptions(s), mx = Math.max(1, ...opts.map(o => o.n)), SL = sellAdvice(s, opts);
        let i; if(SL != null && follows()) i = SL; else { const o = choose(opts, o => (o.n / mx) * (0.5 * pl.R - 0.3 * pl.A)); i = opts.indexOf(o); }
        followAdvice(s, SL, i, opts.length); doSell(s, opts[i].n);
      });
    }
    for(let guard = 0; guard < 40; guard++){
      if(s.lockLeft > 0) autoSeason(s);
      else if(s.season === 0){ springRoll(s); withUndo(springAct); }
      else if(s.season === 1) summer();
      else if(s.season === 2) autumn();
      else doWinter(s);
      if(s.dead) break; if(advance(s)) break;
    }
    ev.codex += randomKid ? pois(1) : pois(Math.exp(BEH.codex[0] + BEH.codex[1] * pl.I + BEH.codex[2] * pl.G));
    ev.games++; ev.dead += s.dead ? 1 : 0;
    dimsAddLog(ev.d, s.persona.log);
    s.persona.log.forEach(e => { if(String(e.src).startsWith('patrol') && e.v[2]){ ev.jp += e.v[2]; ev.jpn++; } });
  }
  const freshEv = () => ({ d: freshDims(), undo: 0, opp: 0, codex: 0, games: 0, dead: 0, jp: 0, jpn: 0 });
  function finalize(ev){ const d = ev.d; d.undo = ev.undo; d.opp = ev.opp; d.lives = ev.games; return d; }

  const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sdOf = a => { const m = meanOf(a); return Math.sqrt(meanOf(a.map(x => (x - m) ** 2))) || 1; };
  const corr = (a, b) => { const ma = meanOf(a), mb = meanOf(b); let s = 0, sa = 0, sb = 0; for(let i = 0; i < a.length; i++){ const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return s / Math.sqrt(sa * sb || 1); };
  const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000, pct = x => Math.round(x * 100);
  function nearestIdx(v, idx, cent, w){ let best = null, bd = 1e9; for(const id of IDS){ const c = cent[id]; let d = 0; idx.forEach((k, j) => { d += (w ? w[j] : 1) * (v[k] - c[k]) ** 2; }); if(d < bd){ bd = d; best = id; } } return best; }

  function simulate(N, games, seed0){
    rnd = mulberry(seed0); const P = [], A = [], B = [];
    for(let i = 0; i < N; i++){ const pl = makePlayer(); P.push(pl); const e1 = freshEv(), e2 = freshEv();
      for(let g = 0; g < games; g++) playGame(pl, seed0 + i * 101 + g, e1, false);
      for(let g = 0; g < games; g++) playGame(pl, seed0 + 7777777 + i * 101 + g, e2, false);
      A.push({ d: finalize(e1), ev: e1 }); B.push({ d: finalize(e2), ev: e2 }); }
    return { P, A, B };
  }
  /* ① z점수 기준: 판 수별 원점수 평균 · 표준편차 (신호가 없어 null인 아이는 빼고) */
  function normsFor(A){ const o = {}; DIM_KEYS.forEach(k => { const a = A.map(x => dimsRaw(x.d)[k]).filter(v => v != null); o[k] = [r3(meanOf(a)), r3(sdOf(a))]; }); return o; }
  function norms(opt = {}){ const N = opt.N || 1500, seed0 = opt.seed || 20261027, out = {};
    for(const g of [1, 2, 3]) out[g] = normsFor(simulate(N, g, seed0 + g).A);
    return out; }

  /* ② 평가 — CFG.dimNorms(게임에 넣은 값)를 그대로 쓴다 */
  function run(opt = {}){
    const N = opt.N || 1500, games = opt.games || 3, seed0 = opt.seed || 20261100;
    const BEH0 = JSON.parse(JSON.stringify(BEH)); if(opt.beh) Object.assign(BEH, opt.beh);
    try{
      const { P, A, B } = simulate(N, games, seed0);
      const RK = []; for(let i = 0; i < Math.round(N / 2); i++){ const e = freshEv(); for(let g = 0; g < games; g++) playGame(makePlayer(), seed0 + 999999 + i * 13 + g, e, true); RK.push(finalize(e)); }
      const zOf = d => { const z = dimsZ(d); return DIM_KEYS.map(k => z[k]); };
      const ZA = A.map(x => zOf(x.d)), ZB = B.map(x => zOf(x.d));
      const L4 = P.map(p => [p.A, p.S, -p.R, -p.T]), L5 = P.map(p => [p.A, p.I, p.S, -p.R, -p.T]);
      const C4 = Object.fromEntries(IDS.map(id => [id, LORDS[id].c]));
      const dims = {}; DIM_KEYS.forEach((k, i) => { dims[k] = { 숨은성향: r2(corr(ZA.map(v => v[i]), L4.map(v => v[i]))), 재검사: r2(corr(ZA.map(v => v[i]), ZB.map(v => v[i]))) }; });
      const rel = DIM_KEYS.map(k => Math.max(0.05, dims[k].재검사));
      const truth4 = L4.map(v => nearestIdx(v, [0, 1, 2, 3], C4)), truth5 = L5.map(v => nearestIdx(v, [0, 1, 2, 3, 4], C5));
      const half = Math.floor(N / 2);
      const tree = (v, a, sv, g) => v[0] > a ? (v[3] > 0 ? 'wave' : 'tree') : v[2] > sv ? 'sun' : ((v[3] - v[1]) / 2 > g ? 'bolt' : 'fire');
      let bestTh = [0, 0, 0], bestAcc = -1;
      for(const a of [-0.25, 0, 0.25, 0.5, 0.75]) for(const sv of [-0.5, -0.25, 0, 0.25, 0.5]) for(const g of [-0.5, -0.25, 0, 0.25, 0.5]){ let ok = 0; for(let i = 0; i < half; i++) if(tree(ZA[i], a, sv, g) === truth4[i]) ok++; if(ok > bestAcc){ bestAcc = ok; bestTh = [a, sv, g]; } }
      const RULES = {
        C1: (v, d) => lordOf(d).id,                                       // 게임이 쓰는 함수 그대로
        C2: v => nearestIdx(v, [0, 1, 2, 3], C4, rel),
        C4: v => tree(v, 0, 0, 0),
        C6: v => tree(v, ...bestTh),
      };
      const rules = {};
      for(const [nm, f] of Object.entries(RULES)){
        const idx = nm === 'C6' ? [...Array(N - half).keys()].map(i => i + half) : [...Array(N).keys()];
        const got = ZA.map((v, i) => f(v, A[i].d)), again = ZB.map((v, i) => f(v, B[i].d));
        const own = L4.map((v, i) => nm === 'C1' ? nearestIdx(v, [0, 1, 2, 3], C4) : f(v, null));
        const rk = RK.map(d => f(zOf(d), d));
        const share = Object.fromEntries(IDS.map(id => [id, pct(got.filter(t => t === id).length / N)]));
        const conf = {}; IDS.forEach(t => { const ix = [...Array(N).keys()].filter(i => truth4[i] === t); conf[t] = Object.fromEntries(IDS.map(g => [g, pct(ix.filter(i => got[i] === g).length / Math.max(1, ix.length))])); });
        rules[nm] = { 정답일치: pct(idx.filter(i => got[i] === truth4[i]).length / idx.length), 공정비교: pct(idx.filter(i => got[i] === own[i]).length / idx.length),
          재검사: pct(idx.filter(i => got[i] === again[i]).length / idx.length), 분포: share, 최대쏠림: Math.max(...Object.values(share)),
          무작위쏠림: pct(Math.max(...IDS.map(id => rk.filter(t => t === id).length / rk.length))), 헷갈림표: conf };
      }
      const blurry = pct(A.filter(x => lordOf(x.d).blurry).length / N), close = pct(A.filter(x => lordOf(x.d).close).length / N);
      // 3축 · 4축 · 5축 (모두 C1, 정답 = 숨은 5성향)
      const jcurZ = (() => { const raw = A.map(x => (x.d.j + x.ev.jp) / (x.d.jn + x.ev.jpn + 2)); const m = meanOf(raw), sd = sdOf(raw); return raw.map(v => (v - m) / sd); })();
      const intZ = (() => { const raw = A.map(x => Math.log1p(x.ev.codex / games)); const m = meanOf(raw), sd = sdOf(raw); return raw.map(v => (v - m) / sd); })();
      const V5 = A.map((x, i) => [ZA[i][0], intZ[i], ZA[i][1], ZA[i][2], ZA[i][3]]), V3 = A.map((x, i) => [0, 0, jcurZ[i], ZA[i][2], ZA[i][3]]);
      const models = { '3축': V3.map(v => nearestIdx(v, [2, 3, 4], C5)), '4축': V5.map(v => nearestIdx(v, [0, 2, 3, 4], C5)), '5축': V5.map(v => nearestIdx(v, [0, 1, 2, 3, 4], C5)) };
      const mcmp = Object.fromEntries(Object.entries(models).map(([k, g]) => [k, { 정답일치5: pct(g.filter((t, i) => t === truth5[i]).length / N), 최대쏠림: Math.max(...IDS.map(id => pct(g.filter(t => t === id).length / N))) }]));
      return { 설정: { N, games, 행동모형: JSON.parse(JSON.stringify(BEH)), 기준: JSON.parse(JSON.stringify(CFG.dimNorms)) },
        한판: { 판단신호: r2(meanOf(A.map(x => x.d.jn)) / games), 판단신호0: pct(A.filter(x => x.d.jn === 0).length / N), 다시고르기기회: r2(meanOf(A.map(x => x.d.opp)) / games),
          위험신호: r2(meanOf(A.map(x => x.d.rn)) / games), 시간신호: r2(meanOf(A.map(x => x.d.tn)) / games), 무너진판: pct(meanOf(A.map(x => x.ev.dead)) / games) },
        차원: dims, 신뢰도무게: rel.map(r2), 정답분포: Object.fromEntries(IDS.map(id => [id, pct(truth4.filter(t => t === id).length / N)])),
        우연: pct(IDS.reduce((s, id) => s + (truth4.filter(t => t === id).length / N) ** 2, 0)), C6문턱: bestTh, 흐릿: blurry, 비슷함: close, 분류: rules, 모형비교: mcmp };
    } finally { Object.keys(BEH0).forEach(k => BEH[k] = BEH0[k]); }
  }
  window.SIM71 = { run, norms, BEH };
})();
