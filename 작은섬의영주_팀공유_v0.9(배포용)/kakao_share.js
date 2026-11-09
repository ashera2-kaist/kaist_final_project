/* ============================================================
   작은 섬의 영주 v0.9 — 💬 카카오톡 공유하기 (검색어: [카톡공유])
   ------------------------------------------------------------
   불러오는 곳: 작은섬의영주_v0.9.html 맨 아래 <script src="kakao_share.js"> (게임 <script> · survey_popup.js보다 뒤)
   버튼 두 곳
     · 시작 화면  「💬 카카오톡으로 게임 알려 주기」 — 게임 소개 + 링크
     · 결과 화면  「💬 카카오톡으로 결과 보내기」   — 지금까지의 영주 유형 + 링크 (보호자 · 친구에게)
     · 도감 책    「💬 카톡으로 PDF 링크 보내기」   — book_share.js가 PDF를 서버에 올리고 IslandKakao.sendFeed로 보냄
                   [PDF 열기] 버튼 → 게임 폴더의 pdf.html?f=… → 서버 PDF (7일 보관). 카카오 키가 있을 때만 보임
       아이 이름 · 점수 같은 개인 기록은 보내지 않는다. 영주 유형과 생 수만
   보내는 방법 (위에서부터 되는 것)
     ① 카카오 JavaScript SDK (KAKAO_SHARE.jsKey가 있을 때) — 카톡 친구 · 채팅방 고르기 창
     ② 기기 공유 창(Web Share) — 휴대폰에서 카카오톡 · 문자 등 고르기
     ③ 링크 복사
   ── 처음 한 번: 카카오 앱 만들기 (KAKAO_SHARE.jsKey 채우기) ──
     1. https://developers.kakao.com → 로그인 → 내 애플리케이션 → 애플리케이션 추가하기 (이름: 작은 섬의 영주)
     2. 앱 설정 → 앱 키 → "JavaScript 키"를 아래 jsKey에 붙여 넣기 (JavaScript 키는 공개돼도 되는 키. REST · Admin 키는 넣지 말 것)
     3. 앱 설정 → 플랫폼 → Web → 사이트 도메인에 게임을 올린 주소 등록 (예: https://아이디.github.io)
        테스트할 때는 http://localhost:포트 도 등록. 파일로 연 게임(file://)에서는 카카오 공유가 동작하지 않음 → ②③으로 대신함
     4. 대표 이미지 share_og.png(1200×630)는 게임과 같은 폴더에 함께 올린다 (카톡 미리보기 그림)
   ============================================================ */
(function(){
  'use strict';
  const KAKAO_SHARE = {
    jsKey: '679a2de2e896f546f3a1f5629808b474',                       // ← 카카오 개발자 콘솔의 JavaScript 키 (비어 있으면 ②③으로 보냄)
    gameUrl: 'https://ashera2-kaist.github.io/kaist_final_project/작은섬의영주_팀공유_v0.9(배포용)/작은섬의영주_v0.9.html',   // 공유할 게임 주소 — https://부터 전체 주소로. 비우면 지금 열린 주소의 폴더(index.html)
    image: 'share_og.png',           // 게임 폴더 안 대표 이미지 (1200×630)
    sdk: 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js',
  };
  const $ = s => document.querySelector(s);

  /* ── 주소 ── */
  const folderUrl = () => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.pathname = u.pathname.replace(/[^/]*$/, ''); return u.href; };
  const gameUrl = () => new URL(KAKAO_SHARE.gameUrl || folderUrl(), location.href).href;   // 한글 · 괄호가 든 주소도 올바르게 인코딩
  const imageUrl = () => new URL(KAKAO_SHARE.image, gameUrl()).href;
  const webPage = () => /^https?:$/.test(location.protocol);

  /* ── 카카오 SDK (처음 누를 때만 불러옴) ── */
  let sdkP = null;
  function loadSdk(){
    if(window.Kakao) return Promise.resolve(window.Kakao);
    return sdkP || (sdkP = new Promise((ok, bad) => {
      const s = document.createElement('script'); s.src = KAKAO_SHARE.sdk; s.crossOrigin = 'anonymous';
      s.onload = () => window.Kakao ? ok(window.Kakao) : bad(new Error('Kakao SDK 없음'));
      s.onerror = () => { sdkP = null; bad(new Error('Kakao SDK를 불러오지 못함(인터넷 확인)')); };
      document.head.appendChild(s);
    }));
  }

  /* ── 보낼 내용 ── */
  function inviteMsg(){
    return { title: '눈 떠 보니, 망한 섬의 영주?',
      description: '섬을 다스리며 금융 개념을 배우고, 나의 금융 성향(영주 유형)을 알아보는 초등학생용 게임이에요.',
      button: '게임 하러 가기' };
  }
  function resultMsg(){
    let L = null, n = 0;
    try{ const d = META.dims || freshDims(); n = d.lives || 0; if(n) L = lordOf(d).lord; }catch(e){}
    if(!L) return inviteMsg();
    return { title: `${L.emoji} 섬의 영주 게임에서 나는 「${L.name}」!`,
      description: `${L.good} (${n}번의 생을 모아 본 결과)`, button: '나도 해 보기' };
  }

  /* ── 카카오 메시지 한 장 보내기 — m = { title, description, buttons:[{title, url}] } · 성공하면 true ── */
  const ready = () => !!KAKAO_SHARE.jsKey && webPage();
  async function sendFeed(m){
    if(!ready()) return false;
    try{
      const K = await loadSdk();
      if(!K.isInitialized()) K.init(KAKAO_SHARE.jsKey);
      const lk = u => ({ mobileWebUrl: u, webUrl: u }), btns = m.buttons && m.buttons.length ? m.buttons : [{ title: '게임 하러 가기', url: gameUrl() }];
      K.Share.sendDefault({ objectType: 'feed',
        content: { title: m.title, description: m.description, imageUrl: imageUrl(), imageWidth: 1200, imageHeight: 630, link: lk(btns[0].url) },
        buttons: btns.slice(0, 2).map(b => ({ title: b.title, link: lk(b.url) })) });
      return true;
    }catch(e){ console.warn('[카톡공유] 카카오 공유 실패', e); return false; }
  }
  const pdfUrl = path => new URL('pdf.html?f=' + encodeURIComponent(path), gameUrl()).href;

  /* ── 보내기 ── */
  function note(msg){ if(typeof toast === 'function') toast(msg); else alert(msg); }
  async function copyLink(url){
    try{ await navigator.clipboard.writeText(url); note('게임 주소를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.'); }
    catch(e){ prompt('아래 주소를 복사해 카카오톡에 붙여 넣어 주세요.', url); }
  }
  async function share(kind){
    const m = kind === 'result' ? resultMsg() : inviteMsg(), url = gameUrl();
    if(await sendFeed({ title: m.title, description: m.description, buttons: [{ title: m.button, url }] })) return;
    if(navigator.share && webPage()){
      try{ await navigator.share({ title: m.title, text: `${m.title}\n${m.description}`, url }); return; }
      catch(e){ if(e && e.name === 'AbortError') return; }
    }
    copyLink(url);
  }

  /* ── 버튼 ── */
  const css = document.createElement('style');
  css.textContent = `.kk-share{background:#FEE500!important;color:#191919!important}
    .kk-share[hidden]{display:none}`;
  document.head.appendChild(css);
  function addBtn(id, anchorSel, label, kind){
    if($('#' + id)) return $('#' + id);
    const a = $(anchorSel); if(!a) return null;
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'secondary kk-share'; b.textContent = label;
    b.onclick = () => share(kind); a.insertAdjacentElement('afterend', b); return b;
  }
  const isDemo = () => typeof DEMO !== 'undefined' && !!DEMO;
  addBtn('btn-kk-invite', '#btn-demo', '💬 카카오톡으로 게임 공유하기', 'invite');
  function endBtn(){ const b = addBtn('btn-kk-result', '#btn-book-end', '💬 카카오톡으로 결과 보내기', 'result'); if(b) b.hidden = isDemo(); }
  if(typeof window.finish === 'function'){
    const orig = window.finish;
    window.finish = function(){ const out = orig.apply(this, arguments); try{ endBtn(); }catch(e){} return out; };
  }
  endBtn();

  window.IslandKakao = { share, sendFeed, ready, pdfUrl, config: KAKAO_SHARE, url: gameUrl };
})();
