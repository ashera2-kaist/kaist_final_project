/* ============================================================
   작은 섬의 영주 — 플레이 데이터 DB 연동 (Supabase) · v2 (v0.8: 4축 · 5영주 · 설문)
   ------------------------------------------------------------
   불러오는 곳: 작은섬의영주_v0.8.html 맨 아래 <script src="db/islandlord_db.js" data-game-version="0.8">
                (게임 <script> · book_share.js보다 뒤 — 게임 함수를 감싸서 기록하기 때문)
   테이블:     db/schema_v2_dims4_survey.sql 을 Supabase SQL Editor에서 먼저 실행 (v1 테이블이 있으면 칸만 더함)
                play_sessions (한 생 요약) · play_choices (선택 하나하나) · play_surveys (설문, survey_popup.js가 보냄)

   v1(v0.6.9.9, 3축) → v2에서 고친 것 — 현재 영주 분류(lordOf)와 맞추기
     · 영주: 예전 3축 유형(personaType) 대신 결과 화면과 같은 lordOf(META.dims) = 누적 영주 → lord_id
             이번 생만 본 영주도 lord_life_id로 따로 남김
     · 4축 원점수: 이번 생(life_dims)과 누적(total_dims) — 의사결정은 순찰 제외(dimsAddLog와 같음), 불안은 UNDOSTAT(다시 고르기 · 기회)
     · 동료 추천: 봄 · 가을 추천이 다음 손님 카드 줄에 잘못 붙던 문제 → 추천마다 kind=advice 줄(advice_ctx = spring / card / sell)
     · 봄에 "아무것도 하지 않기"(시간 −1)가 기록되지 않던 문제 → kind=rest 줄
     · 다시 고르기: 어느 줄들이 취소됐는지 undo 줄의 extra.undone_from ~ undone_to로 남김
     · 요약 줄은 게임의 finish가 META를 고친 "뒤"에 만든다(누적 영주가 화면과 같도록)

   게임 함수를 바깥에서 감싼다(wrap). 이름이 바뀌면 콘솔에 "[DB] 감쌀 함수를 못 찾음: 이름" → HOOKS를 고친다.
   주소 옵션:  ?test=1 팀원 테스트(is_test) · ?group=3반 반 코드 · ?nodb=1 보내지 않음 · ?dbdebug=1 전송 상태 표시
   보내기 실패(오프라인 등) → 브라우저(localStorage)에 모아 두었다가 다시 보낸다.
   콘솔에서: IslandDB.status() · IslandDB.flush() · IslandDB.test() · IslandDB.recent() (최근에 만든 줄, ?nodb=1이어도 보임)
   ============================================================ */
(function(){
  'use strict';

  /* ── 설정 — anon(publishable) 키만! service_role/secret 키는 절대 넣지 말 것 ── */
  const DB = {
    url: 'https://pposrdpdznaladikwoig.supabase.co',
    key: 'sb_publishable_qimgH5niXCyTb7oOYiUN_Q_gKh7qVe2',
    tables: { session: 'play_sessions', choice: 'play_choices', survey: 'play_surveys' },
    scoringModel: 'dims4_v08',
    flushEveryMs: 15000,
    batchSize: 50,
  };

  const me = document.currentScript;
  const GAME_VERSION = (me && me.dataset.gameVersion) || 'unknown';
  const Q = new URLSearchParams(location.search);
  const ENABLED = !Q.has('nodb');
  const IS_TEST = Q.get('test') === '1';
  const GROUP = (Q.get('group') || '').trim().slice(0, 40) || null;
  const DEBUG = Q.has('dbdebug');
  const OUTBOX_KEY = 'islandlord_db_outbox_v1', PLAYER_KEY = 'islandlord_player_id';

  /* ── 작은 도구 ── */
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&3|8)).toString(16); });
  const now = () => new Date().toISOString();
  const store = {
    get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  };
  let PLAYER = store.get(PLAYER_KEY, null);
  if(!PLAYER){ PLAYER = uuid(); store.set(PLAYER_KEY, PLAYER); }
  const r2 = v => v == null ? null : Math.round(v*100)/100;
  const r3 = v => v == null ? null : Math.round(v*1000)/1000;

  /* ── 보내기 (실패하면 outbox에 남겨 두고 다시 시도) ── */
  let outbox = store.get(OUTBOX_KEY, []);
  const state = { sent: 0, failed: 0, last: '', busy: false };
  const RECENT = [];
  function enqueue(table, row){
    RECENT.push({ table, row }); if(RECENT.length > 300) RECENT.shift();
    if(!ENABLED) return;
    outbox.push({ table, row });
    if(outbox.length > 5000) outbox.splice(0, outbox.length - 5000);
    store.set(OUTBOX_KEY, outbox); badge(); flush();
  }
  async function post(table, rows){
    return fetch(`${DB.url}/rest/v1/${table}`, {
      method: 'POST', keepalive: JSON.stringify(rows).length < 60000,
      headers: { 'apikey': DB.key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(rows),
    });
  }
  async function flush(){
    if(!ENABLED || state.busy || !outbox.length) return;
    state.busy = true;
    try{
      while(outbox.length){
        const table = outbox[0].table, batch = [];
        for(const it of outbox){ if(it.table !== table || batch.length >= DB.batchSize) break; batch.push(it); }
        let res;
        try{ res = await post(table, batch.map(b => b.row)); }
        catch(e){ state.last = '네트워크 오류 — 나중에 다시 보냄'; break; }
        if(res.ok){ outbox.splice(0, batch.length); state.sent += batch.length; state.last = `${table} ${batch.length}줄 저장`; }
        else if(res.status === 409 && batch.length > 1){
          for(const it of batch){ const r1 = await post(table, [it.row]).catch(()=>null); if(!r1){ state.last='네트워크 오류'; break; }
            outbox.splice(outbox.indexOf(it), 1); if(r1.ok) state.sent++; }
        }
        else if(res.status === 409){ outbox.splice(0, 1); state.last = '이미 저장된 줄(건너뜀)'; }
        else if(res.status >= 500 || res.status === 408 || res.status === 429){ state.last = `서버 ${res.status} — 나중에 다시 보냄`; break; }
        else if(res.status === 404 || res.status === 401 || res.status === 403){
          if(!state.warned){ state.warned = true; console.warn(`[DB] ${table} 저장 보류 ${res.status} — 테이블이 없거나 키가 맞지 않음. db/schema_v2_dims4_survey.sql을 실행했는지 확인. 기록은 브라우저에 보관 중`, await res.text().catch(()=> '')); }
          state.last = `보류 ${res.status}: 테이블/키 확인 — 기록은 보관 중`; break;
        }
        else {                                                    // 400 등: 칸 이름 · 형식 문제 → 버림(무한 재시도 방지)
          const msg = await res.text().catch(()=> '');
          console.warn(`[DB] ${table} 저장 실패 ${res.status} — v2 칸이 없으면 schema_v2_dims4_survey.sql 실행`, msg);
          state.failed += batch.length; state.last = `실패 ${res.status} (${table}) — 콘솔 확인`;
          outbox.splice(0, batch.length);
        }
        store.set(OUTBOX_KEY, outbox);
      }
    } finally { state.busy = false; store.set(OUTBOX_KEY, outbox); badge(); }
  }
  if(ENABLED){ setInterval(()=>{ if(outbox.length) flush(); }, DB.flushEveryMs); window.addEventListener('online', flush); setTimeout(flush, 1500); }

  /* ── 이번 판 ── */
  let PLAY = null;          // { id, seq, snapSeq, startedAt, demo }
  let LAST_PLAY_ID = null;  // 방금 끝난 판 — 설문에 붙임
  let ADVICE = null;        // 손님 카드의 followAdvice → 바로 다음 applyChoice 줄에도 붙임
  const live = s => typeof S !== 'undefined' && s === S && PLAY;   // 시뮬레이터 등 다른 상태는 기록하지 않음
  const res = s => ({ gold: s.gold, grain: s.grain, trust: s.trust, debt: (typeof debt === 'function') ? debt(s) : null });
  const pv = s => ({ r: s.persona.r, t: s.persona.t, j: s.persona.j });
  const base = () => ({ play_id: PLAY.id, player_id: PLAYER, game_version: GAME_VERSION, scoring_model: DB.scoringModel,
    is_test: IS_TEST, is_demo: PLAY.demo });
  const SEASON_CTX = ['spring', 'card', 'sell'];

  function choice(s, kind, before, o){
    const after = pv(s);
    enqueue(DB.tables.choice, { id: uuid(), ...base(), client_ts: now(), seq: ++PLAY.seq, kind,
      year: o.year ?? s.year, season: o.season ?? s.season,
      card_id: o.card_id ?? null, choice_index: o.choice_index ?? null, choice_text: o.choice_text ?? null,
      advised_index: o.advised_index ?? null, followed_advice: o.followed_advice ?? null, advice_ctx: o.advice_ctx ?? null,
      persona_dr: r2(after.r - before.r), persona_dt: r2(after.t - before.t), persona_dj: r2(after.j - before.j),
      ...res(s), extra: o.extra || null });
  }
  /* 4축: 게임과 같은 계산(dimsAddLog · lordOf)을 그대로 부른다 */
  function lifeDims(s){
    const d = dimsAddLog(freshDims(), s.persona.log);
    const U = (typeof UNDOSTAT !== 'undefined' && UNDOSTAT) || { undo: 0, opp: 0 };
    d.undo = U.undo; d.opp = U.opp; d.lives = 1; return d;
  }
  const dimsOut = d => ({ r: r2(d.r), rn: d.rn, t: r2(d.t), tn: d.tn, j: r2(d.j), jn: d.jn, undo: d.undo, opp: d.opp, lives: d.lives });

  /* ── 게임 함수 감싸기 ── */
  function wrap(name, make){
    const orig = window[name];
    if(typeof orig !== 'function'){ console.warn('[DB] 감쌀 함수를 못 찾음:', name); return; }
    window[name] = make(orig);
  }
  const HOOKS = {
    startGame: orig => function(h){
      PLAY = { id: uuid(), seq: 0, snapSeq: 0, startedAt: now(), demo: typeof DEMO !== 'undefined' && !!DEMO };
      ADVICE = null;
      return orig.apply(this, arguments);
    },
    snap: orig => function(){ if(PLAY) PLAY.snapSeq = PLAY.seq; return orig.apply(this, arguments); },
    followAdvice: orig => function(s, advised, chosen, k){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), out = orig.apply(this, arguments);
      if(advised == null){ if(s.season === 1) ADVICE = null; return out; }
      const ctx = SEASON_CTX[s.season] || null, followed = advised === chosen;
      choice(s, 'advice', b, { advised_index: advised, choice_index: chosen, followed_advice: followed, advice_ctx: ctx, extra: { k: k || 2 } });
      ADVICE = ctx === 'card' ? { advised, followed } : null;
      return out;
    },
    personaAdd: orig => function(s, src){
      if(src === 'rest' && live(s)){ const b = pv(s), out = orig.apply(this, arguments); choice(s, 'rest', b, { choice_text: 'rest' }); return out; }
      return orig.apply(this, arguments);
    },
    applyChoice: orig => function(s, card, i){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), y = s.year, se = s.season, ch = card.choices[i] || {}, adv = ADVICE; ADVICE = null;
      const out = orig.apply(this, arguments);
      choice(s, 'card', b, { year: y, season: se, card_id: card.id, choice_index: i, choice_text: ch.text || null,
        advised_index: adv ? adv.advised : null, followed_advice: adv ? adv.followed : null,
        extra: { title: card.title || null, n_choices: card.choices.length, risk: !!ch.risk, dead: s.dead || null } });
      return out;
    },
    doBuild: orig => function(s, id, pay){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), out = orig.apply(this, arguments);
      if(out) choice(s, 'build', b, { card_id: id, choice_text: pay });
      return out;
    },
    doBet: orig => function(s, id, stake){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), out = orig.apply(this, arguments);
      choice(s, 'bet', b, { card_id: id, choice_text: String(stake), extra: { stake } });
      return out;
    },
    doSplit: orig => function(s, r, x, opt){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), H = s.harvestNow || 0, out = orig.apply(this, arguments);
      choice(s, 'seed', b, { extra: { harvest: H, ration: r, seeds: s.seeds, store: out && out.store, auto: !!(opt && opt.auto), untouched: !!(opt && opt.untouched) } });
      return out;
    },
    doPatrol: orig => function(s, card, r){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), out = orig.apply(this, arguments);
      if(out && out.res !== 'none') choice(s, 'patrol', b, { card_id: card.id, choice_text: r, extra: { got_extra: !!out.extra } });
      return out;
    },
    doSell: orig => function(s, n){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), out = orig.apply(this, arguments);
      choice(s, 'sell', b, { choice_text: String(n), extra: { n, rot: out && out.rot } });
      return out;
    },
    useUlt: orig => function(s){
      if(!live(s)) return orig.apply(this, arguments);
      const b = pv(s), out = orig.apply(this, arguments);
      if(out) choice(s, 'ult', b, { card_id: s.hero.id, choice_text: s.hero.ult || null });
      return out;
    },
    undo: orig => function(){
      if(PLAY && typeof UNDO !== 'undefined' && UNDO && typeof S !== 'undefined' && S){
        const from = PLAY.snapSeq + 1, to = PLAY.seq;
        choice(S, 'undo', pv(S), { choice_text: UNDO.kind, extra: { undone_from: from <= to ? from : null, undone_to: from <= to ? to : null } });
      }
      return orig.apply(this, arguments);
    },
    finish: orig => function(){
      let row = null;
      if(PLAY && typeof S !== 'undefined' && S){
        try{
          const sc = score(S), goal = goalNow(), life = lifeDims(S);
          row = { ...base(), group_code: GROUP, started_at: PLAY.startedAt, ended_at: now(),
            life_no: PLAY.demo ? null : META.lives + 1, tier: META.tier, goal, passed: passed(S, goal), score: sc,
            dead: S.dead || null, years: S.years,
            birth_face: S.birth ? S.birth.face : null, birth_id: S.birth ? S.birth.id : null, hero_id: S.hero.id,
            gold: S.gold, grain: S.grain, trust: S.trust, debt: debt(S), seeds: S.seeds || 0, built: [...S.built],
            persona_r: r2(S.persona.r), persona_t: r2(S.persona.t), persona_j: r2(S.persona.j), persona_n: S.persona.n,
            advice_given: S.advice.given, advice_followed: S.advice.followed,
            patrol: S.patrol, choices_count: PLAY.seq,
            undo_count: life.undo, undo_opp: life.opp, life_dims: dimsOut(life), lord_life_id: lordOf(life).id,
            scoring_cfg: { neutral: CFG.dimNeutral, th: CFG.dimTh, advicePlan: CFG.advicePlan },
            extra: { over: !!S.over, year: S.year, season: S.season } };
        }catch(e){ console.warn('[DB] 요약 만들기 실패', e); }
      }
      const out = orig.apply(this, arguments);
      if(row){
        try{   /* finish가 META.dims에 이번 생을 더한 뒤 → 화면에 보인 누적 영주와 같다 (시연 모드는 이번 생만) */
          const tot = row.is_demo ? lifeDims(S) : (META.dims || lifeDims(S)), R = lordOf(tot);
          Object.assign(row, { lord_id: R.id, persona_type: R.lord.name, lives_total: tot.lives, total_dims: dimsOut(tot),
            grade_anx: R.g.anx, grade_dec: R.g.dec, grade_save: R.g.save, grade_spend: R.g.spend,
            score_anx: r3(R.sc.anx), score_dec: r3(R.sc.dec), score_save: r3(R.sc.save), score_spend: r3(R.sc.spend) });
        }catch(e){ console.warn('[DB] 영주 계산 실패', e); }
        enqueue(DB.tables.session, row); LAST_PLAY_ID = PLAY.id; PLAY = null;
      }
      return out;
    },
  };
  Object.entries(HOOKS).forEach(([n, make]) => wrap(n, make));

  /* ── 전송 상태 표시 (?dbdebug=1) ── */
  let el = null;
  function badge(){
    if(!DEBUG) return;
    if(!el){ el = document.createElement('div'); el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:9999;font:12px/1.4 monospace;background:#0B1526;color:#F2C14E;border:2px solid #F2C14E;padding:4px 8px;pointer-events:none'; document.body.appendChild(el); }
    el.textContent = `DB ${ENABLED?'ON':'OFF'} · 보냄 ${state.sent} · 대기 ${outbox.length} · 실패 ${state.failed}${state.last?' · '+state.last:''}`;
  }
  badge();

  /* ── 설문 저장 (survey_popup.js가 부름) ── */
  function saveSurvey(p){
    const A = p.answers || {}, row = { id: uuid(), player_id: PLAYER, play_id: p.play_id || LAST_PLAY_ID, group_code: GROUP,
      game_version: GAME_VERSION, is_test: IS_TEST, survey_version: p.survey_version || null, status: p.status, trigger: p.trigger || null,
      life_no: p.life_no ?? null, lord_id: p.lord_id || null, lord_name: p.lord_type || null,
      answers: A, comment: p.comment || null, duration_sec: p.duration_sec ?? null, client_ts: p.submitted_at || now(), extra: p.extra || null };
    for(let i = 1; i <= 6; i++){ const a = A['q' + i] || {}; row[`q${i}_before`] = a.before ?? null; row[`q${i}_now`] = a.now ?? null; }
    for(let i = 7; i <= 12; i++) row['q' + i] = A['q' + i] ?? null;
    enqueue(DB.tables.survey, row);
    return row;
  }

  /* ── 콘솔용 ── */
  window.IslandDB = {
    status: () => ({ enabled: ENABLED, player: PLAYER, play: PLAY && PLAY.id, lastPlay: LAST_PLAY_ID, queued: outbox.length, ...state, version: GAME_VERSION }),
    flush, saveSurvey,
    lastPlayId: () => LAST_PLAY_ID,
    recent: (table) => RECENT.filter(x => !table || x.table === table).map(x => x.row),
    test: async () => {
      const row = { id: uuid(), play_id: uuid(), player_id: PLAYER, game_version: GAME_VERSION, scoring_model: DB.scoringModel,
        is_test: true, is_demo: false, client_ts: now(), seq: 1, kind: 'ping', extra: { note: 'IslandDB.test()' } };
      const r = await post(DB.tables.choice, [row]).catch(e => ({ ok: false, status: 'network', text: () => String(e) }));
      const t = r.ok ? '' : await r.text();
      console.log(r.ok ? '[DB] 연결 OK' : `[DB] 연결 실패 ${r.status}`, t); return r.ok;
    },
  };
})();
