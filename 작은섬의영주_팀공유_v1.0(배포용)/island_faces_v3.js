/* ============================================================
   island_faces_v3.js — 주사위 값(1~6)마다 다른 섬 모양
   dice_island_v3.html(출발 애니메이션)과 scene_v3.html(게임 섬)이 같이 쓴다
   → 주사위로 본 섬이 게임 내내 그대로 이어진다

   섬 크기 · 섬 모양 · 건물 자리 · 길은 6개 모두 같다(scene_v2.html 섬 그대로).
   다른 것: 영주 집 · 풀밭(색·결) · 나무 모양 · 꽃 · 땅 장식 · 작은 소품

     1 빚더미 영지    무너져 가는 집(구멍 난 지붕·판자 댄 창·버팀목) · 누렇게 마른 풀과 맨땅 · 마른 나무 · 그루터기 · 부서진 울타리
     2 가난한 어부    초가집(돌벽·그물·말리는 생선) · 바닷바람에 누운 풀 · 바늘잎 나무 · 물웅덩이 · 갈대 · 그물 말리는 틀
     3 평범한 섬      게임 v0.6.7 섬 그대로
     4 창고지기       농가 + 곡물 사일로 · 이삭이 섞인 풀밭 · 과일 나무 · 건초 더미 · 채소밭 · 곡식 자루
     5 상인 집안      2층 상점 집(파란 지붕·줄무늬 차양·간판) · 깎은 잔디 줄무늬 · 길쭉한 측백나무 · 돌 포장 마당 · 생울타리 · 가로등 · 짐 상자
     6 부유한 섬      금 지붕 저택(쌍둥이 탑·기둥) · 꽃이 가득한 진초록 풀밭 · 야자수 · 대리석 마당 · 꽃밭 · 분수 · 보물 상자

   쓰는 곳(두 HTML 모두 같은 자리):
     palette() 끝 → isleTint(P) · makeIsland() 풀 → isleGrass() · 꽃 → isleFlowers() · 끝 → isleDecor()
     BUILD.manor → ISLE_MANOR[ISLE]() · 나무 → isleTree() · 소품 → isleProps()
   ============================================================ */
'use strict';
let ISLE=3;   // 지금 섬 모양 = 주사위 값

/* ── 색 — 계절 색 위에 살짝 덧칠(겨울 눈 풀밭은 그대로) ── */
function isleTint(P){
  const g=(c,k)=>{ if(!P.snowy) ['grass','grassD','grassL'].forEach(n=>P[n]=mix(P[n],c,k)); };
  const path=(c,k)=>{ P.path=mix(P.path,c,k); P.pathL=mix(P.pathL,c,k); };
  if(ISLE===1){ g('#9A8A50',0.45); path('#7A6A58',0.35); }
  if(ISLE===2){ g('#2F6E5A',0.28); path('#A8A498',0.45); }
  if(ISLE===4){ g('#B8B84A',0.16); }
  if(ISLE===5){ g('#4FBF6A',0.15); path('#B4AEA2',0.6); }
  if(ISLE===6){ g('#2FC25A',0.25); path('#F6E6B4',0.6); }
  return P;
}

/* ── 풀밭 결 — makeIsland()가 풀 한 칸마다 부른다 (n: 덩어리 노이즈, b: 디더링 값) ── */
function isleGrass(x,y,col,n,b){
  if(ISLE===1){ const m=vnoise(x+200,y+40,7);                          // 맨땅이 드러난 자리 + 마른 풀 포기
    if(m>0.64){ const dirt=mix(P.path,'#5A4030',0.3); return hash(x,y+3)<0.08?shade(dirt,0.75):(m>0.7||b<0.5?dirt:col); }
    return hash(x,y)<0.03?'#B9A052':col; }
  if(ISLE===2){ if(n>0.42 && (x+Math.floor(y/2))%5===0) return P.grassD;   // 바람에 한쪽으로 누운 풀
    return hash(x+7,y)<0.02?P.grassL:col; }
  if(ISLE===4) return (!P.snowy && hash(x,y+11)<0.03)?'#E2C25A':col;      // 이삭
  if(ISLE===5) return Math.floor((x+(y-IS.cy)*0.8+400)/9)%2?mix(P.grass,P.grassL,0.55):P.grass;   // 깎은 잔디 줄무늬
  if(ISLE===6){ if(n>0.55) return P.grassL;                                 // 윤기 나는 풀 + 작은 꽃
    if(!P.snowy && hash(x+3,y+5)<0.035) return ['#F49AB7','#FFFFFF','#F2D05D','#C8A0F0'][Math.floor(hash(x,y+9)*4)]; return col; }
  return col;
}

/* ── 꽃 — 몇 송이 · 무슨 색 ── */
function isleFlowers(){
  if(P.snowy) return {n:ISLE===1?10:ISLE===6?110:60, c:P.flower};
  return { 1:{n:12,  c:['#8A7A4A','#9A8A5A']},
           2:{n:30,  c:['#FFFFFF','#C8DDE3']},
           3:{n:70,  c:P.flower},
           4:{n:70,  c:['#F2D05D',...P.flower]},
           5:{n:50,  c:P.flower},
           6:{n:140, c:['#F49AB7','#FFFFFF','#F2D05D','#B08AFF','#FF6A6A']} }[ISLE];
}

/* ── 땅 장식 — 섬 그림(캐시)에 바로 그린다. R은 makeIsland()의 칠하기 함수 ──
   자리: 마당 왼쪽(131,121) · 마당 오른쪽(186,121) · 가운데(162,134) · 앞쪽 띠(y 162~166) */
function isleDecor(x,R){
  const snow=P.snowy, F=FIELD;
  const frontY=X0=>{ let y=IS.cy; while(y<H&&lvl(X0,y+1,0)<=1) y++; return y; };   // 그 x에서 풀밭 앞 끝
  if(ISLE===1){
    [[131,121],[184,121],[150,164]].forEach(([sx,sy])=>{ R(sx-2,sy-2,4,2,'#7A5A3A'); R(sx-2,sy-2,4,1,snow?SNOW:'#A8835A'); R(sx-1,sy-2,1,1,'#5A3E28'); });   // 그루터기
    for(let i=0;i<F.w+2;i+=4){ if(i===8||i===20) continue; R(F.x-1+i,F.y+F.h+1,1,3,'#6A5038'); }   // 부서진 울타리(기둥 몇 개 빠짐)
    R(F.x+1,F.y+F.h+2,7,1,'#8A6A48'); for(let i=0;i<6;i++) R(F.x+13+i,F.y+F.h+1+Math.floor(i/3),1,1,'#8A6A48');   // 쓰러진 가로대
    for(let j=1;j<F.h;j+=2) for(let i=1;i<F.w;i+=3) if(hash(F.x+i,F.y+j)<0.55) R(F.x+i,F.y+j-1,1,2,'#8A6A45');   // 시든 밭
    [[156,130],[170,136]].forEach(([cx,cy])=>{ for(let k=0;k<7;k++) R(cx+k,cy+(k%3===1?1:0),1,1,'#5A4030'); });   // 땅 갈라짐
  }
  if(ISLE===2){
    [[131,122,6],[162,134,8],[186,121,5],[118,164,4]].forEach(([px,py,w])=>{ for(let j=-1;j<=1;j++){ const ww=j?w-2:w; R(px-ww,py+j,ww*2,1,snow?'#E2F0F4':mix(P.shallow,'#6A8A9A',0.3)); }
      R(px-w+2,py-1,2,1,'#FFFFFF'); });   // 물웅덩이
    [70,92,150,176,200,228,250].forEach((X0,k)=>{ const fy=frontY(X0); for(let s=0;s<3;s++){ const h=3+((k+s)%3); R(X0+s*2,fy-h,1,h,P.grassD); R(X0+s*2,fy-h,1,1,snow?SNOW:'#B8A870'); } });   // 갈대
    R(262,131,1,7,P.woodD); R(271,131,1,7,P.woodD); for(let j=0;j<5;j++) for(let i=0;i<8;i++) if((i+j)%2===0) R(263+i,132+j,1,1,'#D8CDB0');   // 그물 말리는 틀
    R(263,137,8,1,'#C8433A');
  }
  if(ISLE===4){
    [[131,121],[186,122],[150,165]].forEach(([hx,hy])=>{ [2,4,6,6].forEach((w,j)=>R(hx-w/2,hy-4+j,w,1,j===3?'#B8963A':snow&&j<2?SNOW:'#E2C25A')); R(hx-2,hy-3,1,1,'#F4DC88'); });   // 건초 더미
    const vx=154, vy=130; R(vx-1,vy-1,18,8,shade(mix(P.path,'#6B4425',0.45),0.7));   // 채소밭
    for(let j=0;j<6;j++){ R(vx,vy+j,16,1,j%2?mix(P.path,'#6B4425',0.45):shade(mix(P.path,'#6B4425',0.45),0.78));
      if(j%2) for(let i=1;i<16;i+=3) R(vx+i,vy+j-1,1,1,snow?SNOW:(i%2?'#5FAE4E':'#E0832E')); }
    for(let i=0;i<=F.w+2;i+=4) R(F.x-1+i,F.y+F.h+1,1,3,P.woodD); R(F.x-1,F.y+F.h+2,F.w+3,1,P.wood);   // 반듯한 울타리
  }
  if(ISLE===5){
    for(let j=-4;j<=4;j++){ const w=Math.round(14*Math.sqrt(1-(j/5)**2)); for(let i=-w;i<w;i++){ const X0=160+i, Y0=121+j;   // 돌 포장 마당
      R(X0,Y0,1,1,((X0+(j%2?2:0))%4===0||Y0%2===0&&hash(X0,Y0)<0.3)?'#9E988C':(hash(X0,Y0)<0.2?'#CCC6BA':'#B8B2A6')); } }
    [[127,119],[180,119]].forEach(([hx,hy])=>{ R(hx,hy,12,4,shade(P.tree,0.8)); R(hx+1,hy-1,10,1,snow?SNOW:P.treeL); R(hx,hy+3,12,1,P.treeD); });   // 생울타리
    [[142,124],[178,124]].forEach(([lx,ly])=>{ R(lx,ly-6,1,6,'#3A3A3A'); R(lx-1,ly-8,3,2,'#2E2A28'); R(lx,ly-8,1,1,'#FFE9A8'); });   // 가로등
    R(158,131,9,5,'#8D8A78'); R(159,132,7,3,'#6E6A60'); R(160,133,5,1,'#3A5E7A'); R(158,131,9,1,'#B3B0A2');   // 우물
  }
  if(ISLE===6){
    for(let j=-4;j<=4;j++){ const w=Math.round(14*Math.sqrt(1-(j/5)**2)); for(let i=-w;i<w;i++) R(160+i,121+j,1,1,(i+j+40)%4<2?'#F4EEDC':'#E2D8BE'); }   // 대리석 마당
    const fc=snow?[SNOW,'#E8EEF0']:['#F49AB7','#FFFFFF','#F2D05D','#B08AFF','#FF6A6A'];
    [[125,119],[181,119]].forEach(([bx,by])=>{ R(bx,by,14,5,'#D8D0C0'); R(bx+1,by+1,12,3,'#6A4A2E');   // 꽃밭
      for(let i=0;i<12;i++) for(let j=0;j<3;j++) if((i+j)%2===0) R(bx+1+i,by+1+j,1,1,fc[(i+j*3)%fc.length]); });
    for(let j=-3;j<=3;j++){ const w=Math.round(8*Math.sqrt(1-(j/3.6)**2)); R(162-w,135+j,w*2,1,'#E8E0D0'); }   // 분수
    for(let j=-2;j<=2;j++){ const w=Math.round(6*Math.sqrt(1-(j/2.6)**2)); R(162-w,135+j,w*2,1,snow?'#E2F0F4':'#5AB4DC'); }
    R(161,130,2,5,'#E8E0D0'); R(160,129,4,1,'#F2C14E'); R(161,128,2,1,'#FFFFFF'); R(159,134,1,1,'#FFFFFF'); R(164,136,1,1,'#FFFFFF');
    for(let i=0;i<30;i++){ const X0=110+Math.floor(hash(i,61)*104), Y0=162+Math.floor(hash(i,63)*4); if(lvl(X0,Y0,0)<0.97) R(X0,Y0,1,1,fc[i%fc.length]); }   // 앞쪽 꽃줄
  }
}

/* ── 영주 집 6가지 — 모두 44×40, 아래 가운데(22,39)가 자리. flag/smoke 위치 · 깃발 색은 buildingExtras가 쓴다 ── */
const ISLE_MANOR={
  /* 1 빚더미 — 구멍 난 지붕 · 기운 굴뚝(연기 없음) · 판자 댄 창 · 금 간 벽 · 버팀목 · 찢어진 회색 깃발 */
  1(){ const g=Grid(44,40), roof='#6A5E54', roofD='#4E443C', roofL='#857868', wall='#BFAE8E', wallSh='#A08E70', wd='#5E4A38', w='#7A6248', hole='#2A2420';
    g.r(30,8,4,6,'#7A6A5E'); g.p(30,7,'#7A6A5E'); g.p(31,6,'#7A6A5E');
    for(let y=11;y<=22;y++){ const k=22-y, x0=3+Math.round(k*1.25), x1=40-Math.round(k*1.25);
      g.h(x0,x1,y,roof); if(k%3===2) g.h(x0+1,x1-1,y,roofD); g.p(x0,y,roofL);
      for(let x=x0+2;x<x1;x++) if(hash(x,y)<0.07) g.p(x,y,roofD); }
    g.r(12,16,3,2,hole); g.p(13,15,hole); g.r(27,13,2,2,hole);                       // 구멍
    g.r(19,18,6,2,'#9A7A50'); g.p(20,18,INK); g.p(23,19,INK); g.r(32,17,3,2,'#8A6A44');   // 덧댄 판자
    g.h(5,38,23,roofD);
    g.r(6,24,32,14,wall); g.r(32,24,6,14,wallSh);
    for(let y=25;y<38;y++) for(let x=7;x<32;x++) if(hash(x,y+50)<0.1) g.p(x,y,shade(wall,0.86));
    g.h(6,37,24,wd); g.v(6,24,37,wd); g.v(37,24,37,wd);
    [[14,24],[15,25],[15,26],[16,27],[16,28],[17,29]].forEach(([x,y])=>g.p(x,y,'#5A4A3A'));   // 금
    [[34,30],[35,31],[35,32],[36,33]].forEach(([x,y])=>g.p(x,y,'#5A4A3A'));
    [9,30].forEach(wx=>{ g.r(wx,27,5,5,hole); g.h(wx-1,wx+5,28,w); g.h(wx-1,wx+5,30,w); g.p(wx,28,INK); g.p(wx+4,30,INK); });   // 판자로 막은 창
    g.r(19,29,6,9,hole); for(let y=30;y<=37;y++){ const s=y<33?0:1; g.h(20+s,22+s,y,w); } g.p(20,31,INK);   // 비뚤어진 문
    for(let i=0;i<=11;i++){ g.p(41-Math.round(i*0.4),37-i,wd); g.p(42-Math.round(i*0.4),37-i,w); }   // 버팀목
    g.h(5,11,38,'#7A776A'); g.h(13,26,38,'#7A776A'); g.h(28,38,38,'#7A776A'); g.h(16,27,39,'#8A887A');
    [[7,37],[8,36],[10,37],[26,37],[27,36],[35,37]].forEach(([x,y])=>g.p(x,y,'#8A9A4A'));   // 잡초
    if(P.snowy){ for(let y=11;y<=13;y++){ const k=22-y; g.h(3+Math.round(k*1.25),40-Math.round(k*1.25),y,SNOW); } g.p(31,6,SNOW); }
    g.outline(); return {c:g.canvas(), ax:22, ay:39, flag:[22,10], flagCol:'#8A847A', flagLen:4}; },

  /* 2 가난한 어부 — 둥근 초가지붕(새끼줄) · 돌벽 · 작은 창 · 그물 · 말리는 생선 */
  2(){ const g=Grid(44,40), th='#C9A85A', thD='#A8883E', thL='#E2C67E', st='#A8A498', stD='#86827A', stL='#C4C0B4';
    g.r(9,8,4,9,stD); g.h(8,13,7,st);                                                    // 돌 굴뚝
    const half=y=>Math.round(6+Math.sqrt((y-12)/15)*12+(y>=25?1:0));
    for(let y=12;y<=27;y++){ const x0=21-half(y), x1=22+half(y);
      for(let x=x0;x<=x1;x++){ let c=th; if((x+y*2)%5===0) c=thD; if(x<x0+2) c=thL; if(y>=26) c=thD; g.p(x,y,c); } }
    [17,22].forEach(y=>g.h(21-half(y)+1,22+half(y)-1,y,'#7A5E30'));                    // 새끼줄
    g.r(6,28,32,10,st);
    for(let y=28;y<38;y++){ const band=Math.floor((y-28)/3); for(let x=6;x<38;x++){ if((y-28)%3===2||(x+band*2)%5===0) g.p(x,y,stD); else if(hash(x,y)<0.12) g.p(x,y,stL); } }
    g.h(20,23,29,'#6A4A2E'); g.r(19,30,6,8,'#6A4A2E'); g.r(20,31,4,7,'#8A6440'); g.p(23,34,'#F2C14E');
    [9,31].forEach(wx=>{ g.r(wx,30,4,4,'#4A3A2E'); g.r(wx+1,31,2,2,'#FFE9A8'); });
    g.v(41,24,38,P.woodD); for(let y=27;y<=35;y++) for(let x=37;x<=40;x++) if((x+y)%2===0) g.p(x,y,'#D8CDB0');   // 그물
    g.p(38,36,'#C8433A'); g.p(40,36,'#C8433A');
    g.v(0,28,38,P.woodD); g.h(0,5,28,P.wood); [1,3,5].forEach(x=>{ g.v(x,29,31,'#A8B8C0'); g.p(x,32,'#8A98A0'); });   // 말리는 생선
    g.h(5,38,38,'#8D8A78');
    if(P.snowy){ for(let y=12;y<=15;y++) g.h(21-half(y),22+half(y),y,SNOW); g.h(8,13,7,SNOW); }
    g.outline(); return {c:g.canvas(), ax:22, ay:39, smoke:[10,6]}; },

  /* 3 평범한 섬 — 게임 v0.6.7 영주 집 그대로 */
  3(){ const g=Grid(44,40), roofL=mix(P.roof,'#FFFFFF',0.25);
    g.r(30,5,4,9,'#8D7A6A'); g.h(29,34,4,'#6E5E50');
    for(let y=10;y<=22;y++){ const k=22-y, x0=3+Math.round(k*1.25), x1=40-Math.round(k*1.25);
      g.h(x0,x1,y,P.roof); if(k%3===2) g.h(x0+1,x1-1,y,P.roofD); g.p(x0,y,roofL); g.p(x0+1,y,roofL); }
    g.h(18,25,10,P.roofD); g.h(5,38,23,P.roofD);
    g.r(6,24,32,14,P.wall); g.r(32,24,6,14,P.wallSh);
    g.h(6,37,24,P.woodD); [6,16,27,37].forEach(x=>g.v(x,24,37,P.woodD));
    g.r(19,29,6,9,P.woodD); g.r(20,30,4,8,P.wood); g.v(22,30,37,P.woodD); g.p(21,34,'#F2C14E'); g.h(20,23,28,P.woodD);
    [9,30].forEach(wx=>{ g.r(wx,27,5,5,P.woodD); g.r(wx+1,28,3,3,'#FFE9A8'); g.p(wx+1,28,'#FFF8D8'); g.v(wx+2,28,30,P.woodD); g.h(wx+1,wx+3,29,P.woodD); g.h(wx-1,wx+5,32,P.wood); });
    g.r(20,16,4,4,'#F2C14E'); g.r(21,17,2,2,'#C8433A');
    g.h(5,38,38,'#8D8A78'); g.h(16,27,39,'#A9A698');
    if(P.snowy){ for(let y=10;y<=13;y++){ const k=22-y; g.h(3+Math.round(k*1.25),40-Math.round(k*1.25),y,SNOW); } g.h(30,33,5,SNOW); [8,13,30,35].forEach((x,i)=>g.p(x,20-i%2,SNOW)); }
    g.outline(); return {c:g.canvas(), ax:22, ay:39, flag:[22,9], smoke:[32,3]}; },

  /* 4 창고지기 — 꺾인 지붕 농가(다락에 건초) + 둥근 곡물 사일로 · 노란 깃발 */
  4(){ const g=Grid(44,40), rf='#4E7A5A', rfD='#3A5E46', rfL='#6A9A72', pl='#B88A5A', plD='#946A42', trim='#EFE0BE';
    g.r(6,7,3,7,'#8D7A6A'); g.h(5,9,6,'#6E5E50');                                       // 굴뚝
    const half=y=>y<=12?Math.round(4+(y-8)*1.5):Math.round(10+(y-12)*0.4);
    for(let y=8;y<=23;y++){ const x0=15-half(y), x1=16+half(y); g.h(x0,x1,y,rf); g.p(x0,y,rfL); g.p(x0+1,y,rfL); if(y%3===0) g.h(x0+2,x1-1,y,rfD); }
    g.h(12,19,14,trim); g.r(13,15,6,6,'#5E3E26'); g.r(14,16,4,5,'#E2C25A'); g.p(15,16,'#F4DC88');   // 다락 건초
    g.h(2,29,24,rfD);
    g.r(3,25,26,13,pl); for(let y=26;y<38;y+=2) g.h(3,28,y,plD); g.v(3,25,37,trim); g.v(28,25,37,trim);
    g.r(11,29,10,9,trim); g.r(12,30,8,8,'#8A5A34'); for(let i=0;i<8;i++){ g.p(12+i,30+i,trim); g.p(19-i,30+i,trim); }
    [5,23].forEach(wx=>{ g.r(wx,28,4,4,'#5E3E26'); g.r(wx+1,29,2,2,'#FFE9A8'); });
    for(let y=12;y<=37;y++) for(let x=30;x<=41;x++) g.p(x,y, (y-12)%6===0?'#8A847A' : x<=31?'#E4DCCC' : x>=39?'#A8A090' : '#C8C0B0');   // 사일로
    [2,4,5,6,6,6].forEach((h,j)=>g.h(35-h,36+h,6+j,j<2?'#A87A54':'#8A5A3A')); g.r(35,18,2,3,'#3A2A20');
    g.h(2,42,38,'#8D8A78');
    if(P.snowy){ for(let y=8;y<=10;y++) g.h(15-half(y),16+half(y),y,SNOW); [2,4].forEach((h,j)=>g.h(35-h,36+h,6+j,SNOW)); }
    g.outline(); return {c:g.canvas(), ax:22, ay:39, flag:[35,5], flagCol:'#E8C35A', smoke:[7,5]}; },

  /* 5 상인 집안 — 2층 상점 집: 파란 지붕 · 지붕창 · 반쯤 목조 2층 · 벽돌 1층 · 줄무늬 차양 · 진열창 · 금화 간판 */
  5(){ const g=Grid(44,40), rf='#3E6A9A', rfD='#2E5078', rfL='#6A96C2', wl='#F2E8D4', tb='#6A4A32', br='#B4523E', brD='#8E3E2E';
    g.r(25,1,3,5,'#9A4E3B'); g.h(24,28,0,'#7A3A2E');
    for(let y=3;y<=13;y++){ const h=Math.round(6+(y-3)*1.1), x0=22-h, x1=21+h; g.h(x0,x1,y,rf); g.p(x0,y,rfL); g.p(x0+1,y,rfL); if(y%3===1) g.h(x0+2,x1-1,y,rfD); }
    [14,26].forEach(dx=>{ g.h(dx-1,dx+4,6,rfD); g.r(dx,7,4,4,wl); g.r(dx+1,8,2,2,'#FFE9A8'); });   // 지붕창
    g.h(4,39,14,rfD);
    g.r(5,15,34,11,wl); [5,13,22,30,38].forEach(x=>g.v(x,15,25,tb)); g.h(5,38,15,tb); g.h(5,38,25,tb);   // 2층
    [8,17,25].forEach(wx=>{ g.r(wx,17,4,5,'#FFE9A8'); g.v(wx+2,17,21,tb); g.v(wx-1,17,21,'#4E8A6A'); g.v(wx+4,17,21,'#4E8A6A'); });
    for(let x=7;x<=36;x++) if(x%2) g.p(x,24,'#3A2A20'); g.h(7,36,23,'#3A2A20');            // 난간
    g.r(5,26,34,12,br); for(let y=26;y<38;y++){ const band=Math.floor((y-26)/3); for(let x=5;x<39;x++) if((y-26)%3===2||(x+band*2)%4===0) g.p(x,y,brD); }
    for(let x=4;x<=39;x++){ const c=Math.floor((x-4)/3)%2?'#FFFFFF':rf; g.p(x,26,c); g.p(x,27,c); if((x-4)%3!==2) g.p(x,28,c); }   // 차양
    [[7,30],[28,30]].forEach(([vx,vy])=>{ g.r(vx,vy,9,6,'#3A2A20'); g.r(vx+1,vy+1,7,4,'#BFE0F0');
      [['#D2453A',1],['#F2C14E',3],['#4FA046',5],['#E0832E',6]].forEach(([c,i])=>g.p(vx+i,vy+4,c)); g.p(vx+2,vy+1,'#FFFFFF'); });
    g.r(19,30,6,8,'#3A2A20'); g.r(20,31,4,7,'#6A3E1E'); g.p(23,34,'#F2C14E');
    g.h(38,42,17,'#3A2A20'); g.v(39,18,18,'#3A2A20'); g.v(42,18,18,'#3A2A20'); g.r(39,19,4,4,'#F2C14E'); g.r(40,20,2,2,'#B88A1E');   // 간판
    g.h(4,39,38,'#8D8A78');
    if(P.snowy){ for(let y=3;y<=5;y++){ const h=Math.round(6+(y-3)*1.1); g.h(22-h,21+h,y,SNOW); } g.h(24,28,0,SNOW); }
    g.outline(); return {c:g.canvas(), ax:22, ay:39, flag:[22,2], flagCol:'#3E6A9A', smoke:[26,-1]}; },

  /* 6 부유한 섬 — 쌍둥이 탑 · 금 지붕 · 대리석 벽 · 기둥 · 빨간 휘장 · 금 깃발 */
  6(){ const g=Grid(44,40), G='#E8B83A', GD='#B88A1E', GL='#FFE08A', M='#F6EEDA', MS='#D8CCAA';
    for(let y=8;y<=17;y++){ const h=Math.round(4+(y-8)*1.0), x0=22-h, x1=21+h; g.h(x0,x1,y,G); g.p(x0,y,GL); g.p(x0+1,y,GL); if(y%2) g.h(x0+2,x1-1,y,GD); }
    g.r(19,4,6,4,G); g.h(20,23,3,GL); g.p(21,2,GL); g.p(22,2,GL);                       // 둥근 지붕
    g.r(10,18,24,20,M); g.r(30,18,4,20,MS); g.h(10,33,18,GD); g.h(10,33,27,GD);
    [12,16,26,30].forEach(x=>{ g.r(x,20,2,4,'#FFE9A8'); g.p(x,20,'#FFF8D8'); });
    [13,17,26,30].forEach(x=>{ g.v(x,28,37,'#FFFFFF'); g.v(x+1,28,37,MS); g.h(x-1,x+2,28,G); });   // 기둥
    g.r(19,29,6,9,'#6A3E1E'); g.h(19,24,28,G); g.p(21,33,G); g.p(22,33,G);
    [11,32].forEach(x=>{ g.r(x,19,2,6,'#C8433A'); g.p(x,25,G); g.p(x+1,25,G); });         // 휘장
    [5,38].forEach(cx=>{ for(let y=1;y<=10;y++){ const k=Math.round((y-1)*0.55); g.h(cx-k,cx+k,y,y<4?GL:G); if(y>4&&y%2) g.p(cx+k,y,GD); }   // 탑
      g.r(cx-4,11,9,27,M); g.v(cx+4,11,37,MS); g.h(cx-4,cx+4,11,GD);
      [14,22,30].forEach(wy=>{ g.r(cx-1,wy,2,3,'#FFE9A8'); g.p(cx-1,wy-1,G); g.p(cx,wy-1,G); }); });
    g.h(1,42,38,'#D8D0C0'); g.h(14,29,38,'#E8E0D0'); g.h(12,31,39,'#C8C0B0');
    if(P.snowy){ for(let y=8;y<=10;y++){ const h=Math.round(4+(y-8)); g.h(22-h,21+h,y,SNOW); } g.h(20,23,3,SNOW); [5,38].forEach(cx=>{ g.p(cx,1,SNOW); g.p(cx,2,SNOW); }); }
    g.outline(); return {c:g.canvas(), ax:22, ay:39, flag:[22,2], flagCol:'#F2C14E', smoke:null}; },
};

/* ── 나무 — drawTree()가 쓰는 잎 픽셀 목록 [i, j, 색, 흔들림 비율(0 꼭대기 → 1 밑동)]
   기준: 나무 자리 (x,y)에서 cy=y-4-r. 밑동 땅은 j=r+4. noTrunk면 기본 줄기를 그리지 않는다 ── */
function isleTree(r,seed){
  if(ISLE===1) return treeDead(r,seed);
  if(ISLE===2) return treePine(r,seed);
  if(ISLE===4) return treeFruit(r,seed);
  if(ISLE===5) return treeCypress(r,seed);
  if(ISLE===6) return P.snowy ? treePine(r,seed) : treePalm(r,seed);   // v0.6.9.3 겨울엔 야자수 대신 눈 덮인 바늘잎 나무
  return treePixels(r,seed);
}
function treeDead(r,seed){   // 마른 나무 — 잎 없이 가지만
  const px=[], B='#5A4E44', BL='#7A6A5A', fr=j=>Math.min(1,Math.max(0,(j+r)/(2*r+3)));
  const add=(i,j,c)=>px.push([i,j,c,fr(j)]);
  for(let j=-r+1;j<=r+3;j++){ add(0,j,B); if(j>r-2) add(-1,j,B); }
  const s=seed%2?1:-1;
  [[-r*0.1,s,0.9],[r*0.35,-s,0.7],[-r*0.6,-s,0.6]].forEach(([j0,dir,len])=>{ const L=Math.max(2,Math.round(r*len)); let i=0, j=Math.round(j0);
    for(let k=1;k<=L;k++){ i=dir*k; j=Math.round(j0)-Math.round(k*0.8); add(i,j,k===1?B:BL); }
    add(i,j-1,P.snowy?SNOW:BL); });
  add(1,-r,B); add(-1,-r-1,BL); add(1,-r-1,P.snowy?SNOW:BL);
  px.noTrunk=true; px.swayK=0.5; return px;
}
function treePine(r,seed){   // 바늘잎 나무 — 층층이 뾰족
  const px=[], c=mix(P.tree,'#1E5A4A',0.45), cd=mix(P.treeD,'#123E34',0.45), cl=mix(P.treeL,'#3E8A6A',0.35), out=shade(cd,0.7);
  const top=-r-3, bot=r;
  for(let j=top;j<=bot;j++){ const t=(j-top)/(bot-top), tier=(j-top)%3, w=Math.round(t*r*1.05*(0.7+tier*0.15));
    for(let i=-w;i<=w;i++){ let col=Math.abs(i)===w?out : i<0?(i>-w*0.5?c:cl) : (i>w*0.4?cd:c);
      if(P.snowy&&tier===0&&Math.abs(i)<w) col=SNOW; if(col===c&&hash(i+seed*7,j)<0.15) col=cd;
      px.push([i,j,col,(j-top)/(bot-top+1)]); } }
  return px;
}
function treeFruit(r,seed){   // 과일 나무 — 둥근 나무 + 봄 꽃 · 여름 사과 · 가을 귤빛 열매
  const px=treePixels(r,seed), out=shade(P.treeD,0.7);
  if(P.snowy) return px;
  const fc=P.season==='spring'?['#FFF0F4','#F7B6CB']:P.season==='autumn'?['#E8902A','#F2C14E']:['#D8433A','#F06050'];
  px.forEach(p=>{ if(p[2]!==out && hash(p[0]+seed*11,p[1]+seed*5)<0.1) p[2]=fc[(p[0]+p[1]+40)%2]; });
  return px;
}
function treeCypress(r,seed){   // 측백나무 — 길쭉하게 위로
  const px=[], c=mix(P.tree,'#2E6A3A',0.3), cd=mix(P.treeD,'#1E4A2A',0.3), cl=mix(P.treeL,'#5E9A4A',0.2), out=shade(cd,0.7);
  const rx=Math.max(2,Math.round(r*0.55)), ry=Math.round(r*1.6), j0=r-ry;
  for(let j=-ry-1;j<=ry+1;j++) for(let i=-rx-1;i<=rx+1;i++){ const d=Math.hypot(i/(rx+0.5),j/(ry+0.5)); if(d>1) continue;
    let col=d>0.82?out : (j+seed)%3===0?cd : i<0?cl : c;
    if(P.snowy&&j<-ry*0.3&&d<=0.82&&hash(i+seed,j)<0.6) col=SNOW;
    px.push([i,j+j0,col,(j+ry)/(2*ry)]); }
  return px;
}
function treePalm(r,seed){   // 야자수 — 휜 줄기 + 늘어진 잎 + 코코넛
  const px=[], H=r*2+4, lean=seed%2?1:-1;
  for(let k=0;k<H;k++){ const j=r+3-k, i=Math.round(lean*Math.pow(k/H,2)*3), col=k%3===0?'#7A5A38':'#9A7A50', f=1-k/H*0.9;
    px.push([i,j,col,f]); px.push([i+1,j,shade(col,0.8),f]); }
  const ti=Math.round(lean*3), tj=r+3-H;
  const g=P.snowy?'#6A9A7A':mix('#3E9A4A',P.tree,0.25), gd=shade(g,0.75), gl=mix(g,'#FFFFFF',0.25);
  [[-1,-0.3],[-0.8,-0.8],[-0.3,-1],[0.3,-1],[0.8,-0.8],[1,-0.3]].forEach(([dx,dy],n)=>{ const len=r+2;
    for(let s=1;s<=len;s++){ const X0=ti+Math.round(dx*s), Y0=tj+Math.round(dy*s*0.7+0.12*s*s);
      px.push([X0,Y0,s===len&&P.snowy?SNOW:(n<3?gl:g),0]); px.push([X0,Y0+1,gd,0]); } });
  [[-1,1],[1,1],[0,2]].forEach(([i,j])=>px.push([ti+i,tj+j,'#6A4A2A',0.1]));
  px.noTrunk=true; return px;
}

/* ── 소품 — 섬 위 깊이순으로 그리는 작은 스프라이트 {x, y(밑), sp} ── */
function isleSpr(w,h,fn){ const g=Grid(w,h); fn(g); g.outline(); return {c:g.canvas(), ax:Math.floor(w/2), ay:h-1}; }
function isleProps(){
  if(ISLE===1) return [{x:200,y:127, sp:isleSpr(16,6,g=>{ for(let i=0;i<6;i++) g.p(2+i,4-Math.floor(i/3),'#7A5A3A'); g.r(9,2,5,2,'#5E4A3E'); g.p(10,1,'#5E4A3E'); g.p(13,4,'#7A5A3A'); })}];   // 무너진 잔해
  if(ISLE===2) return [{x:58,y:160, sp:isleSpr(18,12,g=>{ g.v(2,2,10,'#6A4C32'); g.v(15,2,10,'#6A4C32'); g.h(2,15,2,'#8A6A48'); [5,8,11].forEach(x=>{ g.v(x,3,6,'#A8B8C0'); g.p(x,7,'#8A98A0'); }); })}];   // 생선 말리는 대
  if(ISLE===4) return [{x:106,y:143, sp:isleSpr(9,6,g=>{ g.r(1,2,3,3,'#E8D29A'); g.p(2,1,'#B89A5A'); g.r(5,2,3,3,'#E8D29A'); g.p(6,1,'#B89A5A'); g.r(3,1,3,3,'#F2E0AE'); g.p(4,0,'#B89A5A'); })}];   // 곡식 자루
  if(ISLE===5) return [{x:262,y:146, sp:isleSpr(16,10,g=>{ g.r(1,3,6,6,'#B8865A'); g.h(1,6,3,'#D8A878'); g.v(3,4,8,'#8A5E3A'); g.r(8,5,6,4,'#A87A4E'); g.h(8,13,5,'#C89868'); g.r(10,1,4,4,'#8A6A48'); g.h(10,13,1,'#A8885E'); })}];   // 짐 상자
  if(ISLE===6) return [{x:200,y:127, sp:isleSpr(14,10,g=>{ g.r(1,3,12,6,'#8A5A2A'); g.r(1,1,12,3,'#A86E34'); g.h(1,12,4,'#F2C14E'); g.v(6,1,8,'#F2C14E'); g.v(7,1,8,'#F2C14E'); g.r(6,4,2,2,'#FFF2A0'); g.p(3,0,'#F2C14E'); g.p(9,0,'#FFE080'); g.p(11,0,'#F2C14E'); })}];   // 보물 상자
  return [];
}
