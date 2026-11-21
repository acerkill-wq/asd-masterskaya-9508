/* Римора: импорт сплит-формы индексов и сметных цен для ценовой зоны (Excel, ФГИС ЦС / ГРАНД-Смета).
   Одна сплит-форма = одна ценовая зона и один квартал. Графы: 1 код, 2 наименование, 3 единица, 4 отпускная цена 01.01.2022,
   5 сметная цена 01.01.2022, 6 номер группы однородных ресурсов, 7 название группы, 8 сметная цена в текущем уровне, 9 индекс к группе.
   Файл читается в браузере по частям (распакованный лист — около 110 МБ), ничего не отправляется на сервер.
   Результат — те же структуры, что у цен ФГИС ЦС в data/prices (D — цены зоны, G — группы) и data/transport (T — перевозка),
   плюс примечания региона и список групп без индекса (такие ресурсы — только по конъюнктурному анализу). */
window.RimoraSplit=function(ctx){
'use strict';
const {loadJs}=ctx;

/* ---------- zip: центральный каталог, поток распаковки ---------- */
function zipDir(buf){const dv=new DataView(buf),u8=new Uint8Array(buf);let e=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-66000);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw new Error('это не файл Excel (.xlsx)');
  const n=dv.getUint16(e+10,true);let o=dv.getUint32(e+16,true);const out={},td=new TextDecoder();
  for(let i=0;i<n;i++){if(dv.getUint32(o,true)!==0x02014b50)throw new Error('файл Excel повреждён');
    const meth=dv.getUint16(o+10,true),cs=dv.getUint32(o+20,true),us=dv.getUint32(o+24,true),nl=dv.getUint16(o+28,true),xl=dv.getUint16(o+30,true),cl=dv.getUint16(o+32,true),lho=dv.getUint32(o+42,true);
    const name=td.decode(u8.subarray(o+46,o+46+nl));out[name]={meth,cs,us,lho};o+=46+nl+xl+cl}
  return out}
function entryStream(buf,en){const dv=new DataView(buf),l=en.lho,start=l+30+dv.getUint16(l+26,true)+dv.getUint16(l+28,true);
  const raw=new Blob([new Uint8Array(buf,start,en.cs)]).stream();
  if(en.meth===0)return raw;if(en.meth!==8)throw new Error('неизвестное сжатие в файле Excel');
  return raw.pipeThrough(new DecompressionStream('deflate-raw'))}
// элементы <tag>…</tag> по одному, без загрузки всего текста; onBytes — прогресс по распакованным байтам
async function eachEl(stream,tag,fn,onBytes){const rd=stream.pipeThrough(new TextDecoderStream()).getReader();
  const open='<'+tag,close='</'+tag+'>';let buf='',n=0;
  for(;;){const {value,done}=await rd.read();if(done)break;buf+=value;n+=value.length;if(onBytes)onBytes(n);
    let p=0;for(;;){const a=buf.indexOf(open,p);if(a<0){p=Math.max(p,buf.length-open.length+1);break}
      const gt=buf.indexOf('>',a);if(gt<0){p=a;break}
      if(buf[gt-1]==='/'){fn(buf.slice(a,gt+1),'');p=gt+1;continue}
      const b=buf.indexOf(close,gt);if(b<0){p=a;break}
      fn(buf.slice(a,gt+1),buf.slice(gt+1,b));p=b+close.length}
    buf=buf.slice(p)}}
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
const unesc=s=>s.indexOf('&')<0?s:s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi,(m,c)=>c[0]==='#'?String.fromCodePoint(c[1]==='x'||c[1]==='X'?parseInt(c.slice(2),16):+c.slice(1)):ENT[c]??m);
const tText=s=>{let r='';const re=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;let m;while((m=re.exec(s)))r+=m[1];return unesc(r)};

/* ---------- чтение листа: строки как массивы A…I ---------- */
async function readRows(file,onProgress,onRow){const buf=await file.arrayBuffer(),Z=zipDir(buf);
  const sheet=Object.keys(Z).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];if(!sheet)throw new Error('в файле нет листа');
  const SS=[];const total=(Z['xl/sharedStrings.xml']?Z['xl/sharedStrings.xml'].us:0)+Z[sheet].us;let done1=0;
  if(Z['xl/sharedStrings.xml'])await eachEl(entryStream(buf,Z['xl/sharedStrings.xml']),'si',(h,b)=>SS.push(tText(b)),n=>{done1=n;onProgress&&onProgress(n/total)});
  const COL={A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8},cre=/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  await eachEl(entryStream(buf,Z[sheet]),'row',(h,b)=>{const row=new Array(9).fill(null);let m;cre.lastIndex=0;
    while((m=cre.exec(b))){const ci=COL[m[1]];if(ci==null||m[3]==null)continue;const t=/t="(\w+)"/.exec(m[2]),ty=t?t[1]:'';
      if(ty==='inlineStr'){row[ci]=tText(m[3]);continue}const v=/<v>([^<]*)<\/v>/.exec(m[3]);if(!v)continue;
      row[ci]=ty==='s'?SS[+v[1]]:unesc(v[1])}
    onRow(row)},n=>onProgress&&onProgress((done1+n)/total))}

/* ---------- сборка цен зоны ---------- */
const num=v=>{if(v==null)return null;const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(s===''||s==='-')return null;const x=+s;return isFinite(x)?x:null};
const RE={mat:/^\d\d\.\d\.\d\d\.\d\d-\d{4}$/,mach:/^91\.\d\d\.\d\d-\d{3}$/,lab:/^[1-5]-\d{3}-\d+$/,tr:/^\d\d-\d\d-\d-\d\d-\d{4}$/,load:/^\d{1,2}-[12]$/,rail:/^\d{6}-\d\d-\d{4}-\d{4}$/};
const pidOf=(q,y)=>421+(y-2025)*4+(q-1);
async function parse(file,onProgress){
  const H=[],notes=[];let hdr=-1,ri=0;
  const D={meta:{},lab:{},m:{},e:{},gim:[],gie:[]},G={gm:[],ge:[],m:{},e:{},drv:{},nm:[],ne:[]},GI={m:new Map(),e:new Map()};
  const tr={},cnt={mat:0,matCur:0,matIdx:0,matNone:0,mach:0,machCur:0,machIdx:0,machNone:0,lab:0,tr:0,load:0,rail:0,other:0,idxConflict:0};
  const noIdx={m:new Map(),e:new Map()};
  const grp=(kind,name,no)=>{const M=GI[kind];let i=M.get(name);if(i==null){i=G['g'+kind].length;G['g'+kind].push(name);G['n'+kind].push(no);M.set(name,i)}return i};
  await readRows(file,onProgress,row=>{ri++;const a=row[0]==null?'':String(row[0]).trim();
    if(hdr<0){if(/^Код ресурса/i.test(a)){hdr=ri;return}H.push(row);if(/^\d+\.\s/.test(a)&&!notes.includes(a))notes.push(a);return}
    if(ri===hdr+1&&a==='1')return;
    const cur=num(row[7]),idx=num(row[8]),gname=row[6]&&String(row[6]).trim()!=='-'?String(row[6]).trim():null,gno=num(row[5]);
    if(RE.mat.test(a)||RE.mach.test(a)){const k=RE.mat.test(a)?'m':'e',w=k==='m'?'mat':'mach';cnt[w]++;
      if(cur!=null){D[k][a]=[cur,null];cnt[w+'Cur']++}
      if(gname){const gi=grp(k,gname,gno);G[k][a]=gi;const arr=k==='m'?D.gim:D.gie;
        if(idx!=null){if(arr[gi]==null)arr[gi]=idx;else if(Math.abs(arr[gi]-idx)>1e-9)cnt.idxConflict++;cnt[w+'Idx']++}
        else if(cur==null){cnt[w+'None']++;noIdx[k].set(gname,(noIdx[k].get(gname)||0)+1)}}
      else if(cur==null)cnt[w+'None']++;
      return}
    if(RE.lab.test(a)){if(cur!=null){D.lab[a]=cur;cnt.lab++}return}
    if(RE.tr.test(a)){if(cur!=null){tr[a]=cur;cnt.tr++}return}
    if(RE.load.test(a)){tr[a]=cur;cnt.load++;return}
    if(RE.rail.test(a)){cnt.rail++;return}
    if(a)cnt.other++});
  if(hdr<0)throw new Error('не найдена таблица «Код ресурса, услуги». Это точно сплит-форма?');
  const hv=lbl=>{const r=H.find(r=>r[0]&&new RegExp(lbl,'i').test(String(r[0])));return r?String(r[6]??r[7]??'').trim():''};
  const title=String((H[0]||[])[0]||''),q=/на\s+(\d)\s+квартал\s+(\d{4})/i.exec(title);
  if(!q)throw new Error('в заголовке не найден квартал («на N квартал ГГГГ года»)');
  const quarter=`${q[1]} квартал ${q[2]} г.`,pid=pidOf(+q[1],+q[2]);
  const subject=hv('Наименование субъекта'),zone=hv('Наименование зоны')||subject,letter=hv('Реквизиты письма'),wageAct=hv('оплаты труда');
  for(const k of ['gim','gie']){const n=G[k==='gim'?'gm':'ge'].length;for(let i=0;i<n;i++)if(D[k][i]===undefined)D[k][i]=null}
  return {D,G,tr,cnt,notes,quarter,pid,subject,zone,letter,wageAct,file:file.name,
    noIdx:{m:[...noIdx.m].map(([n,c])=>({name:n,no:G.nm[GI.m.get(n)],count:c})),e:[...noIdx.e].map(([n,c])=>({name:n,no:G.ne[GI.e.get(n)],count:c}))}}}

/* ---------- водители машин и перевозка: берём каталог из данных Риморы ---------- */
const jsKey=(o,pre)=>Object.keys(o||{}).filter(k=>!pre||k.startsWith(pre));
async function drvMap(pid){if(window.RDRV)return window.RDRV;const R=()=>window.RGROUPS||{};let p=Object.keys(R())[0];
  if(!p){const ps=Object.keys((window.PRICE_INDEX||{}).periods||{}).map(Number).sort((a,b)=>Math.abs(a-pid)-Math.abs(b-pid));
    for(const x of ps){try{await loadJs('data/prices/'+x+'/g.js');p=x;break}catch(e){}}}
  return p&&R()[p]?R()[p].drv||{}:{}}
async function trTemplate(zid,pid){const TS=()=>window.TRSET||{},I=window.TR_INDEX||{};
  const k=jsKey(TS()).find(k=>TS()[k].combos&&TS()[k].combos.length);if(k)return TS()[k];
  const cands=[...new Set(jsKey(I,zid+'_').concat(jsKey(I,'166_'),jsKey(I)))];
  for(const c of cands){const [z,p]=c.split('_');try{await loadJs(`data/transport/${p}/${z}.js`);if(TS()[c])return TS()[c]}catch(e){}}
  return null}
const RAT=[0.85,0.6,0.45];
function buildTR(tpl,tr,meta){if(!tpl)return {T:null,miss:0,combos:0};let miss=0;const combos=[],x=[];
  for(const c of tpl.combos){const code=c.code,p1=[];for(let km=1;km<=1500;km++){const v=tr[code+String(km).padStart(4,'0')];if(v==null)break;p1.push(Math.round(v*100))}
    if(!p1.length){miss++;continue}const ci=combos.length;
    combos.push({road:c.road,veh:c.veh,cap:c.cap,code,n:c.n,d:p1.map((v,i)=>i?v-p1[i-1]:v)});
    for(let k=0;k<p1.length;k++)for(let cl=2;cl<=c.n;cl++){const v=tr[code.slice(0,6)+cl+code.slice(7)+String(k+1).padStart(4,'0')];if(v==null)continue;
      const der=Math.round(p1[k]/100/RAT[cl-2]*100)/100;if(Math.abs(der-v)>0.004)x.push([ci,k,cl,Math.round(v*100)])}}
  const loads=(tpl.loads||[]).map(([nm,lc,lp,uc,up])=>[nm,lc,tr[lc]??0,uc,tr[uc]??0]);
  return {T:{meta,roads:tpl.roads,combos,x,loads},miss,combos:combos.length}}

/* ---------- сверка с ценами ФГИС ЦС, если они есть в Риморе ---------- */
function compare(set,OD,OG,OT){const r={};const add=(k,a,b)=>{const o=r[k]||(r[k]={eq:0,ne:0,ex:[]});if(a==null||b==null)return;if(Math.abs(a-b)<0.005)o.eq++;else{o.ne++;if(o.ex.length<5)o.ex.push([a,b])}};
  const {D,G}=set;
  for(const [rc,v] of Object.entries(D.m))add('материалы, текущие цены',v[0],(OD.m[rc]||[])[0]);
  for(const [rc,v] of Object.entries(D.e))add('машины, текущие цены',v[0],(OD.e[rc]||[])[0]);
  for(const [c,v] of Object.entries(D.lab))add('оплата труда',v,OD.lab[c]);
  if(OG){const om=new Map(OG.gm.map((n,i)=>[n,OD.gim[i]])),oe=new Map(OG.ge.map((n,i)=>[n,OD.gie[i]]));
    G.gm.forEach((n,i)=>add('индексы групп материалов',D.gim[i],om.get(n)));G.ge.forEach((n,i)=>add('индексы групп машин',D.gie[i],oe.get(n)))}
  if(OT&&set.T){const key=c=>c.road+'|'+c.veh+'|'+c.cap,om=new Map(OT.combos.map(c=>[key(c),c]));
    const cum=o=>{if(o.p)return o.p.map(x=>Math.round(x[0]*100));let s=0;return (o.d||[]).map(v=>s+=v)};
    for(const c of set.T.combos){const o=om.get(key(c));if(!o)continue;const ob=cum(o),oa=cum(c);
      for(let k=0;k<Math.min(oa.length,ob.length);k++)add('перевозка, I класс груза',oa[k]/100,ob[k]/100)}}
  return r}

/* ---------- хранение в браузере (IndexedDB): сплит-форма весит несколько МБ, в localStorage не помещается ---------- */
const DB='rimora',ST='split';
function db(){return new Promise((ok,bad)=>{try{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(ST))q.result.createObjectStore(ST,{keyPath:'key'})};q.onsuccess=()=>ok(q.result);q.onerror=()=>bad(q.error)}catch(e){bad(e)}})}
async function tx(mode,fn){const d=await db();return new Promise((ok,bad)=>{const t=d.transaction(ST,mode),s=t.objectStore(ST);let r;const q=fn(s);if(q)q.onsuccess=()=>{r=q.result};t.oncomplete=()=>ok(r);t.onerror=()=>bad(t.error);t.onabort=()=>bad(t.error)})}
const save=set=>tx('readwrite',s=>s.put(set));
const list=()=>tx('readonly',s=>s.getAll()).then(r=>r||[]).catch(()=>[]);
const del=key=>tx('readwrite',s=>s.delete(key));

/* ---------- полный импорт ---------- */
async function importFile(file,onProgress,zoneIdOf){
  const P=await parse(file,f=>onProgress&&onProgress(Math.min(0.95,f*0.95)));
  const zid=zoneIdOf(P.subject,P.zone),key=zid+'_'+P.pid,I=window.PRICE_INDEX||{},L=(I.letters||{})[P.quarter];
  const drv=await drvMap(P.pid);for(const rc of Object.keys(P.G.e))if(drv[rc])P.G.drv[rc]=drv[rc];
  for(const rc of Object.keys(P.D.e)){const d=drv[rc];P.D.e[rc][1]=d&&P.D.lab[d]!=null?P.D.lab[d]:null}
  const taken=new Date().toLocaleDateString('ru-RU');
  const meta={subject:P.subject,zone:P.zone,quarter:P.quarter,base:'01.01.2022',source:'Сплит-форма «'+P.file+'»',taken,authority:'',letter:P.letter,
    frsn:L?L.frsn:null,zoneId:zid,period:P.pid,wageAct:P.wageAct,split:true};
  P.D.meta=meta;
  const tpl=await trTemplate(zid,P.pid),TB=buildTR(tpl,P.tr,{...meta});
  const set={key,zid,pid:P.pid,file:P.file,taken,meta,D:P.D,G:P.G,T:TB.T,cnt:{...P.cnt,trCombos:TB.combos,trMiss:TB.miss},notes:P.notes,noIdx:P.noIdx};
  // сверка с ФГИС ЦС, если цены этой зоны и квартала уже есть в Риморе
  let cmp=null;const off=(I.subjects||[]).some(s=>s.zones.some(z=>z.id===zid&&(z.offP||z.p).includes(P.pid)));
  if(off){try{const W=n=>window[n]||{};
      if(!W('RGROUPS')[P.pid])await loadJs('data/prices/'+P.pid+'/g.js');if(!W('PRICESET')[key])await loadJs('data/prices/'+P.pid+'/'+zid+'.js');
      if(!W('TRSET')[key]&&(window.TR_INDEX||{})[key])await loadJs(`data/transport/${P.pid}/${zid}.js`).catch(()=>{});
      const PS=W('PRICESET'),RG=W('RGROUPS'),TS=W('TRSET');
      const OT=TS[key]&&TS[key].combos&&TS[key].combos.length?TS[key]:null;
      cmp=compare(set,PS[key],RG[P.pid],OT)}catch(e){cmp={['сверка не выполнена: '+(e.message||e)]:{eq:0,ne:0,ex:[]}}}}
  set.cmp=cmp;onProgress&&onProgress(1);
  try{await save(set);set.saved=true}catch(e){set.saved=false}
  return set}

return {parse,importFile,list,del,save,compare,readRows}};
