/* ============================================================
   Bilingual dashboard, English and Italian.

   The dictionary is keyed by the English source text, so the
   markup needs no per-element keys. The engine walks text nodes
   once, remembers the English, and swaps it for the Italian.
   Anything not in the dictionary is left alone, which is what
   we want for names, code and tool names.

   Content rendered later just calls I18N.apply() again.
   ============================================================ */

(function () {
  'use strict';

  var KEY = 'site.lang';
  var LANGS = ['en', 'it'];

  /* ---------- text ---------- */

  var IT = {
    /* demo: gate and chrome */
    'Sign in': 'Accedi',
    'SolarFlow portfolio management': 'Gestione del portafoglio SolarFlow',
    'Password': 'Password',
    'Access is by invitation.': 'Accesso su invito.',
    'Back to the project': 'Torna al progetto',
    'See the source on GitHub': 'Vedi il codice su GitHub',
    'Source': 'Codice',
    'Back': 'Indietro',
    'Sign out': 'Esci',
    'Checking…': 'Verifica in corso…',
    'Please fill in both fields.': 'Compila entrambi i campi.',
    'That email or password is not right.': 'Email o password non corretti.',
    'Too many attempts.': 'Troppi tentativi.',
    'Something went wrong. Please try again.': 'Qualcosa è andato storto. Riprova.',
    'This demo needs https or localhost to sign you in.':
      'Questa demo richiede https o localhost per l’accesso.',

    /* demo: dashboard */
    'Solar Portfolio': 'Portafoglio fotovoltaico',
    'C&I solar and storage across Italy. Synthetic demo data.':
      'Fotovoltaico e accumulo commerciale e industriale in Italia. Dati dimostrativi sintetici.',
    'Reset data': 'Ripristina i dati',
    'Add plant': 'Aggiungi impianto',
    'Overview': 'Panoramica',
    'Pipeline': 'Pipeline',
    'Operations': 'Esercizio',
    'Dashboard views': 'Viste della dashboard',
    'Progress to target': 'Avanzamento verso l’obiettivo',
    'Connected per month': 'Connessi al mese',
    'Last 24 months': 'Ultimi 24 mesi',
    'Capacity by region': 'Potenza per regione',
    'Development pipeline': 'Pipeline di sviluppo',
    'Click a stage to filter': 'Clicca una fase per filtrare',
    'Plants': 'Impianti',
    'GSE tariff deadlines': 'Scadenze tariffa GSE',
    'MWp reaching its deadline, by quarter': 'MWp in scadenza, per trimestre',
    'Alerts': 'Avvisi',
    'All plants': 'Tutti gli impianti',
    'Search name, code or owner': 'Cerca nome, codice o responsabile',
    'Search plants': 'Cerca impianti',
    'All stages': 'Tutte le fasi',
    'All regions': 'Tutte le regioni',
    'Filter by stage': 'Filtra per fase',
    'Filter by region': 'Filtra per regione',
    'Code': 'Codice',
    'Plant': 'Impianto',
    'Region': 'Regione',
    'Type': 'Tipo',
    'Stage': 'Fase',
    'Days in stage': 'Giorni in fase',
    'GSE deadline': 'Scadenza GSE',
    'No plants match these filters.': 'Nessun impianto corrisponde a questi filtri.',
    'Generation against budget': 'Produzione rispetto al budget',
    'Lowest performers': 'Impianti meno performanti',
    'Storage': 'Accumulo',
    'Fleet summary': 'Riepilogo del parco',
    'Portfolio summary': 'Riepilogo del portafoglio',
    'Data is saved only in this browser, in local storage. Click any row to edit it.':
      'I dati sono salvati solo in questo browser, in local storage. Clicca una riga per modificarla.',
    'Add project': 'Aggiungi progetto',
    'Edit plant': 'Modifica impianto',
    'Plant name': 'Nome impianto',
    'Asset manager': 'Responsabile',
    'Size (MWp / MW)': 'Potenza (MWp / MW)',
    'Delete': 'Elimina',
    'Save': 'Salva',
    'Close': 'Chiudi',
    'Please enter a name.': 'Inserisci un nome.',
    'Sure? Reset': 'Sicuro? Ripristina',
    'Sure? Delete': 'Sicuro? Elimina',
    'Connected': 'Connessi',
    'Plants live': 'Impianti attivi',
    'Annual output': 'Produzione annua',
    'CO2 avoided': 'CO2 evitata',
    'vs grid mix': 'vs mix di rete',
    'Target met': 'Obiettivo raggiunto',
    'Under construction': 'In costruzione',
    'Earlier stages': 'Fasi precedenti',
    'On track': 'In linea',
    'At risk of losing the tariff': 'A rischio di perdere la tariffa',
    'Passed': 'Scadute',
    'Actual': 'Effettiva',
    'Budget': 'Budget',
    'GWh per month': 'GWh al mese',
    'Fleet performance': 'Rendimento del parco',
    '% of budget': '% del budget',
    'Above budget': 'Sopra budget',
    'Below budget': 'Sotto budget',
    'Availability': 'Disponibilità',
    'Underperforming': 'Sotto rendimento',
    'All on budget': 'Tutti a budget',
    'Storage online': 'Accumulo in esercizio',
    'Units': 'Unità',
    'Power': 'Potenza',
    'Energy': 'Energia',
    'Round trip': 'Efficienza di ciclo',
    'No operating plants.': 'Nessun impianto in esercizio.',
    'No storage units.': 'Nessuna unità di accumulo.',
    'No alerts. Every plant is within its targets.': 'Nessun avviso. Tutti gli impianti sono nei target.',
    'Permitting': 'Autorizzazioni',
    'Grid (TICA)': 'Connessione (TICA)',
    'Financing': 'Finanziamento',
    'Construction': 'Costruzione',
    'Connection': 'Allacciamento',
    'In operation': 'In esercizio',
    'Rooftop': 'Tetto',
    'Ground mount': 'A terra',
    'Connection offer': 'Preventivo di connessione',
    'Funding close': 'Chiusura finanziaria',
    'On site': 'In cantiere',
    'Testing': 'Collaudo',
    'Producing': 'In produzione',

    /* demo: sentence fragments the dashboard builds around numbers */
    'of 500 MWp targeted by end 2026': 'di 500 MWp previsti entro fine 2026',
    ' MWp to go': ' MWp mancanti',
    ' MWp connected': ' MWp connessi',
    ' MWp live': ' MWp in esercizio',
    ' MWp pipeline': ' MWp in pipeline',
    ' plants': ' impianti',
    'typical': 'tipico',
    ' days': ' giorni',
    ' MWp on track': ' MWp in linea',
    ' MWp at risk': ' MWp a rischio',
    'cannot reach operation before its GSE deadline of':
      'non pu\u00f2 entrare in esercizio prima della scadenza GSE del',
    'The tariff of': 'La tariffa di',
    ' \u20ac/MWh is at risk.': ' \u20ac/MWh \u00e8 a rischio.',
    'has little slack before its GSE deadline of':
      'ha poco margine prima della scadenza GSE del',
    'has been in': '\u00e8 in',
    'for': 'da',
    'days. The typical time is': 'giorni. Il tempo tipico \u00e8',
    'is running at': 'sta rendendo al',
    '% of budget.': '% del budget.',
    ' more alerts, sorted by severity.': ' altri avvisi, ordinati per gravit\u00e0.',
    'Below': 'Sotto',
    ' GWh actual': ' GWh effettivi',
    ' GWh budget': ' GWh a budget',
    '% available': '% di disponibilit\u00e0',
    'Output as a share of budget. The line marks':
      'Produzione come quota del budget. La linea segna',
    ' live': ' attive',
    ' MWh of the': ' MWh dei',
    ' MWh targeted by 2027.': ' MWh previsti entro il 2027.',
    'to the project': 'al progetto',

    'Skip to the dashboard': 'Vai alla dashboard',
    'Language': 'Lingua',
    'Email': 'Email'
  };

  /* Attribute values that also need translating. */
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

  /* ---------- engine ---------- */

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, TEXTAREA: 1, svg: 1, SVG: 1 };
  var originals = new WeakMap();   /* node -> English source */
  var current = 'en';

  function shouldSkip(node) {
    for (var el = node.parentNode; el; el = el.parentNode) {
      if (el.nodeType !== 1) continue;
      if (SKIP[el.tagName] || el.namespaceURI === 'http://www.w3.org/2000/svg') return true;
      if (el.hasAttribute && el.hasAttribute('data-no-i18n')) return true;
    }
    return false;
  }

  function translateText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var raw = node.nodeValue;
      if (!raw || !raw.trim()) continue;
      if (shouldSkip(node)) continue;

      var en = originals.get(node);
      if (en === undefined) {
        en = raw;
        originals.set(node, en);
      }
      /* keep the whitespace that surrounded the original */
      var m = en.match(/^(\s*)([\s\S]*?)(\s*)$/);
      var key = m[2].replace(/\s+/g, ' ');
      var it = (current === 'it') ? IT[key] : null;
      var next = it ? m[1] + it + m[3] : en;
      if (node.nodeValue !== next) node.nodeValue = next;
    }
  }

  function translateAttrs(root) {
    ATTRS.forEach(function (attr) {
      var nodes = [].slice.call(root.querySelectorAll('[' + attr + ']'));
      if (root.nodeType === 1 && root.hasAttribute(attr)) nodes.push(root);
      nodes.forEach(function (el) {
        var store = 'data-en-' + attr.replace(/[^a-z]/g, '');
        var en = el.getAttribute(store);
        if (en === null) { en = el.getAttribute(attr); el.setAttribute(store, en); }
        var key = en.replace(/\s+/g, ' ').trim();
        el.setAttribute(attr, (current === 'it' && IT[key]) ? IT[key] : en);
      });
    });
  }

  function apply(root) {
    var scope = root || document.body;
    if (!scope) return;
    translateText(scope);
    translateAttrs(scope);
    document.documentElement.lang = current;
    syncButtons();
  }

  /* ---------- the switcher ---------- */

  var FLAGS = {
    it: '<svg viewBox="0 0 21 15" aria-hidden="true"><rect width="7" height="15" fill="#008C45"/>' +
        '<rect x="7" width="7" height="15" fill="#F4F5F0"/><rect x="14" width="7" height="15" fill="#CD212A"/></svg>',
    en: '<svg viewBox="0 0 60 30" aria-hidden="true">' +
        '<clipPath id="i18nUk"><rect width="60" height="30" rx="0"/></clipPath>' +
        '<g clip-path="url(#i18nUk)">' +
        '<rect width="60" height="30" fill="#012169"/>' +
        '<path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="6"/>' +
        '<path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" stroke-width="3"/>' +
        '<path d="M30 0V30M0 15H60" stroke="#fff" stroke-width="10"/>' +
        '<path d="M30 0V30M0 15H60" stroke="#C8102E" stroke-width="6"/>' +
        '</g></svg>'
  };
  var NAMES = { it: 'Italiano', en: 'English' };

  function buildSwitch(host) {
    if (host.querySelector('.langsw-btn')) return;
    host.className = (host.className ? host.className + ' ' : '') + 'langsw';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Language');
    host.innerHTML = ['it', 'en'].map(function (l) {
      return '<button type="button" class="langsw-btn" data-lang-set="' + l + '" ' +
        'lang="' + l + '" title="' + NAMES[l] + '" aria-label="' + NAMES[l] + '" ' +
        'aria-pressed="false">' + FLAGS[l] + '</button>';
    }).join('');
    [].slice.call(host.querySelectorAll('[data-lang-set]')).forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-lang-set')); });
    });
  }

  function syncButtons() {
    [].slice.call(document.querySelectorAll('[data-lang-set]')).forEach(function (b) {
      var on = b.getAttribute('data-lang-set') === current;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
    });
  }

  /* ---------- public ---------- */

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(l) {
    try { localStorage.setItem(KEY, l); } catch (e) { /* blocked */ }
  }

  function set(lang) {
    if (LANGS.indexOf(lang) < 0) lang = 'en';
    if (lang === current) return;
    current = lang;
    remember(lang);
    apply();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
  }

  function detect() {
    var saved = stored();
    if (saved && LANGS.indexOf(saved) >= 0) return saved;
    var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return nav === 'it' ? 'it' : 'en';
  }

  function init() {
    [].slice.call(document.querySelectorAll('[data-lang]')).forEach(buildSwitch);
    current = detect();
    apply();
  }

  window.I18N = {
    apply: function (root) { apply(root); },
    set: set,
    get: function () { return current; },
    t: function (s) { return current === 'it' && IT[s] ? IT[s] : s; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
