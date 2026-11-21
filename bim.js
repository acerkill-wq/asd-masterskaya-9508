/* Римора: ТИМ — чтение модели IFC (шаги 1–3 раздела «Идея: ТИМ» дорожной карты).
   Модель читается в браузере библиотекой web-ifc (MPL-2.0, файлы в vendor/web-ifc без изменений), на сервер не уходит.
   Геометрия не строится: берутся элементы, этажи и количества из наборов Qto_* (IfcElementQuantity),
   а если их нет — числовые свойства с объёмом, площадью, длиной из наборов свойств.
   Все величины приводятся к м, м², м³ по единицам проекта (IfcUnitAssignment). */
(function (G) {
  // типы элементов, которые сметчик считает; ключ — имя константы web-ifc
  const TYPES = [
    ['IFCFOOTING', 'Фундаменты'], ['IFCPILE', 'Сваи'], ['IFCWALL', 'Стены'], ['IFCWALLSTANDARDCASE', 'Стены'], ['IFCWALLELEMENTEDCASE', 'Стены'],
    ['IFCCURTAINWALL', 'Витражи'], ['IFCCOLUMN', 'Колонны'], ['IFCCOLUMNSTANDARDCASE', 'Колонны'], ['IFCBEAM', 'Балки'], ['IFCBEAMSTANDARDCASE', 'Балки'],
    ['IFCSLAB', 'Плиты и перекрытия'], ['IFCSLABSTANDARDCASE', 'Плиты и перекрытия'], ['IFCSLABELEMENTEDCASE', 'Плиты и перекрытия'], ['IFCROOF', 'Кровли'],
    ['IFCSTAIR', 'Лестницы'], ['IFCSTAIRFLIGHT', 'Лестничные марши'], ['IFCRAMP', 'Пандусы'], ['IFCRAMPFLIGHT', 'Пандусы'], ['IFCRAILING', 'Ограждения'],
    ['IFCDOOR', 'Двери и ворота'], ['IFCDOORSTANDARDCASE', 'Двери и ворота'], ['IFCWINDOW', 'Окна'], ['IFCWINDOWSTANDARDCASE', 'Окна'],
    ['IFCCOVERING', 'Покрытия и отделка'], ['IFCPLATE', 'Пластины и панели'], ['IFCMEMBER', 'Стержни и профили'], ['IFCCHIMNEY', 'Дымоходы'],
    ['IFCREINFORCINGBAR', 'Арматура'], ['IFCREINFORCINGMESH', 'Арматурные сетки'],
    ['IFCPIPESEGMENT', 'Трубы'], ['IFCPIPEFITTING', 'Фасонные части труб'], ['IFCDUCTSEGMENT', 'Воздуховоды'], ['IFCDUCTFITTING', 'Фасонные части воздуховодов'],
    ['IFCCABLESEGMENT', 'Кабели'], ['IFCCABLECARRIERSEGMENT', 'Кабельные лотки'], ['IFCFLOWSEGMENT', 'Сегменты сетей'], ['IFCFLOWFITTING', 'Фасонные части сетей'],
    ['IFCFLOWTERMINAL', 'Приборы'], ['IFCSANITARYTERMINAL', 'Сантехприборы'], ['IFCLIGHTFIXTURE', 'Светильники'], ['IFCFURNISHINGELEMENT', 'Мебель и оборудование'],
    ['IFCBUILDINGELEMENTPROXY', 'Прочие элементы']];
  // вид величины: V — объём, A — площадь, L — длина, C — штуки, W — масса
  const KIND = { V: 'объём', A: 'площадь', L: 'длина', C: 'количество', W: 'масса' }, KU = { V: 'м3', A: 'м2', L: 'м', C: 'шт', W: 'кг' };
  const QN = { // понятные имена стандартных количеств
    NetVolume: 'объём нетто', GrossVolume: 'объём брутто', NetArea: 'площадь нетто', GrossArea: 'площадь брутто', NetSideArea: 'площадь боковой поверхности нетто',
    GrossSideArea: 'площадь боковой поверхности брутто', NetFootprintArea: 'площадь основания нетто', GrossFootprintArea: 'площадь основания брутто',
    Length: 'длина', Width: 'толщина (ширина)', Height: 'высота', Depth: 'глубина', Perimeter: 'периметр', Area: 'площадь', NetWeight: 'масса нетто',
    GrossWeight: 'масса брутто', OuterSurfaceArea: 'наружная поверхность', CrossSectionArea: 'площадь сечения', Count: 'штук'};
  const val = x => x == null ? null : typeof x === 'object' ? ('value' in x ? val(x.value) : null) : x;
  const ref = x => x == null ? null : typeof x === 'object' ? x.value : x;
  // строка STEP: \X2\…\X0\ (UTF-16), \X\hh (ISO 8859-1), \S\c — на случай, если библиотека не раскодировала
  const dec = t => typeof t !== 'string' ? t : t.replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (m, h) => h.match(/.{4}/g).map(c => String.fromCharCode(parseInt(c, 16))).join(''))
    .replace(/\\X\\([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\S\\(.)/g, (m, c) => String.fromCharCode(c.charCodeAt(0) + 128));
  const PREF = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 10, DECI: 1e-1, CENTI: 1e-2, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9 };

  function units(api, W, m) {
    const U = { L: 1, A: 1, V: 1, W: 1, txt: [] };
    const ids = api.GetLineIDsWithType(m, W.IFCUNITASSIGNMENT);
    if (!ids.size()) { U.txt.push('единицы проекта не заданы, считаем в метрах'); return U }
    const ua = api.GetLine(m, ids.get(0), false);
    for (const r of ua.Units || []) {
      const u = api.GetLine(m, ref(r), false), t = api.GetLineType(m, ref(r));
      let ut = val(u.UnitType), f = 1;
      if (t === W.IFCSIUNIT) { const p = val(u.Prefix); f = p ? PREF[p] || 1 : 1; const nm = val(u.Name);
        if (nm === 'GRAM') f /= 1000; }
      else if (t === W.IFCCONVERSIONBASEDUNIT) { const cf = api.GetLine(m, ref(u.ConversionFactor), false); const vc = val(cf.ValueComponent);
        const uc = api.GetLine(m, ref(cf.UnitComponent), false); const p = val(uc.Prefix); f = (+vc || 1) * (p ? PREF[p] || 1 : 1); if (/LENGTH|AREA|VOLUME|MASS/.test(ut || '')) U.txt.push(`единица ${dec(val(u.Name))}: множитель ${f}`) }
      else continue;
      if (ut === 'LENGTHUNIT') { U.L = f; if (f !== 1) U.txt.push(`длина в модели: ${f === 1e-3 ? 'мм' : f === 1e-2 ? 'см' : '×' + f}`) }
      else if (ut === 'AREAUNIT') { U.A = t === W.IFCSIUNIT ? f * f : f; if (U.A !== 1) U.txt.push(`площадь в модели: ${U.A === 1e-6 ? 'мм²' : '×' + U.A}`) }
      else if (ut === 'VOLUMEUNIT') { U.V = t === W.IFCSIUNIT ? f * f * f : f; if (U.V !== 1) U.txt.push(`объём в модели: ${U.V === 1e-9 ? 'мм³' : '×' + U.V}`) }
      else if (ut === 'MASSUNIT') U.W = t === W.IFCSIUNIT ? f * 1000 : f; // в кг
    }
    return U
  }

  // разбор модели: {schema, units, files, els:[{e,g,t,tl,n,ot,st,q:{ключ:{v,k,n,src}}}], types}
  function parse(api, W, bytes, name) {
    const m = api.OpenModel(bytes, { COORDINATE_TO_ORIGIN: false });
    try {
      const U = units(api, W, m), K = { V: U.V, A: U.A, L: U.L, C: 1, W: U.W }, els = new Map(), cache = new Map();
      let schema = ''; try { schema = api.GetModelSchema(m) } catch (e) {}
      for (const [c, tl] of TYPES) {
        const code = W[c]; if (code == null) continue;
        const ids = api.GetLineIDsWithType(m, code);
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i); if (els.has(id)) continue;
          const l = api.GetLine(m, id, false);
          els.set(id, { e: id, g: val(l.GlobalId), t: c.replace(/^IFC/, '').replace(/STANDARDCASE|ELEMENTEDCASE/, ''), tl, n: dec(val(l.Name)) || '', ot: dec(val(l.ObjectType)) || '', st: '', mt: '', q: {} });
        }
      }
      // этажи
      const rc = api.GetLineIDsWithType(m, W.IFCRELCONTAINEDINSPATIALSTRUCTURE);
      for (let i = 0; i < rc.size(); i++) {
        const r = api.GetLine(m, rc.get(i), false), s = api.GetLine(m, ref(r.RelatingStructure), false), sn = dec(val(s.Name)) || dec(val(s.LongName)) || '';
        for (const x of r.RelatedElements || []) { const el = els.get(ref(x)); if (el) el.st = sn }
      }
      // количества и числовые свойства
      const QT = [[W.IFCQUANTITYVOLUME, 'V', 'VolumeValue'], [W.IFCQUANTITYAREA, 'A', 'AreaValue'], [W.IFCQUANTITYLENGTH, 'L', 'LengthValue'], [W.IFCQUANTITYCOUNT, 'C', 'CountValue'], [W.IFCQUANTITYWEIGHT, 'W', 'WeightValue']];
      const byName = n => /объ[её]м|volume/i.test(n) ? 'V' : /площад|area/i.test(n) ? 'A' : /масс|weight|вес\b/i.test(n) ? 'W' : /длин|length|периметр|perimeter/i.test(n) ? 'L' : /количеств|count|кол-во/i.test(n) ? 'C' : null;
      function pdef(pid) {
        if (cache.has(pid)) return cache.get(pid);
        const t = api.GetLineType(m, pid), out = [];
        if (t === W.IFCELEMENTQUANTITY) {
          const d = api.GetLine(m, pid, false), set = dec(val(d.Name)) || '';
          for (const qr of d.Quantities || []) {
            const qid = ref(qr), qt = api.GetLineType(m, qid), M = QT.find(x => x[0] === qt); if (!M) continue;
            const q = api.GetLine(m, qid, false), v = +val(q[M[2]]); if (!isFinite(v)) continue;
            const qn = dec(val(q.Name)) || ''; out.push({ key: set + '.' + qn, k: M[1], v: v * K[M[1]], n: QN[qn] || qn, src: set })
          }
        } else if (t === W.IFCPROPERTYSET) {
          const d = api.GetLine(m, pid, false), set = dec(val(d.Name)) || '';
          for (const pr of d.HasProperties || []) {
            const prid = ref(pr); if (api.GetLineType(m, prid) !== W.IFCPROPERTYSINGLEVALUE) continue;
            const p = api.GetLine(m, prid, false), nv = p.NominalValue, v = nv && typeof nv === 'object' ? nv.value : null;
            if (typeof v !== 'number' || !isFinite(v)) continue;
            const pn = dec(val(p.Name)) || '', k = byName(pn); if (!k) continue;
            // свойства из наборов свойств пишут в единицах проекта, кроме явных «… м3/м2» в имени
            const kf = /\bм3|м³|m3\b/i.test(pn) || /\bм2|м²|m2\b/i.test(pn) ? 1 : K[k];
            out.push({ key: set + '.' + pn, k, v: v * kf, n: pn, src: set, prop: 1 })
          }
        }
        cache.set(pid, out); return out
      }
      const rd = api.GetLineIDsWithType(m, W.IFCRELDEFINESBYPROPERTIES);
      for (let i = 0; i < rd.size(); i++) {
        const r = api.GetLine(m, rd.get(i), false), Q = pdef(ref(r.RelatingPropertyDefinition)); if (!Q.length) continue;
        for (const x of r.RelatedObjects || []) { const el = els.get(ref(x)); if (!el) continue; for (const q of Q) el.q[q.key] = { v: q.v, k: q.k, n: q.n, src: q.src, ...(q.prop ? { prop: 1 } : {}) } }
      }
      // материалы: IfcMaterial, слои (LayerSetUsage, LayerSet, Layer), список, составной набор, профили
      const MT = (id, d = 0) => { if (id == null || d > 6) return []; const t = api.GetLineType(m, id), l = api.GetLine(m, id, false), is = c => W[c] != null && t === W[c];
        const many = a => (a || []).flatMap(x => MT(ref(x), d + 1));
        if (is('IFCMATERIAL')) return [dec(val(l.Name)) || ''];
        if (is('IFCMATERIALLAYERSETUSAGE')) return MT(ref(l.ForLayerSet), d + 1);
        if (is('IFCMATERIALLAYERSET')) return many(l.MaterialLayers);
        if (is('IFCMATERIALLAYER') || is('IFCMATERIALCONSTITUENT') || is('IFCMATERIALPROFILE')) return MT(ref(l.Material), d + 1);
        if (is('IFCMATERIALLIST')) return many(l.Materials);
        if (is('IFCMATERIALCONSTITUENTSET')) return many(l.MaterialConstituents);
        if (is('IFCMATERIALPROFILESETUSAGE')) return MT(ref(l.ForProfileSet), d + 1);
        if (is('IFCMATERIALPROFILESET')) return many(l.MaterialProfiles);
        return [] };
      if (W.IFCRELASSOCIATESMATERIAL != null) { const ra = api.GetLineIDsWithType(m, W.IFCRELASSOCIATESMATERIAL);
        for (let i = 0; i < ra.size(); i++) { const r = api.GetLine(m, ra.get(i), false); let nm = '';
          try { nm = [...new Set(MT(ref(r.RelatingMaterial)).filter(Boolean))].join(' / ') } catch (e) {}
          if (nm) for (const x of r.RelatedObjects || []) { const el = els.get(ref(x)); if (el && !el.mt) el.mt = nm } } }
      const list = [...els.values()], types = {};
      for (const el of list) (types[el.tl] = types[el.tl] || []).push(el.e);
      return { name, schema, units: U.txt, els: list, types, noQ: list.filter(x => !Object.keys(x.q).length).length }
    } finally { api.CloseModel(m) }
  }

  // единица позиции → вид величины модели: м3 → V, м2 → A, м/км → L, шт → C, т/кг → W
  function kindOfUnit(nat) {
    const u = String(nat || '').toLowerCase().replace(/\s/g, '');
    if (/м3|м³/.test(u)) return 'V'; if (/м2|м²/.test(u)) return 'A'; if (/^(\d+)?(км|м)$/.test(u) || /^\d*м$/.test(u)) return 'L';
    if (/шт|компл|комплект|ед/.test(u)) return 'C'; if (/^(\d+)?(т|кг)$/.test(u)) return 'W'; return null
  }
  // множитель от физической единицы величины модели к физической единице позиции (км, т)
  const unitF = (k, nat) => { const u = String(nat || '').toLowerCase(); return k === 'L' && /км/.test(u) ? 1e-3 : k === 'W' && /(^|\d|\s)т$/.test(u.trim()) ? 1e-3 : 1 };
  // какую величину предложить по умолчанию для вида
  const PREFER = { V: ['NetVolume', 'GrossVolume'], A: ['NetArea', 'NetSideArea', 'Area', 'GrossArea', 'GrossSideArea', 'OuterSurfaceArea'], L: ['Length', 'Perimeter'], C: ['Count'], W: ['NetWeight', 'GrossWeight'] };
  function quantKeys(els, k) { // ключи величин этого вида, общие хотя бы для одного элемента, по частоте
    const cnt = new Map();
    for (const el of els) for (const [key, q] of Object.entries(el.q)) if (q.k === k) cnt.set(key, (cnt.get(key) || 0) + 1);
    const P = PREFER[k] || [], rank = key => { const i = P.indexOf(key.split('.').pop()); return i < 0 ? 99 : i };
    const std = key => /^(Qto_|BaseQuantities)/.test(key) ? 0 : 1;
    return [...cnt].sort((a, b) => std(a[0]) - std(b[0]) || rank(a[0]) - rank(b[0]) || b[1] - a[1]).map(x => x[0])
  }

  // ссылка позиции на элементы модели: из её строки ВОР (Методика п. 35: смета по ВОР со ссылками на модель), в старых сметах — у самой позиции
  function linkOf(S, p) { if (p && p.vor != null && S && S.vor) { const r = S.vor.find(x => x.id === p.vor); if (r && r.bim && r.bim.els && r.bim.els.length) return r.bim } return p && p.bim && p.bim.els && p.bim.els.length ? p.bim : null }
  // шаг 4 «ВОР из модели»: какой вид величины обычно берёт сметчик для типа элемента
  const GKIND = { 'Фундаменты': 'V', 'Сваи': 'V', 'Стены': 'V', 'Колонны': 'V', 'Балки': 'V', 'Плиты и перекрытия': 'V', 'Лестницы': 'V', 'Лестничные марши': 'V', 'Пандусы': 'V', 'Дымоходы': 'V',
    'Кровли': 'A', 'Покрытия и отделка': 'A', 'Витражи': 'A', 'Пластины и панели': 'A', 'Окна': 'A', 'Двери и ворота': 'A',
    'Трубы': 'L', 'Воздуховоды': 'L', 'Кабели': 'L', 'Кабельные лотки': 'L', 'Сегменты сетей': 'L', 'Стержни и профили': 'L', 'Ограждения': 'L',
    'Арматура': 'W', 'Арматурные сетки': 'W' };
  // группы: тип элемента + материал (если материала нет — тип элемента в модели ObjectType)
  function groups(els) {
    const g = new Map();
    for (const e of els) { const sub = e.mt || e.ot || '', key = e.tl + '|' + sub; if (!g.has(key)) g.set(key, { key, tl: e.tl, sub, mt: !!e.mt, els: [] }); g.get(key).els.push(e) }
    return [...g.values()].sort((a, b) => TYPES.findIndex(x => x[1] === a.tl) - TYPES.findIndex(x => x[1] === b.tl) || a.sub.localeCompare(b.sub, 'ru'))
  }
  G.RimoraBIMCore = { parse, groups, GKIND, TYPES, KIND, KU, QN, kindOfUnit, unitF, quantKeys, dec, linkOf };
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------- вкладка «Модель (ТИМ)»: выбор элементов, объём позиции из модели, проверки сметы по модели ---------- */
(function (G) {
  const C = G.RimoraBIMCore;
  G.RimoraBIM = function (A) {
    let api = null, apiP = null;
    const st = { type: '', q: '', pick: new Set(), pos: null, key: '', grp: false, gsel: {}, gall: false }, S = () => A.S, M = () => S().bim && S().bim.files && S().bim.files[0];
    const COUNT = '#count', LK = p => C.linkOf(S(), p);
    // чистое или полное значение: подсказка у кнопки «В позицию» (правила подсчёта объёмов в технической части сборника)
    const netGross = key => /^Net|\.Net/i.test(key.split('.').pop()) ? 'за вычетом проёмов и пересечений' : /^Gross|\.Gross/i.test(key.split('.').pop()) ? 'без вычета проёмов' : '';
    function getApi() {
      if (api) return Promise.resolve(api);
      return apiP || (apiP = (window.WebIFC ? Promise.resolve() : A.loadJs('vendor/web-ifc/web-ifc-api-iife.js')).then(async () => {
        const a = new WebIFC.IfcAPI(); a.SetWasmPath(new URL('vendor/web-ifc/', location.href).href, true); await a.Init(undefined, true); api = a; return a
      }).catch(e => { apiP = null; throw e }))
    }
    // в смету модель кладётся компактно: список величин keys [ключ, вид, название] и у элемента q {номер величины: значение в м, м², м³}
    function store(r) {
      const keys = [], ki = new Map();
      const els = r.els.map(e => { const q = {}; for (const [k, x] of Object.entries(e.q)) { if (!ki.has(k)) { ki.set(k, keys.length); keys.push([k, x.k, x.n]) } q[ki.get(k)] = +x.v.toPrecision(10) }
        return { g: e.g, t: e.t, tl: e.tl, n: e.n, st: e.st, ...(e.mt ? { mt: e.mt } : {}), ...(e.ot ? { ot: e.ot } : {}), q } });
      return { name: r.name, schema: r.schema, units: r.units, date: new Date().toISOString().slice(0, 10), keys, els }
    }
    async function openBytes(bytes, name) {
      A.toast('Читаю модель ' + name + '…');
      let a; try { a = await getApi() } catch (e) { return A.toast('Не загрузилась библиотека чтения IFC: ' + (e.message || e)) }
      let r; try { r = C.parse(a, WebIFC, bytes, name) } catch (e) { return A.toast('Не удалось прочитать файл IFC: ' + (e.message || e)) }
      if (!r.els.length) return A.toast('В модели не найдено строительных элементов');
      const old = M(); S().bim = { files: [store(r)] }; st.pick.clear(); st.type = ''; st.q = '';
      if (A.tab !== 'bim') A.setTab('bim'); A.commit();
      A.toast(`Модель ${name}: ${r.els.length} эл.${r.noQ ? `, без количеств ${r.noQ}` : ''}${old ? '. Это новая версия: «Проверить смету» покажет, что изменилось' : ''}`)
    }
    function open() {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.ifc,.IFC';
      i.onchange = async () => { const f = i.files[0]; if (!f) return;
        if (f.size > 200e6 && !confirm(`Файл ${Math.round(f.size / 1e6)} МБ: чтение займёт несколько минут и много памяти браузера. Продолжить?`)) return;
        openBytes(new Uint8Array(await f.arrayBuffer()), f.name) };
      i.click()
    }
    async function sample(v2) {
      try { const b = await (await fetch(v2 ? 'data/bim/garage_6x9_v2.ifc' : 'data/bim/garage_6x9.ifc')).arrayBuffer(); await openBytes(new Uint8Array(b), v2 ? 'Гараж_6x9_v2.ifc' : 'Гараж_6x9.ifc') }
      catch (e) { A.toast('Учебная модель не загрузилась') }
    }
    const qOf = (f, e, key) => { if (key === COUNT) return 1; const i = f.keys.findIndex(x => x[0] === key); return i >= 0 && e.q[i] != null ? e.q[i] : null };
    const keyName = (f, key) => key === COUNT ? 'штук (по числу элементов)' : ((f.keys.find(x => x[0] === key) || [])[2] || key) + ' · ' + key.split('.')[0];
    function posList() {
      const out = []; let n = 0;
      for (const p of S().pos) { if (p.sec !== undefined) continue; n++; if (p.ka || p.mr || p.tr) continue; const R = A.calc(p).R; out.push({ p, n, R, k: C.kindOfUnit(R.nat || R.unit) }) }
      return out
    }
    function links() { const L = new Map(), add = (g, x) => { if (!L.has(g)) L.set(g, []); L.get(g).push(x) }; let n = 0;
      for (const p of S().pos) { if (p.sec !== undefined) continue; n++; const b = LK(p); if (b) for (const e of b.els) add(e.g, { p, n }) }
      for (const r of S().vor || []) if (r.bim && r.bim.els && !S().pos.some(p => p.vor === r.id)) for (const e of r.bim.els) add(e.g, { p: null, n: 'ВОР ' + A.vorNum(r.id), v: r.id });
      return L }
    function keysFor(f, els, k) {
      if (!k) return [];
      const ks = C.quantKeys(els.map(e => ({ q: Object.fromEntries(Object.keys(e.q).map(i => [f.keys[i][0], { k: f.keys[i][1] }])) })), k);
      return k === 'C' ? [...ks, COUNT] : ks
    }
    function state() {
      const f = M(), P = posList();
      // позиция следует за выделенной в смете: выделил другую позицию — вкладка «Модель» переключается на неё (ручной выбор в списке держится, пока выделение в смете не сменится)
      if (A.sel !== st.selSeen) { st.selSeen = A.sel; if (P.some(x => x.p.id === A.sel) && st.pos !== A.sel) { st.pos = A.sel; st.key = '' } }
      if (st.pos == null || !P.some(x => x.p.id === st.pos)) { const s = P.find(x => x.p.id === A.sel); st.pos = s ? s.p.id : P.length ? P[P.length - 1].p.id : null }
      const tp = P.find(x => x.p.id === st.pos) || null, k = tp ? tp.k : null;
      const pickEls = f ? f.els.filter(e => st.pick.has(e.g)) : [];
      const avail = f ? keysFor(f, pickEls.length ? pickEls : f.els, k) : [];
      if (!avail.includes(st.key)) { const b = tp && LK(tp.p); st.key = b && avail.includes(b.key) ? b.key : avail[0] || '' }
      const uf = tp && k ? C.unitF(k, tp.R.nat) : 1;
      const vals = pickEls.map(e => qOf(f, e, st.key)), miss = vals.filter(v => v == null).length, sum = vals.reduce((a, v) => a + (v || 0), 0) * uf;
      return { f, P, tp, k, pickEls, avail, uf, miss, sum }
    }
    function html() {
      const f = M(), E = A.esc, fq = A.fq, pu = A.pu;
      if (!f) return `<div class="empty"><div>${A.ic('sheet')}<h3>Модель IFC не загружена</h3><p>Откройте модель здания в формате IFC (Renga, nanoCAD BIM, Revit, ArchiCAD и др.). Модель читается на этом компьютере и никуда не отправляется. Объёмы берутся из наборов количеств модели, геометрия не строится.</p>
        <button class="btn pri" id="bimOpen">Открыть модель IFC…</button> <button class="btn" id="bimSample">Учебная модель: гараж 6×9 м</button></div></div>`;
      const { P, tp, k, pickEls, avail, uf, miss, sum } = state(), L = links();
      const types = {}; for (const e of f.els) types[e.tl] = (types[e.tl] || 0) + 1;
      const ql = st.q.toLowerCase(), vis = f.els.filter(e => (!st.type || e.tl === st.type) && (!ql || (e.n + ' ' + e.tl + ' ' + e.st + ' ' + e.t + ' ' + (e.mt || '')).toLowerCase().includes(ql)));
      const shown = vis.slice(0, 3000), allOn = shown.length && shown.every(e => st.pick.has(e.g));
      const nat = tp ? tp.R.nat || tp.R.unit : '', free = f.els.filter(e => !L.has(e.g)).length;
      const chk = checks().filter(x => x.p == null || x.p);
      return `<div class="bimw">
       <div class="bimh"><div><b>${E(f.name)}</b> <span class="u">${E(f.schema || 'IFC')} · ${f.els.length} эл. · загружена ${E(f.date)}${f.units && f.units.length ? ' · ' + E(f.units.join('; ')) : ''}</span></div>
        <div><button class="btn sm ${st.grp ? 'pri' : ''}" id="bimGrp" title="Сгруппировать элементы по типу и материалу и создать из групп строки ведомости объёмов работ">ВОР из модели</button> <button class="btn sm" id="bimOpen">Открыть другую…</button> <button class="btn sm" id="bimDrop">Убрать модель</button></div></div>
       ${st.grp ? grpHtml(f, L) : ''}
       <div class="bimt"><button class="chip ${st.type ? '' : 'on'}" data-bt="">Все ${f.els.length}</button>${Object.entries(types).map(([t, n]) => `<button class="chip ${st.type === t ? 'on' : ''}" data-bt="${E(t)}">${E(t)} ${n}</button>`).join('')}
        <input id="bimQ" value="${E(st.q)}" placeholder="Поиск: имя, этаж…" style="margin-left:auto;min-width:180px"></div>
       <div class="bimbar">
        <label>Позиция <select id="bimPos">${P.length ? P.map(x => `<option value="${x.p.id}" ${tp && x.p.id === tp.p.id ? 'selected' : ''}>${x.n}. ${E(x.R.real ? 'ГЭСН' + x.p.code : x.p.code)} · ${E(String(x.R.name).slice(0, 60))} · ${E(pu(x.R.nat || x.R.unit))}${LK(x.p) ? ' · из модели' : ''}</option>`).join('') : '<option>в смете нет расценок</option>'}</select></label>
        <label>Величина <select id="bimKey" ${avail.length ? '' : 'disabled'}>${avail.length ? avail.map(key => `<option value="${E(key)}" ${key === st.key ? 'selected' : ''}>${E(keyName(f, key))}</option>`).join('') : `<option>${tp ? (k ? 'у элементов нет величины «' + C.KIND[k] + '»' : 'единица «' + E(pu(nat)) + '» не берётся из модели') : '—'}</option>`}</select></label>
        <span class="bims">Выбрано <b>${pickEls.length}</b>${pickEls.length ? ` · ${miss ? `<span class="wn">у ${miss} нет этой величины</span>` : `<b>${fq(A.r7(sum))}</b> ${E(pu(nat))}`}` : ''}</span>
        <button class="btn pri" id="bimApply" ${pickEls.length && !miss && st.key && tp ? '' : 'disabled'}>В позицию ${tp ? tp.n : ''}</button>
        ${tp && LK(tp.p) ? `<button class="btn" id="bimShow" title="Отметить элементы, из которых взят объём позиции">Элементы позиции</button>` : ''}
        ${pickEls.length ? '<button class="btn" id="bimClr">Снять выбор</button>' : ''}
        ${tp && st.key && st.key !== COUNT ? `<div class="bimhint">Берётся «${E(keyName(f, st.key).split(' · ')[0])}» (${E(st.key.split('.').pop())})${netGross(st.key) ? ': ' + netGross(st.key) : ''}. Сверьте с правилами подсчёта объёмов работ в технической части сборника ГЭСН ${E(sb(tp.p.code))}: что вычитается, что нет. Земляные работы, опалубка, леса и подмости в модели обычно не моделируются, их объёмы считают по проекту.</div>` : ''}</div>
       <table class="kvt bimtab"><thead><tr><th style="width:28px"><input type="checkbox" id="bimAll" ${allOn ? 'checked' : ''} aria-label="Выбрать все показанные"></th><th>Элемент</th><th>Тип</th><th>Этаж</th><th class="r">${st.key ? E(keyName(f, st.key).split(' · ')[0]) + (nat ? ', ' + E(pu(nat)) : '') : 'Величина'}</th><th>В позициях</th></tr></thead><tbody>
        ${shown.map(e => { const v = qOf(f, e, st.key), on = st.pick.has(e.g), lk = L.get(e.g) || [];
          return `<tr class="${on ? 'on' : ''}" data-bg="${E(e.g)}"><td><input type="checkbox" ${on ? 'checked' : ''} aria-label="Выбрать"></td><td>${E(e.n || '(без имени)')}</td><td>${E(e.tl)}<div class="u mono">${E(e.t)}</div>${e.mt ? `<div class="u">${E(e.mt)}</div>` : ''}</td><td>${E(e.st)}</td><td class="r num">${v == null ? '—' : fq(+(v * uf).toFixed(4))}</td><td>${lk.map(x => x.p ? `<span class="chip" data-bp="${x.p.id}" title="${E(x.p.code)}">${x.n}</span>` : `<span class="chip" title="Строка ведомости объёмов без расценки: подберите расценку на вкладке «Ведомость объёмов»">${E(x.n)}</span>`).join(' ')}</td></tr>` }).join('')}
        ${vis.length > shown.length ? `<tr><td colspan="6" class="u">Показаны первые ${shown.length} из ${vis.length}: уточните поиск или тип</td></tr>` : ''}</tbody></table>
       <div class="bimc"><h4>Проверка сметы по модели</h4>${free ? `<div class="u">Не связано ни с одной позицией: ${free} эл. из ${f.els.length}</div>` : '<div class="u">Все элементы модели связаны с позициями сметы</div>'}
        ${chk.map(x => `<div class="bimck ${x.lv}">${x.n ? `<b>Поз. ${x.n}.</b> ` : ''}${E(x.t)}</div>`).join('') || '<div class="u">Замечаний нет</div>'}</div>
       <div class="u" style="margin-top:8px">«В позицию» записывает элементы в строку ведомости объёмов работ (формула из значений модели, ссылки на элементы), позиция берёт объём из этой строки. Если позиция уже связана со строкой ВОР, обновляется эта строка. В XML для экспертизы уходят ссылки на элементы (BIMFiles, BIMData).</div></div>`
    }
    // ---- шаг 4: ВОР из модели ----
    const KO = ['V', 'A', 'L', 'W', 'C'];
    function grpModel(f, L) {
      const els = st.gall ? f.els : f.els.filter(e => !L.has(e.g)), G = C.groups(els);
      return G.map(g => { const s0 = st.gsel[g.key] || {}, all = [];
        for (const k of KO) for (const key of keysFor(f, g.els, k)) if (!all.some(x => x[0] === key)) all.push([key, k]);
        const want = C.GKIND[g.tl] || 'C', def = all.find(x => x[1] === want) || all.find(x => x[0] !== COUNT) || [COUNT, 'C'];
        const pick = all.find(x => x[0] === s0.key) || def, k = pick[1], key = pick[0], unit = k === 'W' ? 'т' : C.KU[k], uf = C.unitF(k, unit);
        const vals = g.els.map(e => qOf(f, e, key)), miss = vals.filter(v => v == null).length, sum = vals.reduce((a, v) => a + (v || 0), 0) * uf;
        return { ...g, all, key, k, unit, uf, miss, sum, on: s0.on != null ? s0.on : !miss, name: s0.name != null ? s0.name : g.tl + (g.sub ? ': ' + g.sub : '') } })
    }
    function grpHtml(f, L) {
      const E = A.esc, fq = A.fq, R = grpModel(f, L), n = R.filter(x => x.on && !x.miss).length;
      return `<div class="bimg"><div class="bimgh"><b>ВОР из модели</b><span class="u">Элементы сгруппированы по типу и материалу (без материала — по типу в модели). Отметьте группы и величины: каждая группа станет строкой ведомости объёмов со ссылками на свои элементы, расценку к строке подберёте на вкладке «Ведомость объёмов».</span>
        <label class="kchk"><input type="checkbox" id="bimGall" ${st.gall ? 'checked' : ''}> включая элементы, уже учтённые в ВОР или смете</label></div>
       ${R.length ? `<table class="kvt"><thead><tr><th style="width:28px"></th><th>Строка ВОР</th><th class="r">Эл.</th><th>Величина</th><th class="r">Объём</th><th>Ед.</th></tr></thead><tbody>
        ${R.map(g => `<tr><td><input type="checkbox" data-gon="${E(g.key)}" ${g.on && !g.miss ? 'checked' : ''} ${g.miss ? 'disabled' : ''} aria-label="Взять группу"></td>
          <td><input data-gname="${E(g.key)}" value="${E(g.name)}" style="width:100%;min-width:220px"></td><td class="r num">${g.els.length}</td>
          <td><select data-gkey="${E(g.key)}">${g.all.map(([key]) => `<option value="${E(key)}" ${key === g.key ? 'selected' : ''}>${E(keyName(f, key))}</option>`).join('')}</select>${g.miss ? `<div class="wn">у ${g.miss} эл. нет этой величины</div>` : ''}</td>
          <td class="r num">${g.miss ? '—' : fq(A.r7(g.sum))}</td><td>${E(g.unit)}</td></tr>`).join('')}</tbody></table>
        <div style="margin-top:8px"><button class="btn pri" id="bimGo" ${n ? '' : 'disabled'}>Создать строки ВОР (${n})</button> <span class="u">Добавятся разделом «Из модели ${E(f.name)}» в конец ведомости.</span></div>`
        : `<div class="u">Все элементы модели уже учтены в ведомости объёмов или смете. Отметьте «включая учтённые», чтобы собрать заново.</div>`}</div>`
    }
    function grpCreate() {
      const f = M(); if (!f) return; const R = grpModel(f, links()).filter(g => g.on && !g.miss && g.els.length); if (!R.length) return;
      const num = v => String(+v.toFixed(6)).replace('.', ','); let first = null;
      A.vorRow({ sec: 'Из модели ' + f.name });
      for (const g of R) { const els = g.els.map(e => ({ g: e.g, v: +(qOf(f, e, g.key) * g.uf).toPrecision(10) })), q = A.r7(els.reduce((a, e) => a + e.v, 0));
        const r = A.vorRow({ name: g.name.slice(0, 200), unit: g.unit, f: els.length <= 12 ? els.map(e => num(e.v)).join('+') : num(q), ref: f.name, bim: { f: 1, key: g.key, k: g.k, els } }); if (first == null) first = r.id }
      st.grp = false; st.gsel = {}; A.commit();
      A.toast(`В ведомость объёмов добавлено строк: ${R.length} (с ${A.vorNum(first)}). Подберите к ним расценки на вкладке «Ведомость объёмов»`)
    }
    function apply() {
      const { f, tp, k, pickEls, uf, miss } = state(); if (!tp || !pickEls.length || miss || !st.key) return;
      const p = tp.p, els = pickEls.map(e => ({ g: e.g, v: +(qOf(f, e, st.key) * uf).toPrecision(10) })), q = A.r7(els.reduce((a, e) => a + e.v, 0));
      const nat = tp.R.nat || tp.R.unit, num = v => String(+v.toFixed(6)).replace('.', ',');
      const fx = els.length <= 12 ? els.map(e => num(e.v)).join('+') : num(q), link = { f: 1, key: st.key, k, els };
      let r = p.vor != null && A.S.vor ? A.S.vor.find(x => x.id === p.vor) : null, old = '';
      // строка ВОР считалась по своей формуле (не из модели): заменять только после подтверждения
      if (r && !r.bim && String(r.f || '').trim() && !confirm(`Позиция ${tp.n} берёт объём из строки ВОР ${A.vorNum(r.id)} «${String(r.name || '').slice(0, 60)}» по формуле ${r.f}. Заменить формулу строки объёмом из модели (${els.length} эл., ${A.fq(q)} ${A.pu(nat)})?`)) return;
      if (r) { if (!r.bim && r.f) old = r.f; r.f = fx; r.bim = link; if (!r.unit) r.unit = A.pu(nat); if (!String(r.ref || '').includes(f.name)) r.ref = (r.ref && r.ref !== 'модель IFC' ? r.ref + '; ' : '') + f.name }
      else r = A.vorRow({ name: String(tp.R.name || '').slice(0, 200), unit: A.pu(nat), f: fx, ref: f.name, bim: link });
      p.vor = r.id; delete p.bim; delete p.f; A.vorSync(); A.commit();
      A.toast(`Строка ВОР ${A.vorNum(r.id)} ← ${els.length} эл. модели, ${A.fq(q)} ${A.pu(nat)}; позиция ${tp.n} берёт объём из неё${old ? `. Прежняя формула строки: ${old}` : ''}`)
    }
    function bind() {
      const $ = s => document.querySelector(s), on = (s, f) => { const e = $(s); if (e) e.onclick = f };
      on('#bimOpen', open); on('#bimSample', () => sample(false));
      on('#bimDrop', () => { if (!confirm('Убрать модель из сметы? Ссылки позиций на элементы останутся, но проверка по модели и выгрузка ссылок в XML работать не будут, пока модель не загружена снова.')) return; delete S().bim; st.pick.clear(); A.commit() });
      document.querySelectorAll('[data-bt]').forEach(b => b.onclick = () => { st.type = b.dataset.bt; A.render() });
      const q = $('#bimQ'); if (q) q.onchange = () => { st.q = q.value.trim(); A.render() };
      const ps = $('#bimPos'); if (ps) ps.onchange = () => { st.pos = +ps.value; st.key = ''; A.render() };
      const ks = $('#bimKey'); if (ks) ks.onchange = () => { st.key = ks.value; A.render() };
      on('#bimApply', apply); on('#bimGrp', () => { st.grp = !st.grp; A.render() }); on('#bimGo', grpCreate);
      const ga = $('#bimGall'); if (ga) ga.onchange = () => { st.gall = ga.checked; st.gsel = {}; A.render() };
      const gs = (k, f) => { st.gsel[k] = { ...(st.gsel[k] || {}), ...f } };
      document.querySelectorAll('[data-gon]').forEach(x => x.onchange = () => { gs(x.dataset.gon, { on: x.checked }); A.render() });
      document.querySelectorAll('[data-gkey]').forEach(x => x.onchange = () => { gs(x.dataset.gkey, { key: x.value }); A.render() });
      document.querySelectorAll('[data-gname]').forEach(x => x.onchange = () => gs(x.dataset.gname, { name: x.value })); on('#bimClr', () => { st.pick.clear(); A.render() });
      on('#bimShow', () => { const { tp } = state(), b = tp && LK(tp.p); if (!b) return; show(b, tp.p.id) });
      const all = $('#bimAll'); if (all) all.onchange = () => { const f = M(), ql = st.q.toLowerCase();
        const vis = f.els.filter(e => (!st.type || e.tl === st.type) && (!ql || (e.n + ' ' + e.tl + ' ' + e.st + ' ' + e.t + ' ' + (e.mt || '')).toLowerCase().includes(ql))).slice(0, 3000);
        for (const e of vis) all.checked ? st.pick.add(e.g) : st.pick.delete(e.g); A.render() };
      document.querySelectorAll('.bimtab tr[data-bg]').forEach(tr => tr.onclick = ev => { if (ev.target.closest('[data-bp]')) return; const g = tr.dataset.bg; st.pick.has(g) ? st.pick.delete(g) : st.pick.add(g); A.render() });
      document.querySelectorAll('.bimtab [data-bp]').forEach(c => c.onclick = () => { st.pos = +c.dataset.bp; st.key = ''; A.render() })
    }
    // открыть вкладку и отметить элементы связи (кнопка «Элементы позиции», метка в строке ВОР)
    function show(b, pid) { st.pick = new Set(b.els.map(e => e.g)); st.key = b.key; st.type = ''; st.q = ''; if (pid != null) st.pos = pid; if (A.tab !== 'bim') A.setTab('bim'); else A.render() }
    const sb = code => { const m = /^([а-яa-z]*\d+)-/i.exec(String(code || '')); return m ? m[1] : String(code || '') };
    // проверки: объём позиции = сумма по модели; элементы удалены или изменились (новая версия модели); задвоение; не посчитано
    function checks() {
      const f = M(), out = [], fq = A.fq, pu = A.pu, r7 = A.r7; let n = 0, linked = 0;
      const byG = f ? new Map(f.els.map(e => [e.g, e])) : null, L = new Map();
      for (const p of S().pos) {
        if (p.sec !== undefined) continue; n++; const B = LK(p); if (!B) continue; linked++;
        const R = A.calc(p).R, nat = R.nat || R.unit, sum = B.els.reduce((a, e) => a + e.v, 0), vn = p.vor != null && B !== p.bim ? A.vorNum(p.vor) : 0, vr = vn ? `строки ВОР ${vn} ` : '';
        if (!f) { out.push({ lv: 'w', p, n, t: 'Объём позиции взят из модели, но модель в смете не загружена: откройте её на вкладке «Модель», иначе ссылки на элементы не уйдут в XML' }); continue }
        if (Math.abs(sum - (+p.qty || 0)) > Math.max(1e-6, Math.abs(sum) * 1e-4))
          out.push({ lv: 'w', p, n, t: `Объём ${vr || 'позиции '}${fq(p.qty)} ${pu(nat)} не равен сумме по модели ${fq(r7(sum))} ${pu(nat)} (${B.els.length} эл.). Если объём изменён вручную, приложите обоснование` });
        const uf = C.unitF(B.k, R.nat), gone = [], chg = [];
        for (const e of B.els) {
          if (!L.has(e.g)) L.set(e.g, []); L.get(e.g).push({ p, n, k: B.k });
          const m = byG.get(e.g); if (!m) { gone.push(e); continue }
          const v0 = qOf(f, m, B.key), v = v0 == null ? null : v0 * uf;
          if (v == null || Math.abs(v - e.v) > Math.max(1e-6, Math.abs(e.v) * 1e-4)) chg.push({ m, e, v })
        }
        if (gone.length) out.push({ lv: 'w', p, n, t: `${gone.length} эл. позиции нет в загруженной модели (удалены или загружена другая модель): объём позиции нужно пересчитать` });
        if (chg.length) { const nv = sum + chg.reduce((a, x) => a + (x.v || 0) - x.e.v, 0);
          out.push({ lv: 'w', p, n, t: `В модели изменились ${chg.length} эл. (${chg.slice(0, 3).map(x => x.m.n || x.m.t).join('; ')}${chg.length > 3 ? '…' : ''}): по модели объём ${fq(r7(nv))} ${pu(nat)} вместо ${fq(r7(sum))}. Выберите элементы позиции на вкладке «Модель» и нажмите «В позицию»: обновится ${vn ? 'строка ВОР ' + vn : 'объём позиции'}` }) }
      }
      if (!f) return out;
      const inV = new Set(); for (const r of S().vor || []) if (r.bim && r.bim.els) for (const e of r.bim.els) inV.add(e.g);
      if (!linked && !inV.size) { out.push({ lv: 'i', p: null, n: '', t: `Модель ${f.name} загружена, но ни одна позиция не связана с её элементами: выберите элементы на вкладке «Модель» и нажмите «В позицию» или соберите ВОР из модели` }); return out }
      const pairs = new Map();
      for (const [g, arr] of L) { if (arr.length < 2) continue; const grp = new Map();
        for (const x of arr) { const key = x.k + '|' + sb(x.p.code); if (!grp.has(key)) grp.set(key, []); grp.get(key).push(x) }
        for (const a of grp.values()) if (a.length > 1) { const key = a.map(x => x.n).join(','); if (!pairs.has(key)) pairs.set(key, { a, names: [] }); const e = byG.get(g); pairs.get(key).names.push(e ? e.n || e.t : g) } }
      for (const { a, names } of pairs.values()) { const last = a[a.length - 1];
        out.push({ lv: 'w', p: last.p, n: last.n, t: `Одни и те же элементы модели (${names.slice(0, 3).join('; ')}${names.length > 3 ? ` и ещё ${names.length - 3}` : ''}) учтены в позициях ${a.map(x => x.n).join(' и ')} одного сборника с одной величиной: похоже на задвоение` }) }
      const free = {}; for (const e of f.els) if (!L.has(e.g) && !inV.has(e.g)) (free[e.tl] = free[e.tl] || []).push(e);
      for (const [tl, a] of Object.entries(free)) out.push({ lv: 'i', p: null, n: '', t: `Не посчитано по модели: ${tl} — ${a.length} эл. (${a.slice(0, 3).map(e => e.n || e.t).join('; ')}${a.length > 3 ? '…' : ''}), их нет ни в одной позиции` });
      return out
    }
    const css = document.createElement('style');
    css.textContent = `.bimw{padding:12px 14px}.bimh{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
     .bimt{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}.bimt .chip{cursor:pointer}.bimt .chip.on{background:var(--brand);color:#fff}
     .bimbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--surface2);margin-bottom:8px;position:sticky;top:0;z-index:2}
     .bimbar label{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)}.bimbar select{max-width:340px}.bims{font-size:13px}
     .bimtab tr[data-bg]{cursor:pointer}.bimtab tr.on td{background:color-mix(in srgb,var(--brand) 10%,transparent)}.bimtab .chip{cursor:pointer}
     .bimc{margin-top:12px}.bimc h4{margin:0 0 6px}.bimck{padding:6px 8px;border-left:3px solid var(--muted);margin:4px 0;font-size:13px}.bimck.w{border-color:var(--warn)}.bimck.e{border-color:var(--err,#c33)}
     .bimhint{flex-basis:100%;font-size:12px;color:var(--ink2);line-height:1.4}
     .bimg{border:1px solid var(--brand);border-radius:10px;padding:10px;margin-bottom:10px}.bimgh{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}.bimg select{max-width:300px}`;
    document.head.appendChild(css);
    return { html, bind, open, sample, checks, getApi, show, linkOf: LK }
  }
})(typeof window !== 'undefined' ? window : globalThis);
