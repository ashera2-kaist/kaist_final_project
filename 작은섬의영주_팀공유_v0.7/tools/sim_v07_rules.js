/* tools/sim_v07_rules.js — v0.7 규칙(고정 가중치 평균 · 기준점 · 고정 문턱 · 갈림길) 시뮬레이션. 게임 엔진은 작은섬의영주_v0.7_최종.html (봄 · 가을 동료 추천 포함). 콘솔: SIMTB.run({N:1500, games:3}) */
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
    const follows = () => !randomKid && rnd() < sig(BEH.follow * pl.S);   // 무작위로 누르는 아이는 추천과 상관없이 선택지를 같은 확률로 고름(따를 확률 = 1/선택지 수)
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
    ev.games++; ev.dead += s.dead ? 1 : 0; ev.advG += s.advice.given; ev.advF += s.advice.followed;
    dimsAddLog(ev.d, s.persona.log);
    s.persona.log.forEach(e => { if(String(e.src).startsWith('patrol') && e.v[2]){ ev.jp += e.v[2]; ev.jpn++; } });
  }
  const freshEv = () => ({ d: freshDims(), undo: 0, opp: 0, codex: 0, games: 0, dead: 0, jp: 0, jpn: 0, advG: 0, advF: 0 });
  function finalize(ev){ const d = ev.d; d.undo = ev.undo; d.opp = ev.opp; d.lives = ev.games; d.advG = ev.advG; d.advF = ev.advF; return d; }

  const meanOf = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sdOf = a => { const m = meanOf(a); return Math.sqrt(meanOf(a.map(x => (x - m) ** 2))) || 1; };
  const corr = (a, b) => { const ma = meanOf(a), mb = meanOf(b); let s = 0, sa = 0, sb = 0; for(let i = 0; i < a.length; i++){ const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return s / Math.sqrt(sa * sb || 1); };
  const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000, pct = x => Math.round(x * 100);

  /* ============================================================
     v0.7 규칙(고정 가중치 + 기준점 + 갈림길) 평가 — 평균 · 표준편차(z점수)는 쓰지 않는다
     채택 갈림길(방향): 예비저축 · 지출은 높음/낮음 두 가지만(기준점보다 크면 높음)
        높음·높음 → 파도 · 낮음·낮음 → 불꽃 · 낮음·높음 → 번개 · 높음·낮음 → 불안 높음이면 나무, 아니면 햇빛
     비교용: 예전 갈림길(예비저축 · 지출 ±0.3 세 등급, 불안 먼저)
     ============================================================ */
  const TH = { lv: 0.3, anxHi: 0.2 };   // 의사결정 ±0.3 · 불안 0번=낮음 / 20% 이상=높음
  function simulate(N, games, seed0, randomKid){
    rnd = mulberry(seed0); const P = [], A = [], B = [];
    for(let i = 0; i < N; i++){ const pl = makePlayer(); P.push(pl); const e1 = freshEv(), e2 = freshEv();
      for(let g = 0; g < games; g++) playGame(pl, seed0 + i * 101 + g, e1, randomKid);
      for(let g = 0; g < games; g++) playGame(pl, seed0 + 7777777 + i * 101 + g, e2, randomKid);
      A.push(finalize(e1)); B.push(finalize(e2)); }
    return { P, A, B };
  }
  /* 기준점 = 모든 선택지를 같은 확률로 고를 때 나오는 평균(무작위로 누르는 아이) */
  function neutral(N, games){ const R = simulate(N, games, 4242, true).A;
    const m = k => { let s = 0, n = 0; R.forEach(d => { s += d[k]; n += d[k + 'n']; }); return n ? s / n : 0; };
    return { r: m('r'), t: m('t'), j: m('j') }; }
  const avg = (d, k) => d[k + 'n'] ? d[k] / d[k + 'n'] : null;
  function scores(d, nz){ return { anx: d.opp ? d.undo / d.opp : 0, dec: avg(d, 'j') == null ? 0 : avg(d, 'j') - nz.j,
      save: avg(d, 'r') == null ? 0 : -(avg(d, 'r') - nz.r), spend: avg(d, 't') == null ? 0 : -(avg(d, 't') - nz.t) }; }
  const lv3 = x => x >= TH.lv ? 'H' : x <= -TH.lv ? 'L' : 'M';
  const dir = x => x > 0 ? 'H' : 'L';
  const lvAnx = (x, d) => d.undo === 0 ? 'L' : x >= TH.anxHi ? 'H' : 'M';
  function grades(sc, d){ return { anx: lvAnx(sc.anx, d), dec: lv3(sc.dec), save: dir(sc.save), spend: dir(sc.spend), save3: lv3(sc.save), spend3: lv3(sc.spend) }; }
  /* 채택: 방향 갈림길 */
  const tree = g => g.save === 'H' ? (g.spend === 'H' ? 'wave' : g.anx === 'H' ? 'tree' : 'sun') : g.spend === 'H' ? 'bolt' : 'fire';
  const treeAnxM = g => g.save === 'H' ? (g.spend === 'H' ? 'wave' : g.anx !== 'L' ? 'tree' : 'sun') : g.spend === 'H' ? 'bolt' : 'fire';   // 불안 보통도 나무
  const tree3 = g => tree({ ...g, anx: 'L' });   // 불안 축이 없을 때(3축): 나무를 가를 수 없음
  /* 비교: 예전 갈림길 (세 등급, 불안 먼저) */
  const treeOld = g => g.anx === 'H' ? (g.spend3 === 'H' ? 'wave' : 'tree') : g.spend3 === 'H' ? 'bolt' : g.save3 === 'H' ? 'sun' : 'fire';
  /* 정답: 숨은 성향에 같은 기준을 씀 — 방향은 0(중앙) 기준, 세 등급은 아래 1/3 · 가운데 · 위 1/3 */
  const Q = 0.4307;   // 표준정규 1/3 지점
  const lvLat = z => z > Q ? 'H' : z < -Q ? 'L' : 'M';
  const latG = p => ({ anx: lvLat(p.A), dec: lvLat(p.S), save: dir(-p.R), spend: dir(-p.T), save3: lvLat(-p.R), spend3: lvLat(-p.T) });
  const truthOf = p => tree(latG(p));

  function run(opt = {}){
    const N = opt.N || 1500, games = opt.games || 3, seed0 = opt.seed || 20261200;
    const nz = neutral(Math.round(N / 2), games);
    const { P, A, B } = simulate(N, games, seed0, false);
    const RK = simulate(Math.round(N / 2), games, seed0 + 555, true).A;
    const G = A.map(d => grades(scores(d, nz), d)), GB = B.map(d => grades(scores(d, nz), d)), GR = RK.map(d => grades(scores(d, nz), d));
    const got = G.map(tree), again = GB.map(tree), truth = P.map(truthOf), got3 = G.map(tree3), rk = GR.map(tree);
    const share = (arr, keys) => Object.fromEntries(keys.map(k => [k, pct(arr.filter(x => x === k).length / arr.length)]));
    const gradeDist = {}; DIM_KEYS.forEach(k => { gradeDist[k] = share(G.map(g => g[k]), ['L', 'M', 'H']); });
    const conf = {}; IDS.forEach(t => { const ix = [...Array(N).keys()].filter(i => truth[i] === t); conf[t] = pct(ix.filter(i => got[i] === t).length / Math.max(1, ix.length)); });
    /* 갈림길 비교 — 정답은 각 갈림길에 숨은 성향을 넣은 영주 */
    const evalTree = f => { const gt = G.map(f), ag = GB.map(f), tr = P.map(p => f(latG(p))), r = GR.map(f);
      return { 정답일치: pct(gt.filter((t, i) => t === tr[i]).length / N), 재검사: pct(gt.filter((t, i) => t === ag[i]).length / N),
        분포: share(gt, IDS), 정답분포: share(tr, IDS), 무작위: share(r, IDS) }; };
    const anxTypes = truth.filter(t => t === 'tree').length / N;
    return { 설정: { N, games, 문턱: TH, 기준점: { 위험: r3(nz.r), 시간: r3(nz.t), 판단: r3(nz.j) }, 추천: CFG.advicePlan },
      한판: { 판단신호: r2(meanOf(A.map(d => d.jn)) / games), 추천횟수: r2(meanOf(A.map(d => d.advG)) / games),
        다시고르기기회: r2(meanOf(A.map(d => d.opp)) / games), 다시고른아이: pct(A.filter(d => d.undo > 0).length / N) },
      등급분포: gradeDist, 영주분포: share(got, IDS), 정답분포: share(truth, IDS),
      정답일치_4축: pct(got.filter((t, i) => t === truth[i]).length / N), 정답일치_3축: pct(got3.filter((t, i) => t === truth[i]).length / N),
      불안유형비율: pct(anxTypes), 재검사같은유형: pct(got.filter((t, i) => t === again[i]).length / N),
      영주별맞힘: conf, 무작위분포: share(rk, IDS),
      갈림길비교: { 방향: evalTree(tree), 방향_불안보통도나무: evalTree(treeAnxM), 예전: evalTree(treeOld) } };
  }
  window.SIMTB = { run, BEH };
})();
