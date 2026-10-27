/* ============================================================
   tools/sim_dims5.js — 3축 → 5차원(불안 · 관심도 포함) 측정 시뮬레이션
   ------------------------------------------------------------
   무엇을 보나: "성향이 이미 정해진 가상의 아이"가 실제 게임 엔진·카드로 게임을 하면,
               게임이 매긴 점수가 그 아이의 원래 성향을 얼마나 되찾는가(회복) · 다른 차원과 섞이지 않는가(구별) ·
               다시 해도 비슷한가(재검사) · 논문 5유형을 얼마나 맞히는가(유형 일치).
   돌리는 법: 작은섬의영주_v0.7.html을 연 뒤 개발자 도구 콘솔에 이 파일 내용을 붙여 넣고
               await SIM5.run({N:1500})  → 결과 표(JSON). 같은 seed면 같은 결과.
   주의: 행동 모형(아래 BEH)은 "이런 아이는 이렇게 행동할 것"이라는 가정이다.
         시뮬레이션은 측정 장치가 가정대로라면 제대로 돌아가는지만 보여 준다. 실제 아이에게 맞는지는 파일럿에서 확인.
   ============================================================ */
(function(){
  'use strict';
  /* ── 숨은 성향(모두 평균 0, 표준편차 1) ──
     R 위험 감수(+도전)  → 예비저축 필요성 = −R      T 미래 지향(+미래) → 지출 성향 = −T
     D 분석적 판단(+따져봄) = 의사결정 스타일          S 남의 말 따르기(논문 5차원 밖 — 지금 판단 축이 재는 것)
     A 불안                I 관심도                  G 화면 이것저것 누르는 버릇(방해 요인 — 불안·관심도 둘 다에 섞임) */
  const BEH = {
    tau: 1.0,                    // 선택 잡음(굼벨) — 1이면 성향 1 차이 ≈ 선택 확률 73:27
    cBuild: 0.5, cRest: -0.3, guard: 0.8,     // 봄: 짓기 선호 · 쉬기 비선호 · 예보 재난을 막는 건물 가산
    follow: 1.2,                 // 동료 추천 따를 확률 = σ(1.2·S)
    patrol: [-0.2, 0.8, 0.5],    // 순찰 확률 = σ(b0 + 0.8·D + 0.5·I)  (따져 보는 아이 · 궁금한 아이가 더 돈다)
    undo: [-2.4, 1.0, 0.4],      // 결과를 본 뒤 다시 고를 확률 = σ(b0 + 1.0·A + 0.4·G)  → 보통 아이 약 8%
    codex: [0.0, 0.7, 0.4],      // 한 판에 🎒 도감·개념 열어 보는 횟수 ~ 포아송(exp(b0 + 0.7·I + 0.4·G)) → 보통 약 1회
    seed: [0.25, 0.15],          // 가을 씨앗 비율 = 0.25 + 0.15·T (+잡음)
  };
  /* 논문 5유형의 대략적 위치 [불안, 관심도, 분석적, 예비저축, 지출] — Phan·Rieger·Wang(2019) 서술을 바탕으로 한 근사값 */
  const TYPES = {
    '합리적(햇빛)':       [-0.6,  0.8,  0.8,  0.4, -0.3],
    '근시안적(불꽃)':     [-0.3, -0.7, -0.3, -0.8,  0.9],
    '불안한 저축자(나무)': [ 1.0,  0.1,  0.3,  0.9, -0.8],
    '직감 추종자(번개)':   [-0.2,  0.2, -1.0, -0.1,  0.3],
    '불안한 소비자(파도)': [ 0.9, -0.3, -0.4, -0.5,  0.8],
  };
  const DIMS = ['불안', '관심도', '의사결정', '예비저축', '지출'];

  let rnd = Math.random;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const N01 = () => { let u = 0, v = 0; while(!u) u = rnd(); while(!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const gum = () => -Math.log(-Math.log(Math.max(1e-12, rnd())));
  const sig = x => 1 / (1 + Math.exp(-x));
  const pois = l => { const L = Math.exp(-l); let k = 0, p = 1; do{ k++; p *= rnd(); }while(p > L); return k - 1; };
  const clampV = (v, a, b) => Math.max(a, Math.min(b, v));

  function makePlayer(cor){
    const R = N01(), T = N01(), D = N01(), S = N01(), G = N01();
    const A = cor ? 0.3 * (-R) + Math.sqrt(0.91) * N01() : N01();      // 현실 가정: 불안한 아이가 조금 더 모아 두려 함
    const I = cor ? 0.3 * D + Math.sqrt(0.91) * N01() : N01();         //            궁금한 아이가 조금 더 따져 봄
    return { R, T, D, S, A, I, G };
  }

  /* ── 한 판 — 게임 화면 흐름(next · spring · summer · autumn · winter)을 엔진 함수로 그대로 따라간다 ── */
  function playGame(pl, seed, ev, randomKid){
    setRng(seeded(seed));
    const hero = pick(HEROES), birth = pick(BIRTHS);
    let s = newState(hero, DECK, null, birth);
    const U = p => pl.R * ((p && p[0]) || 0) + pl.T * ((p && p[1]) || 0);
    const choose = (list, util) => { let best = -1e9, bi = 0; list.forEach((c, i) => { const u = (randomKid ? 0 : util(c)) + gum() * BEH.tau; if(u > best){ best = u; bi = i; } }); return list[bi]; };
    const pUndo = () => randomKid ? 0.08 : sig(BEH.undo[0] + BEH.undo[1] * pl.A + BEH.undo[2] * pl.G);
    function withUndo(act){                       // 결과를 본 뒤 "다시 고르기" (게임처럼 같은 상황으로 되돌려 다시 고름, 최대 2번)
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
        if(patrolOk(card)){ ev.patAsk++; const go = randomKid ? rnd() < 0.5 : rnd() < sig(BEH.patrol[0] + BEH.patrol[1] * pl.D + BEH.patrol[2] * pl.I);
          if(go) ev.pat++; pr = doPatrol(s, card, go ? patrolZone(rnd()) : 'skip'); }
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
    ev.codex += randomKid ? pois(1) : pois(Math.exp(BEH.codex[0] + BEH.codex[1] * pl.I + BEH.codex[2] * pl.G));
    ev.games++; ev.dead += s.dead ? 1 : 0; ev.score += score(s);
    s.persona.log.forEach(e => ev.log.push(e));
    return s;
  }

  /* ── 게임 기록 → 점수 ── */
  function measure(ev){
    const B = CFG.personaBias || {}, sum = { r: 0, t: 0, ja: 0, jp: 0 }, n = { r: 0, t: 0, ja: 0, jp: 0 };
    ev.log.forEach(({ src, v }) => { if(v[0]){ sum.r += v[0]; n.r++; } if(v[1]){ sum.t += v[1]; n.t++; }
      if(v[2]){ if(src === 'advice'){ sum.ja += v[2]; n.ja++; } else if(String(src).startsWith('patrol')){ sum.jp += v[2]; n.jp++; } else { sum.ja += v[2]; n.ja++; } } });
    const mean = (k, b) => n[k] ? sum[k] / n[k] - (b || 0) : 0;
    return {
      save: -mean('r', B.r), spend: -mean('t', B.t),
      jcur: -((sum.ja + sum.jp) / Math.max(1, n.ja + n.jp)),     // 지금 판단 축(추천 따르기 + 순찰) — 부호: +면 "내 생각대로 · 순찰"
      adv: n.ja ? sum.ja / n.ja : 0,                              // 추천 따르기만
      pat: ev.patAsk ? (ev.pat + 0.5) / (ev.patAsk + 1) : 0.5,     // 순찰 비율만 (분석적으로 미리 알아봄)
      anx: (ev.undos + 0.4) / (ev.opps + 4),                      // 다시 고르기 비율 (적은 기회는 평균 쪽으로 당김)
      int: Math.log1p(ev.codex / Math.max(1, ev.games)),          // 판당 도감·개념 열어 보기 (로그)
      nSignals: n.r + n.t + n.ja + n.jp, opps: ev.opps, games: ev.games,
    };
  }
  const freshEv = () => ({ opps: 0, undos: 0, pat: 0, patAsk: 0, codex: 0, games: 0, dead: 0, score: 0, log: [] });

  /* ── 통계 도구 ── */
  const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sdOf = a => { const m = meanOf(a); return Math.sqrt(meanOf(a.map(x => (x - m) ** 2))) || 1; };
  const corr = (a, b) => { const ma = meanOf(a), mb = meanOf(b); let s = 0, sa = 0, sb = 0; for(let i = 0; i < a.length; i++){ const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return s / Math.sqrt(sa * sb || 1); };
  const r2 = x => Math.round(x * 100) / 100;
  const nearest = (vec, idx) => { let best = null, bd = 1e9; for(const [name, c] of Object.entries(TYPES)){ let d = 0; idx.forEach(k => { d += (vec[k] - c[k]) ** 2; }); if(d < bd){ bd = d; best = name; } } return best; };
  const latentVec = p => [p.A, p.I, p.D, -p.R, -p.T];

  /* 측정 모형 — [불안, 관심도, 의사결정, 예비저축, 지출] 에 어떤 점수를 쓸지 (null = 그 차원 없음) */
  const MODELS = {
    'M3  지금 3축(판단=추천+순찰)':          { dims: [null, null, 'jcur', 'save', 'spend'] },
    'M3p 3축, 판단=순찰만':                   { dims: [null, null, 'pat', 'save', 'spend'] },
    'M4A 3축(순찰) + 불안':                   { dims: ['anx', null, 'pat', 'save', 'spend'] },
    'M4I 3축(순찰) + 관심도':                 { dims: [null, 'int', 'pat', 'save', 'spend'] },
    'M5  5차원(불안 + 관심도)':               { dims: ['anx', 'int', 'pat', 'save', 'spend'] },
    'M5j 5차원, 판단=지금 축(추천+순찰)':      { dims: ['anx', 'int', 'jcur', 'save', 'spend'] },
  };

  function run(opt = {}){
    const N = opt.N || 1500, games = opt.games || 1, cor = opt.cor !== false, seed0 = opt.seed || 20261027;
    const BEH0 = JSON.parse(JSON.stringify(BEH)); if(opt.beh) Object.assign(BEH, opt.beh);   // 민감도 시험: 행동 가정 바꿔 보기 (끝나면 되돌림)
    try{ return runInner(N, games, cor, seed0); } finally { Object.keys(BEH0).forEach(k => BEH[k] = BEH0[k]); }
  }
  function runInner(N, games, cor, seed0){
    rnd = mulberry(seed0);
    const players = [], A = [], B = [];
    for(let i = 0; i < N; i++){
      const pl = makePlayer(cor); players.push(pl);
      const e1 = freshEv(), e2 = freshEv();
      for(let g = 0; g < games; g++) playGame(pl, seed0 + i * 101 + g, e1, false);
      for(let g = 0; g < games; g++) playGame(pl, seed0 + 7777777 + i * 101 + g, e2, false);   // 다시 하기(재검사)
      A.push({ ...measure(e1), dead: e1.dead, score: e1.score }); B.push(measure(e2));
    }
    const keys = ['anx', 'int', 'jcur', 'pat', 'adv', 'save', 'spend'];
    const norm = {}; keys.forEach(k => { const a = A.map(m => m[k]); norm[k] = { m: meanOf(a), s: sdOf(a) }; });
    const z = (m, k) => (m[k] - norm[k].m) / norm[k].s;
    const lat = { 불안: players.map(p => p.A), 관심도: players.map(p => p.I), '분석적(D)': players.map(p => p.D), '추천 따르기(S)': players.map(p => p.S),
                  예비저축: players.map(p => -p.R), 지출: players.map(p => -p.T), '누르는 버릇(G)': players.map(p => p.G) };
    const meas = { '불안=다시 고르기': 'anx', '관심도=도감 열기': 'int', '지금 판단 축(내 생각+순찰)': 'jcur', '순찰 비율': 'pat', '추천 따르기': 'adv', '예비저축=−위험': 'save', '지출=−시간': 'spend' };
    const matrix = {}; for(const [mn, mk] of Object.entries(meas)){ matrix[mn] = {}; for(const [ln, lv] of Object.entries(lat)) matrix[mn][ln] = r2(corr(A.map(m => m[mk]), lv)); }
    const retest = {}; for(const [mn, mk] of Object.entries(meas)) retest[mn] = r2(corr(A.map(m => m[mk]), B.map(m => m[mk])));
    const truth = players.map(p => nearest(latentVec(p), [0, 1, 2, 3, 4]));
    const dist = l => { const c = {}; l.forEach(x => c[x] = (c[x] || 0) + 1); const o = {}; Object.keys(TYPES).forEach(k => o[k] = Math.round(100 * (c[k] || 0) / l.length) + '%'); return o; };
    const chance = (() => { const c = {}; truth.forEach(x => c[x] = (c[x] || 0) + 1); return Object.values(c).reduce((s, v) => s + (v / N) ** 2, 0); })();
    const models = {};
    for(const [name, M] of Object.entries(MODELS)){
      const idx = M.dims.map((k, i) => k ? i : -1).filter(i => i >= 0);
      const vec = m => M.dims.map(k => k ? z(m, k) : 0);
      const got = A.map(m => nearest(vec(m), idx)), again = B.map(m => nearest(vec(m), idx));
      const truthSub = players.map(p => nearest(latentVec(p), idx));                       // 같은 차원만으로 본 "정답"
      models[name] = { '5유형 일치(정답=5차원)': Math.round(100 * got.filter((t, i) => t === truth[i]).length / N) + '%',
        '같은 차원 기준 일치': Math.round(100 * got.filter((t, i) => t === truthSub[i]).length / N) + '%',
        '다시 해도 같은 유형': Math.round(100 * got.filter((t, i) => t === again[i]).length / N) + '%', 분포: dist(got) };
    }
    // 무작위로 누르는 아이 — 유형이 한쪽으로 쏠리지 않는지 (같은 기준점 사용)
    const RK = []; for(let i = 0; i < Math.round(N / 2); i++){ const e = freshEv(); for(let g = 0; g < games; g++) playGame(makePlayer(cor), seed0 + 999999 + i * 13 + g, e, true); RK.push(measure(e)); }
    const rkM5 = dist(RK.map(m => nearest(MODELS['M5  5차원(불안 + 관심도)'].dims.map(k => k ? z(m, k) : 0), [0, 1, 2, 3, 4])));
    const rkM3 = dist(RK.map(m => nearest(MODELS['M3  지금 3축(판단=추천+순찰)'].dims.map(k => k ? z(m, k) : 0), [2, 3, 4])));
    return {
      설정: { N, 판수: games, 성향끼리_상관: cor, 행동모형: JSON.parse(JSON.stringify(BEH)) },
      한판_평균: { '점수 신호 개수': r2(meanOf(A.map(m => m.nSignals)) / games), '다시 고르기 기회': r2(meanOf(A.map(m => m.opps)) / games),
        '다시 고르기 비율': r2(meanOf(A.map(m => m.anx))), '순찰 비율': r2(meanOf(A.map(m => m.pat))), '섬이 무너진 판': Math.round(100 * meanOf(A.map(m => m.dead)) / games) + '%' },
      '측정↔숨은성향 상관': matrix, '다시 해도 같은 점수(재검사 상관)': retest,
      '5유형 정답 분포': dist(truth), '우연히 맞을 확률': Math.round(chance * 100) + '%',
      모형: models, '무작위로 누르는 아이 — M5 유형 분포': rkM5, '무작위로 누르는 아이 — M3 유형 분포': rkM3,
    };
  }
  window.SIM5 = { run, BEH, TYPES };
})();
