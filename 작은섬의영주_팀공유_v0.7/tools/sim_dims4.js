/* ============================================================
   tools/sim_dims4.js — 4차원(불안 · 의사결정 스타일 · 예비저축 필요성 · 지출 성향) 측정 + 5유형 분류 기준 비교
   ------------------------------------------------------------
   측정 (2026-10-27 팀 결정)
     불안          = 결과를 본 뒤 "다시 고르기" 누른 비율 (봄 결정 · 손님 카드 · 곡식 팔기 뒤)
     의사결정 스타일 = 지금 판단 축과 같게 — 동료 추천 따르기 + 카드 선택지의 판단 점수 (순찰은 뺌)
                      + 쪽 = 남의 말 듣고 확인(타인참조) · − 쪽 = 내 생각대로(자기판단)
     예비저축 필요성 = −(위험 축)   지출 성향 = −(시간 축)       (관심도는 뺌)
   유형 위치는 논문 Table 8 (관심도 뺀 4개). 분류 기준 후보를 같은 가상 아이들에게 적용해 비교한다 (아래 RULES)
   옵션: {N, games, cor(성향끼리 상관, 기본 false), dec:'flip'|'same'|'zero', beh:{행동 가정 바꾸기}}
   돌리는 법: 작은섬의영주_v0.7.html을 열고 콘솔에 이 파일을 붙여 넣은 뒤  SIM4.run({N:1500, games:3})
   주의: 행동 모형(BEH)과 유형 위치(TYPES)는 가정 · 근사값이다. 실제 아이에게 맞는지는 파일럿에서 확인
   ============================================================ */
(function(){
  'use strict';
  /* 숨은 성향(평균 0, 표준편차 1): A 불안 · S 타인참조(+)/자기판단(−) · R 위험 감수 · T 미래 지향 · G 이것저것 누르는 버릇 · D 순찰 성향(측정 안 함) */
  const BEH = {
    tau: 1.0, cBuild: 0.5, cRest: -0.3, guard: 0.8,
    follow: 1.2,                  // 동료 추천 따를 확률 = σ(1.2·S)
    cardJ: 1.0,                   // 카드 선택지의 판단 점수에 S가 얼마나 끌리나
    undo: [-2.4, 1.0, 0.4],       // 다시 고를 확률 = σ(b0 + 1.0·A + 0.4·G)
    patrol: [-0.2, 0.8],          // 순찰은 하지만 점수에 안 씀
    seed: [0.25, 0.15],
  };
  /* 5유형 위치 — Phan, Rieger & Wang (2019) Table 8 (최종 군집 중심, z점수, 스위스·베트남 n=3,919)
     논문 순서 [불안, 관심도, 직관적 결정(+직관), 예비저축 필요성, 자유로운 지출] → 관심도는 빼고 네 개만 쓴다 */
  const PAPER = {
    '합리적(햇빛)':       [-0.54,  1.21, -0.15,  0.46, -0.41],
    '근시안적(불꽃)':     [-0.22, -0.33, -0.50, -0.95, -0.32],
    '불안한 저축자(나무)': [ 0.43, -0.57, -0.67,  0.64, -0.71],
    '직감 추종자(번개)':   [-0.32, -0.04,  1.05, -1.17,  0.91],
    '불안한 소비자(파도)': [ 0.56, -0.40,  0.67,  0.54,  0.92],
  };
  /* 우리 의사결정 축은 +타인참조 / −자기판단. 논문 '직관적 결정'과 방향을 어떻게 맞출지 — run({dec}) 로 고른다
       'flip' (기본) 자기판단 = 직관 → 논문 값의 부호를 뒤집어 씀
       'same'        타인참조 = 직관 → 논문 값을 그대로 씀
       'zero'        의사결정 축을 분류에 쓰지 않음(무게 0) */
  let TYPES = {}, WD = 1;
  function setDec(mode){ TYPES = {}; for(const [nm, p] of Object.entries(PAPER)) TYPES[nm] = [p[0], mode === 'same' ? p[2] : -p[2], p[3], p[4]]; WD = mode === 'zero' ? 0 : 1; }
  setDec('flip');
  const NAMES = Object.keys(PAPER), DIMS = ['불안', '의사결정', '예비저축', '지출'];

  let rnd = Math.random;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const N01 = () => { let u = 0, v = 0; while(!u) u = rnd(); while(!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const gum = () => -Math.log(-Math.log(Math.max(1e-12, rnd())));
  const sig = x => 1 / (1 + Math.exp(-x));
  const clampV = (v, a, b) => Math.max(a, Math.min(b, v));
  function makePlayer(cor){
    const R = N01(), T = N01(), S = N01(), G = N01(), D = N01();
    const A = cor ? 0.3 * (-R) + Math.sqrt(0.91) * N01() : N01();      // 불안한 아이가 조금 더 모아 둠
    return { R, T, S, G, D, A };
  }

  /* ── 한 판 (게임 화면 흐름을 엔진 함수로 그대로) ── */
  function playGame(pl, seed, ev, randomKid){
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
        if(patrolOk(card)){ const go = randomKid ? rnd() < 0.5 : rnd() < sig(BEH.patrol[0] + BEH.patrol[1] * pl.D); pr = doPatrol(s, card, go ? patrolZone(rnd()) : 'skip'); }
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
    ev.games++; ev.dead += s.dead ? 1 : 0;
    s.persona.log.forEach(e => ev.log.push(e));
  }
  const freshEv = () => ({ opps: 0, undos: 0, games: 0, dead: 0, log: [] });
  function measure(ev){
    const B = CFG.personaBias || {}, sum = { r: 0, t: 0, j: 0 }, n = { r: 0, t: 0, j: 0 };
    ev.log.forEach(({ src, v }) => { if(v[0]){ sum.r += v[0]; n.r++; } if(v[1]){ sum.t += v[1]; n.t++; }
      if(v[2] && !String(src).startsWith('patrol')){ sum.j += v[2]; n.j++; } });   // 판단: 추천 따르기 + 카드 (순찰 제외)
    const mean = (k, b) => n[k] ? sum[k] / n[k] - (b || 0) : 0;
    return { anx: (ev.undos + 0.4) / (ev.opps + 4), dec: mean('j', B.j), save: -mean('r', B.r), spend: -mean('t', B.t),
      n: { r: n.r, t: n.t, j: n.j, opps: ev.opps }, games: ev.games, dead: ev.dead };
  }

  /* ── 통계 ── */
  const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sdOf = a => { const m = meanOf(a); return Math.sqrt(meanOf(a.map(x => (x - m) ** 2))) || 1; };
  const corr = (a, b) => { const ma = meanOf(a), mb = meanOf(b); let s = 0, sa = 0, sb = 0; for(let i = 0; i < a.length; i++){ const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return s / Math.sqrt(sa * sb || 1); };
  const r2 = x => Math.round(x * 100) / 100, pct = x => Math.round(x * 100) + '%';
  const KEYS = ['anx', 'dec', 'save', 'spend'];
  const latentVec = p => [p.A, p.S, -p.R, -p.T];
  function nearestW(v, w){ let best = null, bd = 1e9, second = 1e9; for(const nm of NAMES){ const c = TYPES[nm]; let d = 0; for(let k = 0; k < 4; k++) d += (k === 1 ? WD : 1) * w[k] * (v[k] - c[k]) ** 2; if(d < bd){ second = bd; bd = d; best = nm; } else if(d < second) second = d; } return { t: best, margin: second - bd }; }

  /* ── Table 8 구조로 만든 규칙 나무 ──
     ① 불안이 높으면 → 불안한 두 유형 (지출로 가름: 소비자 +0.92 / 저축자 −0.71)
     ② 불안이 낮고 예비저축이 높으면 → 합리적 (+0.46)
     ③ 불안 · 예비저축 둘 다 낮으면 → 직감 추종자 / 근시안적 — "직감 점수" = 지출과 직관 쪽 의사결정의 평균으로 가름
        (직감 추종자 지출 +0.91·직관 +1.05 / 근시안적 지출 −0.32·직관 −0.50). 의사결정 무게 0이면 지출만 */
  const gutScore = v => { const intuit = WD ? (TYPES['직감 추종자(번개)'][1] < 0 ? -v[1] : v[1]) : 0; return WD ? (v[3] + intuit) / 2 : v[3]; };
  const tree = (v, a, s, g) => v[0] > a ? (v[3] > 0 ? '불안한 소비자(파도)' : '불안한 저축자(나무)')
                              : v[2] > s ? '합리적(햇빛)' : (gutScore(v) > g ? '직감 추종자(번개)' : '근시안적(불꽃)');

  /* ── 분류 기준 후보 ──  v = [불안, 의사결정, 예비저축, 지출] (모집단 기준 z점수), rel = 차원별 신뢰도(재검사 상관) */
  const RULES = {
    'C1 가장 가까운 유형(같은 무게)':           (v, ctx) => nearestW(v, [1, 1, 1, 1]).t,
    'C2 가장 가까운 유형(믿을 만한 차원에 무게)':  (v, ctx) => nearestW(v, ctx.rel).t,
    'C4 규칙 나무(Table 8 구조 · 문턱 0)':       (v) => tree(v, 0, 0, 0),
    'C6 규칙 나무(Table 8 구조 · 문턱 맞춤)':     (v, ctx) => tree(v, ...ctx.th),
    /* 판단 신호가 적은 아이는 의사결정 점수를 덜 믿는다 — 신호 k개면 믿음 = k/(k+3) */
    'C8 C2 + 판단 신호 수만큼만 믿기':          (v, ctx, m) => { const q = m.n.j / (m.n.j + 3); const w = ctx.rel.slice(); w[1] *= q; const vv = v.slice(); vv[1] *= q; return nearestW(vv, w).t; },
  };

  function run(opt = {}){
    const N = opt.N || 1500, games = opt.games || 1, cor = !!opt.cor, seed0 = opt.seed || 20261027, dec = opt.dec || 'flip';
    setDec(dec);   // 논문은 다섯 요인이 서로 독립 → 기본은 성향끼리 독립(cor:false)
    const BEH0 = JSON.parse(JSON.stringify(BEH)); if(opt.beh) Object.assign(BEH, opt.beh);
    try{
      rnd = mulberry(seed0);
      const players = [], A = [], B = [];
      for(let i = 0; i < N; i++){
        const pl = makePlayer(cor); players.push(pl);
        const e1 = freshEv(), e2 = freshEv();
        for(let g = 0; g < games; g++) playGame(pl, seed0 + i * 101 + g, e1, false);
        for(let g = 0; g < games; g++) playGame(pl, seed0 + 7777777 + i * 101 + g, e2, false);
        A.push(measure(e1)); B.push(measure(e2));
      }
      const norm = {}; KEYS.forEach(k => { const a = A.map(m => m[k]); norm[k] = { m: meanOf(a), s: sdOf(a) }; });
      const zv = m => KEYS.map(k => (m[k] - norm[k].m) / norm[k].s);
      const ZA = A.map(zv), ZB = B.map(zv), L = players.map(latentVec);
      const rel = KEYS.map((k, i) => Math.max(0.05, corr(ZA.map(v => v[i]), ZB.map(v => v[i]))));
      const recov = {}; DIMS.forEach((d, i) => { recov[d] = { '숨은 성향과': r2(corr(ZA.map(v => v[i]), L.map(v => v[i]))), '다시 해도(재검사)': r2(rel[i]) }; });
      const cross = {}; DIMS.forEach((d, i) => { cross[d] = {}; DIMS.forEach((e, j) => cross[d][e] = r2(corr(ZA.map(v => v[i]), L.map(v => v[j])))); });
      const truth = L.map(v => nearestW(v, [1, 1, 1, 1]).t);
      const chance = NAMES.reduce((s, nm) => s + (truth.filter(t => t === nm).length / N) ** 2, 0);
      // C6 문턱 맞추기: 앞쪽 절반으로 고르고 뒤쪽 절반으로 평가
      const half = Math.floor(N / 2); let bestTh = [0, 0, 0], bestAcc = -1;
      for(const a of [-0.25, 0, 0.25, 0.5, 0.75]) for(const sv of [-0.5, -0.25, 0, 0.25, 0.5]) for(const g of [-0.5, -0.25, 0, 0.25, 0.5]){
        let ok = 0; for(let i = 0; i < half; i++) if(tree(ZA[i], a, sv, g) === truth[i]) ok++;
        if(ok > bestAcc){ bestAcc = ok; bestTh = [a, sv, g]; } }
      const ctx = { rel, th: bestTh };
      const RK = []; for(let i = 0; i < Math.round(N / 2); i++){ const e = freshEv(); for(let g = 0; g < games; g++) playGame(makePlayer(cor), seed0 + 999999 + i * 13 + g, e, true); const mm = measure(e); RK.push({ v: zv(mm), m: mm }); }
      const rules = {};
      for(const [name, f] of Object.entries(RULES)){
        const evalIdx = name.startsWith('C6') ? [...Array(N - half).keys()].map(i => i + half) : [...Array(N).keys()];
        const FULL = { n: { j: 1e9 } };
        const got = ZA.map((v, i) => f(v, ctx, A[i])), again = ZB.map((v, i) => f(v, ctx, B[i])), own = L.map(v => f(v, { ...ctx, rel: [1, 1, 1, 1] }, FULL));
        const assigned = evalIdx.filter(i => got[i] !== '아직 모름');
        const share = {}; [...NAMES, '아직 모름'].forEach(nm => { const c = got.filter(t => t === nm).length; if(c) share[nm] = pct(c / N); });
        const maxShare = Math.max(...NAMES.map(nm => got.filter(t => t === nm).length / N));
        const rkShare = Math.max(...NAMES.map(nm => RK.filter(o => f(o.v, ctx, o.m) === nm).length / RK.length));
        rules[name] = {
          '정답 유형과 일치': pct(assigned.filter(i => got[i] === truth[i]).length / Math.max(1, assigned.length)),
          '숨은 성향에 같은 기준을 썼을 때와 일치': pct(evalIdx.filter(i => got[i] === own[i]).length / evalIdx.length),
          '다시 해도 같은 유형': pct(evalIdx.filter(i => got[i] === again[i]).length / evalIdx.length),
          '가장 많은 유형 비율': pct(maxShare), '무작위로 누르는 아이 — 가장 많은 유형': pct(rkShare), 분포: share,
          '헷갈림표(행=정답, 열=분류, %는 그 정답 아이 중)': Object.fromEntries(NAMES.map(t => { const idx = evalIdx.filter(i => truth[i] === t);
            return [t, Object.fromEntries(NAMES.map(g => [g, pct(idx.filter(i => got[i] === g).length / Math.max(1, idx.length))]))]; })) };
      }
      return { 설정: { N, 판수: games, 성향끼리_상관: cor, 의사결정_방향: dec, 행동모형: JSON.parse(JSON.stringify(BEH)) },
        한판_신호: { '위험': r2(meanOf(A.map(m => m.n.r)) / games), '시간': r2(meanOf(A.map(m => m.n.t)) / games), '판단(순찰 제외)': r2(meanOf(A.map(m => m.n.j)) / games),
          '다시 고르기 기회': r2(meanOf(A.map(m => m.n.opps)) / games), '판단 신호 0개인 아이': pct(A.filter(m => m.n.j === 0).length / N), '섬이 무너진 판': pct(meanOf(A.map(m => m.dead)) / games) },
        '차원별 측정 정확도': recov, '측정(행)↔숨은 성향(열)': cross, '정답 유형 분포': Object.fromEntries(NAMES.map(nm => [nm, pct(truth.filter(t => t === nm).length / N)])),
        '우연히 맞을 확률': pct(chance), 'C6이 고른 문턱 [불안, 예비저축, 직감점수]': bestTh, '분류 기준': rules };
    } finally { Object.keys(BEH0).forEach(k => BEH[k] = BEH0[k]); setDec('flip'); }
  }
  window.SIM4 = { run, BEH, PAPER, RULES, types: () => TYPES };
})();
