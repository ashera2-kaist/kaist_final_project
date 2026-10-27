/* ============================================================
   작은 섬의 영주 v0.7 — 📕 금융 도감 책 PDF 만들기 · 카카오톡/Gmail 공유
   ------------------------------------------------------------
   불러오는 곳: 작은섬의영주_v0.7.html 맨 아래 <script src="book_share.js"> (게임 <script>보다 뒤)
   쓰는 라이브러리(lib 폴더, 처음 누를 때만 불러옴 · 인터넷 없어도 됨)
     lib/html2canvas.min.js  1.4.1  MIT — 책 쪽을 그림으로
     lib/jspdf.umd.min.js    2.5.1  MIT — 그림을 A4 PDF로
   흐름
     ① 📄 PDF 만들기 → 책 쪽(.bpage)을 A4 크기로 나눠(길면 항목 단위로 다음 쪽에) 그림으로 찍고 PDF 한 파일로 묶는다
     ② 📤 카톡·메일로 보내기 → 기기의 공유 창(Web Share). 카카오톡 · Gmail · 메시지 등 설치된 앱이 뜬다
        (공유 창은 버튼을 "누른 순간"에만 열 수 있어서 ①과 ②를 두 번에 나눠 누르게 했다)
     ③ 공유 창이 없는 곳(PC 브라우저 · 카카오톡 안 브라우저 · 파일로 연 경우 일부) → ⬇️ PDF 내려받기만 보인다
   한글 글꼴을 PDF에 넣지 않아도 되도록 쪽마다 그림으로 넣는다(글자 선택은 안 됨, 대신 화면과 똑같이 보임)
   콘솔에서: BookShare.make() → {blob, pages} · BookShare.state
   ============================================================ */
(function(){
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src) || location.href;
  const LIBS = ['lib/html2canvas.min.js', 'lib/jspdf.umd.min.js'];
  const A4 = { w: 210, h: 297, m: 12 };                    // mm
  const SHEET_W = 704, SHEET_H = 1033;                     // A4 안쪽(여백 12mm)을 96dpi 픽셀로
  const SCALE = 2, JPEG_Q = 0.85;
  const $ = s => document.querySelector(s);
  const IN_KAKAO = /KAKAOTALK/i.test(navigator.userAgent);

  /* ── 라이브러리 늦게 불러오기 ── */
  let libsP = null;
  function loadLibs(){
    if(window.html2canvas && window.jspdf) return Promise.resolve();
    return libsP || (libsP = Promise.all(LIBS.map(src => new Promise((ok, bad) => {
      const s = document.createElement('script'); s.src = new URL(src, BASE).href;
      s.onload = ok; s.onerror = () => bad(new Error(src + ' 를 불러오지 못했어요 (lib 폴더 확인)'));
      document.head.appendChild(s);
    }))).catch(e => { libsP = null; throw e; }));
  }

  /* ── PDF용 배치 — 인쇄(@media print) 규칙을 화면 밖 상자에 똑같이 ── */
  const css = document.createElement('style');
  css.textContent = `
    .pdfroot{position:absolute;left:-30000px;top:0;width:${SHEET_W}px;background:#fff}
    .pdfroot .bpage{width:${SHEET_W}px;box-shadow:none;border-width:2px;margin:0 0 24px}
    .pdfroot .entries{grid-template-columns:1fr 1fr}
    .pdfroot .cover{min-height:${SHEET_H}px;display:flex;flex-direction:column;justify-content:center;border-width:6px}
    .pdfroot .cv-art canvas{width:160px;height:160px}
    .pdfroot .apx-grid{grid-template-columns:repeat(4,1fr);gap:6px}
    .pdfroot .apx{padding:5px 4px;font-size:12px}
    .pdfroot .apx canvas{width:36px;height:36px}
    .pdfroot .apx .em{font-size:22px;line-height:36px;height:36px}
    .book-actions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}
    .book-bar .book-actions button{width:auto;margin:0;padding:10px 12px;font-size:15px}
    .book-actions button[hidden]{display:none}
    .book-bar .book-actions .ghost{padding:8px 6px}
    #book-hint.busy{color:#8A6410;font-weight:700}`;
  document.head.appendChild(css);

  const isEl = n => n.nodeType === 1;
  const SPLIT = n => isEl(n) && (n.classList.contains('entries') || n.classList.contains('apx-grid') || n.tagName === 'UL' || n.tagName === 'OL');
  /* 한 쪽(.bpage)을 A4 높이에 맞게 여러 장으로 — 항목(entry · 칸 · 목록 줄) 단위로 넘긴다 */
  function paginate(root, page){
    const sheets = [];
    const fresh = () => { const s = page.cloneNode(false); root.appendChild(s); sheets.push(s); return s; };
    const over = s => s.offsetHeight > SHEET_H;
    const used = s => [...s.childNodes].some(isEl);
    const carry = (from, to) => { const last = [...from.children].pop(); if(last && /^H[2-4]$/.test(last.tagName)) to.appendChild(last); };   // 제목만 남지 않게
    let sh = fresh();
    for(const k of [...page.childNodes]){
      sh.appendChild(k);
      if(!isEl(k) || !over(sh)) continue;
      sh.removeChild(k);
      if(SPLIT(k)){
        let box = k.cloneNode(false); sh.appendChild(box);
        for(const it of [...k.children]){
          box.appendChild(it);
          if(!over(sh)) continue;
          box.removeChild(it);
          if(!box.children.length) sh.removeChild(box);
          const prev = sh; sh = fresh(); carry(prev, sh);
          box = k.cloneNode(false); sh.appendChild(box); box.appendChild(it);
        }
      } else {
        if(used(sh)){ const prev = sh; sh = fresh(); carry(prev, sh); }
        sh.appendChild(k);
      }
    }
    return sheets.filter(used);
  }
  /* 픽셀 그림(canvas)은 복사하면 비어 있으므로 다시 그리고, 흐려지지 않게 2배로 미리 키워 둔다 */
  function copyCanvases(src, dst){
    const a = [...src.querySelectorAll('canvas')], b = [...dst.querySelectorAll('canvas')];
    b.forEach((c, i) => { const o = a[i]; if(!o) return; c.getContext('2d').drawImage(o, 0, 0); });
  }
  function crispCanvases(sheet){
    sheet.querySelectorAll('canvas').forEach(c => {
      const r = c.getBoundingClientRect(); if(!r.width) return;
      const big = document.createElement('canvas'); big.width = Math.round(r.width * SCALE); big.height = Math.round(r.height * SCALE);
      const x = big.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, big.width, big.height);
      big.className = c.className; big.style.cssText = c.style.cssText + `;width:${r.width}px;height:${r.height}px`;
      c.replaceWith(big);
    });
  }

  /* ── PDF 만들기 ── */
  async function make(progress){
    await loadLibs();
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    const pages = [...document.querySelectorAll('#book-pages .bpage')];
    if(!pages.length) throw new Error('책 쪽이 없어요');
    const root = document.createElement('div'); root.className = 'pdfroot'; document.body.appendChild(root);
    try{
      const sheets = [];
      pages.forEach(p => { const c = p.cloneNode(true); copyCanvases(p, c); sheets.push(...paginate(root, c)); });
      sheets.forEach(crispCanvases);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const aw = A4.w - 2 * A4.m, ah = A4.h - 2 * A4.m;
      for(let i = 0; i < sheets.length; i++){
        progress && progress(i + 1, sheets.length);
        const cv = await window.html2canvas(sheets[i], { scale: SCALE, backgroundColor: '#ffffff', logging: false, useCORS: true });
        let w = aw, h = aw * cv.height / cv.width; if(h > ah){ h = ah; w = ah * cv.width / cv.height; }
        if(i) doc.addPage();
        doc.addImage(cv.toDataURL('image/jpeg', JPEG_Q), 'JPEG', (A4.w - w) / 2, A4.m, w, h, undefined, 'FAST');
        await new Promise(r => setTimeout(r));        // 화면이 멈추지 않게 한 쪽씩 쉬어 감
      }
      return { blob: doc.output('blob'), pages: sheets.length };
    } finally { root.remove(); }
  }

  /* ── 화면 (책 화면 위 버튼 줄) ── */
  const state = { file: null, pages: 0, busy: false };
  const hintEl = () => $('#book-hint');
  const HINT0 = '📄 PDF 만들기를 누르면 책이 PDF 파일 하나로 만들어져요. 그다음 카카오톡·Gmail로 보내거나 내려받을 수 있어요. 이름은 저장되지 않아요.';
  function hint(t, busy){ const h = hintEl(); if(!h) return; h.textContent = t; h.classList.toggle('busy', !!busy); }
  const bookName = () => (($('#book-name') && $('#book-name').value) || '').trim() || '나';
  const fileName = () => `${bookName().replace(/[\\/:*?"<>|]/g, '')}의_금융도감.pdf`;
  const canShareFile = f => !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] }));
  const mb = n => (n / 1048576).toFixed(1) + 'MB';

  function reset(){
    state.file = null; state.pages = 0;
    const p = $('#book-pdf'), s = $('#book-share'), d = $('#book-dl');
    if(p){ p.hidden = false; p.disabled = false; p.textContent = '📄 PDF 만들기'; }
    if(s) s.hidden = true; if(d) d.hidden = true;
    if(!state.busy) hint(HINT0);
  }
  async function onMake(){
    if(state.busy) return; state.busy = true;
    const p = $('#book-pdf'); p.disabled = true; p.textContent = '⏳ 만드는 중…';
    hint('PDF를 만드는 중이에요…', true);
    try{
      const r = await make((i, n) => hint(`PDF를 만드는 중이에요… (${i}/${n}쪽)`, true));
      state.file = new File([r.blob], fileName(), { type: 'application/pdf' }); state.pages = r.pages;
      p.hidden = true; $('#book-dl').hidden = false;
      const share = canShareFile(state.file); $('#book-share').hidden = !share;
      hint(share ? `준비됐어요! (${r.pages}쪽 · ${mb(r.blob.size)}) 📤를 누르고 카카오톡이나 Gmail을 골라 보내세요.`
        : `준비됐어요! (${r.pages}쪽 · ${mb(r.blob.size)}) 이 기기·브라우저에서는 바로 보내기를 쓸 수 없어요. ⬇️로 내려받은 뒤 카카오톡이나 메일에 붙여 보내 주세요.`
          + (IN_KAKAO ? ' 카카오톡 안에서 열었다면 오른쪽 위 ⋮ → "다른 브라우저로 열기"를 누르면 바로 보낼 수 있어요.' : ''));
    }catch(e){
      console.warn('[도감 PDF]', e); p.disabled = false; p.textContent = '📄 PDF 만들기';
      hint('PDF를 만들지 못했어요. 🖨️ 인쇄 → "PDF로 저장"을 써 주세요. (' + (e && e.message || e) + ')');
    }finally{ state.busy = false; }
  }
  async function onShare(){
    if(!state.file) return;
    try{
      await navigator.share({ files: [state.file], title: `${bookName()}의 금융 도감`, text: `「작은 섬의 영주」에서 만든 ${bookName()}의 금융 도감이에요.` });
      hint('보냈어요! 다른 사람에게도 보내려면 📤를 한 번 더 누르세요.');
    }catch(e){
      if(e && e.name === 'AbortError') return;                                   // 공유 창을 그냥 닫음
      console.warn('[도감 공유]', e);
      hint('보내기가 안 됐어요. ⬇️로 내려받은 뒤 카카오톡이나 메일에 붙여 보내 주세요.');
    }
  }
  function onDownload(){
    if(!state.file) return;
    const u = URL.createObjectURL(state.file), a = document.createElement('a');
    a.href = u; a.download = state.file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
    hint('내려받았어요. 다운로드 폴더의 "' + state.file.name + '"를 카카오톡이나 메일에 붙여 보내면 돼요.');
  }

  const bind = (id, fn) => { const b = $(id); if(b) b.addEventListener('click', fn); else console.warn('[도감 PDF] 버튼 없음:', id); };
  bind('#book-pdf', onMake); bind('#book-share', onShare); bind('#book-dl', onDownload);
  /* 책 내용이 바뀌면(이름 입력 · 다시 열기) 만든 PDF는 버리고 처음 상태로 */
  if(typeof window.renderBook === 'function'){
    const orig = window.renderBook;
    window.renderBook = function(){ const r = orig.apply(this, arguments); reset(); return r; };
  } else console.warn('[도감 PDF] renderBook을 못 찾음');
  const nameIn = $('#book-name'); if(nameIn) nameIn.addEventListener('input', reset);
  reset();

  window.BookShare = { make, state, reset };
})();
