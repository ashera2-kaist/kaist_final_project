/* ============================================================
   작은 섬의 영주 v0.8 — 게임 뒤 설문 팝업 (기준: 설문팝업샘플_v1.0.html · 문항 v2.1, 12문항 + 자유 의견)
   ------------------------------------------------------------
   불러오는 곳: 작은섬의영주_v0.8.html 맨 아래 <script src="survey_popup.js"> (db/islandlord_db.js보다 뒤)
   언제 뜨나
     · 자동: 생이 끝난 결과 화면에서 1.5초 뒤, "지금까지 마친 생"이 SURVEY.autoAfterLives(3) 이상이면 한 번만
             (영주 유형이 3번의 생부터 안정되기 때문. 거절 · 완료하면 다시 자동으로 뜨지 않음)
     · 버튼: 결과 화면의 「📝 설문 참여하기」 — 첫 생부터 보이고, 완료하면 사라짐
     · 시연 모드에서는 뜨지 않음. 주소에 ?survey=1 → 생이 끝날 때마다 자동으로 띄움(테스트용)
   저장: IslandDB.saveSurvey(payload) → Supabase play_surveys (db/schema_v2_dims4_survey.sql)
         참여 여부는 이 브라우저(localStorage 'islandlord_survey_v1')에도 남김
   ============================================================ */
(function(){
  'use strict';
  const SURVEY = { version: 'v2.1', autoAfterLives: 3, delayMs: 1500, key: 'islandlord_survey_v1' };
  const Q = new URLSearchParams(location.search), FORCE = Q.get('survey') === '1';
  const $ = s => document.querySelector(s);
  const store = {
    get(){ try{ return JSON.parse(localStorage.getItem(SURVEY.key) || 'null'); }catch(e){ return null; } },
    set(v){ try{ localStorage.setItem(SURVEY.key, JSON.stringify(v)); }catch(e){} },
  };

  /* ── 문항 (샘플 v2.1 그대로) ── */
  const AGREE = [['😶','아니에요'],['🙂','조금 그래요'],['😊','꽤 그래요'],['😆','정말 그래요']];
  const QUESTIONS = [
    {id:'q1', type:'prepost', text:'돈을 쓰기 전에 한 번 더 생각해 봐요', dim:'의사결정'},
    {id:'q2', type:'prepost', text:'갖고 싶은 게 있어도 나중을 위해 참을 수 있어요', dim:'시간'},
    {id:'q3', type:'prepost', text:'혹시 모를 일에 대비해 조금 남겨 두고 싶어요', dim:'예비저축'},
    {id:'q4', type:'prepost', text:'잘 모르는 일에 돈을 쓸 때는 조심하게 돼요', dim:'위험'},
    {id:'q5', type:'prepost', text:'돈 이야기가 궁금하고 재미있어요', dim:'관심도'},
    {id:'q6', type:'prepost', text:'내가 돈을 어떤 식으로 쓰는 사람인지 알 것 같아요', dim:'자기이해'},
    {id:'q7', type:'single', text:'게임이 알려 준 내 영주, 나랑 닮았나요?', opts:[['😶','안 닮았어요'],['🙂','조금'],['😊','꽤'],['😆','완전 나예요']]},
    {id:'q8', type:'single', text:'왜 이런 영주가 나왔는지 알 것 같아요?', opts:[['😶','모르겠어요'],['🙂','조금'],['😊','꽤'],['😆','확실히 알아요']]},
    {id:'q9', type:'single', text:'게임이나 도감을 보면서 돈에 대해 새로 알게 된 게 있어요?', opts:[['😶','없어요'],['🙂','조금'],['😊','꽤'],['😆','많아요']]},
    {id:'q10', type:'single', text:'게임 재미있었어요?', opts:[['😫','별로'],['😐','그냥'],['🙂','재밌어요'],['😆','엄청 재밌어요']]},
    {id:'q11', type:'single', text:'게임 설명이랑 고르는 게 쉬웠어요?', opts:[['😫','너무 어려웠어요'],['😐','조금 어려웠어요'],['🙂','쉬웠어요'],['😆','아주 쉬웠어요']]},
    {id:'q12', type:'single', text:'또 해 보고 싶어요?', opts:[['🙅','아니요'],['🤔','글쎄요'],['🙋','네!']]},
    {id:'comment', type:'text', text:'하고 싶은 말이 있으면 적어 주세요', optional:true},
  ];
  const TOTAL = 12;

  /* ── 모양 (샘플 그대로, 게임 CSS와 겹치지 않게 svy- 이름표) ── */
  const font = document.createElement('link'); font.rel = 'stylesheet';
  font.href = 'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap'; document.head.appendChild(font);
  const css = document.createElement('style');
  css.textContent = `
  .svy-scrim{--sea:#1f6f8b;--sand:#fff7e2;--ink:#2b2a33;--muted:#6d6a78;--sun:#ffc23d;--leaf:#3f9b6b;--line:#e6dcc0;--chip:#fffdf6;
    --display:"Jua","Gowun Dodum",system-ui,sans-serif;--sbody:"Gowun Dodum",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
    position:fixed;inset:0;background:rgba(10,30,40,.55);display:flex;align-items:flex-end;justify-content:center;z-index:9000;
    padding:0 max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));
    color:var(--ink);font-family:var(--sbody);font-size:16px}
  .svy-scrim[hidden]{display:none}
  .svy-scrim *{box-sizing:border-box}
  .svy-scrim button{font:inherit;color:inherit;cursor:pointer;width:auto;margin:0;text-transform:none;letter-spacing:0}
  .svy-scrim button:focus-visible,.svy-scrim textarea:focus-visible{outline:3px solid var(--sun);outline-offset:2px}
  @media (min-width:560px){.svy-scrim{align-items:center}}
  .svy-pop{width:100%;max-width:460px;max-height:calc(100% - 24px);overflow:auto;background:var(--sand);border-radius:22px 22px 18px 18px;
    padding:18px 20px 20px;display:grid;gap:16px;box-shadow:0 -6px 0 var(--sun) inset,0 20px 40px rgba(0,0,0,.3);animation:svy-rise .35s cubic-bezier(.2,.9,.3,1.2)}
  @keyframes svy-rise{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
  @media (prefers-reduced-motion:reduce){.svy-pop,.svy-step{animation:none!important}}
  .svy-top{display:flex;align-items:center;gap:10px}
  .svy-prog{flex:1;height:8px;border-radius:5px;background:var(--line);overflow:hidden}
  .svy-prog i{display:block;height:100%;background:var(--leaf);border-radius:5px;transition:width .3s}
  .svy-count{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:42px;text-align:right}
  .svy-scrim .svy-skip{border:0;background:none;box-shadow:none;font-size:14px;color:var(--muted);padding:4px 2px;text-decoration:underline;text-underline-offset:3px}
  .svy-step{display:grid;gap:14px;animation:svy-fade .25s ease}
  @keyframes svy-fade{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
  .svy-q{font-family:var(--display);font-weight:400;font-size:23px;line-height:1.35;margin:0;text-wrap:balance;color:var(--ink)}
  .svy-hint{margin:0;font-size:14px;color:var(--muted);line-height:1.5}
  .svy-pair{display:grid;gap:12px}
  .svy-lbl{font-size:13px;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;gap:6px}
  .svy-lbl b{font-weight:400;font-family:var(--display);font-size:15px;color:var(--ink);letter-spacing:0}
  .svy-lbl.now b{color:var(--leaf)}
  .svy-opts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
  .svy-opts.three{grid-template-columns:repeat(3,minmax(0,1fr))}
  .svy-scrim .svy-opt{border:2px solid var(--line);background:var(--chip);box-shadow:none;border-radius:14px;padding:10px 4px 8px;display:grid;justify-items:center;gap:4px;
    font-size:12.5px;line-height:1.25;text-align:center;min-height:74px;transition:transform .12s,border-color .12s,background .12s}
  .svy-opt .e{font-size:26px;line-height:1}
  .svy-scrim .svy-opt:hover{border-color:#d4c49a}
  .svy-scrim .svy-opt[aria-pressed="true"]{border-color:var(--leaf);background:#e6f4ec;transform:translateY(-2px)}
  .svy-opt[aria-pressed="true"] .t{font-weight:700}
  .svy-nav{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .svy-scrim .svy-btn{border:0;border-radius:12px;padding:12px 16px;font-family:var(--display);font-size:17px;background:var(--sun);color:var(--ink);box-shadow:0 4px 0 #c99418}
  .svy-scrim .svy-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #c99418}
  .svy-scrim .svy-btn.ghost{background:transparent;box-shadow:none;color:var(--muted);text-decoration:underline;text-underline-offset:3px;padding:12px 8px;font-family:var(--sbody);font-size:15px}
  .svy-scrim .svy-btn[disabled]{opacity:.4;cursor:default}
  .svy-scrim textarea{width:100%;min-height:96px;border:2px solid var(--line);border-radius:14px;background:var(--chip);padding:12px;font:inherit;color:var(--ink);resize:vertical}
  .svy-center{text-align:center;justify-items:center}
  .svy-big{font-size:54px;line-height:1}
  #btn-survey-end{margin-top:10px}
  #btn-survey-end[hidden]{display:none}`;
  document.head.appendChild(css);

  const scrim = document.createElement('div'); scrim.className = 'svy-scrim'; scrim.hidden = true;
  scrim.innerHTML = '<div class="svy-pop" role="dialog" aria-modal="true" aria-labelledby="svy-qtitle" id="svy-pop"></div>';
  document.body.appendChild(scrim);
  const pop = scrim.querySelector('#svy-pop');

  /* ── 상태 ── */
  let ans, idx, startedAt, trigger, sentFinal, advanceTimer;
  const lordNow = () => { try{ const R = lordOf(META.dims || freshDims()); return { id: R.id, name: R.lord.name }; }catch(e){ return { id: null, name: null }; } };
  function open(trg){
    ans = {}; idx = -1; startedAt = Date.now(); trigger = trg; sentFinal = false;
    scrim.hidden = false; render();
  }
  function close(){
    clearTimeout(advanceTimer);
    if(!sentFinal && idx >= 0) submit('declined');       // 문항을 시작했다가 닫으면 거절로 남김(그때까지 고른 답 포함)
    scrim.hidden = true; refreshButton();
  }

  const progressHTML = () => { const n = Math.min(Math.max(idx + 1, 0), TOTAL);
    return `<div class="svy-top"><div class="svy-prog" aria-hidden="true"><i style="width:${(n / TOTAL) * 100}%"></i></div>
      <span class="svy-count">${n}/${TOTAL}</span><button class="svy-skip" id="svy-skip" type="button">건너뛰기</button></div>`; };
  function optBtns(qid, row, opts){
    const cur = row ? (ans[qid] || {})[row] : ans[qid];
    return `<div class="svy-opts ${opts.length === 3 ? 'three' : ''}" role="group">` + opts.map((o, i) =>
      `<button class="svy-opt" type="button" data-q="${qid}" data-row="${row || ''}" data-v="${i + 1}" aria-pressed="${cur === i + 1}">
         <span class="e" aria-hidden="true">${o[0]}</span><span class="t">${o[1]}</span></button>`).join('') + '</div>';
  }
  const answered = q => q.type === 'prepost' ? !!((ans[q.id] || {}).before && (ans[q.id] || {}).now) : q.type === 'single' ? !!ans[q.id] : true;

  function render(){
    if(idx === -1){
      pop.innerHTML = `<div class="svy-step svy-center">
        <div class="svy-big" aria-hidden="true">🏝️</div>
        <h2 class="svy-q" id="svy-qtitle">영주님, 섬을 잘 다스려 주셔서 고마워요!</h2>
        <p class="svy-hint">2분만 나눠주세요. 하고 싶지 않으면 안 해도 괜찮아요.</p>
        <div class="svy-nav" style="justify-content:center;flex-wrap:wrap">
          <button class="svy-btn ghost" id="svy-later" type="button">다음에 할게요</button>
          <button class="svy-btn" id="svy-go" type="button">시작하기</button>
        </div></div>`;
      pop.querySelector('#svy-go').onclick = () => { idx = 0; render(); };
      pop.querySelector('#svy-later').onclick = () => { submit('declined'); scrim.hidden = true; refreshButton(); };
      pop.querySelector('#svy-go').focus();
      return;
    }
    if(idx >= QUESTIONS.length) return renderDone();
    const q = QUESTIONS[idx];
    let body = '';
    if(q.type === 'prepost'){
      body = `<h2 class="svy-q" id="svy-qtitle">${q.text}</h2>
        <p class="svy-hint">게임 하기 전의 나와 지금의 나를 각각 골라 주세요.</p>
        <div class="svy-pair"><div class="svy-lbl">게임 전의 나</div>${optBtns(q.id, 'before', AGREE)}
          <div class="svy-lbl now"><b>지금의 나</b></div>${optBtns(q.id, 'now', AGREE)}</div>`;
    } else if(q.type === 'single'){
      body = `<h2 class="svy-q" id="svy-qtitle">${q.text}</h2>${optBtns(q.id, null, q.opts)}`;
    } else {
      body = `<h2 class="svy-q" id="svy-qtitle">${q.text}</h2>
        <p class="svy-hint">없으면 그냥 보내도 돼요. 이름이나 전화번호는 적지 말아 주세요.</p>
        <label for="svy-cm" class="svy-lbl">자유롭게 적기</label>
        <textarea id="svy-cm" maxlength="300" placeholder="예) 곡식 나누기가 재밌었어요"></textarea>`;
    }
    const isLast = q.type === 'text', ready = answered(q);
    pop.innerHTML = (isLast ? '<div class="svy-top"><div class="svy-prog"><i style="width:100%"></i></div><span class="svy-count">마지막</span></div>' : progressHTML()) +
      `<div class="svy-step">${body}</div>
       <div class="svy-nav"><button class="svy-btn ghost" id="svy-back" type="button">이전</button>
         <button class="svy-btn" id="svy-next" type="button" ${ready || isLast ? '' : 'disabled'}>${isLast ? '보내기' : '다음'}</button></div>`;
    if(isLast) pop.querySelector('#svy-cm').value = ans.comment || '';
    pop.querySelectorAll('.svy-opt').forEach(b => b.onclick = () => pick(b));
    pop.querySelector('#svy-back').onclick = () => { clearTimeout(advanceTimer); idx--; render(); };
    pop.querySelector('#svy-next').onclick = () => { clearTimeout(advanceTimer); if(isLast) ans.comment = pop.querySelector('#svy-cm').value.trim(); idx++; render(); };
    const sk = pop.querySelector('#svy-skip');
    if(sk) sk.onclick = () => { clearTimeout(advanceTimer); ans[q.id] = q.type === 'prepost' ? { before: null, now: null, skipped: true } : null; idx++; render(); };
  }
  function pick(btn){
    const q = btn.dataset.q, row = btn.dataset.row, v = +btn.dataset.v;
    if(row){ ans[q] = Object.assign({}, ans[q], { [row]: v }); delete ans[q].skipped; } else ans[q] = v;
    const keep = `${q}|${row}|${v}`;
    render();
    const again = [...pop.querySelectorAll('.svy-opt')].find(b => `${b.dataset.q}|${b.dataset.row}|${b.dataset.v}` === keep);
    if(again) again.focus();
    clearTimeout(advanceTimer);
    if(answered(QUESTIONS[idx])) advanceTimer = setTimeout(() => { idx++; render(); }, 450);   // 답을 다 고르면 잠깐 뒤 다음 문항
  }

  function buildPayload(status){
    const answers = {};
    QUESTIONS.forEach(q => {
      if(q.type === 'text') return;
      const a = ans[q.id];
      if(q.type === 'prepost'){ const before = a && a.before || null, now = a && a.now || null; answers[q.id] = { before, now, diff: before && now ? now - before : null }; }
      else answers[q.id] = a ?? null;
    });
    const L = lordNow();
    return { play_id: (window.IslandDB && IslandDB.lastPlayId()) || null, lord_type: L.name, lord_id: L.id,
      life_no: (typeof META !== 'undefined' && META) ? META.lives : null, survey_version: SURVEY.version, trigger,
      status, answers, comment: ans.comment || '', duration_sec: Math.round((Date.now() - startedAt) / 1000), submitted_at: new Date().toISOString() };
  }
  function submit(status){
    if(sentFinal) return null;
    sentFinal = true;
    const payload = buildPayload(status);
    const prev = store.get() || {};
    store.set({ status: status === 'completed' || prev.status === 'completed' ? 'completed' : 'declined', at: payload.submitted_at, lives: payload.life_no });
    if(window.IslandDB && typeof IslandDB.saveSurvey === 'function') IslandDB.saveSurvey(payload);
    else console.log('[설문] DB 모듈 없음 — 저장 안 됨', payload);
    if(typeof window.onSurveySubmit === 'function') window.onSurveySubmit(payload);
    return payload;
  }
  function renderDone(){
    submit('completed');
    pop.innerHTML = `<div class="svy-step svy-center"><div class="svy-big" aria-hidden="true">🎉</div>
      <h2 class="svy-q" id="svy-qtitle">고마워요, 영주님!</h2>
      <p class="svy-hint">알려 준 내용으로 섬을 더 재미있게 만들게요.</p>
      <button class="svy-btn" id="svy-close" type="button">닫기</button></div>`;
    pop.querySelector('#svy-close').onclick = close;
    pop.querySelector('#svy-close').focus();
  }
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !scrim.hidden) close(); });

  /* ── 결과 화면 버튼 · 자동 팝업 ── */
  function refreshButton(){
    let b = $('#btn-survey-end');
    const anchor = $('#btn-book-end');
    if(!b && anchor){ b = document.createElement('button'); b.id = 'btn-survey-end'; b.type = 'button'; b.className = 'secondary';
      b.textContent = '📝 설문 참여하기 (2분)'; b.onclick = () => open('button'); anchor.insertAdjacentElement('afterend', b); }
    if(b){ const st = store.get(); b.hidden = (typeof DEMO !== 'undefined' && !!DEMO) || !!(st && st.status === 'completed'); }
  }
  if(typeof window.finish === 'function'){
    const orig = window.finish;
    window.finish = function(){
      const out = orig.apply(this, arguments);
      try{
        refreshButton();
        const demo = typeof DEMO !== 'undefined' && !!DEMO, st = store.get();
        const lives = (typeof META !== 'undefined' && META) ? META.lives : 0;
        if(!demo && (FORCE || (!st && lives >= SURVEY.autoAfterLives)))
          setTimeout(() => { if(scrim.hidden && !$('#s-end').hidden) open('auto'); }, SURVEY.delayMs);
      }catch(e){ console.warn('[설문] 준비 실패', e); }
      return out;
    };
  } else console.warn('[설문] finish를 못 찾음 — 자동 팝업 꺼짐');
  refreshButton();

  window.IslandSurvey = { open: () => open('console'), status: () => store.get(), reset: () => { try{ localStorage.removeItem(SURVEY.key); }catch(e){} refreshButton(); } };
})();
