/* ============================================================
   tools/sim_compare.js — 3축 · 4축 · 5축 스코어링 비교 + 의사결정 신호 수 실험 (같은 조건 · 같은 유형 위치)
   ------------------------------------------------------------
   유형 위치: Phan, Rieger & Wang (2019) Table 8 (5차원 군집 중심 z점수). 정답 = 숨은 5성향에 가장 가까운 유형
   모형 (분류는 모두 C2 = 차원별 신뢰도 무게를 준 "가장 가까운 유형")
     3축  의사결정(지금 판단 축: 추천 따르기 + 카드 + 순찰) · 예비저축(−위험) · 지출(−시간)
     4축  불안(다시 고르기) · 의사결정(추천 따르기 + 카드, 순찰 제외) · 예비저축 · 지출      ← 팀 채택
     5축  4축 + 관심도(🎒 도감·개념 열어 보기)
   의사결정 방향: 우리 축 +타인참조 / −자기판단, "자기판단 = 직관"으로 보고 논문 '직관적 결정' 부호를 뒤집음
   신호 수 실험: run({extraJ:k}) — 한 판에 "누구 말을 따를까" 판단 장면을 k번 더 넣는다(동료 추천 카드를 늘린 것과 같음)
   돌리는 법: 작은섬의영주_v0.7.html 콘솔에 붙여 넣고  SIM.run({N:1500, games:3})
   ============================================================ */
(function(){
  'use strict';
  const BEH = { tau: 1.0, cBuild: 0.5, cRest: -0.3, guard: 0.8, follow: 1.2, cardJ: 1.0,
    undo: [-2.4, 1.0, 0.4], codex: [0.0, 0.7, 0.4], patrol: [-0.2, 0.8, 0.5], seed: [0.25, 0.15] };
  const PAPER = {   // [불안, 관심도, 직관적 결정, 예비저축 필요성, 자유로운 지출]
    '합리적(햇빛)':       [-0.54,  1.21, -0.15,  0.46, -0.41],
    '근시안적(불꽃)':     [-0.22, -0.33, -0.50, -0.95, -0.32],
    '불안한 저축자(나무)': [ 0.43, -0.57, -0.67,  0.64, -0.71],
    '직감 추종자(번개)':   [-0.32, -0.04,  1.05, -1.17,  0.91],
    '불안한 소비자(파도)': [ 0.56, -0.40,  0.67,  0.54,  0.92],
  };
  const NAMES = Object.keys(PAPER);
  const CENT = Object.fromEntries(NAMES.map(n => { const p = PAPER[n]; return [n, [p[0], p[1], -p[2], p[3], p[4]]]; }));   // 우리 부호
  const MODELS = { '3축': { idx: [2, 3, 4], dec: 'jcur' }, '4축': { idx: [0, 2, 3, 4], dec: 'dec' }, '5축': { idx: [0, 1, 2, 3, 4], dec: 'dec' } };

  let rnd = Math.random;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const N01 = () => { let u = 0, v = 0; while(!u) u = rnd(); while(!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const gum = () => -Math.log(-Math.log(Math.max(1e-12, rnd())));
  const sig = x => 1 / (1 + Math.exp(-x));
  const pois = l => { const L = Math.exp(-l); let k = 0, p = 1; do{ k++; p *= rnd(); }while(p > L); return k - 1; };
  const clampV = (v, a, b) => Math.max(a, Math.min(b, v));
  const makePlayer = () => ({ A: N01(), I: N01(), S: N01(), R: N01(), T: N01(), G: N01(), D: N01() });   // 논문처럼 서로 독립

  function playGame(pl, seed, ev, randomKid, extraJ){
    setRng(seeded(seed));
    let s = newState(pick(HEROES), DECK, null, pick(BIRTHS));
    const U = p => pl.R * ((p && p[0]) || 0) + pl.T * ((p && p[1]) || 0) + BEH.cardJ * pl.S * ((p && p[2]) || 0);
    const choose = (list, util) => { let best = -1e9, bi = 0; list.forEach((c, i) => { const u = (randomKid ? 0 : util(c)) + gum() * BEH.tau; if(u > best){ best = u; bi = i; } }); return list[bi]; };
    const pUndo = () => randomKid ? 0.08 : sig(BEH.undo[0] + BEH.undo[1] * pl.A + BEH.undo[2] * pl.G);
    function withUndo(act){
      const snap0 = cloneState(s); const r = act(); if(r && r.noUndo) return; ev.opps++;
      for(let k = 0; k < 2 && rnd() < pUndo(); k++){ ev.undos++; s = cloneState(snap0); act(); ev.opps++; }
    }
    function springAct(){
      const f = DISASTERS[s.forecast], opts = buildOptions(s), bets = betOptions(s), c = [{ k: 'rest', p: [0, -1, 0], c: BEH.cRest }];
      opts.forEach(o => { const id = o.b.id, prot = PROTECT.includes(id), g = Object.values(DISASTERS).some(x => x.guard === id && x === f), cb = BEH.cBuild + (g ? BEH.guard : 0);
        if(o.free) c.push({ k: 'build', id, pay: 'free', p: [0, 0, 0], c: cb });
        else { if(o.canCash) c.push({ k: 'build', id, pay: 'cash', p: [prot ? -1 : 0, 1, 0], c: cb }); if(o.canCredit) c.push({ k: 'build', id, pay: 'credit', p: [prot ? -1 : 0, -1, 0], c: cb - 0.2 }); } });
      bets.forEach(o => o.stakes.forEach(st => c.push({ k: 'bet', id: o.b.id, stake: st, p: BET_PERSONA[o.b.id], c: st === 20 ? 0.3 * pl.R - 0.15 : 0 })));
      const ch = choose(c, x => U(x.p) + x.c);
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
      for(let k = 0; k < extraJ; k++){   // 추가 판단 장면 (두 갈래: 추천을 따른다 / 내 생각대로)
        const follow = randomKid ? rnd() < 0.5 : rnd() < sig(BEH.follow * pl.S);
        personaAdd(s, 'advice', [0, 0, follow ? 1 : -1]);
      }
    }
    function autumn(){
      doAutumn(s, true); if(s.dead) return;
      const I = splitInfo(s), r = I.need, avail = Math.max(0, I.H - r);
      const frac = randomKid ? rnd() * 0.6 : clampV(BEH.seed[0] + BEH.seed[1] * pl.T + N01() * 0.1, 0, 0.9);
      doSplit(s, r, I.seedOk ? Math.round(avail * frac) : 0, { untouched: false }); if(s.dead) return;
      doRepay(s); if(s.dead) return;
      withUndo(() => { const opts = sellOptions(s), mx = Math.max(1, ...opts.map(o => o.n)); const o = choose(opts, o => (o.n / mx) * (0.5 * pl.R - 0.3 * pl.A)); doSell(s, o.n); });
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
    s.persona.log.forEach(e => ev.log.push(e));
  }
  const freshEv = () => ({ opps: 0, undos: 0, codex: 0, games: 0, dead: 0, log: [] });
  function measure(ev){
    const B = CFG.personaBias || {}, sum = { r: 0, t: 0, j: 0, jp: 0 }, n = { r: 0, t: 0, j: 0, jp: 0 };
    ev.log.forEach(({ src, v }) => { if(v[0]){ sum.r += v[0]; n.r++; } if(v[1]){ sum.t += v[1]; n.t++; }
      if(v[2]){ if(String(src).startsWith('patrol')){ sum.jp += v[2]; n.jp++; } else { sum.j += v[2]; n.j++; } } });
    const mean = (k, b) => n[k] ? sum[k] / n[k] - (b || 0) : 0;
    return { anx: (ev.undos + 0.4) / (ev.opps + 4), int: Math.log1p(ev.codex / Math.max(1, ev.games)),
      jcur: (n.j + n.jp) ? (sum.j + sum.jp) / (n.j + n.jp) : 0, dec: mean('j', B.j),
      save: -mean('r', B.r), spend: -mean('t', B.t), nj: n.j, njp: n.jp, nr: n.r, nt: n.t, opps: ev.opps, dead: ev.dead, games: ev.games };
  }
  const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sdOf = a => { const m = meanOf(a); return Math.sqrt(meanOf(a.map(x => (x - m) ** 2))) || 1; };
  const corr = (a, b) => { const ma = meanOf(a), mb = meanOf(b); let s = 0, sa = 0, sb = 0; for(let i = 0; i < a.length; i++){ const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return s / Math.sqrt(sa * sb || 1); };
  const r2 = x => Math.round(x * 100) / 100, pct = x => Math.round(x * 100);
  function nearest(v, idx, w){ let best = null, bd = 1e9; for(const nm of NAMES){ const c = CENT[nm]; let d = 0; idx.forEach((k, j) => { d += (w ? w[j] : 1) * (v[k] - c[k]) ** 2; }); if(d < bd){ bd = d; best = nm; } } return best; }
  const lat = p => [p.A, p.I, p.S, -p.R, -p.T];

  function run(opt = {}){
    const N = opt.N || 1500, games = opt.games || 1, seed0 = opt.seed || 20261027, extraJ = opt.extraJ || 0;
    const BEH0 = JSON.parse(JSON.stringify(BEH)); if(opt.beh) Object.assign(BEH, opt.beh);
    try{
      rnd = mulberry(seed0);
      const P = [], A = [], B = [];
      for(let i = 0; i < N; i++){ const pl = makePlayer(); P.push(pl); const e1 = freshEv(), e2 = freshEv();
        for(let g = 0; g < games; g++) playGame(pl, seed0 + i * 101 + g, e1, false, extraJ);
        for(let g = 0; g < games; g++) playGame(pl, seed0 + 7777777 + i * 101 + g, e2, false, extraJ);
        A.push(measure(e1)); B.push(measure(e2)); }
      const RK = []; for(let i = 0; i < Math.round(N / 2); i++){ const e = freshEv(); for(let g = 0; g < games; g++) playGame(makePlayer(), seed0 + 999999 + i * 13 + g, e, true, extraJ); RK.push(measure(e)); }
      const K = ['anx', 'int', 'jcur', 'dec', 'save', 'spend'], norm = {};
      K.forEach(k => { const a = A.map(m => m[k]); norm[k] = { m: meanOf(a), s: sdOf(a) }; });
      const z = (m, k) => (m[k] - norm[k].m) / norm[k].s;
      const LAT = P.map(lat);
      const latOf = { anx: 0, int: 1, jcur: 2, dec: 2, save: 3, spend: 4 };
      const dims = {}; K.forEach(k => { dims[k] = { 숨은성향: r2(corr(A.map(m => z(m, k)), LAT.map(v => v[latOf[k]]))), 재검사: r2(corr(A.map(m => m[k]), B.map(m => m[k]))) }; });
      const truth = LAT.map(v => nearest(v, [0, 1, 2, 3, 4]));
      const chance = NAMES.reduce((s, nm) => s + (truth.filter(t => t === nm).length / N) ** 2, 0);
      const models = {};
      for(const [name, M] of Object.entries(MODELS)){
        const vec = m => [z(m, 'anx'), z(m, 'int'), z(m, M.dec), z(m, 'save'), z(m, 'spend')];
        const keyOf = k => ['anx', 'int', M.dec, 'save', 'spend'][k];
        const w = M.idx.map(k => Math.max(0.05, dims[keyOf(k)].재검사));
        const got = A.map(m => nearest(vec(m), M.idx, w)), again = B.map(m => nearest(vec(m), M.idx, w));
        const ownTruth = LAT.map(v => nearest(v, M.idx));
        const rk = RK.map(m => nearest(vec(m), M.idx, w));
        const conf = {}; NAMES.forEach(t => { const ix = [...Array(N).keys()].filter(i => truth[i] === t); conf[t] = Object.fromEntries(NAMES.map(g => [g, pct(ix.filter(i => got[i] === g).length / Math.max(1, ix.length))])); });
        models[name] = { 무게: w.map(r2),
          정답일치: pct(got.filter((t, i) => t === truth[i]).length / N),
          같은차원정답일치: pct(got.filter((t, i) => t === ownTruth[i]).length / N),
          재검사같은유형: pct(got.filter((t, i) => t === again[i]).length / N),
          분포: Object.fromEntries(NAMES.map(nm => [nm, pct(got.filter(t => t === nm).length / N)])),
          최대쏠림: pct(Math.max(...NAMES.map(nm => got.filter(t => t === nm).length / N))),
          무작위쏠림: pct(Math.max(...NAMES.map(nm => rk.filter(t => t === nm).length / rk.length))),
          헷갈림표: conf };
      }
      return { 설정: { N, games, extraJ, 행동모형: JSON.parse(JSON.stringify(BEH)) },
        한판: { 판단신호_순찰제외: r2(meanOf(A.map(m => m.nj)) / games), 순찰신호: r2(meanOf(A.map(m => m.njp)) / games), 위험신호: r2(meanOf(A.map(m => m.nr)) / games),
          시간신호: r2(meanOf(A.map(m => m.nt)) / games), 다시고르기기회: r2(meanOf(A.map(m => m.opps)) / games), 판단신호0: pct(A.filter(m => m.nj === 0).length / N), 무너진판: pct(meanOf(A.map(m => m.dead)) / games) },
        차원: dims, 정답분포: Object.fromEntries(NAMES.map(nm => [nm, pct(truth.filter(t => t === nm).length / N)])), 우연: pct(chance), 모형: models };
    } finally { Object.keys(BEH0).forEach(k => BEH[k] = BEH0[k]); }
  }
  window.SIM = { run, BEH, PAPER };
})();
