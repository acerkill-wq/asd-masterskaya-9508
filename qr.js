/* Римора: генератор QR-кода (ISO/IEC 18004, байтовый режим, уровни коррекции M и L, версии 1–40).
   Свой код без внешних библиотек, по общеизвестному алгоритму стандарта. RimoraQR(text) → {size, dark(x,y)}, RimoraQR.svg(text) → строка SVG. */
(function(){
const ECC={M:[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
           L:[-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30]};
const BLK={M:[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
           L:[-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25]};
const FMT={L:1,M:0};
const bit=(x,i)=>((x>>>i)&1)!==0;
function rawModules(v){let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r}
const dataCw=(v,e)=>Math.floor(rawModules(v)/8)-ECC[e][v]*BLK[e][v];
function gmul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z&255}
function rsDiv(deg){const r=new Array(deg).fill(0);r[deg-1]=1;let root=1;
  for(let i=0;i<deg;i++){for(let j=0;j<r.length;j++){r[j]=gmul(r[j],root);if(j+1<r.length)r[j]^=r[j+1]}root=gmul(root,2)}return r}
function rsRem(data,div){const r=div.map(()=>0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>r[i]^=gmul(c,f))}return r}
function alignPos(v,size){if(v===1)return [];const n=Math.floor(v/7)+2,step=Math.floor((v*8+n*3+5)/(n*4-4))*2,r=[6];
  for(let i=n-1,pos=size-7;i>=1;i--,pos-=step)r[i]=pos;return r}

function encode(text){
  const bytes=[...new TextEncoder().encode(text)];
  let v=0,e='M';
  for(const ee of ['M','L']){for(let vv=1;vv<=40;vv++){const cc=vv<10?8:16;if(4+cc+bytes.length*8<=dataCw(vv,ee)*8){v=vv;e=ee;break}}if(v)break}
  if(!v)throw new Error('Слишком длинный текст для QR-кода');
  // поток данных
  const bb=[];const put=(val,len)=>{for(let i=len-1;i>=0;i--)bb.push((val>>>i)&1)};
  put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
  const cap=dataCw(v,e)*8;put(0,Math.min(4,cap-bb.length));put(0,(8-bb.length%8)%8);
  for(let p=0xEC;bb.length<cap;p^=0xEC^0x11)put(p,8);
  const data=[];for(let i=0;i<bb.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bb[i+j];data.push(b)}
  // блоки и коррекция ошибок
  const nb=BLK[e][v],el=ECC[e][v],raw=Math.floor(rawModules(v)/8),nshort=nb-raw%nb,slen=Math.floor(raw/nb),div=rsDiv(el),blocks=[];
  for(let i=0,k=0;i<nb;i++){const d=data.slice(k,k+slen-el+(i<nshort?0:1));k+=d.length;const ecc=rsRem(d,div);if(i<nshort)d.push(0);blocks.push(d.concat(ecc))}
  const cw=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==slen-el||j>=nshort)cw.push(b[i])});
  // матрица
  const size=v*4+17,M=[...Array(size)].map(()=>new Array(size).fill(false)),F=[...Array(size)].map(()=>new Array(size).fill(false));
  const setF=(x,y,d)=>{M[y][x]=d;F[y][x]=true};
  for(let i=0;i<size;i++){setF(6,i,i%2===0);setF(i,6,i%2===0)}
  for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size)setF(x,y,d!==2&&d!==4)}
  const ap=alignPos(v,size);ap.forEach((ax,i)=>ap.forEach((ay,j)=>{if((i===0&&j===0)||(i===0&&j===ap.length-1)||(i===ap.length-1&&j===0))return;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setF(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}));
  const fmt=mask=>{const d=FMT[e]<<3|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=(d<<10|r)^0x5412;
    for(let i=0;i<=5;i++)setF(8,i,bit(b,i));setF(8,7,bit(b,6));setF(8,8,bit(b,7));setF(7,8,bit(b,8));for(let i=9;i<15;i++)setF(14-i,8,bit(b,i));
    for(let i=0;i<8;i++)setF(size-1-i,8,bit(b,i));for(let i=8;i<15;i++)setF(8,size-15+i,bit(b,i));setF(8,size-8,true)};
  fmt(0);
  if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=v<<12|r;
    for(let i=0;i<18;i++){const d=bit(b,i),a=size-11+i%3,c=Math.floor(i/3);setF(a,c,d);setF(c,a,d)}}
  let k=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;
    for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;
      if(!F[y][x]&&k<cw.length*8){M[y][x]=bit(cw[k>>>3],7-(k&7));k++}}}
  const MASK=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
    (x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  const apply=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&MASK[m](x,y))M[y][x]=!M[y][x]};
  // штраф: длинные ряды, квадраты 2×2, баланс тёмных (правило поисковых узоров упрощено)
  const penalty=()=>{let p=0,dark=0;
    for(let a=0;a<size;a++){let rr=1,rc=1;for(let b=1;b<size;b++){
      if(M[a][b]===M[a][b-1]){rr++;if(rr===5)p+=3;else if(rr>5)p++}else rr=1;
      if(M[b][a]===M[b-1][a]){rc++;if(rc===5)p+=3;else if(rc>5)p++}else rc=1}}
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=M[y][x];if(c===M[y][x+1]&&c===M[y+1][x]&&c===M[y+1][x+1])p+=3}
    M.forEach(r=>r.forEach(c=>{if(c)dark++}));p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;return p};
  let best=0,bp=Infinity;for(let m=0;m<8;m++){apply(m);fmt(m);const p=penalty();if(p<bp){bp=p;best=m}apply(m)}
  apply(best);fmt(best);
  return {size,version:v,ecc:e,dark:(x,y)=>M[y][x]};
}
encode.svg=(text,px=4,border=4)=>{const q=encode(text),n=q.size+border*2;let d='';
  for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.dark(x,y))d+=`M${x+border},${y+border}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n*px}" height="${n*px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`};
window.RimoraQR=encode;
})();
