/* ============================================================
   Costa Rica Cafe — POS core (state + sync + actions)
   ============================================================ */
(function () {
  'use strict';

  var App = (window.App = window.App || {});
  var U = (App.util = {});

  /* ============================================================
     Utilities
     ============================================================ */

  U.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  U.num = function (value) {
    var n = parseFloat(String(value == null ? '' : value).replace(',', '.'));
    return isFinite(n) ? n : 0;
  };

  U.round = function (n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  };

  U.fmtPrice = function (value) {
    var n = U.round(U.num(value));
    var text = Math.abs(n % 1) < 0.005
      ? String(Math.round(n))
      : n.toFixed(2);
    var parts = text.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  U.money = function (value, currency) {
    return U.fmtPrice(value) + (currency ? ' ' + currency : '');
  };

  U.uid = function (prefix) {
    var base = String(prefix || 'id').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'id';
    return base + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  };

  U.pad = function (n, len) {
    var s = String(n);
    while (s.length < (len || 2)) s = '0' + s;
    return s;
  };

  U.dateKey = function (date) {
    var d = date ? new Date(date) : new Date();
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  };

  U.dayKey = function (date) {
    var d = date ? new Date(date) : new Date();
    return d.getFullYear() + U.pad(d.getMonth() + 1) + U.pad(d.getDate());
  };

  U.startOfDay = function (date) {
    var d = date ? new Date(date) : new Date();
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      var p = date.split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0).getTime();
    }
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  U.endOfDay = function (date) {
    return U.startOfDay(date) + 24 * 60 * 60 * 1000 - 1;
  };

  U.addDays = function (date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  var timeFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: true });
  var dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
  var dateShortFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: '2-digit', month: '2-digit', year: 'numeric' });
  var weekdayFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long' });

  U.fmtTime = function (ts) { return timeFmt.format(new Date(ts || Date.now())); };
  U.fmtDate = function (ts) { return dateFmt.format(new Date(ts || Date.now())); };
  U.fmtDateShort = function (ts) { return dateShortFmt.format(new Date(ts || Date.now())); };
  U.fmtWeekday = function (ts) { return weekdayFmt.format(new Date(ts || Date.now())); };

  U.ago = function (ts) {
    var diff = Math.max(0, Date.now() - Number(ts || 0));
    var m = Math.floor(diff / 60000);
    if (m < 1) return 'الآن';
    if (m === 1) return 'من دقيقة';
    if (m < 60) return 'من ' + m + ' دقيقة';
    var h = Math.floor(m / 60);
    if (h === 1) return 'من ساعة';
    if (h < 24) return 'من ' + h + ' ساعة';
    var d = Math.floor(h / 24);
    if (d === 1) return 'من يوم';
    return 'من ' + d + ' يوم';
  };

  U.debounce = function (fn, wait) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 300);
    };
  };

  U.download = function (filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  };

  U.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  };

  U.loadScript = function (src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') resolve();
        else {
          existing.addEventListener('load', function () { resolve(); });
          existing.addEventListener('error', function () { reject(new Error('تعذر تحميل ' + src)); });
        }
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.src = src;
      s.addEventListener('load', function () { s.dataset.loaded = '1'; resolve(); });
      s.addEventListener('error', function () { reject(new Error('تعذر تحميل ' + src)); });
      document.head.appendChild(s);
    });
  };

  /* ---------------- Toast ---------------- */

  U.toast = function (message, opts) {
    opts = opts || {};
    var root = document.getElementById('toastRoot');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (opts.type || '');
    el.innerHTML = '<span class="msg">' + U.esc(message) + '</span>';
    if (opts.actionLabel) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', function () {
        if (typeof opts.onAction === 'function') opts.onAction();
        remove();
      });
      el.appendChild(btn);
    }
    root.appendChild(el);
    while (root.children.length > 3) root.removeChild(root.firstChild);
    requestAnimationFrame(function () { el.classList.add('show'); });
    var timer = setTimeout(remove, opts.duration || 3400);
    function remove() {
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 220);
    }
    return { close: remove };
  };

  /* ---------------- Modal ---------------- */

  var openModals = [];

  U.modal = function (html, opts) {
    opts = opts || {};
    var root = document.getElementById('modalRoot');
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal-scrim"></div>' +
      '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
        '<button class="x-close" type="button" aria-label="إغلاق">✕</button>' +
        html +
      '</div>';
    root.appendChild(wrap);

    var closed = false;
    function close(result) {
      if (closed) return;
      closed = true;
      wrap.classList.remove('show');
      var idx = openModals.indexOf(entry);
      if (idx !== -1) openModals.splice(idx, 1);
      setTimeout(function () { wrap.remove(); }, 230);
      if (typeof opts.onClose === 'function') opts.onClose(result);
    }

    var entry = { close: close, wrap: wrap };
    openModals.push(entry);

    wrap.querySelector('.x-close').addEventListener('click', function () { close(null); });
    wrap.querySelector('.modal-scrim').addEventListener('click', function () {
      if (opts.dismissible !== false) close(null);
    });

    requestAnimationFrame(function () { wrap.classList.add('show'); });
    setTimeout(function () {
      var first = wrap.querySelector('input:not([type="hidden"]), select, textarea, button.btn.primary');
      if (first && opts.focus !== false) {
        try { first.focus(); } catch (e) { /* ignore */ }
      }
    }, 120);

    return { el: wrap, body: wrap.querySelector('.modal'), close: close };
  };

  U.closeTopModal = function () {
    var top = openModals[openModals.length - 1];
    if (top) top.close(null);
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openModals.length) {
      e.preventDefault();
      U.closeTopModal();
    }
  });

  U.confirm = function (title, message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = U.modal(
        '<h3>' + U.esc(title) + '</h3>' +
        (message ? '<p class="m-sub">' + U.esc(message) + '</p>' : '') +
        '<div class="modal-actions">' +
          '<button class="btn ghost" data-no type="button">' + U.esc(opts.cancelText || 'إلغاء') + '</button>' +
          '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" data-yes type="button">' + U.esc(opts.okText || 'تأكيد') + '</button>' +
        '</div>',
        { onClose: function (v) { if (v !== true) resolve(false); } }
      );
      m.el.querySelector('[data-no]').addEventListener('click', function () { m.close(false); resolve(false); });
      m.el.querySelector('[data-yes]').addEventListener('click', function () { m.close(true); resolve(true); });
    });
  };

  U.prompt = function (title, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = U.modal(
        '<h3>' + U.esc(title) + '</h3>' +
        (opts.message ? '<p class="m-sub">' + U.esc(opts.message) + '</p>' : '') +
        '<div class="m-body">' +
          (opts.multiline
            ? '<textarea data-input rows="3" placeholder="' + U.esc(opts.placeholder || '') + '">' + U.esc(opts.value || '') + '</textarea>'
            : '<input data-input type="' + U.esc(opts.type || 'text') + '" inputmode="' + (opts.type === 'number' ? 'decimal' : 'text') + '" value="' + U.esc(opts.value == null ? '' : opts.value) + '" placeholder="' + U.esc(opts.placeholder || '') + '">') +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn ghost" data-no type="button">إلغاء</button>' +
          '<button class="btn primary" data-yes type="button">' + U.esc(opts.okText || 'حفظ') + '</button>' +
        '</div>',
        { onClose: function (v) { if (v === undefined || v === null) resolve(null); } }
      );
      var input = m.el.querySelector('[data-input]');
      function done() {
        var value = input.value;
        m.close(value);
        resolve(value);
      }
      m.el.querySelector('[data-no]').addEventListener('click', function () { m.close(null); resolve(null); });
      m.el.querySelector('[data-yes]').addEventListener('click', done);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); done(); }
      });
      setTimeout(function () { input.focus(); if (input.select) input.select(); }, 130);
    });
  };

  /* ---------------- Sound / vibration ---------------- */

  var audioCtx = null;

  U.beep = function (kind) {
    try {
      if (!audioCtx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtx = new Ctx();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var now = audioCtx.currentTime;
      var tones = kind === 'error' ? [220, 180] : kind === 'success' ? [660, 880] : [880, 1174];
      tones.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.13 + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.13);
        osc.stop(now + i * 0.13 + 0.18);
      });
    } catch (e) { /* ignore */ }
  };

  U.vibrate = function (pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern || [90, 60, 90]); } catch (e) { /* ignore */ }
    }
  };

  U.unlockAudio = function () {
    if (!audioCtx) {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      } catch (e) { /* ignore */ }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };

  /* ============================================================
     Store
     ============================================================ */

  var S = (App.store = {});

  var LS = {
    state: 'crc_pos_state_v1',
    sync: 'crc_pos_sync_v1',
    user: 'crc_pos_user_v1',
    device: 'crc_pos_device_v1',
    draft: 'crc_pos_draft_v1',
    cloud: 'crc_pos_cloud_v1'
  };

  var DEFAULT_SETTINGS = {
    cafeName: 'كوستا ريكا كافيه',
    nameEn: 'Costa Rica',
    branch: '',
    phone: '01228235511',
    whatsapp: '201228235511',
    address: '',
    currency: 'ج.م',
    taxRate: 0,
    serviceRate: 0,
    deliveryFee: 0,
    tables: 12,
    receiptFooter: 'شكراً لزيارتكم ☕',
    autoPrint: false,
    sound: true,
    adminPin: ''
  };

  S.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  S.state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    menu: { categories: [], updatedAt: new Date().toISOString() },
    orders: {},
    expenses: {},
    shifts: {},
    meta: { seq: {} }
  };

  S.deviceId = (function () {
    var id = null;
    try { id = localStorage.getItem(LS.device); } catch (e) { /* ignore */ }
    if (!id) {
      id = U.uid('dev');
      try { localStorage.setItem(LS.device, id); } catch (e) { /* ignore */ }
    }
    return id;
  })();

  S.user = (function () {
    try { return localStorage.getItem(LS.user) || 'كاشير'; } catch (e) { return 'كاشير'; }
  })();

  S.setUser = function (name) {
    S.user = String(name || '').trim() || 'كاشير';
    try { localStorage.setItem(LS.user, S.user); } catch (e) { /* ignore */ }
    S.emit('change', 'user');
  };

  S.sync = {
    mode: null,
    cfg: null,
    status: 'local',
    error: '',
    base: null,
    app: null,
    db: null,
    cloud: null,
    cloudCfg: null,
    connectedAt: 0
  };

  S.draft = null;

  /* ---------------- normalisers ---------------- */

  function normalizeSettings(raw) {
    raw = raw || {};
    var out = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      out[key] = raw[key] !== undefined ? raw[key] : DEFAULT_SETTINGS[key];
    });
    out.taxRate = Math.max(0, U.num(out.taxRate));
    out.serviceRate = Math.max(0, U.num(out.serviceRate));
    out.deliveryFee = Math.max(0, U.num(out.deliveryFee));
    out.tables = Math.max(1, Math.min(99, parseInt(out.tables, 10) || 12));
    out.sound = out.sound !== false;
    out.autoPrint = !!out.autoPrint;
    return out;
  }

  function normalizeMenu(raw) {
    raw = raw || {};
    var cats = Array.isArray(raw.categories) ? raw.categories : [];
    var seenCats = {};
    var seenItems = {};
    return {
      updatedAt: raw.updatedAt || new Date().toISOString(),
      categories: cats.map(function (cat, ci) {
        var id = String(cat && cat.id ? cat.id : U.uid('cat')).replace(/[^a-z0-9-]/gi, '').toLowerCase();
        if (!id || seenCats[id]) id = U.uid('cat');
        seenCats[id] = true;
        var items = Array.isArray(cat && cat.items) ? cat.items : [];
        return {
          id: id,
          name: String((cat && cat.name) || 'قسم ' + (ci + 1)),
          icon: String((cat && cat.icon) || '☕'),
          items: items.map(function (item) {
            var iid = String(item && item.id ? item.id : U.uid('item')).replace(/[^a-z0-9-]/gi, '').toLowerCase();
            if (!iid || seenItems[iid]) iid = U.uid('item');
            seenItems[iid] = true;
            return {
              id: iid,
              name: String((item && item.name) || 'صنف'),
              price: Math.max(0, U.num(item && item.price)),
              cost: Math.max(0, U.num(item && item.cost)),
              desc: String((item && item.desc) || ''),
              hidden: !!(item && item.hidden)
            };
          })
        };
      })
    };
  }

  S.normalizeMenu = normalizeMenu;
  S.normalizeSettings = normalizeSettings;

  /* ---------------- persistence ---------------- */

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function loadState() {
    var raw = readJSON(LS.state);
    if (!raw) return false;
    S.state.settings = normalizeSettings(raw.settings);
    S.state.menu = normalizeMenu(raw.menu);
    S.state.orders = raw.orders && typeof raw.orders === 'object' ? raw.orders : {};
    S.state.expenses = raw.expenses && typeof raw.expenses === 'object' ? raw.expenses : {};
    S.state.shifts = raw.shifts && typeof raw.shifts === 'object' ? raw.shifts : {};
    S.state.meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : { seq: {} };
    if (!S.state.meta.seq) S.state.meta.seq = {};
    return true;
  }

  function saveState() {
    writeJSON(LS.state, {
      version: 1,
      settings: S.state.settings,
      menu: S.state.menu,
      orders: S.state.orders,
      expenses: S.state.expenses,
      shifts: S.state.shifts,
      meta: S.state.meta
    });
  }

  S.save = saveState;

  /* ---------------- events ---------------- */

  var listeners = {};

  S.on = function (event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return function () {
      var arr = listeners[event];
      var i = arr.indexOf(fn);
      if (i !== -1) arr.splice(i, 1);
    };
  };

  S.emit = function (event, data) {
    var arr = listeners[event];
    if (!arr) return;
    arr.slice().forEach(function (fn) {
      try { fn(data); } catch (e) { console.error(e); }
    });
  };

  /* ---------------- broadcast (same device tabs) ---------------- */

  var bc = null;
  var tabId = U.uid('tab');
  try {
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('crc-pos');
      bc.onmessage = function (e) {
        if (!e.data || e.data.type !== 'state' || e.data.tab === tabId) return;
        if (S.sync.base) return;
        loadState();
        S.emit('change', 'all');
      };
    }
  } catch (e) { bc = null; }

  function commit(scope, opts) {
    saveState();
    if (bc && !S.sync.base) {
      try { bc.postMessage({ type: 'state', source: S.deviceId, tab: tabId }); } catch (e) { /* ignore */ }
    }
    if (S.sync.cloud) cloudPublishSoon();
    S.emit('change', scope || 'all');
    if (!opts || !opts.quiet) S.emit('save', scope || 'all');
  }

  S.commit = commit;

  /* ---------------- remote sync ---------------- */

  var FIREBASE_VERSION = '10.12.5';
  var FIREBASE_APP = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-app-compat.js';
  var FIREBASE_DB = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/firebase-database-compat.js';

  function setStatus(status, error) {
    S.sync.status = status;
    if (error !== undefined) S.sync.error = error;
    S.emit('sync', { status: status, error: S.sync.error });
  }

  S.setSyncStatus = setStatus;

  function remoteRef(path) {
    if (!S.sync.base) return null;
    return path ? S.sync.base.child(path) : S.sync.base;
  }

  function rset(path, value) {
    var ref = remoteRef(path);
    if (!ref) return Promise.resolve();
    return ref.set(value).catch(function (err) {
      console.warn('sync write failed', err);
      setStatus('error', err && err.message ? err.message : 'خطأ في المزامنة');
    });
  }

  function rremove(path) {
    var ref = remoteRef(path);
    if (!ref) return Promise.resolve();
    return ref.remove().catch(function (err) {
      console.warn('sync remove failed', err);
    });
  }

  S.remoteSet = rset;
  S.remoteRemove = rremove;

  S.loadSyncConfig = function () {
    var cfg = readJSON(LS.sync);
    if (!cfg || !cfg.databaseURL || !cfg.cafeKey) return null;
    return { databaseURL: String(cfg.databaseURL), cafeKey: String(cfg.cafeKey) };
  };

  S.saveSyncConfig = function (cfg) {
    if (!cfg) {
      try { localStorage.removeItem(LS.sync); } catch (e) { /* ignore */ }
      return;
    }
    writeJSON(LS.sync, { databaseURL: cfg.databaseURL, cafeKey: cfg.cafeKey });
  };

  S.generateCafeKey = function () {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return 'crc-' + out;
  };

  function normalizeDatabaseURL(url) {
    var u = String(url || '').trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u)) {
      throw new Error('رابط قاعدة البيانات غير صحيح. لازم يبدأ بـ https://');
    }
    return u;
  }

  S.connect = function (cfg) {
    cfg = cfg || {};
    if (cfg.broker) return S.connectCloud(cfg);
    return Promise.resolve().then(function () {
      var databaseURL = normalizeDatabaseURL(cfg.databaseURL);
      var cafeKey = String(cfg.cafeKey || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cafeKey) throw new Error('كود الكافيه مطلوب');
      return { databaseURL: databaseURL, cafeKey: cafeKey };
    }).then(function (clean) {
      return S.disconnect().then(function () {
        S.sync.cfg = clean;
        S.saveSyncConfig(clean);
        setStatus('connecting', '');
        S.emit('change', 'sync');

        return fetch(clean.databaseURL + '/.json?shallow=true', { cache: 'no-store' })
          .then(function (res) {
            if (res.status === 401 || res.status === 403) {
              throw new Error('قاعدة البيانات مرفوضة — فعّل Test Mode أو عدّل الـ Rules للسماح بالقراءة والكتابة.');
            }
            if (!res.ok && res.status !== 404) {
              throw new Error('تعذر الوصول لقاعدة البيانات (HTTP ' + res.status + ')');
            }
          })
          .catch(function (err) {
            if (err && /مرفوضة|تعذر الوصول/.test(err.message || '')) throw err;
            throw new Error('تعذر الوصول للرابط — تأكد من اتصال النت ومن صحة databaseURL.');
          });
      });
    }).then(function () {
      return U.loadScript(FIREBASE_APP).then(function () { return U.loadScript(FIREBASE_DB); });
    }).then(function () {
      if (!window.firebase) throw new Error('تعذر تحميل مكتبة Firebase');
      var appName = 'crc-' + Date.now();
      var app = firebase.initializeApp({ databaseURL: S.sync.cfg.databaseURL }, appName);
      S.sync.app = app;
      S.sync.db = firebase.database(app);
      S.sync.base = S.sync.db.ref('cafes/' + S.sync.cfg.cafeKey);

      return S.sync.base.once('value').then(function (snap) {
        return snap.val() || {};
      }).then(function (remote) {
        return mergeRemote(remote);
      }).then(function () {
        bindRemote();
        S.sync.connectedAt = Date.now();
        setStatus('online', '');
        S.emit('change', 'all');
        return S.sync.cfg;
      });
    }).catch(function (err) {
      setStatus('error', err && err.message ? err.message : 'فشل الاتصال');
      S.emit('change', 'sync');
      throw err;
    });
  };

  function mergeRemote(remote) {
    remote = remote || {};
    var localOrders = S.state.orders || {};
    var localExpenses = S.state.expenses || {};
    var localShifts = S.state.shifts || {};

    var remoteOrders = remote.orders && typeof remote.orders === 'object' ? remote.orders : {};
    var remoteExpenses = remote.expenses && typeof remote.expenses === 'object' ? remote.expenses : {};
    var remoteShifts = remote.shifts && typeof remote.shifts === 'object' ? remote.shifts : {};

    var orders = mergeById(localOrders, remoteOrders);
    var expenses = mergeById(localExpenses, remoteExpenses);
    var shifts = mergeById(localShifts, remoteShifts);
    var localOnlyOrders = orders.push;
    var localOnlyExpenses = expenses.push;
    var localOnlyShifts = shifts.push;

    S.state.orders = orders.merged;
    S.state.expenses = expenses.merged;
    S.state.shifts = shifts.merged;

    if (remote.settings) S.state.settings = normalizeSettings(remote.settings);
    else rset('settings', S.state.settings);

    if (remote.menu) S.state.menu = normalizeMenu(remote.menu);
    else rset('menu', S.state.menu);

    if (remote.meta) {
      var localSeq = S.state.meta && S.state.meta.seq ? S.state.meta.seq : {};
      var remoteSeq = remote.meta.seq && typeof remote.meta.seq === 'object' ? remote.meta.seq : {};
      var mergedSeq = {};
      Object.keys(localSeq).concat(Object.keys(remoteSeq)).forEach(function (day) {
        mergedSeq[day] = Math.max(Number(localSeq[day]) || 0, Number(remoteSeq[day]) || 0);
      });
      S.state.meta = Object.assign({}, remote.meta, { seq: mergedSeq });
      if (JSON.stringify(mergedSeq) !== JSON.stringify(remoteSeq)) rset('meta/seq', mergedSeq);
    } else {
      rset('meta', S.state.meta);
    }

    saveState();

    return Promise.all([
      pushMany('orders', localOnlyOrders),
      pushMany('expenses', localOnlyExpenses),
      pushMany('shifts', localOnlyShifts)
    ]);
  }

  function mergeById(local, remote) {
    var merged = {};
    var push = {};
    Object.keys(local).forEach(function (id) {
      var l = local[id];
      var r = remote[id];
      if (!r) {
        merged[id] = l;
        push[id] = l;
      } else if (Number(l && l.updatedAt || 0) > Number(r && r.updatedAt || 0)) {
        merged[id] = l;
        push[id] = l;
      } else {
        merged[id] = r;
      }
    });
    Object.keys(remote).forEach(function (id) {
      if (!merged[id]) merged[id] = remote[id];
    });
    return { merged: merged, push: push };
  }

  function pushMany(collection, map) {
    var ids = Object.keys(map);
    if (!ids.length) return Promise.resolve();
    return Promise.all(ids.map(function (id) { return rset(collection + '/' + id, map[id]); }));
  }

  function bindRemote() {
    var base = S.sync.base;

    ['orders', 'expenses', 'shifts'].forEach(function (collection) {
      base.child(collection).on('child_added', function (snap) {
        applyRemoteRecord(collection, snap.key, snap.val(), true);
      });
      base.child(collection).on('child_changed', function (snap) {
        applyRemoteRecord(collection, snap.key, snap.val(), false);
      });
      base.child(collection).on('child_removed', function (snap) {
        if (S.state[collection] && S.state[collection][snap.key] !== undefined) {
          delete S.state[collection][snap.key];
          commit(collection, { quiet: true });
        }
      });
    });

    base.child('settings').on('value', function (snap) {
      if (!snap.exists()) return;
      var next = normalizeSettings(snap.val());
      var current = JSON.stringify(S.state.settings);
      if (JSON.stringify(next) !== current) {
        S.state.settings = next;
        commit('settings', { quiet: true });
      }
    });

    base.child('menu').on('value', function (snap) {
      if (!snap.exists()) return;
      var next = normalizeMenu(snap.val());
      if (JSON.stringify(next) !== JSON.stringify(S.state.menu)) {
        S.state.menu = next;
        commit('menu', { quiet: true });
      }
    });

    base.child('meta').on('value', function (snap) {
      var val = snap.val();
      if (val && typeof val === 'object') {
        S.state.meta = val;
        if (!S.state.meta.seq) S.state.meta.seq = {};
      }
    });

    S.sync.db.ref('.info/connected').on('value', function (snap) {
      if (snap.val() === true) {
        setStatus('online', '');
      } else if (S.sync.status !== 'error') {
        setStatus('offline', '');
      }
    });
  }

  function applyRemoteRecord(collection, id, value, isNew) {
    if (!value) return;
    var local = S.state[collection][id];
    if (local && Number(local.updatedAt || 0) > Number(value.updatedAt || 0)) return;
    var wasKnown = !!local;
    S.state[collection][id] = value;
    saveState();
    S.emit('change', collection);

    if (collection === 'orders' && isNew && !wasKnown) {
      if (Number(value.createdAt || 0) > S.sync.connectedAt - 3000 && value.deviceId !== S.deviceId) {
        S.emit('order:new', value);
      }
    }
  }

  function closeFirebase() {
    if (S.sync.base) {
      try { S.sync.base.off(); } catch (e) { /* ignore */ }
    }
    if (S.sync.db) {
      try { S.sync.db.ref('.info/connected').off(); } catch (e) { /* ignore */ }
    }
    var app = S.sync.app;
    S.sync.base = null;
    S.sync.db = null;
    S.sync.app = null;
    if (app) {
      try { app.delete(); } catch (e) { /* ignore */ }
    }
  }

  function closeCloud() {
    var cloud = S.sync.cloud;
    S.sync.cloud = null;
    if (!cloud) return;
    if (cloud.timer) { clearTimeout(cloud.timer); cloud.timer = null; }
    if (cloud.graceTimer) { clearTimeout(cloud.graceTimer); cloud.graceTimer = null; }
    if (cloud.client) {
      try { cloud.client.removeAllListeners(); } catch (e) { /* ignore */ }
      try { cloud.client.end(true); } catch (e) { /* ignore */ }
    }
  }

  S.disconnect = function () {
    return Promise.resolve().then(function () {
      var mode = S.sync.mode;
      closeFirebase();
      closeCloud();
      S.sync.mode = null;
      S.sync.cfg = null;
      S.sync.cloudCfg = null;
      S.sync.connectedAt = 0;
      if (mode === 'cloud') {
        var kept = loadCloudConfig();
        if (kept) saveCloudConfig({ broker: kept.broker, cafeKey: kept.cafeKey, enabled: false });
      } else {
        S.saveSyncConfig(null);
      }
      if (S.sync.status !== 'error') setStatus('local', '');
      S.emit('change', 'sync');
    });
  };

  /* ---------------- open cloud sync (MQTT, no account) ---------------- */

  var CLOUD = {
    broker: 'wss://broker.emqx.io:8084/mqtt',
    fallback: 'wss://broker.hivemq.com:8884/mqtt',
    cafeKey: 'crc-costarica-7f3k9m2q',
    topicPrefix: 'crcpos/v1/',
    script: 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
    scriptAlt: 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js'
  };

  S.CLOUD_DEFAULT = { broker: CLOUD.broker, cafeKey: CLOUD.cafeKey };

  function loadCloudConfig() {
    var cfg = readJSON(LS.cloud);
    if (!cfg || !cfg.broker || !cfg.cafeKey) return null;
    return {
      broker: String(cfg.broker),
      cafeKey: String(cfg.cafeKey),
      enabled: cfg.enabled !== false
    };
  }

  function saveCloudConfig(cfg) {
    if (!cfg) {
      try { localStorage.removeItem(LS.cloud); } catch (e) { /* ignore */ }
      return;
    }
    writeJSON(LS.cloud, {
      broker: cfg.broker,
      cafeKey: cfg.cafeKey,
      enabled: cfg.enabled !== false
    });
  }

  S.loadCloudConfig = loadCloudConfig;
  S.saveCloudConfig = saveCloudConfig;

  function normalizeBroker(url) {
    var u = String(url || '').trim().replace(/\/+$/, '');
    if (!u) return CLOUD.broker;
    u = u.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    if (!/^wss?:\/\//i.test(u)) return CLOUD.broker;
    return u;
  }

  function cloudTopic(key) {
    return CLOUD.topicPrefix + key + '/state';
  }

  function loadMqtt() {
    if (window.mqtt && window.mqtt.connect) return Promise.resolve();
    return U.loadScript(CLOUD.script).catch(function () {
      return U.loadScript(CLOUD.scriptAlt);
    });
  }

  function capCollection(map, limit) {
    map = map || {};
    var ids = Object.keys(map);
    if (ids.length <= limit) return map;
    ids.sort(function (a, b) {
      var av = map[a] || {};
      var bv = map[b] || {};
      return Number(bv.createdAt || bv.updatedAt || 0) - Number(av.createdAt || av.updatedAt || 0);
    });
    var out = {};
    ids.slice(0, limit).forEach(function (id) { out[id] = map[id]; });
    return out;
  }

  function cloudData() {
    return {
      settings: S.state.settings,
      menu: S.state.menu,
      orders: capCollection(S.state.orders, 800),
      expenses: capCollection(S.state.expenses, 800),
      shifts: capCollection(S.state.shifts, 400),
      meta: S.state.meta
    };
  }

  function cloudSnapshot() {
    return { v: 1, at: Date.now(), dev: S.deviceId, data: cloudData() };
  }

  /* Canonical JSON so two devices with the same data produce the same signature
     even if object keys were inserted in a different order. */
  function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value === undefined ? null : value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }
    var keys = Object.keys(value).filter(function (k) { return value[k] !== undefined; }).sort();
    return '{' + keys.map(function (k) {
      return JSON.stringify(k) + ':' + stableStringify(value[k]);
    }).join(',') + '}';
  }

  function cloudSig(data) {
    return stableStringify(data || {});
  }

  function cloudPublish(force) {
    var cloud = S.sync.cloud;
    if (!cloud || !cloud.client || !cloud.client.connected) return;
    var snap = cloudSnapshot();
    var sig = cloudSig(snap.data);
    if (!force && sig === cloud.lastSig) return;
    cloud.lastSig = sig;
    try {
      cloud.client.publish(cloud.topic, JSON.stringify(snap), { qos: 1, retain: true });
    } catch (e) { /* ignore */ }
  }

  function cloudPublishSoon() {
    var cloud = S.sync.cloud;
    if (!cloud) return;
    cloud.lastLocalAt = Date.now();
    if (cloud.timer) clearTimeout(cloud.timer);
    cloud.timer = setTimeout(function () {
      cloud.timer = null;
      cloudPublish(false);
    }, 600);
  }

  S.cloudPublish = cloudPublishSoon;

  /* Wait a moment for the broker's retained snapshot before publishing ours,
     so a fresh device never overwrites existing orders with an empty state. */
  function startCloudGrace() {
    var cloud = S.sync.cloud;
    if (!cloud) return;
    cloud.synced = false;
    if (cloud.graceTimer) clearTimeout(cloud.graceTimer);
    cloud.graceTimer = setTimeout(function () {
      cloud.graceTimer = null;
      if (!S.sync.cloud || S.sync.cloud !== cloud || cloud.synced) return;
      cloudPublish(true);
    }, 3000);
  }

  function mergeCollection(local, remote) {
    local = local || {};
    remote = remote || {};
    var merged = {};
    var localAhead = false;
    Object.keys(local).forEach(function (id) {
      var l = local[id];
      var r = remote[id];
      if (!r) { merged[id] = l; localAhead = true; return; }
      var lu = Number(l && l.updatedAt || 0);
      var ru = Number(r && r.updatedAt || 0);
      if (lu > ru) { merged[id] = l; localAhead = true; }
      else merged[id] = r;
    });
    Object.keys(remote).forEach(function (id) {
      if (!merged[id]) merged[id] = remote[id];
    });
    return { merged: merged, localAhead: localAhead };
  }

  function applyCloudSnapshot(data, at) {
    if (!data || typeof data !== 'object') return false;

    var localAhead = false;
    var cloud = S.sync.cloud;
    var guardSettings = cloud && cloud.lastLocalAt && at && at < cloud.lastLocalAt - 1500;

    var localMeta = S.state.meta || {};
    var remoteMeta = data.meta || {};
    var localCleared = localMeta.cleared || {};
    var remoteCleared = remoteMeta.cleared || {};
    var cleared = {};
    Object.keys(localCleared).concat(Object.keys(remoteCleared)).forEach(function (k) {
      cleared[k] = Math.max(Number(localCleared[k]) || 0, Number(remoteCleared[k]) || 0);
    });

    ['orders', 'expenses', 'shifts'].forEach(function (col) {
      var cutoff = Number(cleared[col]) || 0;
      if (!cutoff) return;
      var localCol = S.state[col] || {};
      Object.keys(localCol).forEach(function (id) {
        var rec = localCol[id];
        if (Number(rec && rec.updatedAt || 0) < cutoff) delete localCol[id];
      });
      var remoteCol = data[col] || {};
      Object.keys(remoteCol).forEach(function (id) {
        var rec = remoteCol[id];
        if (Number(rec && rec.updatedAt || 0) < cutoff) delete remoteCol[id];
      });
    });

    var newOrders = [];
    Object.keys(data.orders || {}).forEach(function (id) {
      var rec = data.orders[id];
      if (!rec || S.state.orders[id]) return;
      if (Number(rec.createdAt || 0) > (S.sync.connectedAt || 0) - 5000 && rec.deviceId !== S.deviceId) {
        newOrders.push(rec);
      }
    });

    var orders = mergeCollection(S.state.orders, data.orders);
    var expenses = mergeCollection(S.state.expenses, data.expenses);
    var shifts = mergeCollection(S.state.shifts, data.shifts);
    S.state.orders = orders.merged;
    S.state.expenses = expenses.merged;
    S.state.shifts = shifts.merged;
    localAhead = localAhead || orders.localAhead || expenses.localAhead || shifts.localAhead;

    if (data.settings) {
      if (guardSettings) localAhead = true;
      else S.state.settings = normalizeSettings(data.settings);
    }
    if (data.menu) {
      if (guardSettings) localAhead = true;
      else S.state.menu = normalizeMenu(data.menu);
    }

    var localSeq = localMeta.seq && typeof localMeta.seq === 'object' ? localMeta.seq : {};
    var remoteSeq = remoteMeta.seq && typeof remoteMeta.seq === 'object' ? remoteMeta.seq : {};
    var mergedSeq = {};
    Object.keys(localSeq).concat(Object.keys(remoteSeq)).forEach(function (day) {
      mergedSeq[day] = Math.max(Number(localSeq[day]) || 0, Number(remoteSeq[day]) || 0);
    });
    S.state.meta = Object.assign({}, localMeta, remoteMeta, { seq: mergedSeq, cleared: cleared });

    saveState();
    S.emit('change', 'all');

    if (newOrders.length) {
      newOrders.sort(function (a, b) { return Number(a.createdAt || 0) - Number(b.createdAt || 0); });
      S.emit('order:new', newOrders[newOrders.length - 1]);
    }
    return localAhead;
  }

  function onCloudMessage(buf) {
    var msg;
    try { msg = JSON.parse(buf.toString()); } catch (e) { return; }
    if (!msg || msg.v !== 1 || !msg.data) return;
    if (msg.dev === S.deviceId) return;
    var cloud = S.sync.cloud;
    if (cloud) {
      cloud.synced = true;
      if (cloud.graceTimer) { clearTimeout(cloud.graceTimer); cloud.graceTimer = null; }
    }
    var remoteSig = cloudSig(msg.data);
    applyCloudSnapshot(msg.data, Number(msg.at) || 0);
    if (!S.sync.cloud || S.sync.cloud !== cloud) return;
    var mergedSig = cloudSig(cloudData());
    if (!cloud.lastSig && mergedSig === remoteSig) cloud.lastSig = mergedSig;
    if (mergedSig !== cloud.lastSig) cloudPublishSoon();
  }

  function subscribeCloud(client, key) {
    try { client.subscribe(cloudTopic(key), { qos: 1 }); } catch (e) { /* ignore */ }
  }

  S.connectCloud = function (cfg) {
    cfg = cfg || {};
    var broker = normalizeBroker(cfg.broker || cfg.databaseURL || CLOUD.broker);
    var key = String(cfg.cafeKey || CLOUD.cafeKey).trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!key) return Promise.reject(new Error('كود الكافيه مطلوب'));

    closeFirebase();
    closeCloud();

    S.sync.mode = 'cloud';
    S.sync.cfg = { broker: broker, cafeKey: key };
    S.sync.cloudCfg = { broker: broker, cafeKey: key };
    saveCloudConfig({ broker: broker, cafeKey: key, enabled: true });
    S.saveSyncConfig(null);
    setStatus('connecting', '');
    S.emit('change', 'sync');

    return loadMqtt().then(function () {
      if (!window.mqtt || !window.mqtt.connect) throw new Error('تعذر تحميل مكتبة المزامنة');
      return new Promise(function (resolve, reject) {
        var client = window.mqtt.connect(broker, {
          clientId: 'crc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
          keepalive: 30,
          reconnectPeriod: 5000,
          connectTimeout: 12000,
          clean: true
        });
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          try { client.end(true); } catch (e) { /* ignore */ }
          reject(new Error('تعذر الاتصال بالسحابة — راجع النت وجرب تاني'));
        }, 16000);
        client.on('connect', function () {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(client);
          } else if (S.sync.cloud) {
            subscribeCloud(client, key);
            setStatus('online', '');
            startCloudGrace();
          }
        });
        client.on('reconnect', function () {
          if (settled && S.sync.cloud) setStatus('connecting', '');
        });
        client.on('close', function () {
          if (settled && S.sync.cloud) setStatus('offline', '');
        });
        client.on('error', function (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { client.end(true); } catch (e) { /* ignore */ }
            reject(new Error(err && err.message ? err.message : 'خطأ في الاتصال بالسحابة'));
          }
        });
      });
    }).then(function (client) {
      S.sync.cloud = {
        client: client,
        broker: broker,
        cafeKey: key,
        topic: cloudTopic(key),
        lastSig: '',
        lastLocalAt: 0,
        synced: false,
        timer: null,
        graceTimer: null
      };
      S.sync.connectedAt = Date.now();
      client.on('message', function (topic, buf) { onCloudMessage(buf); });
      subscribeCloud(client, key);
      setStatus('online', '');
      startCloudGrace();
      S.emit('change', 'sync');
      return { broker: broker, cafeKey: key };
    }).catch(function (err) {
      S.sync.mode = null;
      S.sync.cloudCfg = null;
      setStatus('error', err && err.message ? err.message : 'فشل الاتصال');
      S.emit('change', 'sync');
      throw err;
    });
  };

  S.cloudBoot = function () {
    try {
      if (typeof WebSocket === 'undefined') return Promise.resolve(null);
      if (location.protocol === 'file:') return Promise.resolve(null);
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname)) return Promise.resolve(null);
    } catch (e) {
      return Promise.resolve(null);
    }
    var firebaseCfg = S.loadSyncConfig();
    if (firebaseCfg) return S.connect(firebaseCfg);
    var cloudCfg = loadCloudConfig();
    if (cloudCfg && cloudCfg.enabled === false) {
      setStatus('local', '');
      return Promise.resolve(null);
    }
    if (!cloudCfg) {
      cloudCfg = { broker: CLOUD.broker, cafeKey: CLOUD.cafeKey, enabled: true };
      saveCloudConfig(cloudCfg);
    }
    return S.connectCloud(cloudCfg);
  };

  /* ---------------- init ---------------- */

  S.init = function () {
    if (!loadState()) {
      S.state.menu = normalizeMenu(window.CRC_DEFAULT_MENU || { categories: [] });
      S.state.settings = normalizeSettings({});
      saveState();
    }
    S.draft = loadDraft();
  };

  /* ---------------- menu helpers ---------------- */

  S.categories = function () { return S.state.menu.categories || []; };

  S.findItem = function (id) {
    var cats = S.categories();
    for (var i = 0; i < cats.length; i++) {
      for (var j = 0; j < cats[i].items.length; j++) {
        if (cats[i].items[j].id === id) return { item: cats[i].items[j], category: cats[i] };
      }
    }
    return null;
  };

  S.allItems = function () {
    var out = [];
    S.categories().forEach(function (cat) {
      cat.items.forEach(function (item) {
        if (!item.hidden) out.push({ item: item, category: cat });
      });
    });
    return out;
  };

  function saveMenu() {
    S.state.menu.updatedAt = new Date().toISOString();
    saveState();
    if (S.sync.base) rset('menu', S.state.menu);
    if (S.sync.cloud) cloudPublishSoon();
    S.emit('change', 'menu');
  }

  S.updateItem = function (catId, itemId, patch) {
    var cat = S.categories().filter(function (c) { return c.id === catId; })[0];
    if (!cat) return;
    var item = cat.items.filter(function (i) { return i.id === itemId; })[0];
    if (!item) return;
    Object.keys(patch).forEach(function (k) { item[k] = patch[k]; });
    if (patch.price !== undefined) item.price = Math.max(0, U.num(patch.price));
    if (patch.cost !== undefined) item.cost = Math.max(0, U.num(patch.cost));
    saveMenu();
  };

  S.addItem = function (catId, data) {
    var cat = S.categories().filter(function (c) { return c.id === catId; })[0];
    if (!cat) return null;
    var item = {
      id: U.uid('item'),
      name: String(data.name || 'صنف جديد'),
      price: Math.max(0, U.num(data.price)),
      cost: Math.max(0, U.num(data.cost)),
      desc: String(data.desc || ''),
      hidden: false
    };
    cat.items.push(item);
    saveMenu();
    return item;
  };

  S.deleteItem = function (catId, itemId) {
    var cat = S.categories().filter(function (c) { return c.id === catId; })[0];
    if (!cat) return;
    cat.items = cat.items.filter(function (i) { return i.id !== itemId; });
    saveMenu();
  };

  S.addCategory = function (data) {
    var cat = {
      id: U.uid('cat'),
      name: String(data.name || 'قسم جديد'),
      icon: String(data.icon || '☕'),
      items: []
    };
    S.state.menu.categories.push(cat);
    saveMenu();
    return cat;
  };

  S.updateCategory = function (catId, patch) {
    var cat = S.categories().filter(function (c) { return c.id === catId; })[0];
    if (!cat) return;
    Object.keys(patch).forEach(function (k) { cat[k] = patch[k]; });
    saveMenu();
  };

  S.deleteCategory = function (catId) {
    S.state.menu.categories = S.categories().filter(function (c) { return c.id !== catId; });
    saveMenu();
  };

  /* ---------------- settings ---------------- */

  var pushSettings = U.debounce(function () {
    if (S.sync.base) rset('settings', S.state.settings);
    if (S.sync.cloud) cloudPublishSoon();
  }, 350);

  S.updateSettings = function (patch) {
    Object.keys(patch).forEach(function (k) { S.state.settings[k] = patch[k]; });
    S.state.settings = normalizeSettings(S.state.settings);
    saveState();
    pushSettings();
    S.emit('change', 'settings');
  };

  /* ---------------- draft / cart ---------------- */

  function loadDraft() {
    var raw = readJSON(LS.draft);
    if (!raw || typeof raw !== 'object') return null;
    return normalizeDraft(raw);
  }

  function normalizeDraft(raw) {
    var draft = {
      items: {},
      type: raw.type === 'take' || raw.type === 'delivery' ? raw.type : 'dine',
      table: raw.table || '',
      customer: raw.customer || '',
      phone: raw.phone || '',
      address: raw.address || '',
      note: raw.note || '',
      discountType: raw.discountType === 'percent' ? 'percent' : 'amount',
      discountValue: Math.max(0, U.num(raw.discountValue)),
      delivery: Math.max(0, U.num(raw.delivery))
    };
    var items = raw.items && typeof raw.items === 'object' ? raw.items : {};
    Object.keys(items).forEach(function (id) {
      var line = items[id];
      var qty = typeof line === 'number' ? line : Number(line && line.qty);
      var note = typeof line === 'object' && line ? String(line.note || '') : '';
      if (qty > 0) draft.items[id] = { qty: Math.min(99, Math.floor(qty)), note: note };
    });
    return draft;
  }

  S.ensureDraft = function () {
    if (!S.draft) {
      S.draft = normalizeDraft({ type: 'dine' });
      if (S.state.settings.deliveryFee) S.draft.delivery = U.num(S.state.settings.deliveryFee);
    }
    return S.draft;
  };

  S.saveDraft = function () {
    if (S.draft) writeJSON(LS.draft, S.draft);
  };

  S.resetDraft = function () {
    S.draft = normalizeDraft({ type: 'dine', delivery: S.state.settings.deliveryFee });
    S.saveDraft();
    S.emit('draft');
  };

  S.addToDraft = function (itemId) {
    var found = S.findItem(itemId);
    if (!found || found.item.hidden) return false;
    var draft = S.ensureDraft();
    var line = draft.items[itemId];
    if (!line) line = draft.items[itemId] = { qty: 0, note: '' };
    line.qty = Math.min(99, line.qty + 1);
    S.saveDraft();
    S.emit('draft');
    return true;
  };

  S.setDraftQty = function (itemId, qty) {
    var draft = S.ensureDraft();
    qty = Math.max(0, Math.min(99, Math.floor(U.num(qty))));
    if (qty <= 0) delete draft.items[itemId];
    else {
      if (!draft.items[itemId]) draft.items[itemId] = { qty: 0, note: '' };
      draft.items[itemId].qty = qty;
    }
    S.saveDraft();
    S.emit('draft');
  };

  S.setDraftNote = function (itemId, note) {
    var draft = S.ensureDraft();
    if (!draft.items[itemId]) return;
    draft.items[itemId].note = String(note || '');
    S.saveDraft();
    S.emit('draft');
  };

  S.setDraftField = function (key, value) {
    var draft = S.ensureDraft();
    draft[key] = value;
    S.saveDraft();
    S.emit('draft');
  };

  S.draftLines = function () {
    var draft = S.ensureDraft();
    var out = [];
    Object.keys(draft.items).forEach(function (id) {
      var found = S.findItem(id);
      var line = draft.items[id];
      if (!found || !line || !line.qty) return;
      out.push({
        item: found.item,
        category: found.category,
        qty: line.qty,
        note: line.note || '',
        total: U.round(found.item.price * line.qty)
      });
    });
    return out;
  };

  S.draftCount = function () {
    var draft = S.ensureDraft();
    return Object.keys(draft.items).reduce(function (sum, id) {
      return sum + (draft.items[id] ? draft.items[id].qty : 0);
    }, 0);
  };

  S.calcTotals = function (lines, opts) {
    opts = opts || {};
    var settings = S.state.settings;
    var subtotal = 0;
    (lines || []).forEach(function (line) {
      subtotal += U.num(line.item ? line.item.price : line.price) * U.num(line.qty);
    });
    subtotal = U.round(subtotal);

    var discount = 0;
    var dType = opts.discountType || 'amount';
    var dValue = Math.max(0, U.num(opts.discountValue));
    if (dType === 'percent') discount = U.round(subtotal * Math.min(100, dValue) / 100);
    else discount = Math.min(subtotal, U.round(dValue));

    var taxable = Math.max(0, U.round(subtotal - discount));
    var service = U.round(taxable * U.num(settings.serviceRate) / 100);
    var tax = U.round((taxable + service) * U.num(settings.taxRate) / 100);
    var delivery = opts.type === 'delivery' ? Math.max(0, U.num(opts.delivery)) : 0;
    var total = U.round(taxable + service + tax + delivery);

    return {
      subtotal: subtotal,
      discount: discount,
      service: service,
      tax: tax,
      delivery: delivery,
      total: total
    };
  };

  S.draftTotals = function () {
    var draft = S.ensureDraft();
    return S.calcTotals(S.draftLines(), {
      discountType: draft.discountType,
      discountValue: draft.discountValue,
      type: draft.type,
      delivery: draft.delivery
    });
  };

  /* ---------------- order numbering ---------------- */

  function nextNumber() {
    var day = U.dayKey();
    if (S.sync.base && S.sync.status === 'online') {
      var localLast = Number((S.state.meta.seq || {})[day]) || 0;
      return S.sync.base.child('meta/seq/' + day).transaction(function (current) {
        return Math.max(Number(current) || 0, localLast) + 1;
      }).then(function (res) {
        var n = res && res.snapshot ? Number(res.snapshot.val()) : 0;
        if (n > 0) {
          S.state.meta.seq = S.state.meta.seq || {};
          S.state.meta.seq[day] = n;
          saveState();
          return buildNumber(day, n);
        }
        return localNext(day);
      }).catch(function () {
        return localNext(day);
      });
    }
    return Promise.resolve(localNext(day));
  }

  function buildNumber(day, n) {
    return day + '-' + U.pad(n, 3);
  }

  function localNext(day) {
    S.state.meta.seq = S.state.meta.seq || {};
    var n = Number(S.state.meta.seq[day]) || 0;
    Object.keys(S.state.orders || {}).forEach(function (id) {
      var order = S.state.orders[id];
      if (!order || !order.number) return;
      var parts = String(order.number).split('-');
      if (parts[0] !== day) return;
      var seq = parseInt(parts[1], 10);
      if (seq > n) n = seq;
    });
    n += 1;
    S.state.meta.seq[day] = n;
    saveState();
    if (S.sync.base) rset('meta/seq/' + day, n);
    return buildNumber(day, n);
  }

  /* ---------------- orders ---------------- */

  S.orderList = function () {
    return Object.keys(S.state.orders).map(function (id) { return S.state.orders[id]; })
      .filter(Boolean)
      .sort(function (a, b) { return Number(b.createdAt || 0) - Number(a.createdAt || 0); });
  };

  S.getOrder = function (id) { return S.state.orders[id] || null; };

  S.createOrderFromDraft = function (payment) {
    var draft = S.ensureDraft();
    var lines = S.draftLines();
    if (!lines.length) return Promise.reject(new Error('السلة فاضية'));

    var totals = S.draftTotals();
    var paid = !!(payment && payment.method);
    var received = paid ? U.num(payment.received) : 0;

    return nextNumber().then(function (number) {
      var now = Date.now();
      var order = {
        id: U.uid('ord'),
        number: number,
        seq: number.split('-')[1] || '',
        type: draft.type,
        table: draft.type === 'dine' ? String(draft.table || '') : '',
        customer: String(draft.customer || '').trim(),
        phone: String(draft.phone || '').trim(),
        address: String(draft.address || '').trim(),
        items: lines.map(function (line) {
          return {
            id: line.item.id,
            name: line.item.name,
            price: U.num(line.item.price),
            cost: U.num(line.item.cost),
            qty: line.qty,
            note: line.note || '',
            cat: line.category ? line.category.id : ''
          };
        }),
        subtotal: totals.subtotal,
        discountType: draft.discountType,
        discountValue: U.num(draft.discountValue),
        discount: totals.discount,
        service: totals.service,
        tax: totals.tax,
        delivery: totals.delivery,
        total: totals.total,
        status: paid ? 'paid' : 'new',
        payment: paid ? {
          method: payment.method,
          received: received,
          change: U.round(Math.max(0, received - totals.total)),
          at: now
        } : null,
        note: String(draft.note || '').trim(),
        createdAt: now,
        updatedAt: now,
        createdBy: S.user,
        deviceId: S.deviceId,
        shiftId: S.currentShift() ? S.currentShift().id : null
      };

      S.state.orders[order.id] = order;
      commit('orders');
      rset('orders/' + order.id, order);
      S.resetDraft();
      return order;
    });
  };

  S.updateOrder = function (id, patch) {
    var order = S.state.orders[id];
    if (!order) return null;
    var next = Object.assign({}, order, patch, { updatedAt: Date.now() });
    S.state.orders[id] = next;
    commit('orders');
    rset('orders/' + id, next);
    return next;
  };

  S.setOrderStatus = function (id, status) {
    return S.updateOrder(id, { status: status });
  };

  S.payOrder = function (id, payment) {
    var order = S.state.orders[id];
    if (!order) return null;
    var received = U.num(payment.received);
    var next = S.updateOrder(id, {
      status: 'paid',
      payment: {
        method: payment.method || 'cash',
        received: received,
        change: U.round(Math.max(0, received - order.total)),
        at: Date.now()
      }
    });
    return next;
  };

  S.cancelOrder = function (id, reason) {
    return S.updateOrder(id, {
      status: 'cancelled',
      cancelReason: String(reason || ''),
      cancelledAt: Date.now(),
      cancelledBy: S.user
    });
  };

  /* ---------------- expenses ---------------- */

  S.expenseList = function () {
    return Object.keys(S.state.expenses).map(function (id) { return S.state.expenses[id]; })
      .filter(Boolean)
      .sort(function (a, b) { return Number(b.createdAt || 0) - Number(a.createdAt || 0); });
  };

  S.addExpense = function (data) {
    var now = Date.now();
    var shift = S.currentShift();
    var expense = {
      id: U.uid('exp'),
      title: String(data.title || 'مصروف'),
      amount: Math.max(0, U.num(data.amount)),
      category: String(data.category || 'other'),
      date: data.date || U.dateKey(),
      note: String(data.note || ''),
      createdAt: now,
      updatedAt: now,
      by: S.user,
      shiftId: shift ? shift.id : null
    };
    S.state.expenses[expense.id] = expense;
    commit('expenses');
    rset('expenses/' + expense.id, expense);
    return expense;
  };

  S.deleteExpense = function (id) {
    if (!S.state.expenses[id]) return;
    delete S.state.expenses[id];
    commit('expenses');
    rremove('expenses/' + id);
  };

  S.updateExpense = function (id, patch) {
    var exp = S.state.expenses[id];
    if (!exp) return;
    var next = Object.assign({}, exp, patch, { updatedAt: Date.now() });
    S.state.expenses[id] = next;
    commit('expenses');
    rset('expenses/' + id, next);
  };

  /* ---------------- shifts ---------------- */

  S.shiftList = function () {
    return Object.keys(S.state.shifts).map(function (id) { return S.state.shifts[id]; })
      .filter(Boolean)
      .sort(function (a, b) { return Number(b.openedAt || 0) - Number(a.openedAt || 0); });
  };

  S.currentShift = function () {
    return S.shiftList().filter(function (s) { return !s.closedAt; })[0] || null;
  };

  S.openShift = function (openingCash) {
    var existing = S.currentShift();
    if (existing) return existing;
    var now = Date.now();
    var shift = {
      id: U.uid('shift'),
      openedAt: now,
      openingCash: Math.max(0, U.num(openingCash)),
      openedBy: S.user,
      deviceId: S.deviceId,
      closedAt: null,
      updatedAt: now
    };
    S.state.shifts[shift.id] = shift;
    commit('shifts');
    rset('shifts/' + shift.id, shift);
    return shift;
  };

  S.shiftStats = function (shiftId) {
    var orders = S.orderList().filter(function (o) {
      return o.shiftId === shiftId && o.status !== 'cancelled';
    });
    var expenses = S.expenseList().filter(function (e) { return e.shiftId === shiftId; });
    var cashSales = orders.filter(function (o) {
      return o.payment && o.payment.method === 'cash';
    }).reduce(function (s, o) { return s + U.num(o.total); }, 0);
    var cashExpenses = expenses.reduce(function (s, e) { return s + U.num(e.amount); }, 0);
    var sales = orders.reduce(function (s, o) { return s + U.num(o.total); }, 0);
    var shift = S.state.shifts[shiftId] || {};
    var expected = U.round(U.num(shift.openingCash) + cashSales - cashExpenses);
    return {
      orders: orders.length,
      sales: U.round(sales),
      cashSales: U.round(cashSales),
      expenses: U.round(cashExpenses),
      expected: expected
    };
  };

  S.closeShift = function (countedCash, note) {
    var shift = S.currentShift();
    if (!shift) return null;
    var stats = S.shiftStats(shift.id);
    var counted = U.round(U.num(countedCash));
    var next = Object.assign({}, shift, {
      closedAt: Date.now(),
      closedBy: S.user,
      countedCash: counted,
      difference: U.round(counted - stats.expected),
      note: String(note || ''),
      totals: stats,
      updatedAt: Date.now()
    });
    S.state.shifts[shift.id] = next;
    commit('shifts');
    rset('shifts/' + shift.id, next);
    return next;
  };

  /* ---------------- reports ---------------- */

  function sum(list, key) {
    return U.round(list.reduce(function (s, x) { return s + U.num(x[key]); }, 0));
  }

  S.stats = function (from, to) {
    var all = S.orderList();
    var list = all.filter(function (o) {
      var t = Number(o.createdAt || 0);
      return t >= from && t <= to;
    });
    var valid = list.filter(function (o) { return o.status !== 'cancelled'; });
    var paid = valid.filter(function (o) { return o.payment && o.payment.method; });
    var sales = sum(valid, 'total');
    var collected = sum(paid, 'total');
    var cogs = U.round(valid.reduce(function (s, o) {
      return s + (o.items || []).reduce(function (x, it) {
        return x + U.num(it.cost) * U.num(it.qty);
      }, 0);
    }, 0));

    var expenseList = S.expenseList().filter(function (e) {
      var t = e.date ? U.startOfDay(e.date) : Number(e.createdAt || 0);
      return t >= from && t <= to;
    });
    var expenses = sum(expenseList, 'amount');

    var byPayment = {};
    paid.forEach(function (o) {
      var m = (o.payment && o.payment.method) || 'other';
      if (!byPayment[m]) byPayment[m] = { count: 0, total: 0 };
      byPayment[m].count++;
      byPayment[m].total = U.round(byPayment[m].total + U.num(o.total));
    });

    var byType = { dine: { count: 0, total: 0 }, take: { count: 0, total: 0 }, delivery: { count: 0, total: 0 } };
    valid.forEach(function (o) {
      var t = byType[o.type] || (byType[o.type] = { count: 0, total: 0 });
      t.count++;
      t.total = U.round(t.total + U.num(o.total));
    });

    var byHour = [];
    for (var h = 0; h < 24; h++) byHour.push({ hour: h, total: 0, count: 0 });
    valid.forEach(function (o) {
      var hr = new Date(Number(o.createdAt)).getHours();
      byHour[hr].total = U.round(byHour[hr].total + U.num(o.total));
      byHour[hr].count++;
    });

    var itemMap = {};
    var catMap = {};
    valid.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var key = it.id || it.name;
        if (!itemMap[key]) itemMap[key] = { name: it.name, qty: 0, revenue: 0, cost: 0 };
        itemMap[key].qty += U.num(it.qty);
        itemMap[key].revenue = U.round(itemMap[key].revenue + U.num(it.price) * U.num(it.qty));
        itemMap[key].cost = U.round(itemMap[key].cost + U.num(it.cost) * U.num(it.qty));

        var ck = it.cat || 'other';
        if (!catMap[ck]) catMap[ck] = { id: ck, qty: 0, revenue: 0 };
        catMap[ck].qty += U.num(it.qty);
        catMap[ck].revenue = U.round(catMap[ck].revenue + U.num(it.price) * U.num(it.qty));
      });
    });

    var topItems = Object.keys(itemMap).map(function (k) { return itemMap[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; });

    var byCategory = Object.keys(catMap).map(function (k) {
      var cat = S.categories().filter(function (c) { return c.id === k; })[0];
      return {
        id: k,
        name: cat ? cat.name : 'أخرى',
        icon: cat ? cat.icon : '•',
        qty: catMap[k].qty,
        revenue: catMap[k].revenue
      };
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    return {
      from: from,
      to: to,
      orders: valid.length,
      allOrders: list.length,
      cancelled: list.length - valid.length,
      sales: sales,
      collected: collected,
      due: U.round(sales - collected),
      dueCount: valid.length - paid.length,
      cogs: cogs,
      expenses: expenses,
      net: U.round(sales - cogs - expenses),
      avg: valid.length ? U.round(sales / valid.length) : 0,
      byPayment: byPayment,
      byType: byType,
      byHour: byHour,
      topItems: topItems,
      byCategory: byCategory,
      expenseList: expenseList
    };
  };

  S.rangeFor = function (range, customFrom, customTo) {
    var now = new Date();
    if (range === 'today') return { from: U.startOfDay(now), to: U.endOfDay(now) };
    if (range === 'yesterday') {
      var y = U.addDays(now, -1);
      return { from: U.startOfDay(y), to: U.endOfDay(y) };
    }
    if (range === 'week') return { from: U.startOfDay(U.addDays(now, -6)), to: U.endOfDay(now) };
    if (range === 'month') {
      var first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: U.startOfDay(first), to: U.endOfDay(now) };
    }
    if (range === 'custom' && customFrom) {
      return {
        from: U.startOfDay(customFrom),
        to: U.endOfDay(customTo || customFrom)
      };
    }
    return { from: U.startOfDay(now), to: U.endOfDay(now) };
  };

  /* ---------------- export ---------------- */

  S.exportData = function () {
    return {
      app: 'costa-rica-pos',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: S.state.settings,
      menu: S.state.menu,
      orders: S.state.orders,
      expenses: S.state.expenses,
      shifts: S.state.shifts,
      meta: S.state.meta
    };
  };

  S.importData = function (data) {
    if (!data || typeof data !== 'object') throw new Error('ملف غير صالح');
    if (!data.settings && !data.menu && !data.orders) throw new Error('الملف لا يحتوي على بيانات النظام');
    if (data.settings) S.state.settings = normalizeSettings(data.settings);
    if (data.menu) S.state.menu = normalizeMenu(data.menu);
    if (data.orders) S.state.orders = data.orders;
    if (data.expenses) S.state.expenses = data.expenses;
    if (data.shifts) S.state.shifts = data.shifts;
    if (data.meta) S.state.meta = data.meta;
    saveState();
    if (S.sync.base) {
      rset('settings', S.state.settings);
      rset('menu', S.state.menu);
      rset('orders', S.state.orders);
      rset('expenses', S.state.expenses);
      rset('shifts', S.state.shifts);
      rset('meta', S.state.meta);
    }
    if (S.sync.cloud) cloudPublishSoon();
    S.emit('change', 'all');
  };

  S.clearData = function (what) {
    var clearedAt = Date.now();
    S.state.meta = S.state.meta || { seq: {} };
    S.state.meta.cleared = S.state.meta.cleared || {};
    if (what === 'all') {
      S.state.orders = {};
      S.state.expenses = {};
      S.state.shifts = {};
      S.state.meta = { seq: {}, cleared: { orders: clearedAt, expenses: clearedAt, shifts: clearedAt } };
    } else if (what === 'orders') {
      S.state.orders = {};
      S.state.meta.seq = {};
      S.state.meta.cleared.orders = clearedAt;
    } else if (what === 'expenses') {
      S.state.expenses = {};
      S.state.meta.cleared.expenses = clearedAt;
    }
    saveState();
    if (S.sync.base) {
      if (what === 'all' || what === 'orders') rset('orders', null);
      if (what === 'all' || what === 'expenses') rset('expenses', null);
      if (what === 'all') rset('shifts', null);
      if (what === 'all' || what === 'orders') rset('meta', S.state.meta);
    }
    if (S.sync.cloud) cloudPublishSoon();
    S.emit('change', 'all');
  };

  function csvEscape(value) {
    var s = String(value == null ? '' : value);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows) {
    return '\uFEFF' + rows.map(function (row) {
      return row.map(csvEscape).join(',');
    }).join('\r\n');
  }

  S.exportOrdersCSV = function (from, to) {
    var rows = [['رقم الفاتورة', 'التاريخ', 'الوقت', 'النوع', 'الترابيزة', 'العميل', 'الأصناف', 'الإجمالي', 'الخصم', 'طريقة الدفع', 'الحالة', 'الكاشير']];
    S.orderList().filter(function (o) {
      var t = Number(o.createdAt || 0);
      return t >= from && t <= to;
    }).forEach(function (o) {
      rows.push([
        o.number,
        U.fmtDateShort(o.createdAt),
        U.fmtTime(o.createdAt),
        typeLabel(o.type),
        o.table || '',
        o.customer || '',
        (o.items || []).map(function (it) { return it.name + ' x' + it.qty; }).join(' | '),
        U.round(o.total),
        U.round(o.discount || 0),
        o.payment ? methodLabel(o.payment.method) : 'آجل',
        statusLabel(o.status),
        o.createdBy || ''
      ]);
    });
    return toCSV(rows);
  };

  S.exportItemsCSV = function (from, to) {
    var stats = S.stats(from, to);
    var rows = [['الصنف', 'الكمية', 'الإيراد', 'التكلفة', 'الربح']];
    stats.topItems.forEach(function (it) {
      rows.push([it.name, it.qty, it.revenue, it.cost, U.round(it.revenue - it.cost)]);
    });
    return toCSV(rows);
  };

  S.exportExpensesCSV = function (from, to) {
    var rows = [['التاريخ', 'البند', 'التصنيف', 'المبلغ', 'ملاحظات', 'بواسطة']];
    S.expenseList().filter(function (e) {
      var t = e.date ? U.startOfDay(e.date) : Number(e.createdAt || 0);
      return t >= from && t <= to;
    }).forEach(function (e) {
      rows.push([e.date, e.title, expenseCatLabel(e.category), U.round(e.amount), e.note || '', e.by || '']);
    });
    return toCSV(rows);
  };

  /* ---------------- labels ---------------- */

  function typeLabel(type) {
    return type === 'take' ? 'تيك أوي' : type === 'delivery' ? 'دليفري' : 'صالة';
  }
  function statusLabel(status) {
    return ({
      new: 'جديد',
      preparing: 'قيد التحضير',
      ready: 'جاهز',
      served: 'تم التقديم',
      paid: 'مدفوع',
      cancelled: 'ملغي'
    })[status] || status;
  }
  function methodLabel(method) {
    return ({
      cash: 'كاش',
      card: 'فيزا',
      wallet: 'محفظة',
      instapay: 'انستاباي',
      other: 'أخرى'
    })[method] || method;
  }
  function expenseCatLabel(cat) {
    return ({
      supplies: 'خامات',
      rent: 'إيجار',
      salaries: 'رواتب',
      utilities: 'كهرباء ومياه',
      maintenance: 'صيانة',
      other: 'أخرى'
    })[cat] || cat;
  }

  S.typeLabel = typeLabel;
  S.statusLabel = statusLabel;
  S.methodLabel = methodLabel;
  S.expenseCatLabel = expenseCatLabel;
  S.expenseCategories = [
    { id: 'supplies', name: 'خامات' },
    { id: 'rent', name: 'إيجار' },
    { id: 'salaries', name: 'رواتب' },
    { id: 'utilities', name: 'كهرباء ومياه' },
    { id: 'maintenance', name: 'صيانة' },
    { id: 'other', name: 'أخرى' }
  ];
  S.paymentMethods = [
    { id: 'cash', name: 'كاش', icon: '💵' },
    { id: 'card', name: 'فيزا', icon: '💳' },
    { id: 'wallet', name: 'محفظة', icon: '📱' },
    { id: 'instapay', name: 'انستاباي', icon: '🏦' }
  ];

  /* ---------------- join code ---------------- */

  S.makeJoinCode = function (cfg) {
    var payload = cfg && cfg.broker
      ? { b: cfg.broker, k: cfg.cafeKey }
      : { u: cfg.databaseURL, k: cfg.cafeKey };
    return btoa(encodeURIComponent(JSON.stringify(payload)));
  };

  S.parseJoinCode = function (code) {
    var raw = String(code || '').trim();
    if (!raw) return null;
    try {
      var json = decodeURIComponent(atob(raw));
      var data = JSON.parse(json);
      if (data && data.b && data.k) return { broker: data.b, cafeKey: data.k };
      if (data && data.u && data.k) return { databaseURL: data.u, cafeKey: data.k };
    } catch (e) { /* ignore */ }
    return null;
  };

  S.joinLink = function (cfg) {
    return location.origin + location.pathname + '#join=' + S.makeJoinCode(cfg);
  };

  /* ---------------- expose misc ---------------- */

  S.LS = LS;
  S.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
})();
