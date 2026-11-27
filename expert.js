/* Римора: экспертиза сметы. Три уровня эксперта (лёгкий, средний, суровый), уведомление с пронумерованными замечаниями,
   пометки «Повторно» при повторной проверке, выгрузка в Word и PDF, номера замечаний на строках сметы.
   Правила считает код, результат воспроизводим. Основа — правила «Проверки сметы» (checkSmeta) и правила ниже.
   Эталон — 33 замечания экспертизы по реальной смете (папка 79_, внутренняя). Файл подключается до основного скрипта. */
window.RimoraExpert=function(A){
const {calc,checkSmeta,kaFgis,req,totals,fmt,fq,esc,dlg,dlBlob,toast,commit,render,RC,go,today,dmy}=A;
const S=()=>A.S;
const LVN={l:['Лёгкий','лёгкий','Грубые и арифметические ошибки: объём, задвоения, нет цены, нет НР и СП, расценки вне ФСНБ'],
  m:['Средний','средний','Добавляет Методику 421/пр: обоснование коэффициентов, конъюнктурный анализ, перевозка, резерв на непредвиденные'],
  h:['Суровый','суровый','Как государственная экспертиза: ВОР, документ к каждому коэффициенту, пояснительная записка, реквизиты']};
const ORD={l:0,m:1,h:2};
const key=t=>String(t).replace(/[\d\s.,]+/g,'#').slice(0,70);
const dot=t=>String(t||'').trim().replace(/[.\s]+$/,'');
const DOCRX=/ПОС|проект|прил|табл|п\.|пп\.|приказ|письм|ТЧ|техн|Методик/i,MDS=/МДС\s*81-35/i;// МДС 81-35.2004 отменена с 05.10.2020: документом не считается
const kt=x=>{const a=[];if(+x.ot&&+x.ot!==1)a.push('ОЗП '+fq(+x.ot));if(+x.em&&+x.em!==1)a.push('ЭМ '+fq(+x.em));if(+x.m&&+x.m!==1)a.push('МАТ '+fq(+x.m));return a.join(', ')||'1'};
const code=p=>p.ka?'КА':p.tr?'Перевозка':p.mr?'ФСБЦ-'+p.mr.rc:(/^\d|^[мрп]/.test(p.code||'')?'ГЭСН'+p.code:p.code||'');

// все замечания всех уровней: {lvl, id, pn, code, k (ключ для «Повторно»), t (замечание), fix (как исправить), ref (пункт)}
function collect(){
  const s=S(),R=[],add=(lvl,p,pn,rule,t,fix,ref)=>R.push({lvl,id:p?p.id:null,pn:pn||'',code:p?code(p):'',k:(p?p.id:'doc')+'|'+rule,t:dot(t),fix:dot(fix),ref:ref||''});
  const byId=new Map(s.pos.map(p=>[p.id,p]));
  // 1. правила «Проверки сметы»: ошибки — лёгкий эксперт, предупреждения — средний, подсказки по существу — суровый
  for(const f of checkSmeta()){const t=f.t;
    if(/нет в ФСНБ-2022|Ресурсов с ценой «базис|НДС начисляется|Смета в базисном уровне|Несколько коэффициентов снижения|«на каждые/.test(t))continue;
    add(f.vor!=null?'h':f.lv==='e'?'l':f.lv==='w'?'m':'h',f.id!=null?byId.get(f.id):null,f.pn,'ck:'+key(t),t,'',f.ref)}
  // 2. правила экспертизы по позициям
  const hasKA=s.pos.some(p=>p.ka),rates=[];let n=0,prevRate=null;
  for(const p of s.pos){if(p.sec!==undefined)continue;n++;const c=calc(p),pn=n;
    if(p.ka){const ka=p.ka;
      ka.offers.forEach((o,i)=>{if(+o.price>0&&!o.incl&&!kaFgis(ka)&&+o.trans>0)add('m',p,pn,'katr'+i,
        `Конъюнктурный анализ «${ka.name||'материал'}», предложение ${i+1}: перевозка задана суммой ${fmt(o.trans)} ₽. Перевозку рассчитывают по сметным ценам ФРСН на перевозку с учётом расстояния, типа покрытия дороги, вида транспорта и класса груза`,
        'В карточке КА включите «Перевозка по ценам ФГИС ЦС», укажите массу единицы и расстояние','п. 91')});
      if(prevRate&&/^27-/.test(prevRate.code)&&/^02\.(2\.05|3\.01)/.test(ka.rescode||''))add('m',p,pn,'upl27',
        `Расход «${ka.name||ka.rescode}» к позиции ${prevRate.pn}: проверьте, что учтён коэффициент уплотнения`,'Расход щебня и песка считают с коэффициентом по приложению 27.2 технической части сборника 27 (для щебня 1,26)','ТЧ сб. 27, прил. 27.2');
      continue}
    if(p.tr){const t=p.tr;
      if(hasKA)add('m',p,pn,'trsep','Перевозка материалов вынесена отдельной позицией. Перевозку материалов, цены которых определены конъюнктурным анализом, включают в сам конъюнктурный анализ',
        'Перенесите перевозку в карточки КА; отдельной позицией оставьте только перевозку, согласованную с заказчиком','п. 91');
      if(t.mode==='water'||t.mode==='air'){const w=(calc(p).warn||[]).filter(x=>/перевозчик|предложений/.test(x));if(w.length)add('m',p,pn,'trka',`Перевозка ${t.mode==='water'?'водным':'воздушным'} транспортом по конъюнктурному анализу: ${w.join('; ')}`,'Приложите не менее 2 предложений перевозчиков с ИНН и датой или письмо заказчика','п. 91')}
      if(!t.mode&&/самосвал/i.test(t.veh||'')&&/30/.test(String(t.cap||'')))add('m',p,pn,'tr30','Перевозка автомобилями-самосвалами грузоподъёмностью до 30 т: такой транспорт применяют только при обосновании в проекте организации строительства',
        'Приложите обоснование из ПОС или выберите транспорт по примечаниям к сметным ценам перевозки субъекта','ПОС, примечания к сметным ценам');
      continue}
    if(p.mr){const rc=p.mr.rc;
      for(const r of rates){const l=r.c.lines.find(l=>l.rc===rc&&+l.sum>0);if(l)add('l',p,pn,'dup:'+r.p.id,
        `Материал ${rc} учтён дважды: в позиции ${r.pn} (${fq(l.qty)} ${l.unit||''}, ${fmt(l.sum)} ₽) и отдельной позицией ${pn}`,'Оставьте материал в одном месте','')}
      if(prevRate&&/^27-/.test(prevRate.code)&&/^02\.(2\.05|3\.01)/.test(rc))add('m',p,pn,'upl27',
        `Расход «${(c.R&&c.R.name||rc).split(',')[0]}» к позиции ${prevRate.pn}: проверьте, что учтён коэффициент уплотнения`,'Расход щебня и песка считают с коэффициентом по приложению 27.2 технической части сборника 27 (для щебня 1,26)','ТЧ сб. 27, прил. 27.2');
      continue}
    if(!c.R||!c.R.real){if((c.warn||[]).some(w=>/нет в ФСНБ-2022/.test(w)))add('l',p,pn,'nofsnb',
      `Расценки ГЭСН${p.code} нет в ФСНБ-2022. Нормы вне Федерального реестра сметных нормативов не применяются`,'Подберите расценку из сборников ФСНБ-2022 по составу работ','ФРСН');continue}
    rates.push({p,pn,c});prevRate={code:p.code,pn};
    (p.kc||[]).forEach((x,i)=>{const up=[x.ot,x.em,x.m].some(v=>+v>1);
      if(MDS.test(x.j+' '+(x.n||'')))add('l',p,pn,'kcmds'+i,`Коэффициент ${kt(x)} обоснован ссылкой на МДС 81-35.2004: она отменена с 05.10.2020`,'Укажите пункт Методики 421/пр, техническую часть сборника или проект','421/пр');
      else if(!String(x.j||'').trim())add('m',p,pn,'kcj'+i,`Коэффициент ${kt(x)}${x.n?` («${x.n}»)`:''} применён без обоснования`,'Укажите документ (ПОС, техническая часть сборника, пункт Методики) или исключите коэффициент','пп. 52–61');
      else if(up&&!DOCRX.test(x.j+' '+(x.n||'')))add('h',p,pn,'kcd'+i,`Повышающий коэффициент ${kt(x)} («${x.j}») не подтверждён документом`,'Исключите коэффициент или приложите обоснование из проекта организации строительства','пп. 52–61')});
    for(const k of p.ks||[])if(/^Т[15]\./.test(k)&&RC[k])add('h',p,pn,'ks:'+k,`Коэффициент ${fq(RC[k].v)} «${RC[k].name}» (${k}) применяют, когда условия производства работ подтверждены проектом организации строительства`,
      'Приложите ссылку на раздел ПОС с описанием условий','прил. 10 Методики');
    if(/^27-/.test(p.code)&&!(window.kcOf?window.kcOf(p):p.kc||[]).some(x=>+x.m&&+x.m!==1)){const L=c.lines.filter(l=>l.t==='М'&&/^02\.(2\.05|3\.01)/.test(l.rc)&&+l.sum>0);
      if(L.length)add('m',p,pn,'upl27',`Расход ${L.map(l=>'«'+l.name.split(',')[0]+'»').join(', ')} принят без коэффициента уплотнения`,'Примените к расходу материала коэффициент по приложению 27.2 технической части сборника 27 (для щебня 1,26)','ТЧ сб. 27, прил. 27.2')}
  }
  // 3. правила по смете в целом
  // коэффициенты на всю смету: замечание одно на смету, а не на каждую позицию
  {const K=s.kall||{},nOn=rates.filter(r=>!r.p.nokall).length;
    (K.kc||[]).forEach((x,i)=>{const up=[x.ot,x.em,x.m].some(v=>+v>1);
      if(MDS.test(x.j+' '+(x.n||'')))add('l',null,'','kallmds'+i,`Коэффициент ${kt(x)} ко всей смете (${nOn} поз.) обоснован ссылкой на МДС 81-35.2004: она отменена с 05.10.2020`,'Укажите пункт Методики 421/пр, техническую часть сборника или проект','421/пр');
      else if(!String(x.j||'').trim())add('m',null,'','kallj'+i,`Коэффициент ${kt(x)}${x.n?` («${x.n}»)`:''} применён ко всей смете (${nOn} поз.) без обоснования`,'Укажите документ (ПОС, техническая часть сборника, пункт Методики) или исключите коэффициент','пп. 52–61');
      else if(up&&!DOCRX.test(x.j+' '+(x.n||'')))add('h',null,'','kalld'+i,`Повышающий коэффициент ${kt(x)} («${x.j}») применён ко всей смете (${nOn} поз.) и не подтверждён документом`,'Исключите коэффициент или приложите обоснование из проекта организации строительства','пп. 52–61')});
    for(const k of K.ks||[])if(/^Т[15]\./.test(k)&&RC[k])add('h',null,'','kallks:'+k,`Коэффициент ${fq(RC[k].v)} «${RC[k].name}» (${k}) применён ко всей смете (${nOn} поз.). Его применяют, когда условия производства работ подтверждены проектом организации строительства`,
      'Приложите ссылку на раздел ПОС с описанием условий','прил. 10 Методики')}
  if(s.level==='base')add('l',null,'','base','Сметная стоимость определена в базисном уровне цен 01.01.2022. Ресурсно-индексным методом стоимость определяют в текущем уровне цен: квартал и ценовая зона','Переключите уровень цен на текущий квартал','');
  if(!(s.vor||[]).some(r=>r.sec===undefined))add('h',null,'','vor','Не представлена ведомость объёмов работ (ВОР): виды работ с технологией выполнения, формулы расчёта объёмов, марки и расход материалов на единицу измерения. Техническое задание ведомостью объёмов работ не является',
    'Составьте ВОР на вкладке «Ведомость объёмов» и свяжите с ней объёмы позиций','');
  const st=s.stroy;
  if(st&&st.res&&+st.res.pct>0&&!String(st.res.osn||'').trim())add('m',null,'','npr',`Резерв на непредвиденные работы и затраты ${fq(+st.res.pct)} %: нужно письмо главного распорядителя бюджетных средств с конкретным значением. Формулировка «не более ${fq(+st.res.pct)} %» не подходит`,
    'Укажите реквизиты письма в окне «Объектный и сводный расчёты»','п. 179');
  if(st&&st.pz){const pz=st.pz,miss=[[!String(pz.reason||'').trim(),'основание для разработки сметной документации'],[!String(pz.teiName||'').trim()||!String(pz.teiVal||'').trim(),'главный технико-экономический показатель'],[!String(pz.fclass||'').trim(),'код функционального назначения объекта']].filter(x=>x[0]).map(x=>x[1]);
    if(miss.length)add('h',null,'','pz','Пояснительная записка: не указаны '+miss.join(', '),'Заполните раздел «Пояснительная записка» в окне «Объектный и сводный расчёты»','')}
  return R}

// провести экспертизу уровня lv: новое уведомление, «Повторно» для неисправленного из прошлого
function run(lv){const s=S(),H=(s.exp&&s.exp.hist)||[],last=H[H.length-1],prev=new Set(last?last.items.flatMap(x=>x.ks||[x.k]):[]);
  // одинаковые замечания по разным позициям — один пункт «П.1, 2, 6: …», как в настоящих уведомлениях
  const seen=new Set(),G=new Map();
  for(const x of collect()){if(ORD[x.lvl]>ORD[lv]||seen.has(x.k))continue;seen.add(x.k);const g=x.lvl+'|'+x.t+'|'+x.fix+'|'+x.ref+'|'+(x.pn===''?'doc':'pos');
    const o=G.get(g);if(o){o.pns.push(x.pn);o.ids.push(x.id);o.ks.push(x.k);if(o.code!==x.code)o.code=''}else G.set(g,{lvl:x.lvl,t:x.t,fix:x.fix,ref:x.ref,code:x.code,pns:x.pn===''?[]:[x.pn],ids:x.id!=null?[x.id]:[],ks:[x.k]})}
  const items=[...G.values()].map(o=>({...o,rep:o.ks.some(k=>prev.has(k))}));
  items.sort((a,b)=>(a.pns.length?a.pns[0]:-1)-(b.pns.length?b.pns[0]:-1)||ORD[a.lvl]-ORD[b.lvl]);
  const N={n:H.length+1,date:today(),lv,total:totals().total,items,fixed:last?last.items.filter(x=>!(x.ks||[x.k]).some(k=>seen.has(k))).length:0};
  s.exp={hist:[...H,N].slice(-20),show:true,only:false};commit();return N}

// текст уведомления (просмотр, Word, PDF)
const CSS=`body{font:14pt/1.35 "Times New Roman",Times,serif;color:#000;margin:0;padding:18mm 15mm 18mm 25mm;background:#fff}
.hd{display:flex;justify-content:space-between;gap:24px}.org{text-align:center;width:46%}.org small{font-size:10pt}.to{width:44%;text-align:center}
.reg{margin-top:18px}.ttl{margin:12px 0 18px}h2{font-size:14pt;font-weight:normal;text-align:center;margin:0}.obj{text-align:center;margin:2px 0 14px}
ol{padding-left:1.4em;margin:0}li{text-align:justify;margin:0 0 4px}.ft{margin-top:16px;text-align:justify}.sg{margin-top:28px;display:flex;justify-content:space-between}
.ok{margin-top:10px}@page{size:A4;margin:0}`;
function body(N){const Q=req(),s=S(),LV=LVN[N.lv];
  return `<div class="hd"><div class="org">Римора<br>Учебная экспертиза<br>сметной документации<br><small>проверка по правилам Методики 421/пр, приказов 812/пр и 774/пр</small></div><div class="to">Составителю сметной документации${Q.sost?'<br>'+esc(Q.sost):''}</div></div>
  <div class="reg">${dmy(N.date)} № ЭС-${N.n}</div><div class="ttl">О замечаниях к сметной документации</div>
  <h2>Уведомление (${N.n})</h2><p class="obj">по объекту: <b><i>«${esc(Q.stroyka||Q.obj||s.name)}»</i></b>, локальный сметный расчёт № ${esc(Q.num||'')},<br>сметной стоимостью ${fmt(N.total)} рублей.</p>
  ${N.items.length?`<ol>${N.items.map(x=>`<li>${pnTxt(x)}${esc(x.t)}${x.ref?` (${esc(x.ref)})`:''}.${x.fix?` ${esc(x.fix)}.`:''}${x.rep?' <b>Повторно.</b>':''}</li>`).join('')}</ol>
  <p class="ft">Замечания необходимо устранить и представить исправленную сметную документацию на повторную проверку.${N.fixed?` По сравнению с уведомлением (${N.n-1}) устранено замечаний: ${N.fixed}.`:''}</p>`
  :`<p class="ok">Замечаний нет: смета соответствует правилам проверки уровня «${LV[0]} эксперт».${N.fixed?` Устранены все замечания уведомления (${N.n-1}): ${N.fixed}.`:''}</p>`}
  <div class="sg"><span>Эксперт (${LV[1]} уровень)</span><span>__________ Римора</span></div>`}
// «П.4», «П.6–п.8», «П.1, п.2, п.9» — как в уведомлениях экспертизы
function pnTxt(x){const a=x.pns;if(!a.length)return '';const r=[];for(let i=0;i<a.length;i++){let j=i;while(j+1<a.length&&a[j+1]===a[j]+1)j++;r.push(j-i>=2?`п.${a[i]}–п.${a[j]}`:j>i?`п.${a[i]}, п.${a[j]}`:`п.${a[i]}`);i=j}return 'П'+r.join(', ').slice(1)+'. '}
const page=N=>`<!doctype html><html><head><meta charset="utf-8"><title>Уведомление (${N.n})</title><style>${CSS}</style></head><body>${body(N)}</body></html>`;
function word(N){const h=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>${CSS.replace(/display:flex[^;}]*;?/g,'')}</style></head><body>${body(N).replace(/<div class="hd">([\s\S]*?)<\/div><\/div>/,(m)=>m.replace('<div class="hd">','<table width="100%" style="font:inherit"><tr><td width="50%" style="text-align:center;vertical-align:top">').replace('</div><div class="to">','</td><td style="text-align:center;vertical-align:top">').replace(/<\/div><\/div>$/,'</td></tr></table>')).replace('<div class="sg"><span>','<p>').replace('</span><span>','&nbsp;&nbsp;&nbsp;&nbsp;').replace('</span></div>','</p>')}</body></html>`;
  dlBlob(new Blob(['﻿'+h],{type:'application/msword'}),`Уведомление (${N.n}) ${S().name}.doc`);toast('Уведомление выгружено в Word')}
function pdf(N){const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
  f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){toast('Печать недоступна')}setTimeout(()=>f.remove(),60000)};f.srcdoc=page(N);toast('В окне печати выберите «Сохранить как PDF»')}

// окно экспертизы
let LV0='m',TAB='doc';
function open(){const s=S(),H=(s.exp&&s.exp.hist)||[];if(H.length)LV0=H[H.length-1].lv;view()}
function view(){const s=S(),H=(s.exp&&s.exp.hist)||[],N=H[H.length-1],E=s.exp||{};
  dlg(`<div class="kah"><div><h3>Экспертиза сметы</h3><div class="u">Программа проверяет смету как экспертиза и выдаёт уведомление с пронумерованными замечаниями. Правила считает код: результат одинаков при каждом запуске. Это учебная проверка, она не заменяет государственную экспертизу.</div></div><button class="vdel" id="exX" style="font-size:22px" aria-label="Закрыть">×</button></div>
  <div class="exlv">${['l','m','h'].map(k=>`<button data-exl="${k}" class="${k===LV0?'on':''}"><b>${LVN[k][0]} эксперт</b><span>${LVN[k][2]}</span></button>`).join('')}</div>
  <div class="fmb" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn pri" id="exRun">${N?'Провести повторную экспертизу':'Провести экспертизу'}</button>
   ${N?`<button class="btn" id="exDoc">Уведомление в Word</button><button class="btn" id="exPdf">В PDF</button>
   <label class="exck"><input type="checkbox" id="exShow"${E.show?' checked':''}> номера замечаний в смете</label><label class="exck"><input type="checkbox" id="exOnly"${E.only?' checked':''}> только строки с замечаниями</label>`:''}</div>
  ${N?`<div class="exsum">Уведомление (${N.n}) от ${dmy(N.date)} · ${LVN[N.lv][0].toLowerCase()} эксперт · замечаний: <b>${N.items.length}</b>${N.items.some(x=>x.rep)?`, из них повторно: ${N.items.filter(x=>x.rep).length}`:''}${N.fixed?` · устранено с прошлого раза: ${N.fixed}`:''}${H.length>1?` · ранее: ${H.slice(0,-1).reverse().slice(0,4).map(h=>`(${h.n}) ${h.items.length}`).join(', ')}`:''}</div>
  <div class="kstab"><button data-ext="doc" class="${TAB==='doc'?'on':''}">Уведомление</button><button data-ext="list" class="${TAB==='list'?'on':''}">Замечания по строкам</button></div>
  ${TAB==='doc'?`<iframe id="exPrev" title="Уведомление" style="width:100%;height:54vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>`
   :`<div class="ckl">${N.items.length?N.items.map((x,i)=>`<div class="cki ${x.lvl==='l'?'e':x.lvl==='m'?'w':'i'}" data-exi="${i}"><span class="ckb">№ ${i+1}</span><div><div class="ckh">${x.pns.length?`${x.pns.length>1?'Позиции':'Позиция'} ${esc(x.pns.join(', '))}${x.code?' · '+esc(x.code):''}`:'Смета'}${x.ref?` <span class="ckr">${esc(x.ref)}</span>`:''}${x.rep?' <span class="ckr" style="color:var(--warn)">Повторно</span>':''}</div><div>${esc(x.t)}</div>${x.fix?`<div class="u">Как исправить: ${esc(x.fix)}</div>`:''}</div>${x.ids.length?'<span class="ckg">к строке →</span>':''}</div>`).join(''):'<p class="u">Замечаний нет.</p>'}</div>`}`
  :`<p class="u" style="margin-top:12px">Выберите уровень эксперта и нажмите «Провести экспертизу». После исправлений проведите повторную: устранённое снимется, неисправленное получит пометку «Повторно», уведомление получит следующий номер.</p>`}`,true);
  const D=$$('#dlg')[0];
  D.querySelector('#exX').onclick=()=>$$('#dlgbg')[0].classList.remove('on');
  D.querySelectorAll('[data-exl]').forEach(b=>b.onclick=()=>{LV0=b.dataset.exl;view()});
  D.querySelector('#exRun').onclick=()=>{const N=run(LV0);TAB='doc';view();toast(`Уведомление (${N.n}): замечаний ${N.items.length}`)};
  if(N){D.querySelector('#exDoc').onclick=()=>word(N);D.querySelector('#exPdf').onclick=()=>pdf(N);
    D.querySelector('#exShow').onchange=e=>{s.exp.show=e.target.checked;if(!s.exp.show)s.exp.only=false;render();view()};
    D.querySelector('#exOnly').onchange=e=>{s.exp.only=e.target.checked;if(s.exp.only)s.exp.show=true;render();view()};
    D.querySelectorAll('[data-ext]').forEach(b=>b.onclick=()=>{TAB=b.dataset.ext;view()});
    const fr=D.querySelector('#exPrev');if(fr)fr.srcdoc=page(N).replace('padding:18mm 15mm 18mm 25mm','padding:24px 28px');
    D.querySelectorAll('[data-exi]').forEach(el=>el.onclick=()=>{const x=N.items[+el.dataset.exi];if(x.ids.length){s.exp.show=true;go({id:x.ids[0]})}})}}
const $$=q=>document.querySelectorAll(q);

// номера замечаний на строках сметы (из последнего уведомления)
function marks(){const E=S().exp,N=E&&E.show&&E.hist&&E.hist[E.hist.length-1],m={};if(N)N.items.forEach((x,i)=>{for(const id of x.ids||[])(m[id]=m[id]||[]).push(i+1)});return {m,only:!!(N&&E.only),N}}
function showPos(id){const E=S().exp,N=E&&E.hist&&E.hist[E.hist.length-1];if(!N)return;const L=N.items.map((x,i)=>[x,i]).filter(([x])=>(x.ids||[]).includes(id));const pp=S().pos.filter(p=>p.sec===undefined),pnum=pp.findIndex(p=>p.id===id)+1;
  dlg(`<div class="kah"><div><h3>Замечания экспертизы, уведомление (${N.n})</h3><div class="u">Позиция ${pnum}</div></div><button class="vdel" id="exX" style="font-size:22px" aria-label="Закрыть">×</button></div>
  <div class="ckl">${L.map(([x,i])=>`<div class="cki ${x.lvl==='l'?'e':x.lvl==='m'?'w':'i'}"><span class="ckb">№ ${i+1}</span><div><div class="ckh">${x.ref?`<span class="ckr">${esc(x.ref)}</span>`:''}${x.rep?' <span class="ckr" style="color:var(--warn)">Повторно</span>':''}</div><div>${esc(x.t)}</div>${x.fix?`<div class="u">Как исправить: ${esc(x.fix)}</div>`:''}</div></div>`).join('')}</div>
  <div class="fmb"><button class="btn" id="exAll">Всё уведомление</button></div>`,true);
  document.querySelector('#exX').onclick=()=>$$('#dlgbg')[0].classList.remove('on');document.querySelector('#exAll').onclick=open}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-exg]');if(b){e.preventDefault();e.stopPropagation();showPos(+b.dataset.exg)}},true);

return {collect,run,open,marks,showPos,page,word,pdf,LVN}};
