/* Римора: выгрузка локального сметного расчёта в XML по схеме Минстроя России
   «Локальная смета. Ресурсно-индексный метод», LocalEstimateResourceIndexMethod-3_01.xsd (действует с 18.10.2024).
   Копия схемы: 75_Выходные_формы/raw/gge_v3/. Все суммы берутся из того же расчёта calc(), что и ЛСР по прил. 3.
   Файл подключается до основного скрипта; index.html вызывает RimoraXML({...}) и передаёт свои функции расчёта. */
window.RimoraXML=function(A){
let S,PR;const {calc,req,totals,B,RC,nrCode,nrFull,drvCat,toast,markDirty,fq}=A;
const sync=()=>{S=A.S;PR=A.syncPR()};
// реквизиты из Федерального реестра сметных нормативов (ФРСН на 23.09.2026, папка 23_ФРСН_реестр_сметных_нормативов)
const FRSN={
  fsnb:{name:'Федеральная сметно-нормативная база ФСНБ-2022 (приказ Минстроя России от 30.12.2021 № 1046/пр)',type:'ГСН',date:[2021,12,30],num:396,
    orders:'Приказ Минстроя России от 12.08.2026 № 527/пр (дополнение № 19)'},
  met:{name:'Методика определения сметной стоимости строительства, реконструкции, капитального ремонта, сноса объектов капитального строительства, работ по сохранению объектов культурного наследия (памятников истории и культуры) народов Российской Федерации на территории Российской Федерации, утвержденная приказом Минстроя России от 04.08.2020 № 421/пр',type:'ГСН',date:[2020,9,29],num:348,
    orders:'Изменения: приказы Минстроя России от 07.07.2022 № 557/пр, от 30.01.2024 № 55/пр, от 23.01.2025 № 30/пр, от 30.01.2026 № 42/пр'},
  nr:{name:'Методика по разработке и применению нормативов накладных расходов при определении сметной стоимости строительства, реконструкции, капитального ремонта, сноса объектов капитального строительства, утвержденная приказом Минстроя России от 21.12.2020 № 812/пр',type:'ГСН',date:[2021,4,16],num:377},
  sp:{name:'Методика по разработке и применению нормативов сметной прибыли при определении сметной стоимости строительства, реконструкции, капитального ремонта, сноса объектов капитального строительства, утвержденная приказом Минстроя России от 11.12.2020 № 774/пр',type:'ГСН',date:[2021,4,16],num:376},
  letters:{'Письмо Минстроя России от 24.08.2026 № 52419-ИФ/09':{date:[2026,8,24],num:423},
           'Письмо Минстроя России от 22.08.2025 № 49743-АЛ/09':{date:[2025,8,22],num:393}}
};
const REGION={'Республика Адыгея (Адыгея)':1,'Республика Башкортостан':2,'Республика Бурятия':3,'Республика Алтай':4,'Республика Дагестан':5,'Республика Ингушетия':6,
  'Кабардино-Балкарская Республика':7,'Республика Калмыкия':8,'Карачаево-Черкесская Республика':9,'Республика Карелия':10,'Республика Коми':11,'Республика Марий Эл':12,'Республика Мордовия':13,
  'Республика Саха (Якутия)':14,'Республика Северная Осетия - Алания':15,'Республика Татарстан (Татарстан)':16,'Республика Тыва':17,'Удмуртская Республика':18,'Республика Хакасия':19,
  'Чеченская Республика':20,'Чувашская Республика - Чувашия':21,'Алтайский край':22,'Краснодарский край':23,'Красноярский край':24,'Приморский край':25,'Ставропольский край':26,'Хабаровский край':27,
  'Амурская область':28,'Архангельская область':29,'Астраханская область':30,'Белгородская область':31,'Брянская область':32,'Владимирская область':33,'Волгоградская область':34,'Вологодская область':35,
  'Воронежская область':36,'Ивановская область':37,'Иркутская область':38,'Калининградская область':39,'Калужская область':40,'Камчатский край':41,'Кемеровская область - Кузбасс':42,'Кировская область':43,
  'Костромская область':44,'Курганская область':45,'Курская область':46,'Ленинградская область':47,'Липецкая область':48,'Магаданская область':49,'Московская область':50,'Мурманская область':51,
  'Нижегородская область':52,'город Саров (Нижегородская область)':52,'Новгородская область':53,'Новосибирская область':54,'Омская область':55,'Оренбургская область':56,'Орловская область':57,'Пензенская область':58,
  'Пермский край':59,'Псковская область':60,'Ростовская область':61,'Рязанская область':62,'Самарская область':63,'Саратовская область':64,'Сахалинская область':65,'Свердловская область':66,
  'Смоленская область':67,'Тамбовская область':68,'Тверская область':69,'Томская область':70,'Тульская область':71,'Тюменская область':72,'Ульяновская область':73,'Челябинская область':74,
  'Забайкальский край':75,'Ярославская область':76,'Москва':77,'Санкт-Петербург':78,'Еврейская автономная область':79,'Ненецкий автономный округ':83,'Ханты-Мансийский автономный округ - Югра':86,
  'Чукотский автономный округ':87,'Ямало-Ненецкий автономный округ':89,'Республика Крым':91,'Севастополь':92};
window.RIM_REGION=REGION;
// письмо об индексах квартала: из списка выше или из данных зоны (data/prices: дата, номер и номер в ФРСН)
const letterOf=m=>{if(!m||!m.letter)return null;if(FRSN.letters[m.letter])return FRSN.letters[m.letter];const d=/от (\d\d)\.(\d\d)\.(\d{4})/.exec(m.letter);return d&&m.frsn?{date:[+d[3],+d[2],+d[1]],num:m.frsn}:null};

const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// числа: точка как разделитель, деньги до 2 знаков, количества и коэффициенты до 7 знаков (правила округления схемы)
const n2=x=>{const v=Math.round((+x||0)*100+((+x||0)>=0?1e-7:-1e-7))/100;return (Object.is(v,-0)?0:v).toFixed(2)};
const n7=x=>{let v=Math.round((+x||0)*1e7)/1e7;if(Object.is(v,-0))v=0;let s=v.toFixed(7).replace(/0+$/,'').replace(/\.$/,'');return s==='-0'?'0':s};
class X{constructor(){this.a=[];this.d=0}
  open(t){this.a.push('  '.repeat(this.d)+'<'+t+'>');this.d++;return this}
  close(t){this.d--;this.a.push('  '.repeat(this.d)+'</'+t+'>');return this}
  el(t,v){if(v===undefined||v===null||v==='')return this;this.a.push('  '.repeat(this.d)+'<'+t+'>'+esc(v)+'</'+t+'>');return this}
  date(t,y,m,d){return this.open(t).el('Year',y).el('Month',m).el('Day',d).close(t)}
  toString(){return this.a.join('\n')}}

function legal(x,t,o,extraOrders){x.open(t).el('Name',o.name).el('Type',o.type).date('Date',...o.date).el('Num',o.num);
  const ord=extraOrders||o.orders;if(ord)x.el('Orders',ord);x.close(t)}

// коэффициенты позиции по целям схемы: Объем|ОТ|ЭМ|ОТМ|МАТ|ОБ|ЗТ|ЗТМ
function coefList(p,c){const L=[];
  // общие коэффициенты сметы (S.kall) входят в список позиции, как в ГРАНД-Смете
  for(const id of (window.ksOf?window.ksOf(p):p.ks||[])){const K=RC[id];if(!K)continue;let v;
    if(K.type==='prod')v={ОТ:K.v,ЗТ:K.v,ЭМ:K.v,ОТМ:K.v,ЗТМ:K.v};
    else if(K.type==='lab')v={ОТ:K.v,ЗТ:K.v};
    else if(K.type==='pay')v={ОТ:K.v,ОТМ:K.v};
    else v={ОТ:1.15,ЗТ:1.15,ЭМ:1.25,ОТМ:1.25,ЗТМ:1.25};
    L.push({name:id+' · '+K.name,reason:K.src||id,v})}
  for(const k of (window.kcOf?window.kcOf(p):p.kc||[])){const v={},ot=+k.ot||1,em=+k.em||1,m=+k.m||1;if(ot!==1){v.ОТ=ot;v.ЗТ=ot}if(em!==1){v.ЭМ=em;v.ОТМ=em;v.ЗТМ=em}if(m!==1)v.МАТ=m;
    L.push({name:k.n||'Коэффициент',reason:k.j||'Коэффициент к позиции',v})}
  const kr=c.kr||1;if(kr!==1)L.push({name:'Кратность '+n7(kr)+' (норма применена '+n7(kr)+' раза)',reason:'Кратность к сметной норме',v:{ОТ:kr,ЗТ:kr,ЭМ:kr,ОТМ:kr,ЗТМ:kr,МАТ:kr}});
  return L}
// итоговые значения по целям: как в calcReal — производительность складывается, остальное перемножается
function coefFinal(c){const kl=c.kl,km=c.km,kp=c.kpay||1;
  const F={ЗТ:kl,ОТ:kl*kp,ЭМ:km,ЗТМ:km,ОТМ:km*kp};if((c.kmat||1)!==1)F.МАТ=c.kmat;
  return Object.entries(F).filter(([k,v])=>Math.abs(v-1)>1e-9)}
function values(x,obj,withFormula){x.open('Values');for(const [t,v] of obj){x.open('Value').el('Target',t).el('CoefValue',n7(v));x.close('Value')}x.close('Values')}

function nrsp(x,tag,c,R,kind){const isNr=kind==='nr',val=isNr?c.nrp:c.spp,k=c.rem?(isNr?0.9:0.85):1;
  x.open(tag).el('Reason',isNr?'Пр/812-'+nrCode(R.nk)+(window.nrSfx?window.nrSfx():'-1'):'Пр/774-'+nrCode(R.sk)).el('Name',nrFull(isNr?R.nk:R.sk,kind)).el('Target','ФОТ')
   .el('Value',n7(val)).el('ValueTotal',n7(val*k));
  if(c.rem){x.open('Coefficients').el('Final',n7(k)).open('Coefficient').el('Name','Ремонт по нормам нового строительства').el('Reason',isNr?'812/пр, п. 25':'774/пр, п. 16').el('Num',1).el('Value',n7(k)).close('Coefficient').close('Coefficients')}
  x.el('PriceCur',n2(isNr?c.nr:c.sp));x.close(tag)}

function resIndex(x,l){const pm=PR&&(l.t==='ЭМ'?PR.mach[l.rc]:PR.mat[l.rc]);if(l.src!=='базис × индекс'||!pm)return;
  const iv=l.t==='ЭМ'?pm[3]:pm[1];if(iv==null)return;
  x.open('Index').el('Name','Индекс изменения сметной стоимости к группе однородных строительных ресурсов').el('Reason',PR.meta.letter).el('Num',1)
   .open('Value').el('Final',n7(iv)).el('IndexValue',n7(iv)).close('Value').close('Index')}

let resId=0;
function resource(x,tag,l,c,num){const r=B.res[l.rc]||{},base=r.price??0;
  const pc=l.t==='ЭМ'?l.price-(l.otm||0):l.price,tot=l.t==='ЭМ'?l.qty*pc:l.sum;
  const bpc=l.t==='ЭМ'?base-(r.otm||0):base;
  x.open(tag).el('IDResource',++resId).el('Num',num).el('Code',l.rc).el('Name',l.name).el('Consumption',n7(l.norm)).el('Unit',l.unit)
   .el('PricePerUnitCur',n2(pc)).el('PriceTotalCur',n2(tot)).el('PricePerUnitBase',n2(bpc)).el('PriceTotalBase',n2(l.qty*bpc));
  resIndex(x,l);x.el('ConsumptionTotal',n7(l.qty));
  if(l.t==='ЭМ'){const lab=r.lab||0,otm=l.otm||0;if(lab>0&&otm>0){const pm=PR?PR.mach[l.rc]:null,dc=pm&&pm[4]||'',g=parseFloat(String(drvCat(dc)).replace(',','.'))||0;
    x.open('Machinist').el('Code',dc||'ОТм').el('Grade',n7(g)).el('Consumption',n7(l.norm*lab)).el('Count',Math.max(1,Math.round(lab)))
     .el('Unit','чел.-ч').el('PricePerUnitCur',n2(otm/lab)).el('PriceTotalCur',n2(l.qty*otm*(c.kpay||1))).el('ConsumptionTotal',n7(l.qty*lab)).close('Machinist')}}
  x.close(tag)}

let QTFN=null;
const qtf=(x,p)=>{if(!QTFN||p.vor==null||!S.vor||!S.vor.some(r=>r.id===p.vor))return;x.open('QTF').el('FileNameQTF',QTFN).el('NumQTF',A.vorNum(p.vor)).close('QTF')};
function itemCost(x,p,c,n){const R=c.R,m=/^(мр|м|р|п)?(.*)$/.exec(p.code),pref='ГЭСН'+(m[1]||''),code=m[2],ty=/^м/.test(p.code)?'Монтажные':'Строительные';
  x.open('Item').el('SummaryType',ty).el('WorkType',ty);
  nrsp(x,'Overheads',c,R,'nr');nrsp(x,'Profits',c,R,'sp');
  const vr=p.vor!=null&&S.vor?S.vor.find(v=>v.id===p.vor):null,form=vr&&vr.f?vr.f:p.f||'';
  x.open('Cost').el('Num',n).el('Prefix',pref).el('Code',code).el('Name',R.name)
   .el('Comment',R.mult>1?`Объём ${fq(p.qty)} ${R.nat||''}`.trim():'')
   .el('Quantity',n7(c.q)).el('QuantityFormula',form).el('QuantityTotal',n7(c.q)).el('Unit',R.unit);
  const zt1=c.q?c.zt/c.q:0,ztm1=c.q?c.ztm/c.q:0;
  x.open('PerUnit').el('LaborCosts',n7(zt1)).el('MachinistLaborCosts',n7(ztm1)).close('PerUnit');
  x.open('Totals').open('Current').el('Direct',n2(c.direct)).el('Machines',n2(c.emN)).el('WorkersSalary',n2(c.ot)).el('MachinistSalary',n2(c.otm))
   .el('Salary',n2(c.fot)).el('Materials',n2(c.mat)).close('Current')
   .open('Natural').el('LaborCosts',n7(c.zt)).el('MachinistLaborCosts',n7(c.ztm)).close('Natural').close('Totals');
  const CL=coefList(p,c),F=coefFinal(c);
  if(CL.length&&F.length){x.open('Coefficients').open('Final');values(x,F);x.close('Final');
    for(const k of CL){x.open('Coefficient');values(x,Object.entries(k.v));x.el('Name',k.name).el('Reason',k.reason).close('Coefficient')}
    x.close('Coefficients')}
  const L=c.lines.filter(l=>l.t!=='ТР'&&l.norm!=='П'&&l.qty!=null);
  if(L.length){x.open('ResourcesInternal');let k=0;
    for(const l of L)resource(x,l.t==='ОТ'?'Worker':l.t==='ЭМ'?'Machine':'Material',l,c,++k);
    x.close('ResourcesInternal')}
  x.close('Cost');
  // ВНМР по схеме ЛС РИМ 3.01: отдельная строка ресурсов позиции после прямых затрат, шифр 421/пр_2020_п.75_пп.а (Методика 421/пр, п. 75 «а»)
  if((c.dpl||[]).length||c.vn){x.open('Resources');
    if(c.vn)x.open('Material').el('IDResource',++resId).el('Code',c.vnp===3?'421/пр_2020_п.75_пп.б':'421/пр_2020_п.75_пп.а').el('Name','Сметная стоимость вспомогательных ненормируемых материальных ресурсов, не учтенная в сметной норме, '+(c.vnp||2)+'%')
      .el('Consumption',n7(c.vnp||2)).el('Unit','%').el('PriceTotalCur',n2(c.vn)).el('ConsumptionTotal',n7(c.vnp||2)).close('Material');
    for(const d of c.dpl||[])for(const r of d.rows)trEl(x,r,'ФСБЦ-'+d.rc+'_',' (к ресурсу '+d.rc+')');x.close('Resources')}
  x.el('Salary',n2(c.fot));x.open('Totals').el('Current',n2(c.total)).close('Totals').open('TotalsUnit').el('Current',n2(c.q?c.total/c.q:0)).close('TotalsUnit');
  // ТИМ: ссылки на элементы модели, объём элемента в единицах позиции (как Quantity), схема ЛС РИМ 3.01 TItem/BIMData
  qtf(x,p);
  const bl=window.RimoraBIMCore?RimoraBIMCore.linkOf(S,p):null;
  if(bl&&S.bim&&S.bim.files&&S.bim.files.length){x.open('BIMData');for(const e of bl.els)x.open('Element').el('FileId',bl.f||1).el('IfcGuid',e.g).el('IfcQuantity',n7(e.v/(R.mult||1))).close('Element');x.close('BIMData')}
  x.close('Item')}

// строка перевозки (сверх 30 км к ресурсу или участок маршрута); вычитаемая строка 30 км — с отрицательным количеством
function trEl(x,r,pre,tail){const q=r.sum<0?-r.qty:r.qty;
  x.open('Transport').el('Code',(pre||'')+r.code).el('Name',r.name+(tail||'')).el('Consumption',n7(q)).el('Unit','т')
   .el('PricePerUnitCur',n2(r.pt)).el('PriceTotalCur',n2(r.sum)).el('ConsumptionTotal',n7(q)).close('Transport')}
function itemMR(x,p,c){const r=B.res[p.mr.rc]||{},pb=+r.price||0,own=c.total-(c.dpl||[]).reduce((a,d)=>a+d.sum,0),eq=!!c.R.ob,tag=eq?'Equipment':'Material',ty=eq?'Оборудование':c.mon?'Монтажные':'Строительные';
  x.open('Item').el('SummaryType',ty).el('WorkType',ty);
  x.open(tag).el('IDResource',++resId).el('Code',p.mr.rc).el('Name',c.R.name).el('Consumption',n7(1))
   .el('Unit',c.R.unit||'').el('PricePerUnitCur',n2(c.price)).el('PriceTotalCur',n2(own)).el('PricePerUnitBase',n2(pb)).el('PriceTotalBase',n2(pb*c.q))
   .el('ConsumptionTotal',n7(c.q)).close(tag);
  x.open('Totals').el('Current',n2(own)).close('Totals').open('TotalsUnit').el('Current',n2(c.price)).close('TotalsUnit');
  qtf(x,p);x.close('Item');
  for(const d of c.dpl||[])for(const r of d.rows){x.open('Item').el('SummaryType',ty).el('WorkType','Перевозка');trEl(x,r,'ФСБЦ-'+d.rc+'_',' (к ресурсу '+d.rc+')');
    x.open('Totals').el('Current',n2(r.sum)).close('Totals').open('TotalsUnit').el('Current',n2(r.pt)).close('TotalsUnit');x.close('Item')}}
function itemKA(x,p,c){const ka=p.ka,eq=!!c.R.ob,tag=eq?'Equipment':'Material',ty=eq?'Оборудование':c.mon?'Монтажные':'Строительные';
  x.open('Item').el('SummaryType',ty).el('WorkType',ty);
  x.open(tag).el('IDResource',++resId).el('Code',ka.rescode||'ТЦ').el('Name',c.R.name).el('Consumption',n7(1)).el('Comment','Конъюнктурный анализ, приложение 1 к Методике 421/пр')
   .el('Unit',ka.unit||'').el('PricePerUnitCur',n2(c.K.price)).el('PriceTotalCur',n2(c.total)).el('PricePerUnitBase',n2(0)).el('PriceTotalBase',n2(0))
   .el('ConsumptionTotal',n7(p.qty)).close(tag);
  x.open('Totals').el('Current',n2(c.total)).close('Totals').open('TotalsUnit').el('Current',n2(c.K.price)).close('TotalsUnit');
  qtf(x,p);x.close('Item')}

function itemTR(x,p,c){x.open('Item').el('SummaryType',c.mon?'Монтажные':'Строительные').el('WorkType','Перевозка');
  const m=/^([А-Яа-яA-Za-z]+)[-\s]?(.*)$/.exec(String(c.code||''));
  x.open('Transport').el('Code',c.code||'перевозка').el('Name',c.R.name).el('Consumption',n7(c.q)).el('Unit','т')
   .el('PricePerUnitCur',n2(c.pt||0)).el('PriceTotalCur',n2(c.per)).el('ConsumptionTotal',n7(c.q)).close('Transport');
  x.open('Totals').el('Current',n2(c.total)).close('Totals').open('TotalsUnit').el('Current',n2(c.pt||0)).close('TotalsUnit');
  qtf(x,p);x.close('Item')}

// итоги: строительные и монтажные работы отдельно (Building, Mounting), оборудование своим элементом (Equipment),
// Summary — все виды работ без оборудования, Total — всё вместе (схема ЛС РИМ 3.01, тип TSummary)
function sumItems(x,nm,a){const em=a.emN!=null?a.emN:(a.em-a.otm);
  x.open(nm).el('Total',n2(a.total)).el('WorkersSalary',n2(a.ot)).el('MachinistSalary',n2(a.otm)).el('Salary',n2(a.fot))
   .el('Overhead',n2(a.nr)).el('Profit',n2(a.sp)).el('Machines',n2(em));
  x.open('Materials').el('Total',n2(a.mat+(a.dpm||0))).el('Price',n2(a.mat)).el('External',n2(a.mka||0)).el('Transport',n2(a.dpm||0)).close('Materials');
  x.el('Direct',n2(a.direct)).el('TotalLaborCosts',n7(a.zt+a.ztm)).el('LaborCosts',n7(a.zt)).el('MachinistLaborCosts',n7(a.ztm)).el('Transport',n2((a.per||0)-(a.dpm||0)))
   .el('Price',n2(a.total-(a.per||0))).close(nm)}
function summary(x,tag,a,am){am=am||{};const ob=a.ob||0,b={},s={...a,total:a.total-ob};for(const k in a)b[k]=(a[k]||0)-(am[k]||0);b.total-=ob;
  x.open(tag);sumItems(x,'Building',b);if(am.total)sumItems(x,'Mounting',am);
  if(ob)x.open('Equipment').el('Total',n2(ob)).el('Price',n2(ob-(a.obt||0))).el('External',n2(a.obka||0)).el('Transport',n2(a.obt||0)).close('Equipment');
  sumItems(x,'Summary',s);x.el('Total',n2(a.total)).close(tag)}

const guid=()=>{let g=S.guid;if(!g||!/^\{[0-9A-F-]{36}\}$/.test(g)){const u=(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,ch=>{const r=Math.random()*16|0;return (ch==='x'?r:(r&3|8)).toString(16)}));g='{'+u.toUpperCase()+'}';S.guid=g}return g};

// проверки до выгрузки: что схема или экспертиза не примут
function xmlChecks(){sync();const E=[],W=[];const cur=S.level!=='base';
  if(hasVor()&&S.pos.some(p=>p.sec===undefined&&p.vor!=null))W.push(`позиции ссылаются на строки ВОР (QTF): приложите XML ведомости «${fileNames().vor}» (вкладка «Ведомость объёмов» → «XML ВОР» или пакет для экспертизы)`);
  const pos=S.pos.filter(p=>p.sec===undefined);if(!pos.length)E.push('Смета пустая');
  for(const p of pos){const c=calc(p);const nm=(p.code||'')+' '+(c.R.name||'').slice(0,40);
    if(p.own){E.push('Позиция «'+(c.R.name||'').slice(0,40)+'»: своя позиция вне сметных норм в XML не выгружается, схема ЛС РИМ 3.01 принимает только позиции с шифром норм (ГЭСН, ФССЦ и др.). Материал или оборудование вне базы оформите конъюнктурным анализом');continue}
    if(!p.ka&&!p.tr&&!p.mr&&!c.R.real)E.push('Позиция '+nm+': расценка не из ФСНБ-2022 (старая учебная база), в XML её не выгрузить');
    if(p.mr&&p.mr.rc&&!B.res[p.mr.rc])E.push('Позиция '+nm+': ресурса '+p.mr.rc+' нет в ФСБЦ текущей редакции, замените его или оформите конъюнктурным анализом');
    if(c.warn&&c.warn.some(w=>/нет цены/.test(w)))W.push('Позиция '+nm+': у части ресурсов нет цены');
    if(c.lines&&c.lines.some(l=>l.norm==='П'))W.push('Позиция '+nm+': ресурсы «П» (по проекту) без количества не выгружаются, добавьте их отдельными строками');
    if(c.R.real&&!(+p.qty>0))E.push('Позиция '+nm+': объём не указан')}
  if(!cur)E.push('XML по схеме ресурсно-индексного метода выгружается в текущем уровне цен. Переключите «Цены» в ленте на текущий квартал');
  if(S.base==='ucheb')W.push('Включена учебная база: нормы части расценок отличаются от ФСНБ-2022, такой файл экспертиза не примет. Для экспертизы переключитесь на ФСНБ-2022');
  const Q=req();if(!Q.sost)W.push('Не заполнено «Составил» (Выходные формы → реквизиты)');if(!Q.prov)W.push('Не заполнено «Проверил» (Выходные формы → реквизиты)');
  if(PR&&!REGION[PR.meta.subject])E.push('Нет кода региона для '+PR.meta.subject);
  return {E,W}}

const hasVor=()=>!!(S.vor&&S.vor.some(r=>r.sec===undefined));
function xmlLSR(){resId=0;sync();QTFN=hasVor()?fileNames().vor:null;const Q=req(),cur=S.level!=='base',T=totals(),now=new Date();
  const x=new X();x.a.push('<?xml version="1.0" encoding="UTF-8"?>');
  x.open('Construction');
  x.open('Meta').open('Soft').el('Name','Римора').el('Version','1.0').close('Soft').open('File').el('Type','ЛС').el('Version','3.01').close('File').close('Meta');
  x.el('Num',Q.stroykaNum||'1').el('Name',Q.stroyka||'Стройка');
  x.open('Object').el('Num',Q.objNum||'1').el('Name',Q.obj||'Объект').el('Address',Q.addr||'');
  x.open('Estimate').el('GUID',guid());
  x.open('Legal');legal(x,'Main',FRSN.fsnb);legal(x,'Metodology',FRSN.met);legal(x,'Overheads',FRSN.nr);legal(x,'Profits',FRSN.sp);
  if(cur&&PR){const L=letterOf(PR.meta);if(L)legal(x,'Indexes',{name:PR.meta.letter+' «О размещении индексов изменения сметной стоимости строительства по группам однородных строительных ресурсов на '+PR.meta.quarter.replace(/^(\d) квартал (\d{4}).*/,(m,q,y)=>['','I','II','III','IV'][+q]+' квартал '+y+' года')+'»',type:'ГСН',date:L.date,num:L.num})}
  x.close('Legal');
  x.el('Salary',cur&&PR?'Сметные цены затрат труда, ФГИС ЦС, '+PR.meta.subject+', '+PR.meta.quarter:'Базисный уровень цен на 01.01.2022 (ФСБЦ-2022)');
  x.open('Region').el('RegionCode',PR?REGION[PR.meta.subject]??0:0).el('RegionName',PR?PR.meta.subject:'').close('Region');
  x.el('ТerritoryТype','Территория');
  const num=(/\d{2}-\d{2}-\d{2}/.exec(Q.num||'')||[Q.num||'01-01-01'])[0];
  x.el('Num',num).el('Name',Q.works||S.name||'Локальный сметный расчёт').date('Date',now.getFullYear(),now.getMonth()+1,now.getDate());
  x.open('PriceLevelBase').el('Year',2022).el('Month',1).el('Day',1).el('Quarter',1).close('PriceLevelBase');
  if(cur&&PR){const m=/^(\d) квартал (\d{4})/.exec(PR.meta.quarter);if(m)x.open('PriceLevelCur').el('Year',m[2]).el('Quarter',m[1]).close('PriceLevelCur')}
  x.el('Reason',Q.osn||'');
  // итоги по смете считаем из тех же позиций, что и разделы
  const A=()=>({ot:0,otm:0,emN:0,em:0,mat:0,mka:0,per:0,direct:0,fot:0,nr:0,sp:0,total:0,zt:0,ztm:0,ob:0,obka:0,dpm:0,obt:0});const add=(a,c)=>{for(const k in a)a[k]+=(k==='emN'?(c.emN!=null?c.emN:(c.em||0)-(c.otm||0)):c[k]||0)};
  const secs=[];let cs=null;for(const p of S.pos){if(p.sec!==undefined){cs={name:p.sec,pos:[]};secs.push(cs);continue}if(!cs){cs={name:'Работы',pos:[]};secs.push(cs)}cs.pos.push(p)}
  const all=A(),allM=A();const body=new X();body.d=x.d+1;let n=0;
  secs.filter(s=>s.pos.length).forEach((s,i)=>{const a=A(),am=A();body.open('Section').el('Code',i+1).el('Name',s.name).open('Items');
    for(const p of s.pos){const c=calc(p);add(a,c);add(all,c);if(c.mon){add(am,c);add(allM,c)}n++;if(p.ka)itemKA(body,p,c);else if(p.mr)itemMR(body,p,c);else if(p.tr)itemTR(body,p,c);else itemCost(body,p,c,n)}
    body.close('Items');summary(body,'SectionPrice',a,am);body.close('Section')});
  summary(x,'EstimatePrice',all,allM);
  x.open('Signatures').el('ComposeFIO',Q.sost||'—').el('VerifyFIO',Q.prov||'—').close('Signatures');
  x.open('Sections');x.a.push(...body.a);x.close('Sections');
  x.close('Estimate').close('Object');
  if(S.bim&&S.bim.files&&S.bim.files.length&&window.RimoraBIMCore&&S.pos.some(p=>p.sec===undefined&&RimoraBIMCore.linkOf(S,p))){x.open('BIMFiles');for(const f of S.bim.files)x.el('FileName',f.name);x.close('BIMFiles')}
  const tz=-now.getTimezoneOffset(),pad=v=>String(v).padStart(2,'0');
  x.el('ExportDateTime',`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tz>=0?'+':'-'}${pad(Math.floor(Math.abs(tz)/60))}:${pad(Math.abs(tz)%60)}`);
  x.close('Construction');
  return {xml:x.toString()+'\n',totals:all,allM,T}}

function exportXML(){const {E,W}=xmlChecks();sync();
  if(E.length){toast('XML не выгружен: '+E[0]+(E.length>1?` (и ещё ${E.length-1})`:''));return}
  const {xml,totals:a,T}=xmlLSR();
  if(Math.abs(a.total-T.total)>0.05){toast('XML не выгружен: итог в файле '+n2(a.total)+' не совпал с итогом сметы '+n2(T.total));return}
  const Q=req(),nm=((Q.num||'ЛС')+' '+(S.name||'')).replace(/[\\/:*?"<>|]/g,'').trim();
  const el=document.createElement('a');el.href=URL.createObjectURL(new Blob([xml],{type:'application/xml'}));el.download=nm+'.xml';el.click();
  markDirty();
  toast('XML скачан (схема Минстроя ЛС РИМ 3.01)'+(W.length?'. Проверьте: '+W[0]+(W.length>1?` (и ещё ${W.length-1})`:''):''))}


/* ---------- пакет для экспертизы: ЛСР + ОСР 3.01 + ССРСС 3.01 + ПЗ к сметной документации 4.01 ----------
   Схемы: 75_Выходные_формы/raw/gge_v3/ObjectEstimate-3_01.xsd, SummaryEstimate-3_01.xsd, pzsd_401/…/ExplanatoryNoteEstimate-4_01.xsd.
   ОСР и ССРСС — в тысячах рублей с двумя знаками (как в печатных формах прил. 5 и 6). */
const {osrModel,ssrModel,ST,SSR_CH,dlBlob}=A;
const K=v=>n2((+v||0)/1000);
const newGuid=()=>'{'+(crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,ch=>{const r=Math.random()*16|0;return (ch==='x'?r:(r&3|8)).toString(16)})).toUpperCase()+'}';
const pad2=v=>String(v).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const stamp=now=>{const tz=-now.getTimezoneOffset();return `${isoDate(now)}T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}${tz>=0?'+':'-'}${pad2(Math.floor(Math.abs(tz)/60))}:${pad2(Math.abs(tz)%60)}`};
// «Инженер-сметчик, А. А. Андреева» → должность и ФИО
const sig=(v,defPos)=>{v=String(v||'').trim();const i=v.indexOf(',');return i>0?{pos:v.slice(0,i).trim(),name:v.slice(i+1).trim()||'—'}:{pos:defPos,name:v||'—'}};
const curQ=()=>{const m=PR&&/^(\d) квартал (\d{4})/.exec(PR.meta.quarter);return m?{y:+m[2],q:+m[1]}:null};
const pzDef=()=>({kind:'non',ctype:1,fclass:'',fnote:'',teiName:'',teiUnit:'',teiVal:'',terr:'территория',fin:'budget',blevel:'Федеральный бюджет',duration:'',reason:'',corr:false});
const PZ=()=>{const st=ST();st.pz={...pzDef(),...(st.pz||{})};st.guids=st.guids||{};for(const k of ['osr','ssr','pz','vor'])if(!st.guids[k])st.guids[k]=newGuid();return st.pz};
const fileNames=()=>{const Q=req(),st=ST(),cl=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'').trim();
  return {lsr:cl('ЛСР '+(Q.num||'01-01-01'))+'.gge',osr:cl('ОСР '+st.osrNum)+'.gge',ssr:cl('ССРСС '+st.ssrNum)+'.gge',pz:'ПЗ к сметной документации.gge',vor:cl('ВОР '+(String(S.vorDoc||'').trim()||Q.num||'01-01-01'))+'.gge'}};
const pe=(x,r,noTotal)=>{x.el('Building',n2(r.b)).el('Mounting',n2(r.m)).el('Equipment',n2(r.e)).el('Other',n2(r.o));if(!noTotal)x.el('Total',n2(r.b+r.m+r.e+r.o));return x};
const meta=(x,type,ver)=>x.open('Meta').open('Soft').el('Name','Римора').el('Version','1.0').close('Soft').open('File').el('Type',type).el('Version',ver).close('File').close('Meta');
const priceLevel=(x,tag,q,basic)=>{x.open(tag).el('Year',q.y).el('Quarter',q.q).el('BasicPrice',basic?'true':'false').close(tag)};
const signs=(x,list)=>{x.open('Signatures');for(const [t,o,dep] of list){x.open(t).el('Name',o.name||'—');if(dep!==undefined)x.el(dep[0],dep[1]||'—');x.close(t)}x.close('Signatures')};
// детализация ЛСР по элементам затрат (рубли сметы → тыс. руб.)
function osrItems(x,nm,a){const em=a.emN!=null?a.emN:(a.em-a.otm);
  x.open(nm).el('Total',K(a.total)).el('WorkersSalary',K(a.ot)).el('MachinistSalary',K(a.otm)).el('Salary',K(a.fot)).el('Overhead',K(a.nr)).el('Profit',K(a.sp)).el('Machines',K(em))
   .el('Materials',K(a.mat+(a.dpm||0))).el('Direct',K(a.direct)).el('TotalLaborCosts',n7(a.zt+a.ztm)).el('LaborCosts',n7(a.zt)).el('MachinistLaborCosts',n7(a.ztm))
   .el('Transport',K((a.per||0)-(a.dpm||0))).el('Price',K(a.total-(a.per||0))).close(nm)}
const zeroA=()=>({ot:0,otm:0,emN:0,em:0,mat:0,per:0,direct:0,fot:0,nr:0,sp:0,total:0,zt:0,ztm:0,dpm:0});
function lsrDetails(x,tag,L,ssr){const a=L.totals,am=L.allM||zeroA(),ob=a.ob||0,b={};for(const k in a)b[k]=(a[k]||0)-(am[k]||0);b.total-=ob;const s={...a,total:a.total-ob};
  x.open(tag);osrItems(x,'Building',b);osrItems(x,'Mounting',am.total?am:zeroA());
  x.open('Equipment').el('Total',K(ob)).el('Price',K(ob-(a.obt||0))).el('External',K(a.obka||0)).el('Transport',K(a.obt||0)).close('Equipment');
  if(ssr)x.el('Total',K(a.total)).el('Summary',K(s.total));else{x.el('Total',K(a.total));osrItems(x,'Summary',s)}x.close(tag)}
function rowDetails(x,tag,r,ssr){const it=(nm,v)=>x.open(nm).el('Total',n2(v)).el('Price',n2(v)).close(nm);
  x.open(tag);it('Building',r.b);it('Mounting',r.m);x.open('Equipment').el('Total',n2(r.e)).el('Price',n2(r.e)).close('Equipment');x.el('Other',n2(r.o));
  if(ssr)x.el('Total',n2(r.b+r.m+r.e+r.o)).el('Summary',n2(r.b+r.m));else{x.el('Total',n2(r.b+r.m+r.e+r.o));it('Summary',r.b+r.m)}x.close(tag)}

function packChecks(){const {E,W:W1}=xmlChecks(),W0=W1.filter(w=>!w.startsWith('позиции ссылаются на строки ВОР'));if(hasVor()){const V=xmlVOR();E.push(...V.E);W0.push(...V.W)}const st=ST(),pz=PZ(),O=osrModel();
  const W=W0.filter(w=>!(st.sign.sost&&/«Составил»/.test(w))&&!(st.sign.prov&&/«Проверил»/.test(w)));
  if(!curQ())E.push('Не определён текущий квартал цен');
  if(!/^(\d{1,2}\.\d{1,2}\.\d{1,3}\.\d{1,3}|\d{1,2}\.\d{1,2}\.\d{1,3})$/.test(pz.fclass.trim()))E.push('ПЗ: укажите код функционального назначения объекта по классификатору (например 19.7.1.3)');
  if(!pz.teiName.trim()||!pz.teiUnit.trim()||!String(pz.teiVal).trim())E.push('ПЗ: заполните главный технико-экономический показатель (наименование, единица, значение)');
  if(!(+String(pz.teiVal).replace(',','.')>0))E.push('ПЗ: значение главного показателя должно быть числом больше нуля');
  for(const [k,l] of [['gip','Главный инженер проекта'],['nach','Начальник отдела'],['sost','Составил'],['prov','Проверил'],['ruk','Руководитель проектной организации'],['zak','Заказчик']])if(!String(st.sign[k]||'').trim())W.push('Не заполнена подпись «'+l+'» (вкладка «Данные стройки»)');
  if(!st.zakOrg)W.push('Не указан заказчик (ССРСС)');
  if(st.lsr.length)W.push('Другие ЛСР объекта ('+st.lsr.map(l=>l.num||'без номера').join(', ')+') в пакет не входят: приложите их XML-файлы с именами '+st.lsr.map(l=>'«ЛСР '+(l.num||'')+'.gge»').join(', '));
  if(st.rows.length)W.push('Строки ССРСС по главам выгружены как расчёты и лимитированные затраты: файлы-обоснования приложите отдельно');
  return {E,W}}

function xmlOSR(L,F){sync();const Q=req(),O=osrModel(),st=O.st,now=new Date(),q=curQ()||{y:now.getFullYear(),q:1},pz=PZ();
  const x=new X();x.a.push('<?xml version="1.0" encoding="UTF-8"?>');x.open('Construction');meta(x,'ОСР','3.01');
  x.el('Num',Q.stroykaNum||'1').el('Name',Q.stroyka||'Стройка');
  x.open('Object').el('Num',st.osrNum.replace(/^ОС-?/,'')||'01-01').el('Name',Q.obj||'Объект').el('Address',Q.addr||'')
   .el('Region',PR?REGION[PR.meta.subject]??0:0).el('SubRegion',PR?PR.meta.zone:'').el('Reason',Q.osn||'Проектная документация').el('ReasonLink',pz.reason||F.pz);
  const izm=+String(st.izmQ).replace(',','.');if(izm>0)x.el('Quantity',n7(izm)).el('PricePerUnit',n2(O.tot/izm)).el('QuantityUnit',st.izmU||'');
  x.el('Created',isoDate(now)).el('Approved',isoDate(now));priceLevel(x,'PriceLevel',q,false);
  x.open('Summary');pe(x,O.all);x.close('Summary');
  signs(x,[['ChiefProjectEngineer',{name:st.sign.gip}],['Chief',{name:st.sign.nach},['Department',st.sign.otdel||'Сметный отдел']],
    ['Composer',sig(st.sign.sost||Q.sost,'Составил'),['Position',sig(st.sign.sost||Q.sost,'Составил').pos]],['Verifier',sig(st.sign.prov||Q.prov,'Проверил'),['Position',sig(st.sign.prov||Q.prov,'Проверил').pos]]]);
  O.rows.forEach((r,i)=>{x.open('LocalEstimate');pe(x,r).el('Name',r.name||'Локальный сметный расчёт').el('Num',i+1).el('Reason',r.osn||'—');
    if(i===0)lsrDetails(x,'Details',L,false);else rowDetails(x,'Details',r,false);
    x.el('Link',i===0?F.lsr:('ЛСР '+String(r.osn||'').replace(/[\\/:*?"<>|]/g,'')).trim()+'.gge').close('LocalEstimate')});
  // шаги ОСР: итог по ЛСР → ВЗиС → итог → ЗУ → итог
  const S1=O.steps[0].it;x.open('SubSummary1');pe(x,S1);x.close('SubSummary1');
  let i=1;for(const [key,tag,sub] of [['vz','TempBuildings','SubSummary2'],['win','Additions','SubSummary3']]){if(!st[key].on)continue;const r=O.steps[i],it=O.steps[i+1].it;i+=2;
    x.open(tag);pe(x,r).el('Name',r.name).el('Percent',n7(+String(st[key].pct).replace(',','.')||0)).el('Reason',st[key].osn||'—').el('Link',F.pz).close(tag);
    x.open(sub);pe(x,it);x.close(sub)}
  // детализация всего ОСР: по элементам только при одной ЛСР без начислений, иначе итогами граф
  if(O.rows.length===1&&!st.vz.on&&!st.win.on)lsrDetails(x,'Details',L,false);else rowDetails(x,'Details',O.all,false);
  x.close('Object');x.el('ExportDateTime',stamp(now));x.close('Construction');return {xml:x.toString()+'\n',total:O.tot}}

const CHN={13:'Резерв средств на непредвиденные работы и затраты',14:'Налоги и обязательные платежи'};
function xmlSSR(L,F){sync();const Q=req(),M=ssrModel(),st=M.st,O=M.O,now=new Date(),q=curQ()||{y:now.getFullYear(),q:1};
  const x=new X();x.a.push('<?xml version="1.0" encoding="UTF-8"?>');x.open('Construction');meta(x,'ССР','3.01');
  x.el('Num',Q.stroykaNum||st.ssrNum||'1').el('Name',Q.stroyka||'Стройка').el('Customer',st.zakOrg||'—').el('Created',isoDate(now)).el('Approved',isoDate(now));
  priceLevel(x,'PriceLevel',q,false);x.open('Summary');pe(x,M.total);x.close('Summary');
  let num=0;const ownName=`${O.Q.obj} (объектный сметный расчёт № ${st.osrNum})`;
  for(let ch=1;ch<=14;ch++){const C=M.CH[ch];if(!C)continue;const tag='Chapter'+ch;x.a.push('  '.repeat(x.d)+`<${tag} numberOfChapter="${ch}">`);x.d++;
    x.open('ChapterName').el('ConstantNameChapter',ch<=12?SSR_CH[ch-1]:CHN[ch]).close('ChapterName');
    for(const r of C.rows){num++;const own=ch===+st.ch&&r.name===ownName;
      if(own){x.open('ObjectEstimate');pe(x,r).el('Name',r.name).el('Num',num).el('Reason',r.osn||st.osrNum);rowDetails(x,'Details',r,true);x.el('Link',F.osr).el('StageID',0).el('StageName','Без этапа').close('ObjectEstimate')}
      else if(ch<=7||(r.link&&ch!==13&&ch!==14)){x.open('Calculation');pe(x,r).el('Name',r.name).el('Num',num).el('Reason',r.osn||'—').el('Link',r.link||String(r.osn||'Расчёт').replace(/[\\/:*?"<>|]/g,'')+'.pdf').el('StageID',0).el('StageName','Без этапа').close('Calculation')}
      else{x.open('Addition');pe(x,r).el('Name',r.name).el('Num',num).el('Reason',r.osn||'—').close('Addition')}}
    x.open('Summary');pe(x,C.sum);x.close('Summary');
    if(ch>=7&&ch!==14){x.open('SubSummary');pe(x,C.acc);x.close('SubSummary')}
    x.d--;x.a.push('  '.repeat(x.d)+`</${tag}>`)}
  const Z=s=>sig(s,'—');
  signs(x,[['ProjectOrg',{name:st.sign.ruk}],['ChiefProjectEngineer',{name:st.sign.gip}],['Chief',{name:st.sign.nach},['Department',st.sign.otdel||'Сметный отдел']],
    ['Customer',Z(st.sign.zak),['Position',Z(st.sign.zak).pos]],['Composer',sig(st.sign.sost||Q.sost,'Составил'),['Position',sig(st.sign.sost||Q.sost,'Составил').pos]],
    ['Verifier',sig(st.sign.prov||Q.prov,'Проверил'),['Position',sig(st.sign.prov||Q.prov,'Проверил').pos]]]);
  x.el('ExportDateTime',stamp(now));x.close('Construction');return {xml:x.toString()+'\n',total:gs(M.total),M}}
const gs=r=>Math.round((r.b+r.m+r.e+r.o)*100)/100;

// CRC32-IEEE; в схеме ПЗ поле контрольной суммы — 32 шестнадцатеричных знака, поэтому 8 знаков CRC32 дополняются нулями слева
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRCT[(c^b[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
const enc=s=>new TextEncoder().encode(s);
const noStamp=s=>s.replace(/\n[ \t]*<ExportDateTime>[^<]*<\/ExportDateTime>/,'');
const checksum=xml=>crc32(enc(noStamp(xml))).toString(16).padStart(32,'0');

function xmlPZ(docs,F){sync();const Q=req(),st=ST(),pz=PZ(),M=ssrModel(),O=M.O,now=new Date(),q=curQ()||{y:now.getFullYear(),q:1};
  const x=new X();x.a.push('<?xml version="1.0" encoding="UTF-8"?>');x.open('Construction');meta(x,'ПЗ','4.01');
  const tag=pz.kind==='ind'?'IndustrialObject':'NonIndustrialObject';
  x.open('ObjectDescription').open(tag).el('Name',Q.obj||'Объект').el('ConstructionType',+pz.ctype||1);
  const dur=+String(pz.duration).replace(',','.');if(dur>0)x.el('ConstructionDuration',n7(dur));
  x.open('Address').el('Region',pad2(PR?REGION[PR.meta.subject]??0:0));if(Q.addr)x.el('Note',Q.addr);
  if(PR&&PR.meta.zone)x.open('PriceZone').el('SubRegionCode',String(PR.meta.zoneId||'00')).el('SubRegionName',PR.meta.zone).close('PriceZone');
  x.el('TerritorySign',pz.terr||'территория').close('Address');
  x.open('Functions');if(pz.fnote)x.el('FunctionsNote',pz.fnote);x.el('FunctionsClass',pz.fclass.trim()).close('Functions');
  const tv=+String(pz.teiVal).replace(',','.')||0;
  x.open('MainTEI').el('Name',pz.teiName).el('Measure',pz.teiUnit).el('Value',String(pz.teiVal)).el('UnitCost',n2(tv?O.tot/tv:0)).close('MainTEI');
  x.close(tag).close('ObjectDescription');
  x.open('ProjectDocumentationContent');
  const ng=g=>String(g).replace(/[{}]/g,'');
  for(const d of docs){x.open('ProjectDocument').el('GUID',ng(d.guid)).el('DocumentType',d.type).el('DocumentCode',d.code).el('DocumentName',d.name)
    .open('File').el('FileName',d.file).el('FileFormat','gge').el('FileChecksum',checksum(d.xml)).close('File');
    if(!d.noSum)x.open('SummaryData').el('TotalCost',n2(d.total)).open('BasicPriceLevel').el('Year',2022).el('Month',1).el('Quarter',1).el('Day',1).el('CalculationMethod','Ресурсно-индексный').close('BasicPriceLevel')
    .open('CurentPriceLevel').el('Year',q.y).el('Quarter',q.q).el('CalculationMethod','Ресурсно-индексный').close('CurentPriceLevel').close('SummaryData');
    if(d.dep)x.open('Dependencies').el('DependsOnGUID',ng(d.dep)).close('Dependencies');x.close('ProjectDocument')}
  x.close('ProjectDocumentationContent');
  x.open('ExplanatoryNoteEstimate').open('FinanceSource');
  if(pz.fin==='budget')x.open('BudgetSource').el('BudgetLevel',pz.blevel||'Федеральный бюджет').close('BudgetSource');else x.open('PrivateSource').close('PrivateSource');
  x.close('FinanceSource');
  x.open('Legal');legal(x,'Main',FRSN.fsnb);legal(x,'Metodology',FRSN.met);legal(x,'Overheads',FRSN.nr);legal(x,'Profits',FRSN.sp);
  if(PR){const Lt=letterOf(PR.meta);if(Lt)legal(x,'Indexes',{name:PR.meta.letter,type:'ГСН',date:Lt.date,num:Lt.num})}
  x.close('Legal');
  x.open('BasicPriceLevel').el('Year',2022).el('Month',1).el('Quarter',1).el('Day',1).el('CalculationMethod','Ресурсно-индексный').close('BasicPriceLevel');
  x.open('CurrentPriceLevel').el('Year',q.y).el('Quarter',q.q).el('CalculationMethod','Ресурсно-индексный').close('CurrentPriceLevel');
  const T=M.total,nds=M.CH[14]?M.CH[14].sum:{b:0,m:0,e:0,o:0},pir=M.CH[12]?M.CH[12].sum:null,cr=(t,v)=>x.open(t).el('CurrentLevelPrice',n2(v)).close(t);
  x.open('CostSummary');cr('Total',gs(T));cr('ConstructionWorks',T.b+T.m);cr('Equipment',T.e);cr('OtherCosts',T.o);if(pir)cr('DesignAndSurveyWorks',gs(pir));cr('Vat',gs(nds));x.close('CostSummary');
  x.el('IsCorrection',pz.corr?'true':'false').close('ExplanatoryNoteEstimate');
  const cs=sig(st.sign.sost||Q.sost,'Составил'),vs=sig(st.sign.prov||Q.prov,'Проверил');
  x.open('Signatures').open('ComposeFIO').el('Name',cs.name).el('Position',cs.pos).close('ComposeFIO').open('VerifyFIO').el('Name',vs.name).el('Position',vs.pos).close('VerifyFIO').close('Signatures');
  // текст записки: только факты из сметы
  const pct=s=>String(s||'').replace('.',',');
  const lines=[`Сметная документация составлена ресурсно-индексным методом в текущем уровне цен ${PR?PR.meta.quarter:''} по сметным нормативам ФСНБ-2022 и Методике, утверждённой приказом Минстроя России от 04.08.2020 № 421/пр.`,
    PR?`Сметные цены ресурсов приняты по данным ФГИС ЦС для ценовой зоны «${PR.meta.zone||PR.meta.subject}»; при отсутствии сметной цены применены индексы по группам однородных ресурсов${PR.meta.letter?' ('+PR.meta.letter+')':''}.`:'',
    'Накладные расходы определены по Методике 812/пр, сметная прибыль — по Методике 774/пр.',
    st.vz.on?`Затраты на титульные временные здания и сооружения — ${pct(st.vz.pct)}% (${st.vz.osn||'обоснование не указано'}).`:'',
    st.win.on?`Дополнительные затраты при производстве работ в зимнее время — ${pct(st.win.pct)}% (${st.win.osn||'обоснование не указано'}).`:'',
    M.CH[13]?`Резерв средств на непредвиденные работы и затраты — ${pct(M.CH[13].pct)}% от итога глав 1–12 (п. 179 Методики 421/пр).`:'',
    M.CH[14]?`Налог на добавленную стоимость — ${M.CH[14].pct}% (пп. 180–181 Методики 421/пр).`:''].filter(Boolean);
  x.a.push('  '.repeat(x.d)+'<DesignerNote Title="Сведения о составлении сметной документации">');x.d++;for(const l of lines)x.el('Text',l);x.d--;x.a.push('  '.repeat(x.d)+'</DesignerNote>');
  x.el('ExportDateTime',stamp(now));x.close('Construction');return {xml:x.toString()+'\n'}}

// zip без сжатия (store), имена в UTF-8
function zip(files){const parts=[],cent=[];let off=0;const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
  for(const f of files){const nm=enc(f.name),data=enc(f.data),c=crc32(data),h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dt,true);h.setUint16(12,dd,true);
    h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,data);
    const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);
    ch.setUint16(12,dt,true);ch.setUint16(14,dd,true);ch.setUint32(16,c,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cent.push(new Uint8Array(ch.buffer),nm);off+=30+nm.length+data.length}
  const cl=cent.reduce((a,b)=>a+b.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cl,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cent,new Uint8Array(e.buffer)],{type:'application/zip'})}


/* ---------- ведомость объёмов работ, схема «Ведомость объемов работ» 3.01 (QuantityTakeoff-3_01.xsd, с 11.01.2025;
   копия: 75_Выходные_формы/raw/vor_301/). Строка: номер, наименование, единица без кратности, объём, формула, ссылки на чертежи (лист) или на элементы модели IFC. */
const okei=u=>String(u||'').replace(/²/g,'2').replace(/³/g,'3').replace(/\.$/,'').trim();
function xmlVOR(){sync();const Q=req(),st=ST(),now=new Date(),V=S.vor||[],E=[],W=[],F=fileNames();
  const cl=s=>String(s||'').replace(/[\\/:*?"<>|]/g,'').trim(),pdfs=String(S.vorPdf||'').split(/[;\n]+/).map(cl).filter(Boolean).map(f=>/\.[a-z0-9]{2,4}$/i.test(f)?f:f+'.pdf');
  if(!pdfs.length)pdfs.push(cl(Q.osn||'Проектная документация')+'.pdf');const base=f=>f.replace(/\.[a-z0-9]{2,4}$/i,''),byLen=[...pdfs].sort((a,b)=>base(b).length-base(a).length);
  const files=[],fid=n=>{let f=files.find(x=>x.n===n);if(!f){f={id:files.length+1,n};files.push(f)}return f.id};
  const secs=[];let cs=null;for(const r of V){if(r.sec!==undefined){cs={name:r.sec,rows:[]};secs.push(cs);continue}if(!cs){cs={name:'',rows:[]};secs.push(cs)}cs.rows.push(r)}
  const body=new X();body.d=2;let k=0;const nopg=[],orph=[];
  // ссылка строки: элементы модели IFC или листы чертежей; файл — по имени в «Лист проекта», иначе первый
  const link=(r,n)=>{const bf=r.bim&&r.bim.els&&r.bim.els.length&&S.bim&&S.bim.files&&S.bim.files.length?S.bim.files[(r.bim.f||1)-1]||S.bim.files[0]:null;
    if(bf){body.open('Link').el('FileID',fid(bf.name)).el('ifcGuid',r.bim.els.map(e=>e.g).join(' ')).el('ifcDescription',`${String(r.ref||'').trim()?r.ref+'; ':''}из модели: ${r.bim.els.length} эл., ${String(r.bim.key).split('.').pop()}`).close('Link');return}
    let ref=String(r.ref||''),file=pdfs[0];for(const f of byLen){const b=base(f),ix=ref.toLowerCase().indexOf(b.toLowerCase());if(b&&ix>=0){file=f;ref=ref.slice(0,ix)+' '+ref.slice(ix+b.length);break}}
    let pg=(ref.replace(/\.[a-z0-9]{2,4}\b/ig,' ').match(/\d+/g)||[]).map(Number).filter(x=>x>0);if(!pg.length){pg=[1];nopg.push(n)}
    body.open('Link').el('FileID',fid(file)).el('PageNumber',pg.join(' ')).el('PageDescription',String(r.ref||'').trim()||String(r.name||'').trim()||'—').close('Link')};
  const item=(tag,r,n,num,type)=>{const v=A.vorVal(r);if(v==null||!(v>0))E.push(`ВОР, строка ${n}: объём не считается или не больше нуля`);if(!String(r.name||'').trim())E.push(`ВОР, строка ${n}: нет наименования`);
    body.open(tag).el('Num',num).el('Type',type).el('Name',String(r.name||'').trim()||'—').el('Unit',okei(r.unit)||'—').el('Quantity',n7(v||0)).el('QuantityFormula',String(r.f||'').trim()||n7(v||0)).open('Links');link(r,n);body.close('Links')};
  secs.filter(s=>s.rows.some(r=>!r.res)).forEach(sc=>{body.open('Section').el('Num',++k).el('Name',sc.name||'Работы').open('Works');let open=false,rk=0;
    const end=()=>{if(!open)return;if(rk)body.close('Resources');body.close('Work');open=false};
    for(const r of sc.rows){const n=A.vorLbl?A.vorLbl(r.id):A.vorNum(r.id);
      if(r.res){if(!open){orph.push(n);continue}if(!rk)body.open('Resources');rk++;item('Resource',r,n,rk,r.rt==='оборудование'?'оборудование':'материал');body.close('Resource');continue}
      end();item('Work',r,n,A.vorNum(r.id),'работа');open=true;rk=0}
    end();body.close('Works').close('Section')});
  for(const sc of secs)if(!sc.rows.some(r=>!r.res))for(const r of sc.rows)orph.push(A.vorLbl?A.vorLbl(r.id):A.vorNum(r.id));
  if(orph.length)W.push(`ВОР: ресурсы ${orph.slice(0,8).join(', ')} стоят без работы выше в своём разделе и в XML не попали`);
  if(!String(S.vorDoc||'').trim())W.push('ВОР: не указан номер ведомости — по схеме он совпадает с шифром комплекта чертежей (поле на вкладке «Ведомость объёмов»)');
  if(!k)E.push('ведомость объёмов пуста');
  if(nopg.length)W.push(`ВОР: в «Лист проекта» нет номера листа у строк ${nopg.slice(0,8).join(', ')}${nopg.length>8?'…':''}, в XML записан лист 1 — укажите листы`);
  const used=pdfs.filter(p=>files.some(f=>f.n===p));if(used.length)W.push(`ВОР ссылается на ${used.length>1?'файлы':'файл'} чертежей ${used.map(p=>'«'+p+'»').join(', ')}: приложите к пакету (имена задаются на вкладке «Ведомость объёмов»)`);
  const x=new X();x.a.push('<?xml version="1.0" encoding="UTF-8"?>');x.open('Construction');meta(x,'Ведомость объемов работ','3.01');
  x.el('ConstructionSite',Q.stroyka||'Стройка').el('ObjectName',Q.obj||'Объект');if(String(S.vorDoc||'').trim())x.el('Num',String(S.vorDoc).trim());x.el('Reason',Q.osn||'Проектная документация')
   .date('Date',now.getFullYear(),now.getMonth()+1,now.getDate()).el('ExportDateTime',stamp(now));
  const cs2=sig(st.sign.sost||Q.sost,'Составил'),vs=sig(st.sign.prov||Q.prov,'Проверил');
  x.open('Signatures').open('Composer').el('Name',cs2.name).el('Position',cs2.pos).close('Composer').open('Verifier').el('Name',vs.name).el('Position',vs.pos).close('Verifier').close('Signatures');
  x.open('Files');for(const f of files)x.open('File').el('ID',f.id).el('FileName',f.n).close('File');x.close('Files');
  x.open('Sections');x.a.push(...body.a);x.close('Sections');x.close('Construction');
  return {xml:x.toString()+'\n',E,W,file:F.vor,files}}
function exportVOR(){const R=xmlVOR();if(R.E.length){toast('XML ВОР не выгружен: '+R.E[0]+(R.E.length>1?` (и ещё ${R.E.length-1})`:''));return R}
  dlBlob(new Blob([R.xml],{type:'application/xml'}),R.file);toast('XML ВОР скачан (схема Минстроя ВОР 3.01)'+(R.W.length?'. Проверьте: '+R.W[0]+(R.W.length>1?` (и ещё ${R.W.length-1})`:''):''));return R}
function buildPack(){sync();PZ();const st=ST(),Q=req(),F=fileNames(),L=xmlLSR();const O=xmlOSR(L,F),C=xmlSSR(L,F);
  const docs=[{guid:guid(),type:'ЛСР',code:Q.num||'',name:'Локальный сметный расчёт '+(Q.num||'')+(Q.works?' '+Q.works:''),file:F.lsr,xml:L.xml,total:L.totals.total},
    {guid:st.guids.osr,type:'ОСР',code:st.osrNum,name:'Объектный сметный расчёт '+st.osrNum+' '+(Q.obj||''),file:F.osr,xml:O.xml,total:O.total,dep:guid()},
    {guid:st.guids.ssr,type:'ССРСС',code:st.ssrNum,name:'Сводный сметный расчёт стоимости строительства '+st.ssrNum,file:F.ssr,xml:C.xml,total:C.total,dep:st.guids.osr}];
  let Vr=null;if(hasVor()){Vr=xmlVOR();docs.unshift({guid:st.guids.vor,type:'ВОР',code:String(S.vorDoc||'').trim()||Q.num||'',name:'Ведомость объемов работ '+(String(S.vorDoc||'').trim()||Q.num||'')+(Q.works?' '+Q.works:''),file:F.vor,xml:Vr.xml,noSum:true});docs[1].dep=st.guids.vor}
  const P=xmlPZ(docs,F);return {F,L,O,C,P,V:Vr,files:[...(Vr?[{name:F.vor,data:Vr.xml}]:[]),{name:F.lsr,data:L.xml},{name:F.osr,data:O.xml},{name:F.ssr,data:C.xml},{name:F.pz,data:P.xml}]}}
function exportPack(){const {E,W}=packChecks();
  if(E.length){toast('Пакет не собран: '+E[0]+(E.length>1?` (и ещё ${E.length-1})`:''));return {E,W}}
  const R=buildPack();if(Math.abs(R.L.totals.total-R.L.T.total)>0.05){toast('Пакет не собран: итог ЛСР в XML не совпал с итогом сметы');return {E:['итог'],W}}
  dlBlob(zip(R.files),'Сметная документация '+(req().obj||'')+'.zip');markDirty();
  toast('Пакет для экспертизы скачан: '+(R.V?'ВОР, ':'')+'ЛСР, ОСР, ССРСС и ПЗ'+(W.length?'. Проверьте: '+W[0]+(W.length>1?` (и ещё ${W.length-1})`:''):''));return {E,W}}

return {xmlLSR,exportXML,xmlChecks,xmlOSR,xmlSSR,xmlPZ,xmlVOR,exportVOR,buildPack,exportPack,packChecks,PZ,zip,crc32}};
