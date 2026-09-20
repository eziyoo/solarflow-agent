/* ============================================================
   SolarFlow demo — portfolio management for C&I solar and storage.

   No framework, no dependencies. The portfolio lives in
   localStorage; time series are derived from each plant's seed
   rather than stored, so the data stays small and reproducible.

   Colours come from the CSS variables in demo-solarflow.css,
   so the palette has one home.
   ============================================================ */

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ============================================================
     Model
     ============================================================ */

  /* The real path a commercial plant takes in Italy. Ordered, so the
     colour ramp is ordinal rather than categorical. */
  var STAGES = [
    { key: 'permitting',   label: 'Permitting',   note: 'PAS / AU',         varName: '--sf-s1', target: 90 },
    { key: 'tica',         label: 'Grid (TICA)',  note: 'Connection offer', varName: '--sf-s2', target: 60 },
    { key: 'financing',    label: 'Financing',    note: 'Funding close',    varName: '--sf-s3', target: 45 },
    { key: 'construction', label: 'Construction', note: 'On site',          varName: '--sf-s4', target: 120 },
    { key: 'connection',   label: 'Connection',   note: 'Testing',          varName: '--sf-s5', target: 30 },
    { key: 'operation',    label: 'In operation', note: 'Producing',        varName: '--sf-s6', target: null }
  ];
  var STAGE_MAP = {};
  STAGES.forEach(function (s, i) { STAGE_MAP[s.key] = s; s.order = i; });

  /* Typical specific yield by region, kWh per kWp per year. */
  var REGIONS = [
    { name: 'Lombardia',      yield: 1150, prov: ['BG', 'BS', 'MI', 'CR'] },
    { name: 'Piemonte',       yield: 1180, prov: ['TO', 'CN', 'AL'] },
    { name: 'Veneto',         yield: 1210, prov: ['VR', 'VI', 'PD'] },
    { name: 'Emilia-Romagna', yield: 1260, prov: ['MO', 'RE', 'BO'] },
    { name: 'Lazio',          yield: 1380, prov: ['RM', 'LT', 'VT'] },
    { name: 'Puglia',         yield: 1450, prov: ['BA', 'FG', 'LE'] },
    { name: 'Sicilia',        yield: 1500, prov: ['CT', 'PA', 'SR'] }
  ];
  var REGION_NAMES = REGIONS.map(function (r) { return r.name; });
  var REGION_MAP = {};
  REGIONS.forEach(function (r) { REGION_MAP[r.name] = r; });

  var TYPES = { rooftop: 'Rooftop', ground: 'Ground mount', bess: 'Storage' };

  /* Published portfolio targets the dashboard measures against. */
  var TARGET_MWP = 500;
  var TARGET_MWH = 1400;

  /* Share of annual output by month, Italy. Sums to 100. */
  var SEASON = [4.2, 5.5, 8.2, 9.6, 11.2, 11.9, 12.5, 11.4, 9.2, 7.2, 4.8, 4.3];

  var PERF_FLOOR = 0.95;   /* below this share of budget, a plant is flagged */
  var STORE_KEY = 'solarflow.v2';
  var OWNERS = ['Giulia R.', 'Marco B.', 'Sara V.', 'Luca M.', 'Elena T.'];

  /* ============================================================
     Helpers
     ============================================================ */

  function uid() { return 'p' + Math.random().toString(36).slice(2, 8); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  /* Dates and numbers follow the page language. */
  function loc() { return (window.I18N && I18N.get() === 'it') ? 'it-IT' : 'en-GB'; }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(loc(), { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function num(v, dp) {
    if (!isFinite(v)) return '0';
    return v.toLocaleString(loc(), { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  /* Translate a fragment. Falls back to English when i18n has not loaded. */
  function T(s) { return (window.I18N && I18N.t) ? I18N.t(s) : s; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Deterministic PRNG, so the demo looks the same on every machine. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var PALETTE = {};
  function readPalette() {
    var probe = document.querySelector('.sf');
    if (!probe) return;
    var cs = getComputedStyle(probe);
    var get = function (v, fallback) { return (cs.getPropertyValue(v) || '').trim() || fallback; };
    STAGES.forEach(function (s) { s.color = get(s.varName, '#2451e8'); });
    PALETTE.good = get('--sf-good', '#1f7a4d');
    PALETTE.warn = get('--sf-warn', '#9a5b12');
    PALETTE.danger = get('--sf-danger', '#b3362c');
    PALETTE.accent = get('--cobalt-600', '#2451e8');
  }

  /* ============================================================
     Seeding a portfolio
     ============================================================ */

  var MAKERS = ['Caseificio', 'Meccanica', 'Logistica', 'Ceramiche', 'Conserve', 'Frantoio',
    'Cartiera', 'Distripack', 'Salumificio', 'Officine', 'Farmaceutica', 'Molino',
    'Tessile', 'Vetreria', 'Acciaierie', 'Imballaggi', 'Arredi', 'Plastica',
    'Surgelati', 'Cantine', 'Stampi', 'Fonderia', 'Gomma', 'Serramenti', 'Pastificio'];
  var PLACES = ['Adda', 'Brianza', 'Val Seriana', 'Sud', 'Nord', 'Reggiano', 'Modenese',
    'Pontina', 'Salentino', 'Como', 'Adriatica', 'Etnea', 'Ionica', 'Padana',
    'Veronese', 'Dauna', 'Murgia', 'Sesia', 'Tanaro', 'Garda', 'Iblea', 'Sabina'];

  /* stage -> how many plants sit there */
  var MIX = [
    ['operation', 45], ['connection', 3], ['construction', 9],
    ['financing', 5], ['tica', 5], ['permitting', 6]
  ];

  function seed() {
    var rnd = mulberry32(20260920);
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var between = function (lo, hi) { return lo + rnd() * (hi - lo); };
    var today = todayISO();
    var out = [];
    var n = 0;

    var stageList = [];
    MIX.forEach(function (m) { for (var i = 0; i < m[1]; i++) stageList.push(m[0]); });

    stageList.forEach(function (stage, idx) {
      var region = REGIONS[Math.floor(rnd() * REGIONS.length)];
      /* a few storage units, mostly late stage, so the BESS numbers are real */
      var isBess = (idx % 14 === 5) &&
        (stage === 'operation' || stage === 'construction' || stage === 'financing');
      var type = isBess ? 'bess' : (rnd() < 0.2 ? 'ground' : 'rooftop');

      var mwp = 0, mw = 0, mwh = 0;
      if (type === 'bess') {
        mw = Math.round(between(5, 25) * 10) / 10;
        mwh = Math.round(mw * between(2, 4) * 10) / 10;
      } else if (type === 'ground') {
        mwp = Math.round(between(3, 12) * 100) / 100;
      } else {
        mwp = Math.round(between(0.3, 2.5) * 100) / 100;
      }

      var target = STAGE_MAP[stage].target;
      /* every 9th plant sits well past the typical duration, so the
         stuck rule has something to catch */
      var overrun = (idx % 9 === 4) ? between(1.6, 2.4) : between(0.15, 1.2);
      var inStage = stage === 'operation'
        ? Math.round(between(40, 900))
        : Math.max(3, Math.round((target || 60) * overrun));

      var code = (type === 'bess' ? 'BS-' : 'PV-') + region.prov[0] + '-' + String(++n).padStart(3, '0');

      var plant = {
        id: uid(),
        code: code,
        name: pick(MAKERS) + ' ' + pick(PLACES),
        region: region.name,
        province: pick(region.prov),
        type: type,
        mwp: mwp,
        mw: mw,
        mwh: mwh,
        stage: stage,
        stageEnteredAt: addDays(today, -inStage),
        permit: (mwp >= 1 || type !== 'rooftop') ? 'AU' : 'PAS',
        ticaAcceptedAt: STAGE_MAP[stage].order >= 1
          ? addDays(today, -inStage - Math.round(between(30, 260))) : '',
        tariff: Math.round(between(74, 96)),
        owner: pick(OWNERS),
        yieldKwhKwp: Math.round(region.yield * between(0.94, 1.05)),
        perf: 0,
        availability: 0,
        cod: '',
        gseDeadline: '',
        seed: Math.floor(rnd() * 1e9)
      };

      if (stage === 'operation') {
        plant.cod = addDays(today, -inStage);
        plant.gseDeadline = addDays(plant.cod, -Math.round(between(10, 120)));
        /* every 8th operating plant runs below budget */
        plant.perf = (idx % 8 === 3) ? between(0.80, 0.94) : between(0.96, 1.06);
        plant.availability = (idx % 11 === 6) ? between(0.90, 0.958) : between(0.968, 0.999);
      } else {
        /* a tariff deadline in the next two and a half years, and a few already blown */
        var lead = (idx % 7 === 2) ? between(-90, 120) : between(150, 900);
        plant.gseDeadline = addDays(today, Math.round(lead));
        plant.perf = between(0.96, 1.04);
        plant.availability = 0;
      }

      out.push(plant);
    });

    return out;
  }

  var plants = [];
  var filters = { search: '', stage: '', region: '' };
  var sortKey = 'days', sortDir = -1;
  var funnelMode = 'count';

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length && parsed[0].seed !== undefined) {
          plants = parsed;
          return;
        }
      }
    } catch (e) { /* private mode, or a stale shape */ }
    plants = seed();
    persist();
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(plants)); } catch (e) { /* blocked */ }
  }

  /* ============================================================
     Derived values. Nothing below is stored.
     ============================================================ */

  function isPv(p) { return p.type !== 'bess'; }
  function isLive(p) { return p.stage === 'operation'; }
  function budgetMwhYear(p) { return isPv(p) ? p.mwp * p.yieldKwhKwp : 0; }

  function monthEnd(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  }

  /* Monthly output for one plant, a pure function of its seed. */
  function monthMwh(p, date) {
    if (!isPv(p) || !p.cod) return { actual: 0, budget: 0 };
    if (p.cod > monthEnd(date)) return { actual: 0, budget: 0 };
    var key = date.getFullYear() * 12 + date.getMonth();
    var budget = budgetMwhYear(p) * SEASON[date.getMonth()] / 100;
    var jitter = mulberry32(p.seed + key)();
    return { actual: budget * p.perf * (0.93 + jitter * 0.14), budget: budget };
  }

  function lastMonths(n) {
    var out = [], now = new Date();
    for (var i = n - 1; i >= 0; i--) out.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    return out;
  }

  function fleetMonthly(n) {
    return lastMonths(n).map(function (d) {
      var a = 0, b = 0;
      plants.forEach(function (p) {
        if (!isLive(p)) return;
        var m = monthMwh(p, d);
        a += m.actual; b += m.budget;
      });
      return { date: d, actual: a / 1000, budget: b / 1000 };   /* GWh */
    });
  }

  /* ---------- the rules ---------- */

  function daysInStage(p) { return daysBetween(p.stageEnteredAt, todayISO()); }

  function isStuck(p) {
    var t = STAGE_MAP[p.stage].target;
    return t != null && daysInStage(p) > t * 1.5;
  }

  /* Days still needed to reach operation from the current stage. */
  function daysToOperation(p) {
    var left = 0;
    STAGES.forEach(function (s) {
      if (s.target != null && s.order >= STAGE_MAP[p.stage].order) left += s.target;
    });
    return Math.max(0, left - daysInStage(p));
  }

  /* A tariff is lost if the plant cannot reach operation before the
     GSE deadline. This is the rule that matters most to an owner. */
  function gseRisk(p) {
    if (isLive(p) || !p.gseDeadline) return 'none';
    var slack = daysBetween(todayISO(), p.gseDeadline) - daysToOperation(p);
    if (slack < 0) return 'lost';
    if (slack < 60) return 'tight';
    return 'ok';
  }

  function isUnderperforming(p) { return isLive(p) && isPv(p) && p.perf < PERF_FLOOR; }

  /* ---------- portfolio roll-ups ---------- */

  function totals() {
    var t = {
      liveMwp: 0, livePlants: 0, pipelineMwp: 0, buildMwp: 0,
      bessMwh: 0, bessMw: 0, bessUnits: 0,
      gwhYear: 0, stuck: 0, lost: 0, tight: 0, under: 0,
      perfSum: 0, perfN: 0, availSum: 0, availN: 0
    };
    plants.forEach(function (p) {
      if (p.type === 'bess') {
        t.bessMwh += p.mwh; t.bessMw += p.mw;
        if (isLive(p)) t.bessUnits += 1;
      }
      if (isLive(p)) {
        t.livePlants += 1;
        if (isPv(p)) {
          t.liveMwp += p.mwp;
          t.gwhYear += budgetMwhYear(p) * p.perf / 1000;
          t.perfSum += p.perf; t.perfN += 1;
        }
        t.availSum += p.availability; t.availN += 1;
      } else if (isPv(p)) {
        t.pipelineMwp += p.mwp;
        if (p.stage === 'construction' || p.stage === 'connection') t.buildMwp += p.mwp;
      }
      if (isStuck(p)) t.stuck += 1;
      var r = gseRisk(p);
      if (r === 'lost') t.lost += 1;
      if (r === 'tight') t.tight += 1;
      if (isUnderperforming(p)) t.under += 1;
    });
    t.perf = t.perfN ? t.perfSum / t.perfN : 0;
    t.avail = t.availN ? t.availSum / t.availN : 0;
    /* 0.36 t CO2 per MWh, the usual Italian grid factor */
    t.co2kt = t.gwhYear * 0.36;
    return t;
  }

  /* ============================================================
     Shared chart pieces
     ============================================================ */

  var tip = null;
  function showTip(el, html) {
    if (!tip) tip = $('#tip');
    if (!tip) return;
    tip.innerHTML = html;
    var r = el.getBoundingClientRect();
    tip.style.left = (r.left + r.width / 2) + 'px';
    tip.style.top = r.top + 'px';
    tip.classList.add('show');
  }
  function hideTip() { if (tip) tip.classList.remove('show'); }

  function bindTip(root) {
    $$('[data-tip]', root).forEach(function (el) {
      var html = el.getAttribute('data-tip');
      el.addEventListener('pointerenter', function () { showTip(el, html); });
      el.addEventListener('pointerleave', hideTip);
      el.addEventListener('focus', function () { showTip(el, html); });
      el.addEventListener('blur', hideTip);
    });
  }

  function kpiTile(c) {
    var state = c.state
      ? '<span class="sf-kpi-state ' + c.state.cls + '"><svg class="i"><use href="#' +
        c.state.icon + '"/></svg>' + esc(c.state.text) + '</span>'
      : '';
    return '<div class="sf-kpi">' +
      '<div class="sf-kpi-label">' + esc(c.label) + '</div>' +
      '<div class="sf-kpi-value">' + esc(c.value) +
        (c.unit ? '<small>' + esc(c.unit) + '</small>' : '') + '</div>' +
      state + '</div>';
  }

  function legend(keys) {
    return '<div class="sf-legend">' + keys.map(function (k) {
      if (k.unit) return '<span class="sf-key sf-key--unit">' + esc(k.unit) + '</span>';
      if (k.dash) return '<span class="sf-key"><i class="sf-key-dash"></i>' + esc(k.label) + '</span>';
      return '<span class="sf-key"><i style="background:' + k.color + '"></i>' + esc(k.label) +
        (k.value ? ' <b>' + esc(k.value) + '</b>' : '') + '</span>';
    }).join('') + '</div>';
  }

  /* ============================================================
     Overview
     ============================================================ */

  function renderOverview() {
    var t = totals();

    $('#ovKpis').innerHTML = [
      kpiTile({ label: 'Connected', value: num(t.liveMwp, 1), unit: 'MWp' }),
      kpiTile({ label: 'Plants live', value: num(t.livePlants) }),
      kpiTile({ label: 'Pipeline', value: num(t.pipelineMwp, 1), unit: 'MWp' }),
      kpiTile({ label: 'Storage', value: num(t.bessMwh, 0), unit: 'MWh' }),
      kpiTile({ label: 'Annual output', value: num(t.gwhYear, 0), unit: 'GWh' }),
      kpiTile({
        label: 'CO2 avoided', value: num(t.co2kt, 0), unit: 'kt/yr',
        state: { cls: 'is-good', icon: 'i-check', text: 'vs grid mix' }
      })
    ].join('');

    renderTarget(t);
    renderConnections();
    renderRegions();
  }

  /* Progress to the 500 MWp target, as one stacked bar. */
  function renderTarget(t) {
    var awarded = Math.max(0, t.pipelineMwp - t.buildMwp);
    var segs = [
      { label: 'Connected', v: t.liveMwp, color: STAGE_MAP.operation.color },
      { label: 'Under construction', v: t.buildMwp, color: STAGE_MAP.construction.color },
      { label: 'Earlier stages', v: awarded, color: STAGE_MAP.tica.color }
    ];
    var sum = segs.reduce(function (a, s) { return a + s.v; }, 0);
    var scale = Math.max(TARGET_MWP, sum);
    var met = sum >= TARGET_MWP;

    $('#ovTarget').innerHTML =
      '<div class="sf-target-head">' +
        '<div><span class="sf-target-now">' + num(sum, 0) + '</span>' +
        '<span class="sf-target-of">' + T('of 500 MWp targeted by end 2026') + '</span></div>' +
        '<span class="sf-kpi-state ' + (met ? 'is-good' : 'is-warn') + '">' +
          '<svg class="i"><use href="#' + (met ? 'i-check' : 'i-hourglass') + '"/></svg>' +
          (met ? T('Target met') : num(TARGET_MWP - sum, 0) + T(' MWp to go')) +
        '</span>' +
      '</div>' +
      '<div class="sf-target-track">' +
        segs.map(function (s) {
          return '<span class="sf-target-seg" tabindex="0" style="width:' +
            (s.v / scale * 100).toFixed(2) + '%;background:' + s.color + '"' +
            ' data-tip="<b>' + esc(s.label) + '</b><span>' + num(s.v, 1) + ' MWp</span>"></span>';
        }).join('') +
        '<span class="sf-target-mark" style="left:' + (TARGET_MWP / scale * 100).toFixed(2) + '%"></span>' +
      '</div>' +
      legend(segs.map(function (s) {
        return { label: s.label, color: s.color, value: num(s.v, 1) };
      }).concat([{ unit: 'MWp' }]));

    bindTip($('#ovTarget'));
  }

  /* MWp connected per month. One series, so no legend. */
  function renderConnections() {
    var data = lastMonths(24).map(function (d) {
      var k = monthKey(d), v = 0;
      plants.forEach(function (p) {
        if (isPv(p) && p.cod && p.cod.slice(0, 7) === k) v += p.mwp;
      });
      return { date: d, v: v };
    });
    var max = Math.max.apply(null, data.map(function (d) { return d.v; })) || 1;

    $('#ovConn').innerHTML = data.map(function (d) {
      var h = d.v > 0 ? Math.max(3, Math.round(d.v / max * 100)) : 0;
      var label = d.date.toLocaleDateString(loc(), { month: 'short', year: '2-digit' });
      return '<div class="sf-mcol">' +
        '<button type="button" data-tip="<b>' + esc(label) + '</b><span>' +
          num(d.v, 2) + T(' MWp connected') + '</span>">' +
          '<span class="sf-mtrack"><span class="sf-mbar" style="height:' + h + '%"></span></span>' +
        '</button>' +
        '<span class="sf-mlabel">' + (d.date.getMonth() % 3 === 0 ? esc(label) : '') + '</span>' +
        '</div>';
    }).join('');
    bindTip($('#ovConn'));
  }

  /* Capacity by region. One hue per series: length is the value,
     colour must not encode rank. */
  function renderRegions() {
    var rows = REGION_NAMES.map(function (name) {
      var live = 0, pipe = 0, n = 0;
      plants.forEach(function (p) {
        if (p.region !== name || !isPv(p)) return;
        n += 1;
        if (isLive(p)) live += p.mwp; else pipe += p.mwp;
      });
      return { name: name, live: live, pipe: pipe, total: live + pipe, n: n };
    }).sort(function (a, b) { return b.total - a.total; });

    var max = Math.max.apply(null, rows.map(function (r) { return r.total; })) || 1;

    $('#ovRegions').innerHTML = rows.map(function (r) {
      return '<div class="sf-hrow">' +
        '<span class="sf-hlabel">' + esc(r.name) + '</span>' +
        '<span class="sf-htrack" tabindex="0" data-tip="<b>' + esc(r.name) + '</b><span>' +
          num(r.live, 1) + T(' MWp live') + ' · ' + num(r.pipe, 1) + T(' MWp pipeline') + ' · ' +
          r.n + T(' plants') + '</span>">' +
          '<span class="sf-hbar" style="width:' + (r.live / max * 100).toFixed(1) +
            '%;background:' + STAGE_MAP.operation.color + '"></span>' +
          '<span class="sf-hbar" style="width:' + (r.pipe / max * 100).toFixed(1) +
            '%;background:' + STAGE_MAP.tica.color + '"></span>' +
        '</span>' +
        '<span class="sf-hval">' + num(r.total, 1) + '</span>' +
        '</div>';
    }).join('') +
    legend([
      { label: 'Connected', color: STAGE_MAP.operation.color },
      { label: 'Pipeline', color: STAGE_MAP.tica.color },
      { unit: 'MWp' }
    ]);
    bindTip($('#ovRegions'));
  }

  /* ============================================================
     Pipeline
     ============================================================ */

  function renderPipeline() {
    renderFunnel();
    renderRisk();
    renderAlerts();
    renderTable();
  }

  function renderFunnel() {
    var data = STAGES.filter(function (s) { return s.key !== 'operation'; }).map(function (s) {
      var n = 0, mwp = 0;
      plants.forEach(function (p) {
        if (p.stage !== s.key) return;
        n += 1; if (isPv(p)) mwp += p.mwp;
      });
      return { s: s, n: n, mwp: mwp };
    });
    var val = function (d) { return funnelMode === 'mwp' ? d.mwp : d.n; };
    var max = Math.max.apply(null, data.map(val)) || 1;

    $('#pipeFunnel').innerHTML = data.map(function (d) {
      var v = val(d);
      var pct = Math.max(4, Math.round(v / max * 100));
      var on = filters.stage === d.s.key;
      return '<div class="sf-col">' +
        '<button type="button" data-stage="' + d.s.key + '" aria-pressed="' + on + '" ' +
          'aria-label="' + esc(d.s.label) + ': ' + num(d.n) + ' plants, ' + num(d.mwp, 1) +
          ' MWp. Click to filter the table.">' +
          '<span class="sf-col-val">' + (funnelMode === 'mwp' ? num(v, 1) : num(v)) + '</span>' +
          '<span class="sf-track"><span class="sf-bar" style="height:' + pct +
            '%;background:' + d.s.color + '"></span></span>' +
          '<span class="sf-col-label">' + esc(d.s.label) +
            '<small>' + esc(d.s.note) + '</small></span>' +
        '</button></div>';
    }).join('');

    $$('#pipeFunnel button').forEach(function (b) {
      var key = b.getAttribute('data-stage');
      var d = data.filter(function (x) { return x.s.key === key; })[0];
      b.addEventListener('click', function () {
        filters.stage = filters.stage === key ? '' : key;
        $('#stageFilter').value = filters.stage;
        renderFunnel(); renderTable();
      });
      var html = '<b>' + esc(d.s.label) + '</b><span>' + num(d.n) + ' plants · ' +
        num(d.mwp, 1) + ' MWp' + (d.s.target ? ' · ' + T('typical') + ' ' + d.s.target + T(' days') : '') + '</span>';
      b.addEventListener('pointerenter', function () { showTip(b, html); });
      b.addEventListener('pointerleave', hideTip);
      b.addEventListener('focus', function () { showTip(b, html); });
      b.addEventListener('blur', hideTip);
    });
  }

  /* MWp hitting its GSE tariff deadline per quarter, on track vs at risk. */
  function renderRisk() {
    var now = new Date();
    var buckets = {}, order = [];
    for (var i = 0; i < 8; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() + i * 3, 1);
      var key = d.getFullYear() + ' Q' + (Math.floor(d.getMonth() / 3) + 1);
      if (!buckets[key]) { buckets[key] = { key: key, ok: 0, risk: 0 }; order.push(key); }
    }
    var overdue = { key: 'Passed', ok: 0, risk: 0 };
    var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    plants.forEach(function (p) {
      if (isLive(p) || !isPv(p) || !p.gseDeadline) return;
      var dd = new Date(p.gseDeadline + 'T00:00:00');
      var key = dd.getFullYear() + ' Q' + (Math.floor(dd.getMonth() / 3) + 1);
      var b = dd < startOfMonth ? overdue : buckets[key];
      if (!b) return;
      if (gseRisk(p) === 'ok') b.ok += p.mwp; else b.risk += p.mwp;
    });

    var rows = (overdue.ok + overdue.risk > 0 ? [overdue] : [])
      .concat(order.map(function (k) { return buckets[k]; }));
    var max = Math.max.apply(null, rows.map(function (b) { return b.ok + b.risk; })) || 1;

    $('#pipeRisk').innerHTML =
      '<div class="sf-chart">' + rows.map(function (b) {
        var tot = b.ok + b.risk;
        return '<div class="sf-col">' +
          '<button type="button" data-tip="<b>' + esc(b.key) + '</b><span>' +
            num(b.ok, 1) + T(' MWp on track') + ' · ' + num(b.risk, 1) + T(' MWp at risk') + '</span>">' +
            '<span class="sf-col-val">' + (tot ? num(tot, 1) : '') + '</span>' +
            '<span class="sf-track"><span class="sf-stack">' +
              '<span style="height:' + (tot ? b.risk / max * 100 : 0) + '%;background:' + PALETTE.danger + '"></span>' +
              '<span style="height:' + (tot ? b.ok / max * 100 : 0) + '%;background:' + PALETTE.good + '"></span>' +
            '</span></span>' +
            '<span class="sf-col-label">' + esc(b.key) + '</span>' +
          '</button></div>';
      }).join('') + '</div>' +
      legend([
        { label: 'On track', color: PALETTE.good },
        { label: 'At risk of losing the tariff', color: PALETTE.danger },
        { unit: 'MWp' }
      ]);
    bindTip($('#pipeRisk'));
  }

  function renderAlerts() {
    var items = [];
    plants.forEach(function (p) {
      var risk = gseRisk(p);
      if (risk === 'lost') items.push({
        sev: 'danger', icon: 'i-alert', id: p.id, rank: 0,
        text: '<b>' + esc(p.name) + '</b> ' + T('cannot reach operation before its GSE deadline of') + ' ' +
          fmtDate(p.gseDeadline) + '. ' + T('The tariff of') + ' ' + p.tariff + T(' €/MWh is at risk.')
      });
      else if (risk === 'tight') items.push({
        sev: 'warn', icon: 'i-hourglass', id: p.id, rank: 2,
        text: '<b>' + esc(p.name) + '</b> ' + T('has little slack before its GSE deadline of') + ' ' +
          fmtDate(p.gseDeadline) + '.'
      });
      if (isStuck(p)) items.push({
        sev: 'danger', icon: 'i-alert', id: p.id, rank: 1,
        text: '<b>' + esc(p.name) + '</b> ' + T('has been in') + ' ' + esc(T(STAGE_MAP[p.stage].label)) +
          ' ' + T('for') + ' ' + daysInStage(p) + ' ' + T('days. The typical time is') + ' ' +
          STAGE_MAP[p.stage].target + '.'
      });
      if (isUnderperforming(p)) items.push({
        sev: 'warn', icon: 'i-gauge', id: p.id, rank: 3,
        text: '<b>' + esc(p.name) + '</b> ' + T('is running at') + ' ' + Math.round(p.perf * 100) + T('% of budget.')
      });
    });
    items.sort(function (a, b) { return a.rank - b.rank; });

    var el = $('#alerts');
    if (!items.length) {
      el.innerHTML = '<div class="sf-alert sf-alert-ok"><svg class="i"><use href="#i-check"/></svg>' +
        '<span>No alerts. Every plant is within its targets.</span></div>';
      return;
    }
    var shown = items.slice(0, 8);
    el.innerHTML = shown.map(function (it) {
      return '<button type="button" class="sf-alert sf-alert-' + it.sev + '" data-id="' + it.id + '">' +
        '<svg class="i"><use href="#' + it.icon + '"/></svg><span>' + it.text + '</span></button>';
    }).join('') +
    (items.length > shown.length
      ? '<p class="sf-alert-more">' + (items.length - shown.length) +
        T(' more alerts, sorted by severity.') + '</p>' : '');

    $$('[data-id]', el).forEach(function (x) {
      x.addEventListener('click', function () { openModal(x.getAttribute('data-id')); });
    });
  }

  /* ============================================================
     Operations
     ============================================================ */

  function renderOperations() {
    var t = totals();
    $('#opKpis').innerHTML = [
      kpiTile({
        label: 'Fleet performance', value: num(t.perf * 100, 1), unit: '% of budget',
        state: t.perf >= 1
          ? { cls: 'is-good', icon: 'i-check', text: 'Above budget' }
          : { cls: 'is-warn', icon: 'i-gauge', text: 'Below budget' }
      }),
      kpiTile({ label: 'Availability', value: num(t.avail * 100, 1), unit: '%' }),
      kpiTile({
        label: 'Underperforming', value: num(t.under),
        state: t.under
          ? { cls: 'is-warn', icon: 'i-gauge', text: T('Below') + ' ' + Math.round(PERF_FLOOR * 100) + '%' }
          : { cls: 'is-good', icon: 'i-check', text: 'All on budget' }
      }),
      kpiTile({ label: 'Storage online', value: num(t.bessMw, 1), unit: 'MW' })
    ].join('');

    renderGeneration();
    renderBottom();
    renderBess(t);
  }

  /* Actual vs budget generation, 24 months. Two series, so a legend.
     Budget is a reference, so it recedes to a dashed neutral line. */
  function renderGeneration() {
    var data = fleetMonthly(24);
    var W = 800, H = 260, pad = { l: 46, r: 14, t: 14, b: 34 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var peak = Math.max.apply(null, data.map(function (d) { return Math.max(d.actual, d.budget); })) || 1;
    var max = Math.ceil(peak * 1.15);

    var x = function (i) { return pad.l + (data.length < 2 ? iw / 2 : i / (data.length - 1) * iw); };
    var y = function (v) { return pad.t + ih - (v / max) * ih; };
    var path = function (key) {
      return data.map(function (d, i) {
        return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[key]).toFixed(1);
      }).join(' ');
    };
    var last = data[data.length - 1] || { actual: 0, budget: 0 };
    var band = iw / Math.max(1, data.length);

    var svg = '<svg class="sf-line" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Monthly generation against budget over the last 24 months, in GWh">' +
      [0, 0.25, 0.5, 0.75, 1].map(function (f) {
        var v = max * f;
        return '<line class="sf-grid" x1="' + pad.l + '" x2="' + (W - pad.r) +
          '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
          '<text class="sf-axis" x="' + (pad.l - 8) + '" y="' + (y(v) + 3.5).toFixed(1) +
          '" text-anchor="end">' + num(v, 0) + '</text>';
      }).join('') +
      data.map(function (d, i) {
        if (d.date.getMonth() % 6 !== 0) return '';
        return '<text class="sf-axis" x="' + x(i).toFixed(1) + '" y="' + (H - 12) +
          '" text-anchor="middle">' +
          d.date.toLocaleDateString(loc(), { month: 'short', year: '2-digit' }) + '</text>';
      }).join('') +
      '<path class="sf-line-budget" d="' + path('budget') + '"/>' +
      '<path class="sf-line-actual" d="' + path('actual') + '"/>' +
      '<circle class="sf-line-dot" cx="' + x(data.length - 1).toFixed(1) + '" cy="' +
        y(last.actual).toFixed(1) + '" r="4.5"/>' +
      data.map(function (d, i) {
        return '<rect class="sf-hit" x="' + (x(i) - band / 2).toFixed(1) + '" y="' + pad.t +
          '" width="' + band.toFixed(1) + '" height="' + ih + '" tabindex="0" ' +
          'data-tip="<b>' + d.date.toLocaleDateString(loc(), { month: 'long', year: 'numeric' }) +
          '</b><span>' + num(d.actual, 1) + T(' GWh actual') + ' · ' + num(d.budget, 1) +
          T(' GWh budget') + '</span>"/>';
      }).join('') +
      '</svg>';

    $('#opGen').innerHTML = svg + legend([
      { label: 'Actual', color: PALETTE.accent },
      { label: 'Budget', dash: true },
      { unit: 'GWh per month' }
    ]);
    bindTip($('#opGen'));
  }

  /* The eight worst performers, named, with the threshold marked. */
  function renderBottom() {
    var rows = plants.filter(function (p) { return isLive(p) && isPv(p); })
      .sort(function (a, b) { return a.perf - b.perf; }).slice(0, 8);

    if (!rows.length) { $('#opBottom').innerHTML = '<p class="sf-empty">No operating plants.</p>'; return; }

    var max = 1.1;
    $('#opBottom').innerHTML = rows.map(function (p) {
      var low = p.perf < PERF_FLOOR;
      return '<div class="sf-hrow">' +
        '<span class="sf-hlabel">' + esc(p.name) + '</span>' +
        '<span class="sf-htrack" tabindex="0" data-tip="<b>' + esc(p.name) + '</b><span>' +
          esc(p.code) + ' · ' + num(p.mwp, 2) + ' MWp · ' +
          num(p.availability * 100, 1) + T('% available') + '</span>">' +
          '<span class="sf-hbar" style="width:' + (p.perf / max * 100).toFixed(1) +
            '%;background:' + (low ? PALETTE.danger : PALETTE.good) + '"></span>' +
          '<span class="sf-hmark" style="left:' + (PERF_FLOOR / max * 100).toFixed(1) + '%"></span>' +
        '</span>' +
        '<span class="sf-hval' + (low ? ' is-low' : '') + '">' + num(p.perf * 100, 0) + '%</span>' +
        '</div>';
    }).join('') +
    legend([{ unit: T('Output as a share of budget. The line marks') + ' ' +
      Math.round(PERF_FLOOR * 100) + '%.' }]);
    bindTip($('#opBottom'));
  }

  function renderBess(t) {
    var units = plants.filter(function (p) { return p.type === 'bess'; });
    if (!units.length) { $('#opBess').innerHTML = '<p class="sf-empty">No storage units.</p>'; return; }

    var live = units.filter(isLive).length;
    $('#opBess').innerHTML =
      '<div class="sf-kpis">' +
        kpiTile({ label: 'Units', value: num(units.length), unit: live + T(' live') }) +
        kpiTile({ label: 'Power', value: num(t.bessMw, 1), unit: 'MW' }) +
        kpiTile({ label: 'Energy', value: num(t.bessMwh, 0), unit: 'MWh' }) +
        kpiTile({ label: 'Round trip', value: '88.4', unit: '%' }) +
      '</div>' +
      '<p class="sf-bess-note">' + num(t.bessMwh, 0) + T(' MWh of the') + ' ' + TARGET_MWH +
        T(' MWh targeted by 2027.') + '</p>';
  }

  /* ============================================================
     Table
     ============================================================ */

  function filtered() {
    return plants.filter(function (p) {
      if (filters.stage && p.stage !== filters.stage) return false;
      if (filters.region && p.region !== filters.region) return false;
      if (filters.search) {
        var q = filters.search.toLowerCase();
        if (p.name.toLowerCase().indexOf(q) < 0 &&
            p.code.toLowerCase().indexOf(q) < 0 &&
            p.owner.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function sizeOf(p) { return p.type === 'bess' ? p.mw : p.mwp; }

  function renderTable() {
    var rows = filtered().map(function (p) { return { p: p, days: daysInStage(p) }; });

    rows.sort(function (a, b) {
      var va, vb;
      if (sortKey === 'days') { va = a.days; vb = b.days; }
      else if (sortKey === 'size') { va = sizeOf(a.p); vb = sizeOf(b.p); }
      else if (sortKey === 'tariff') { va = a.p.tariff; vb = b.p.tariff; }
      else if (sortKey === 'deadline') { va = a.p.gseDeadline; vb = b.p.gseDeadline; }
      else if (sortKey === 'stage') { va = STAGE_MAP[a.p.stage].order; vb = STAGE_MAP[b.p.stage].order; }
      else { va = String(a.p[sortKey]).toLowerCase(); vb = String(b.p[sortKey]).toLowerCase(); }
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });

    $('#tbody').innerHTML = rows.map(function (r) {
      var p = r.p, s = STAGE_MAP[p.stage];
      var flag = isStuck(p) ? '<span class="sf-flag"><svg class="i"><use href="#i-alert"/></svg></span>' : '';
      var dl = gseRisk(p) === 'lost'
        ? '<span class="sf-late">' + fmtDate(p.gseDeadline) + '</span>'
        : fmtDate(p.gseDeadline);
      return '<tr data-id="' + p.id + '" tabindex="0">' +
        '<td class="num">' + esc(p.code) + '</td>' +
        '<td>' + esc(p.name) + '<small>' + esc(p.province) + ' · ' + esc(p.permit) + '</small></td>' +
        '<td>' + esc(p.region) + '</td>' +
        '<td><span class="sf-type sf-type--' + p.type + '">' + esc(TYPES[p.type]) + '</span></td>' +
        '<td class="num">' + num(sizeOf(p), 2) + '</td>' +
        '<td><span class="sf-chip"><i style="background:' + s.color + '"></i>' + esc(s.label) + '</span></td>' +
        '<td class="num">' + r.days + flag + '</td>' +
        '<td class="num">' + (p.tariff || '—') + '</td>' +
        '<td class="num">' + dl + '</td>' +
      '</tr>';
    }).join('');

    $('#empty').hidden = rows.length > 0;
    $('#tableCount').textContent = rows.length + (rows.length === 1 ? ' plant' : ' plants');

    $$('#tbody tr').forEach(function (tr) {
      var open = function () { openModal(tr.getAttribute('data-id')); };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
    });

    $$('thead th[data-key]').forEach(function (th) {
      if (th.getAttribute('data-key') === sortKey) {
        th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
        $('.sort', th).textContent = sortDir === 1 ? '↑' : '↓';
      } else {
        th.removeAttribute('aria-sort');
        $('.sort', th).textContent = '';
      }
    });
  }

  function populateSelects() {
    STAGES.forEach(function (s) {
      var o = '<option value="' + s.key + '">' + esc(s.label) + '</option>';
      $('#stageFilter').insertAdjacentHTML('beforeend', o);
      $('#fStage').insertAdjacentHTML('beforeend', o);
    });
    REGION_NAMES.forEach(function (r) {
      var o = '<option value="' + esc(r) + '">' + esc(r) + '</option>';
      $('#regionFilter').insertAdjacentHTML('beforeend', o);
      $('#fRegion').insertAdjacentHTML('beforeend', o);
    });
    Object.keys(TYPES).forEach(function (k) {
      $('#fType').insertAdjacentHTML('beforeend',
        '<option value="' + k + '">' + esc(TYPES[k]) + '</option>');
    });
  }

  /* ============================================================
     Modal
     ============================================================ */

  var editingId = null, lastFocus = null;

  function openModal(id) {
    editingId = id || null;
    lastFocus = document.activeElement;
    var p = id ? plants.filter(function (x) { return x.id === id; })[0] : null;

    $('#modalTitle').textContent = p ? 'Edit plant' : 'Add plant';
    $('#fDelete').hidden = !p;
    resetConfirm($('#fDelete'), $('#fDeleteLabel'), 'Delete');
    $('#nameField').classList.remove('has-error');

    $('#fName').value = p ? p.name : '';
    $('#fCode').value = p ? p.code : 'PV-NEW-' + String(plants.length + 1).padStart(3, '0');
    $('#fOwner').value = p ? p.owner : OWNERS[0];
    $('#fRegion').value = p ? p.region : REGION_NAMES[0];
    $('#fType').value = p ? p.type : 'rooftop';
    $('#fStage').value = p ? p.stage : STAGES[0].key;
    $('#fSize').value = p ? sizeOf(p) : 1.00;
    $('#fTariff').value = p ? p.tariff : 85;
    $('#fDeadline').value = p ? p.gseDeadline : addDays(todayISO(), 540);

    $('#modalScrim').classList.add('open');
    document.body.classList.add('lock');
    $('#fName').focus();
  }

  function closeModal() {
    $('#modalScrim').classList.remove('open');
    document.body.classList.remove('lock');
    editingId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function saveModal() {
    var name = $('#fName').value.trim();
    if (!name) { $('#nameField').classList.add('has-error'); $('#fName').focus(); return; }

    var stage = $('#fStage').value;
    var type = $('#fType').value;
    var size = parseFloat($('#fSize').value) || 0;
    var region = $('#fRegion').value;

    var apply = function (p) {
      p.name = name;
      p.code = $('#fCode').value.trim();
      p.owner = $('#fOwner').value;
      p.region = region;
      p.type = type;
      p.stage = stage;
      p.tariff = parseInt($('#fTariff').value, 10) || 0;
      p.gseDeadline = $('#fDeadline').value;
      if (type === 'bess') { p.mw = size; p.mwh = Math.round(size * 3 * 10) / 10; p.mwp = 0; }
      else { p.mwp = size; p.mw = 0; p.mwh = 0; }
      p.permit = (p.mwp >= 1 || type !== 'rooftop') ? 'AU' : 'PAS';
      p.yieldKwhKwp = p.yieldKwhKwp || (REGION_MAP[region] || REGIONS[0]).yield;
      if (stage === 'operation') {
        if (!p.cod) p.cod = todayISO();
        if (!p.perf) p.perf = 1;
        if (!p.availability) p.availability = 0.99;
      } else {
        p.cod = '';
      }
    };

    if (editingId) {
      var p = plants.filter(function (x) { return x.id === editingId; })[0];
      if (p.stage !== stage) p.stageEnteredAt = todayISO();
      apply(p);
    } else {
      var np = {
        id: uid(), stageEnteredAt: todayISO(),
        province: (REGION_MAP[region] || REGIONS[0]).prov[0],
        perf: 1, availability: 0.99, cod: '', ticaAcceptedAt: '',
        seed: Math.floor(Math.random() * 1e9)
      };
      apply(np);
      plants.unshift(np);
    }
    persist();
    closeModal();
    renderAll();
  }

  /* Two-step confirm on the button, instead of a browser dialog. */
  function resetConfirm(btn, labelEl, text) {
    btn.classList.remove('is-confirming');
    btn.dataset.armed = '';
    labelEl.textContent = text;
    if (btn._t) { clearTimeout(btn._t); btn._t = null; }
  }
  function armConfirm(btn, labelEl, text, original, run) {
    if (btn.dataset.armed === 'yes') { resetConfirm(btn, labelEl, original); run(); return; }
    btn.dataset.armed = 'yes';
    btn.classList.add('is-confirming');
    labelEl.textContent = text;
    btn._t = setTimeout(function () { resetConfirm(btn, labelEl, original); }, 4000);
  }

  /* ============================================================
     Tabs
     ============================================================ */

  var TABS = ['overview', 'pipeline', 'operations'];
  var activeTab = 'overview';

  function renderActive() {
    if (activeTab === 'overview') renderOverview();
    else if (activeTab === 'pipeline') renderPipeline();
    else renderOperations();
    if (window.I18N) I18N.apply();
  }
  function renderAll() { renderActive(); }

  function setTab(name, push) {
    if (TABS.indexOf(name) < 0) name = 'overview';
    activeTab = name;
    hideTip();
    $$('[role="tab"]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    $$('[role="tabpanel"]').forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
    if (push && location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    renderActive();
  }

  function initTabs() {
    var tabs = $$('[role="tab"]');
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab'), true); });
      b.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        tabs[j].focus();
        setTab(tabs[j].getAttribute('data-tab'), true);
      });
    });
    addEventListener('hashchange', function () { setTab(location.hash.slice(1), false); });
  }

  /* ============================================================
     App start. Runs once, after the gate opens.
     ============================================================ */

  var appStarted = false;
  function initApp() {
    if (appStarted) return;
    appStarted = true;
    readPalette();
    load();
    populateSelects();
    initTabs();

    $('#addBtn').addEventListener('click', function () { openModal(null); });

    var resetBtn = $('#resetBtn'), resetLabel = $('#resetLabel');
    resetBtn.addEventListener('click', function () {
      armConfirm(resetBtn, resetLabel, 'Sure? Reset', 'Reset data', function () {
        plants = seed(); persist(); renderAll();
      });
    });

    var delBtn = $('#fDelete'), delLabel = $('#fDeleteLabel');
    delBtn.addEventListener('click', function () {
      armConfirm(delBtn, delLabel, 'Sure? Delete', 'Delete', function () {
        plants = plants.filter(function (x) { return x.id !== editingId; });
        persist(); closeModal(); renderAll();
      });
    });

    $('#modalClose').addEventListener('click', closeModal);
    $('#modalScrim').addEventListener('click', function (e) {
      if (e.target.id === 'modalScrim') closeModal();
    });
    $('#fSave').addEventListener('click', saveModal);
    $('#fName').addEventListener('input', function () {
      $('#nameField').classList.remove('has-error');
    });

    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#modalScrim').classList.contains('open')) closeModal();
    });

    $('#search').addEventListener('input', function (e) {
      filters.search = e.target.value; renderTable();
    });
    $('#stageFilter').addEventListener('change', function (e) {
      filters.stage = e.target.value; renderFunnel(); renderTable();
    });
    $('#regionFilter').addEventListener('change', function (e) {
      filters.region = e.target.value; renderTable();
    });

    $$('[data-funnel]').forEach(function (b) {
      b.addEventListener('click', function () {
        funnelMode = b.getAttribute('data-funnel');
        $$('[data-funnel]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        renderFunnel();
      });
    });

    $$('thead th[data-key]').forEach(function (th) {
      var sort = function () {
        var key = th.getAttribute('data-key');
        if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
        renderTable();
      };
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); }
      });
    });

    addEventListener('scroll', hideTip, { passive: true });
    addEventListener('resize', hideTip, { passive: true });
    document.addEventListener('i18n:change', function () { renderActive(); });

    setTab(location.hash.slice(1) || 'overview', false);
  }

  /* ============================================================
     Sign-in gate.

     This runs in the browser, so it is a convincing gate, not
     security. Anyone who opens DevTools can get past it. Real
     protection needs a server or a hosted auth service.

     What the code compares is one SHA-256 digest of
     username + newline + password, never a stored password.
     To change the credentials, regenerate it with:

       node -e 'console.log(require("crypto").createHash("sha256")
         .update("NEW_USER\nNEW_PASSWORD").digest("hex"))'

     This demo is open to anyone, so the credentials below are
     published on purpose and the gate offers to fill them in.
     ============================================================ */

  var AUTH_KEY = 'solarflow.auth';
  var USER_KEY = 'solarflow.user';
  var USER_NAME = 'Demo user';
  var DEMO_USER = 'admin', DEMO_PASS = 'admin';
  var EXPECTED = '6314d7ddef55cbbc946f542ba290b17ad17582142998407ee1d02992a9702701';
  var MAX_TRIES = 5, LOCKOUT_S = 30;

  function session(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function remember(key, v) { try { sessionStorage.setItem(key, v); } catch (e) { /* blocked */ } }
  function forget(key) { try { sessionStorage.removeItem(key); } catch (e) { /* blocked */ } }

  function digest(user, password) {
    var data = new TextEncoder().encode(user.trim().toLowerCase() + '\n' + password);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return [].map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  function showUser(user) {
    $('#sfUserName').textContent = T(USER_NAME);
    $('#sfUserId').textContent = user || '';
    $('#sfAvatar').textContent = initials(T(USER_NAME));
  }

  function unlock(user) {
    remember(AUTH_KEY, '1');
    if (user) remember(USER_KEY, user);
    document.documentElement.classList.remove('sf-locked');
    showUser(user || session(USER_KEY) || '');
    initApp();
  }

  function lock() {
    forget(AUTH_KEY);
    forget(USER_KEY);
    document.documentElement.classList.add('sf-locked');
    var form = $('#sfGateForm');
    if (form) form.reset();
    gateError('');
    var f = $('#gUser');
    if (f) f.focus();
  }

  function gateError(msg) {
    var el = $('#gError');
    if (!el) return;
    el.textContent = msg ? T(msg) : '';
    el.hidden = !msg;
  }

  function initGate() {
    var form = $('#sfGateForm'), btn = $('#gSubmit'), label = $('#gSubmitLabel');
    var signOut = $('#sfSignOut'), fill = $('#gFill');
    var tries = 0, cooling = false;

    if (signOut) signOut.addEventListener('click', lock);

    /* the demo is open, so the gate hands over its own credentials */
    if (fill) fill.addEventListener('click', function () {
      $('#gUser').value = DEMO_USER;
      $('#gPass').value = DEMO_PASS;
      gateError('');
      btn.focus();
    });

    /* the name in the bar is translated, so repaint it on a switch */
    document.addEventListener('i18n:change', function () {
      if (session(AUTH_KEY) === '1') showUser(session(USER_KEY) || '');
    });

    if (!form) return;

    function coolDown() {
      cooling = true;
      btn.disabled = true;
      var left = LOCKOUT_S;
      label.textContent = T('Try again in') + ' ' + left + 's';
      var t = setInterval(function () {
        left -= 1;
        if (left > 0) { label.textContent = T('Try again in') + ' ' + left + 's'; return; }
        clearInterval(t);
        cooling = false; tries = 0;
        btn.disabled = false;
        label.textContent = T('Sign in');
        gateError('');
      }, 1000);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (cooling) return;

      var user = $('#gUser').value, password = $('#gPass').value;
      if (!user.trim() || !password) { gateError('Please fill in both fields.'); return; }

      if (!(window.crypto && crypto.subtle)) {
        gateError('This demo needs https or localhost to sign you in.');
        return;
      }

      btn.disabled = true;
      label.textContent = T('Checking…');

      digest(user, password).then(function (hex) {
        btn.disabled = false;
        label.textContent = T('Sign in');
        if (hex === EXPECTED) { gateError(''); unlock(user.trim().toLowerCase()); return; }
        tries += 1;
        $('#gPass').value = '';
        if (tries >= MAX_TRIES) { gateError('Too many attempts.'); coolDown(); return; }
        gateError('That username or password is not right.');
        $('#gPass').focus();
      }).catch(function () {
        btn.disabled = false;
        label.textContent = T('Sign in');
        gateError('Something went wrong. Please try again.');
      });
    });

    /* Wired first, decided second: a sign-out after a reload must
       still leave a working form. */
    if (session(AUTH_KEY) === '1') {
      unlock(session(USER_KEY) || '');
      return;
    }
    document.documentElement.classList.add('sf-locked');
    $('#gUser').focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGate);
  else initGate();
})();
