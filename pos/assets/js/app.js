/* ============================================================
   Costa Rica Cafe — app bootstrap, router, printing
   ============================================================ */
(function () {
  'use strict';

  var App = window.App;
  var U = App.util;
  var S = App.store;
  var V = App.views;
  var h = U.esc;

  var ROUTES = ['pos', 'orders', 'reports', 'expenses', 'settings', 'menu'];
  var NAV = [
    { id: 'pos', label: 'كاشير', icon: 'pos' },
    { id: 'orders', label: 'الطلبات', icon: 'orders' },
    { id: 'reports', label: 'الحسابات', icon: 'reports' },
    { id: 'expenses', label: 'المصاريف', icon: 'expenses' },
    { id: 'settings', label: 'الإعدادات', icon: 'settings' }
  ];

  var current = 'pos';
  var adminPromptOpen = false;
  var renderTimer = null;

  function routeFromHash() {
    var raw = String(location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(raw) !== -1 ? raw : 'pos';
  }

  function navigate(name) {
    if (ROUTES.indexOf(name) === -1) name = 'pos';
    if (location.hash === '#' + name) {
      render();
    } else {
      location.hash = '#' + name;
    }
  }

  App.navigate = navigate;

  /* ---------------- header / nav ---------------- */

  function statusInfo() {
    var st = S.sync.status;
    if (st === 'online') return { cls: 'online', text: 'متزامن' };
    if (st === 'connecting') return { cls: 'connecting', text: 'جاري الاتصال' };
    if (st === 'offline') return { cls: 'offline', text: 'غير متصل' };
    if (st === 'error') return { cls: 'error', text: 'خطأ' };
    return { cls: 'local', text: 'محلي' };
  }

  App.renderHeader = function () {
    var top = document.getElementById('topbar');
    if (!top) return;
    var s = S.state.settings;
    var st = statusInfo();
    top.innerHTML =
      '<div class="brand">' +
        '<div class="logo">☕</div>' +
        '<div><b>' + h(s.cafeName) + '</b><small>' + h(s.branch || 'نظام الكاشير والحسابات') + '</small></div>' +
      '</div>' +
      '<div class="head-right">' +
        '<button class="pill ' + st.cls + '" data-nav="settings" title="حالة المزامنة">' +
          '<span class="dot"></span>' + h(st.text) +
        '</button>' +
        '<button class="pill user" data-user="1" title="تغيير اسم الكاشير">👤 ' + h(S.user) + '</button>' +
      '</div>';
  };

  function activeOrdersCount() {
    var from = U.startOfDay();
    return S.orderList().filter(function (o) {
      return Number(o.createdAt) >= from && ['new', 'preparing', 'ready', 'served'].indexOf(o.status) !== -1;
    }).length;
  }

  App.renderNav = function () {
    var nav = document.getElementById('bottomnav');
    if (!nav) return;
    var badge = activeOrdersCount();
    nav.innerHTML = NAV.map(function (item) {
      var active = current === item.id || (current === 'menu' && item.id === 'settings');
      return '<button class="navbtn ' + (active ? 'active' : '') + '" data-nav="' + item.id + '">' +
        App.icon(item.icon) +
        '<span>' + item.label + '</span>' +
        (item.id === 'orders' ? '<span class="nbadge ' + (badge ? '' : 'hide') + '">' + badge + '</span>' : '') +
        '</button>';
    }).join('');
  };

  /* ---------------- render ---------------- */

  App.render = function () {
    var name = routeFromHash();
    var routeChanged = name !== current;
    current = name;

    var screen = document.getElementById('screen');
    if (!screen) return;

    document.body.classList.remove('no-scroll');

    var guard = (name === 'settings' || name === 'menu') && S.state.settings.adminPin;
    var unlocked = false;
    try { unlocked = sessionStorage.getItem('crc_admin') === '1'; } catch (e) { unlocked = false; }

    if (guard && !unlocked) {
      screen.innerHTML = '<div class="empty"><span class="big">🔒</span><strong>الإعدادات مقفولة</strong><span>محتاج رمز PIN للدخول. اضغط تحت للمحاولة.</span><button class="btn primary sm mt8" data-act="unlock">🔑 إدخال الرمز</button></div>';
      App.renderHeader();
      App.renderNav();
      if (!adminPromptOpen) {
        setTimeout(function () { askAdmin(function () { render(); }); }, 150);
      }
      return;
    }

    var y = routeChanged ? 0 : window.scrollY;
    screen.innerHTML = V[name].html();
    if (V[name].mount) {
      try { V[name].mount(); } catch (e) { console.error(e); }
    }
    App.renderHeader();
    App.renderNav();
    if (routeChanged) {
      window.scrollTo(0, 0);
    } else {
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    }
  };

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () { render(); }, 80);
  }

  function render() {
    App.render();
  }

  function askAdmin(cb) {
    if (!S.state.settings.adminPin) { cb(); return; }
    var unlocked = false;
    try { unlocked = sessionStorage.getItem('crc_admin') === '1'; } catch (e) { unlocked = false; }
    if (unlocked) { cb(); return; }
    if (adminPromptOpen) return;
    adminPromptOpen = true;
    U.prompt('رمز المدير', {
      message: 'اكتب رمز PIN للدخول على الإعدادات والمنيو.',
      type: 'password',
      placeholder: '••••',
      okText: 'دخول'
    }).then(function (value) {
      adminPromptOpen = false;
      if (value === null) return;
      if (String(value) === String(S.state.settings.adminPin)) {
        try { sessionStorage.setItem('crc_admin', '1'); } catch (e) { /* ignore */ }
        cb();
      } else {
        U.toast('الرمز غلط', { type: 'error' });
      }
    });
  }

  App.requireAdmin = askAdmin;

  /* ---------------- events ---------------- */

  document.addEventListener('click', function (e) {
    var navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      U.unlockAudio();
      navigate(navBtn.getAttribute('data-nav'));
      return;
    }

    var userBtn = e.target.closest('[data-user]');
    if (userBtn) {
      e.preventDefault();
      U.prompt('اسم الكاشير', {
        message: 'الاسم ده هيظهر على كل طلب بتعمله من الجهاز ده.',
        value: S.user,
        okText: 'حفظ'
      }).then(function (value) {
        if (value === null) return;
        S.setUser(value);
        App.renderHeader();
        U.toast('أهلاً ' + S.user + ' 👋');
      });
      return;
    }

    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');

    if (act === 'unlock') {
      e.preventDefault();
      askAdmin(function () { render(); });
      return;
    }

    var view = V[current];
    var fn = view && view.actions && view.actions[act];
    if (fn) {
      e.preventDefault();
      U.unlockAudio();
      fn(el, e);
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]');
    if (!el) return;
    var kind = el.getAttribute('data-change');

    if (current === 'pos') {
      if (kind === 'table') S.setDraftField('table', el.value);
      else if (kind === 'field') S.setDraftField(el.getAttribute('data-field'), el.value);
      else if (kind === 'delivery') { S.setDraftField('delivery', U.num(el.value)); V.pos.updateTotals(); }
      else if (kind === 'note') S.setDraftField('note', el.value);
      return;
    }

    if (current === 'menu') {
      if (kind === 'itemName') S.updateItem(el.dataset.cat, el.dataset.id, { name: el.value.trim() || 'صنف' });
      else if (kind === 'itemPrice') S.updateItem(el.dataset.cat, el.dataset.id, { price: U.num(el.value) });
      else if (kind === 'itemCost') S.updateItem(el.dataset.cat, el.dataset.id, { cost: U.num(el.value) });
      return;
    }

    if (current === 'reports') {
      if (kind === 'from') { App.reportsState.from = el.value; render(); }
      else if (kind === 'to') { App.reportsState.to = el.value; render(); }
      return;
    }
  });

  document.addEventListener('input', function (e) {
    if (current === 'pos' && e.target.id === 'cartDiscount') {
      var d = S.ensureDraft();
      d.discountValue = U.num(e.target.value);
      S.saveDraft();
      V.pos.updateTotals();
    }
  });

  window.addEventListener('hashchange', function () {
    if (location.hash.indexOf('#join=') !== -1) return;
    render();
  });

  /* ---------------- subscriptions ---------------- */

  function bindSubscriptions() {
    S.on('draft', function () {
      if (current === 'pos') V.pos.onDraft();
    });

    S.on('sync', function () {
      App.renderHeader();
      if (current === 'settings' && V.settings.updateSync) V.settings.updateSync();
      if (current === 'pos' || current === 'orders') scheduleRender();
    });

    S.on('change', function (scope) {
      App.renderHeader();
      App.renderNav();

      if (scope === 'orders') {
        if (current === 'orders' || current === 'reports') scheduleRender();
        return;
      }
      if (scope === 'expenses' || scope === 'shifts') {
        if (current === 'expenses' || current === 'reports') scheduleRender();
        return;
      }
      if (scope === 'settings') {
        if (current === 'pos' || current === 'reports') scheduleRender();
        return;
      }
      if (scope === 'menu') {
        if (current === 'pos') scheduleRender();
        return;
      }
      if (scope === 'user') {
        return;
      }
      if (scope === 'sync') {
        return;
      }
      if (scope === 'all') {
        scheduleRender();
      }
    });

    S.on('order:new', function (order) {
      if (S.state.settings.sound) {
        U.beep('notify');
        U.vibrate([120, 60, 120]);
      }
      U.toast('🔔 طلب جديد #' + (order.seq || order.number) + ' — ' + U.money(order.total, S.state.settings.currency), {
        type: 'success',
        duration: 6000,
        actionLabel: 'عرض الطلبات',
        onAction: function () { navigate('orders'); }
      });
      App.renderNav();
      if (current === 'orders') scheduleRender();
    });

    S.on('save', function () {
      App.renderNav();
    });
  }

  /* ---------------- print ---------------- */

  App.printOrder = function (order, mode) {
    if (!order) return;
    var area = document.getElementById('printArea');
    if (!area) return;
    var s = S.state.settings;
    var cur = s.currency;

    var items = (order.items || []).map(function (it) {
      if (mode === 'kitchen') {
        return '<div class="p-item"><div class="n">' + it.qty + ' × ' + h(it.name) + '</div>' +
          (it.note ? '<div class="p-note">↳ ' + h(it.note) + '</div>' : '') + '</div>';
      }
      return '<div class="p-item"><div class="p-row"><span>' + it.qty + ' × ' + h(it.name) + '</span><span>' + U.fmtPrice(it.price * it.qty) + '</span></div>' +
        (it.note ? '<div class="p-note">↳ ' + h(it.note) + '</div>' : '') + '</div>';
    }).join('');

    if (mode === 'kitchen') {
      area.innerHTML =
        '<div class="p-center"><div class="p-cafe">' + h(s.cafeName) + '</div>' +
        '<div class="p-sub">تذكرة مطبخ</div></div>' +
        '<div class="p-line"></div>' +
        '<div class="p-center" style="font-size:22px;font-weight:800">#' + h(order.seq || order.number) + '</div>' +
        '<div class="p-row"><span>' + h(S.typeLabel(order.type)) + (order.table ? ' · ترابيزة ' + h(order.table) : '') + '</span><span>' + U.fmtTime(order.createdAt) + '</span></div>' +
        (order.customer ? '<div class="p-row"><span>العميل</span><span>' + h(order.customer) + '</span></div>' : '') +
        '<div class="p-line"></div>' +
        items +
        (order.note ? '<div class="p-line"></div><div class="p-note">📝 ' + h(order.note) + '</div>' : '') +
        '<div class="p-line"></div>' +
        '<div class="p-center p-small">' + h(order.createdBy || '') + '</div>';
    } else {
      var totals = '<div class="p-row"><span>الإجمالي الفرعي</span><span>' + U.fmtPrice(order.subtotal) + '</span></div>';
      if (order.discount) totals += '<div class="p-row"><span>خصم</span><span>-' + U.fmtPrice(order.discount) + '</span></div>';
      if (order.service) totals += '<div class="p-row"><span>خدمة</span><span>' + U.fmtPrice(order.service) + '</span></div>';
      if (order.tax) totals += '<div class="p-row"><span>ضريبة</span><span>' + U.fmtPrice(order.tax) + '</span></div>';
      if (order.delivery) totals += '<div class="p-row"><span>توصيل</span><span>' + U.fmtPrice(order.delivery) + '</span></div>';
      totals += '<div class="p-line"></div><div class="p-row p-total"><span>الإجمالي</span><span>' + U.fmtPrice(order.total) + ' ' + h(cur) + '</span></div>';

      area.innerHTML =
        '<div class="p-center"><div class="p-cafe">' + h(s.cafeName) + '</div>' +
        (s.address ? '<div class="p-sub">' + h(s.address) + '</div>' : '') +
        (s.phone ? '<div class="p-sub">' + h(s.phone) + '</div>' : '') + '</div>' +
        '<div class="p-line"></div>' +
        '<div class="p-row"><span>فاتورة #' + h(order.number) + '</span><span>' + U.fmtDateShort(order.createdAt) + '</span></div>' +
        '<div class="p-row"><span>' + h(S.typeLabel(order.type)) + (order.table ? ' · ترابيزة ' + h(order.table) : '') + '</span><span>' + U.fmtTime(order.createdAt) + '</span></div>' +
        '<div class="p-row"><span>الكاشير</span><span>' + h(order.createdBy || '') + '</span></div>' +
        (order.customer ? '<div class="p-row"><span>العميل</span><span>' + h(order.customer) + (order.phone ? ' · ' + h(order.phone) : '') + '</span></div>' : '') +
        '<div class="p-line"></div>' +
        items +
        '<div class="p-line"></div>' +
        totals +
        (order.payment
          ? '<div class="p-row"><span>الدفع</span><span>' + h(S.methodLabel(order.payment.method)) + '</span></div>' +
            '<div class="p-row"><span>المستلم</span><span>' + U.fmtPrice(order.payment.received) + '</span></div>' +
            '<div class="p-row"><span>الباقي</span><span>' + U.fmtPrice(order.payment.change) + '</span></div>'
          : '<div class="p-row"><span>الدفع</span><span>آجل</span></div>') +
        (order.note ? '<div class="p-line"></div><div class="p-note">📝 ' + h(order.note) + '</div>' : '') +
        '<div class="p-line"></div>' +
        '<div class="p-center p-small">' + h(s.receiptFooter || '') + '</div>' +
        '<div class="p-center p-barcode">' + h(order.number) + '</div>';
    }

    setTimeout(function () {
      try { window.print(); } catch (e) { U.toast('تعذر فتح الطباعة', { type: 'error' }); }
    }, 90);
  };

  /* ---------------- join link ---------------- */

  function handleJoinHash() {
    var hash = String(location.hash || '');
    var idx = hash.indexOf('#join=');
    if (idx === -1) return;
    var code = hash.slice(idx + 6);
    var cfg = S.parseJoinCode(decodeURIComponent(code));
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    if (!cfg) {
      U.toast('كود الربط غير صالح', { type: 'error' });
      return;
    }
    setTimeout(function () {
      U.confirm('ربط الجهاز بالكافيه', 'هيتم الاتصال بكود ' + cfg.cafeKey + ' وسحب الطلبات من السحابة. متأكد؟', { okText: 'ربط الجهاز' })
        .then(function (ok) {
          if (!ok) return;
          S.connect(cfg).then(function (res) {
            if (!res || res.cancelled) return;
            U.toast('تم ربط الجهاز ✓', { type: 'success' });
            render();
          }).catch(function (err) {
            U.toast(err.message || 'تعذر الربط', { type: 'error', duration: 5000 });
          });
        });
    }, 500);
  }

  /* ---------------- first run ---------------- */

  function firstRun() {
    var hasUser = true;
    try { hasUser = !!localStorage.getItem(S.LS.user); } catch (e) { hasUser = true; }
    if (hasUser) return;
    setTimeout(function () {
      if (S.draftCount() > 0) return;
      U.prompt('اسمك إيه؟', {
        message: 'الاسم ده هيظهر على الطلبات اللي بتعملها من الجهاز ده. تقدر تغيّره بعدين من الإعدادات.',
        placeholder: 'مثال: أحمد',
        okText: 'يلا نبدأ'
      }).then(function (value) {
        if (value && value.trim()) S.setUser(value.trim());
        App.renderHeader();
      });
    }, 700);
  }

  /* ---------------- boot ---------------- */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
    });
  }

  function autoConnect() {
    if (!S.cloudBoot) return;
    S.cloudBoot().then(function (res) {
      if (res) renderHeader();
    }).catch(function (err) {
      U.toast('تعذر الاتصال بالسحابة: ' + (err.message || ''), { type: 'error', duration: 5000 });
    });
  }

  function boot() {
    S.init();
    bindSubscriptions();
    render();
    firstRun();
    handleJoinHash();
    autoConnect();
    registerSW();

    setInterval(function () {
      if (current === 'orders') scheduleRender();
    }, 30000);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && current === 'orders') scheduleRender();
    });

    window.addEventListener('online', function () { App.renderHeader(); });
    window.addEventListener('offline', function () { App.renderHeader(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
