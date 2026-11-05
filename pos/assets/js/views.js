/* ============================================================
   Costa Rica Cafe — POS views
   ============================================================ */
(function () {
  'use strict';

  var App = window.App;
  var U = App.util;
  var S = App.store;
  var V = (App.views = {});
  var h = U.esc;

  function money(value) { return U.money(value, S.state.settings.currency); }

  function normAr(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ؤئ]/g, 'ء')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function icon(name) {
    var paths = {
      pos: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
      orders: '<path d="M4 5h16M4 12h16M4 19h10"/>',
      reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
      expenses: '<path d="M3 7h18v12H3z"/><path d="M3 7l3-3h12l3 3"/><path d="M16 13h3"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || '') + '</svg>';
  }
  App.icon = icon;

  function syncBanner() {
    var st = S.sync.status;
    if (st === 'local') {
      return '<div class="sync-banner">' +
        '<span>📵</span><div class="grow">الجهاز ده شغال لوحده. اربط الأجهزة ببعض عشان كل الأوردرات تظهر على كل التليفونات.</div>' +
        '<button data-act="goSync">ربط الأجهزة</button></div>';
    }
    if (st === 'offline') {
      return '<div class="sync-banner">' +
        '<span>📡</span><div class="grow">مفيش اتصال بالنت دلوقتي. الطلبات بتتحفظ على الجهاز وهتتزامن أول ما النت يرجع.</div></div>';
    }
    if (st === 'error') {
      return '<div class="sync-banner" style="background:var(--red-dim);border-color:rgba(248,113,113,.3);color:var(--red)">' +
        '<span>⚠️</span><div class="grow">' + h(S.sync.error || 'في مشكلة في المزامنة') + '</div>' +
        '<button data-act="goSync" style="background:var(--red);color:#2a0d0d">إصلاح</button></div>';
    }
    return '';
  }

  /* ============================================================
     POS
     ============================================================ */

  var POS = App.posState = App.posState || { cat: 'all', q: '', cartOpen: false };

  function draftQty(id) {
    var d = S.ensureDraft();
    return d.items[id] ? d.items[id].qty : 0;
  }

  function filteredCategories() {
    var q = normAr(POS.q);
    var out = [];
    S.categories().forEach(function (cat) {
      if (POS.cat !== 'all' && cat.id !== POS.cat) return;
      var items = cat.items.filter(function (item) { return !item.hidden; });
      if (q) {
        var catHit = normAr(cat.name).indexOf(q) !== -1;
        if (!catHit) {
          items = items.filter(function (item) {
            return normAr(item.name + ' ' + item.desc).indexOf(q) !== -1;
          });
        }
      }
      if (items.length) out.push({ cat: cat, items: items });
    });
    return out;
  }

  function catChips() {
    var html = '<button class="chip ' + (POS.cat === 'all' ? 'active' : '') + '" data-act="cat" data-id="all">الكل</button>';
    S.categories().forEach(function (cat) {
      if (!cat.items.some(function (i) { return !i.hidden; })) return;
      html += '<button class="chip ' + (POS.cat === cat.id ? 'active' : '') + '" data-act="cat" data-id="' + h(cat.id) + '">' +
        (cat.icon ? '<span>' + h(cat.icon) + '</span>' : '') + h(cat.name) + '</button>';
    });
    return html;
  }

  function itemCard(item) {
    var qty = draftQty(item.id);
    return '<button class="item-card ' + (qty ? 'in-cart' : '') + '" data-act="add" data-id="' + h(item.id) + '" data-item="' + h(item.id) + '">' +
      '<span class="nm">' + h(item.name) + '</span>' +
      '<span class="pr">' + U.fmtPrice(item.price) + ' <small>' + h(S.state.settings.currency) + '</small></span>' +
      (qty ? '<span class="qty">' + qty + '</span>' : '') +
      '</button>';
  }

  function posItemsHtml() {
    var groups = filteredCategories();
    if (!groups.length) {
      return '<div class="empty"><span class="big">🔍</span><strong>مفيش نتائج</strong><span>جرّب اسم تاني أو اختار قسم مختلف.</span></div>';
    }
    return groups.map(function (g) {
      return '<div class="cat-head"><span class="ic">' + h(g.cat.icon || '•') + '</span><h3>' + h(g.cat.name) + '</h3><span class="ln"></span></div>' +
        '<div class="items-grid">' + g.items.map(itemCard).join('') + '</div>';
    }).join('');
  }

  function totalsHtml(t) {
    var s = S.state.settings;
    var html = '<div class="tr"><span>الإجمالي الفرعي</span><b>' + money(t.subtotal) + '</b></div>';
    if (t.discount) html += '<div class="tr"><span>خصم</span><b>-' + money(t.discount) + '</b></div>';
    if (t.service) html += '<div class="tr"><span>خدمة ' + U.fmtPrice(s.serviceRate) + '%</span><b>' + money(t.service) + '</b></div>';
    if (t.tax) html += '<div class="tr"><span>ضريبة ' + U.fmtPrice(s.taxRate) + '%</span><b>' + money(t.tax) + '</b></div>';
    if (t.delivery) html += '<div class="tr"><span>توصيل</span><b>' + money(t.delivery) + '</b></div>';
    html += '<div class="tr grand"><span>الإجمالي</span><b>' + money(t.total) + '</b></div>';
    return html;
  }

  function cartInner() {
    var d = S.ensureDraft();
    var lines = S.draftLines();
    var t = S.draftTotals();
    var s = S.state.settings;

    var meta = '<div class="seg">' +
      '<button class="' + (d.type === 'dine' ? 'active' : '') + '" data-act="setType" data-type="dine">🍽️ صالة</button>' +
      '<button class="' + (d.type === 'take' ? 'active' : '') + '" data-act="setType" data-type="take">🥡 تيك أوي</button>' +
      '<button class="' + (d.type === 'delivery' ? 'active' : '') + '" data-act="setType" data-type="delivery">🛵 دليفري</button>' +
      '</div>';

    if (d.type === 'dine') {
      var opts = '<option value="">بدون</option>';
      for (var i = 1; i <= s.tables; i++) {
        opts += '<option value="' + i + '"' + (String(d.table) === String(i) ? ' selected' : '') + '>ترابيزة ' + i + '</option>';
      }
      meta += '<div class="mt8"><label class="lbl">الترابيزة</label><select data-change="table" id="cartTable">' + opts + '</select></div>';
    } else {
      meta += '<div class="mt8"><label class="lbl">اسم العميل (اختياري)</label>' +
        '<input type="text" data-change="field" data-field="customer" value="' + h(d.customer) + '" placeholder="اسم العميل"></div>';
      if (d.type === 'delivery') {
        meta += '<div class="form-row two mt8">' +
          '<div><label class="lbl">تليفون</label><input type="tel" inputmode="tel" data-change="field" data-field="phone" value="' + h(d.phone) + '" placeholder="01xxxxxxxxx"></div>' +
          '<div><label class="lbl">رسوم التوصيل</label><input type="number" inputmode="decimal" data-change="delivery" value="' + U.fmtPrice(d.delivery) + '"></div>' +
          '</div>' +
          '<div class="mt8"><label class="lbl">العنوان</label><input type="text" data-change="field" data-field="address" value="' + h(d.address) + '" placeholder="العنوان بالتفصيل"></div>';
      }
    }

    var linesHtml = lines.length ? lines.map(function (line) {
      var id = h(line.item.id);
      return '<li class="cart-line">' +
        '<div class="nm">' + h(line.item.name) + '<small>' + U.fmtPrice(line.item.price) + ' × ' + line.qty + '</small></div>' +
        '<div class="ln-total">' + money(line.total) + '</div>' +
        '<div class="note-row">' +
          '<button class="note-btn ' + (line.note ? 'has' : '') + '" data-act="noteItem" data-id="' + id + '">📝 ' + (line.note ? 'تعديل الملاحظة' : 'ملاحظة') + '</button>' +
          (line.note ? '<span class="item-note">' + h(line.note) + '</span>' : '') +
        '</div>' +
        '<div class="qty">' +
          '<button data-act="dec" data-id="' + id + '">−</button>' +
          '<span>' + line.qty + '</span>' +
          '<button data-act="inc" data-id="' + id + '">+</button>' +
        '</div>' +
        '</li>';
    }).join('') : '<li class="cart-empty"><div class="big">🛒</div><div>السلة فاضية — اضغط على أي صنف</div></li>';

    return '<div class="cart-head"><h2>🧾 الطلب الحالي</h2>' +
        '<div class="row" style="gap:4px">' +
          (lines.length ? '<button class="x" data-act="clearCart" aria-label="تفريغ السلة">🗑</button>' : '') +
          '<button class="x" data-act="closeCart" aria-label="إغلاق">✕</button>' +
        '</div></div>' +
      '<div class="cart-scroll">' +
        '<div class="cart-meta">' + meta + '</div>' +
        '<ul class="cart-lines">' + linesHtml + '</ul>' +
        '<textarea id="cartNote" data-change="note" rows="2" placeholder="ملاحظات على الطلب (اختياري)">' + h(d.note) + '</textarea>' +
        '<div class="disc-row mt12">' +
          '<span class="lbl2">خصم</span>' +
          '<input id="cartDiscount" type="number" inputmode="decimal" min="0" value="' + (d.discountValue || '') + '" placeholder="0">' +
          '<div class="mini-seg">' +
            '<button class="' + (d.discountType === 'amount' ? 'active' : '') + '" data-act="discType" data-type="amount">' + h(s.currency) + '</button>' +
            '<button class="' + (d.discountType === 'percent' ? 'active' : '') + '" data-act="discType" data-type="percent">%</button>' +
          '</div>' +
        '</div>' +
        '<div class="totals mt12" id="cartTotals">' + totalsHtml(t) + '</div>' +
      '</div>' +
      '<div class="cart-foot">' +
        '<div class="row">' +
          '<button class="btn ghost" data-act="saveUnpaid" ' + (lines.length ? '' : 'disabled') + '>📤 حفظ آجل</button>' +
          '<button class="btn primary" id="payBtn" data-act="payNow" ' + (lines.length ? '' : 'disabled') + '>💵 تحصيل ' + money(t.total) + '</button>' +
        '</div>' +
      '</div>';
  }

  function cartBarHtml() {
    var count = S.draftCount();
    var total = S.draftTotals().total;
    return '<div class="cicon">🛒' + (count ? '<span class="badge">' + count + '</span>' : '') + '</div>' +
      '<div class="ctext"><b>' + money(total) + '</b><span>' + (count ? count + ' صنف في السلة' : 'السلة فاضية') + '</span></div>' +
      '<button class="go" data-act="openCart">عرض السلة</button>';
  }

  V.pos = {
    html: function () {
      S.ensureDraft();
      return syncBanner() +
        '<div class="pos-layout">' +
          '<section class="pos-main">' +
            '<div class="pos-tools">' +
              '<div class="searchbox">' +
                '<span class="ic">🔍</span>' +
                '<input id="posSearch" type="search" autocomplete="off" placeholder="ابحث عن صنف… (لاتيه، موهيتو، شيشة)" value="' + h(POS.q) + '">' +
                '<button class="clr ' + (POS.q ? 'show' : '') + '" data-act="clearSearch" aria-label="مسح">✕</button>' +
              '</div>' +
              '<div class="chips" id="posCats">' + catChips() + '</div>' +
            '</div>' +
            '<div id="posItems">' + posItemsHtml() + '</div>' +
          '</section>' +
          '<aside class="cart-panel ' + (POS.cartOpen ? 'open' : '') + '" id="cartPanel">' + cartInner() + '</aside>' +
        '</div>' +
        '<div class="cartbar ' + (S.draftCount() ? 'show' : '') + '" id="cartBar">' + cartBarHtml() + '</div>';
    },

    mount: function () {
      var input = document.getElementById('posSearch');
      if (input) {
        input.addEventListener('input', function () {
          POS.q = input.value;
          var clr = document.querySelector('.searchbox .clr');
          if (clr) clr.classList.toggle('show', !!POS.q);
          renderPosItems();
        });
      }
      if (POS.cartOpen) document.body.classList.add('no-scroll');
    },

    onDraft: function () {
      renderCart();
      updateCartBar();
      updateItemBadges();
    },

    actions: {
      add: function (el) {
        if (S.addToDraft(el.dataset.id)) {
          U.unlockAudio();
          if (navigator.vibrate) U.vibrate(12);
        }
      },
      cat: function (el) {
        POS.cat = el.dataset.id;
        var box = document.getElementById('posCats');
        if (box) box.innerHTML = catChips();
        renderPosItems();
      },
      clearSearch: function () {
        POS.q = '';
        var input = document.getElementById('posSearch');
        if (input) { input.value = ''; input.focus(); }
        var clr = document.querySelector('.searchbox .clr');
        if (clr) clr.classList.remove('show');
        renderPosItems();
      },
      openCart: function () {
        POS.cartOpen = true;
        var panel = document.getElementById('cartPanel');
        if (panel) panel.classList.add('open');
        document.body.classList.add('no-scroll');
        renderCart();
      },
      closeCart: function () {
        POS.cartOpen = false;
        var panel = document.getElementById('cartPanel');
        if (panel) panel.classList.remove('open');
        document.body.classList.remove('no-scroll');
      },
      inc: function (el) { S.setDraftQty(el.dataset.id, draftQty(el.dataset.id) + 1); },
      dec: function (el) { S.setDraftQty(el.dataset.id, draftQty(el.dataset.id) - 1); },
      setType: function (el) { S.setDraftField('type', el.dataset.type); renderCart(); },
      discType: function (el) {
        var d = S.ensureDraft();
        d.discountType = el.dataset.type;
        S.saveDraft();
        renderCart();
      },
      noteItem: function (el) {
        var id = el.dataset.id;
        var d = S.ensureDraft();
        var current = d.items[id] ? d.items[id].note : '';
        U.prompt('ملاحظة على الصنف', {
          value: current,
          placeholder: 'مثال: سكر زيادة، بدون ثلج…',
          okText: 'حفظ'
        }).then(function (value) {
          if (value === null) return;
          S.setDraftNote(id, value);
        });
      },
      clearCart: function () {
        if (!S.draftCount()) return;
        U.confirm('تفريغ السلة', 'هيتم مسح كل الأصناف من الطلب الحالي.', { danger: true, okText: 'تفريغ' })
          .then(function (ok) {
            if (!ok) return;
            S.resetDraft();
            U.toast('تم تفريغ السلة');
          });
      },
      saveUnpaid: function () {
        var lines = S.draftLines();
        if (!lines.length) return;
        S.createOrderFromDraft(null).then(function (order) {
          afterOrder(order, false);
        }).catch(function (err) {
          U.toast(err.message || 'تعذر حفظ الطلب', { type: 'error' });
        });
      },
      payNow: function () {
        var lines = S.draftLines();
        if (!lines.length) return;
        var t = S.draftTotals();
        openPaymentModal(t.total, 'تحصيل الطلب', function (payment) {
          S.createOrderFromDraft(payment).then(function (order) {
            afterOrder(order, true);
          }).catch(function (err) {
            U.toast(err.message || 'تعذر حفظ الطلب', { type: 'error' });
          });
        });
      },
      goSync: function () { location.hash = '#settings'; }
    }
  };

  function afterOrder(order, paid) {
    S.resetDraft();
    POS.cartOpen = false;
    var panel = document.getElementById('cartPanel');
    if (panel) panel.classList.remove('open');
    document.body.classList.remove('no-scroll');

    U.beep(paid ? 'success' : 'notify');
    U.vibrate([60, 40, 60]);
    U.toast((paid ? 'تم تحصيل الطلب #' : 'تم إرسال الطلب #') + order.seq, {
      type: 'success',
      actionLabel: '🖨️ طباعة',
      onAction: function () { App.printOrder(order, 'receipt'); }
    });
    if (S.state.settings.autoPrint) {
      setTimeout(function () { App.printOrder(order, 'receipt'); }, 250);
    }
  }

  function renderPosItems() {
    var box = document.getElementById('posItems');
    if (box) box.innerHTML = posItemsHtml();
  }

  function renderCart() {
    var panel = document.getElementById('cartPanel');
    if (!panel) return;
    var ae = document.activeElement;
    if (ae && panel.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    var scroller = panel.querySelector('.cart-scroll');
    var top = scroller ? scroller.scrollTop : 0;
    panel.innerHTML = cartInner();
    var next = panel.querySelector('.cart-scroll');
    if (next) next.scrollTop = top;
  }

  function updateCartBar() {
    var bar = document.getElementById('cartBar');
    if (!bar) return;
    bar.innerHTML = cartBarHtml();
    bar.classList.toggle('show', S.draftCount() > 0);
  }

  function updateItemBadges() {
    var d = S.ensureDraft();
    document.querySelectorAll('[data-item]').forEach(function (card) {
      var id = card.getAttribute('data-item');
      var qty = d.items[id] ? d.items[id].qty : 0;
      card.classList.toggle('in-cart', qty > 0);
      var badge = card.querySelector('.qty');
      if (qty > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'qty';
          card.appendChild(badge);
        }
        badge.textContent = qty;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  V.pos.updateTotals = function () {
    var box = document.getElementById('cartTotals');
    if (box) box.innerHTML = totalsHtml(S.draftTotals());
    var pay = document.getElementById('payBtn');
    if (pay) pay.innerHTML = '💵 تحصيل ' + money(S.draftTotals().total);
  };

  /* ---------------- shared payment modal ---------------- */

  function openPaymentModal(total, title, onConfirm) {
    var method = 'cash';
    var methods = S.paymentMethods;
    var m = U.modal(
      '<h3>' + h(title) + '</h3>' +
      '<p class="m-sub">الإجمالي المطلوب <b style="color:var(--gold)">' + money(total) + '</b></p>' +
      '<div class="pay-methods">' +
        methods.map(function (pm) {
          return '<button type="button" data-method="' + pm.id + '" class="' + (pm.id === 'cash' ? 'active' : '') + '">' +
            '<span class="e">' + pm.icon + '</span>' + h(pm.name) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="m-body mt12">' +
        '<div><label class="lbl">المبلغ المستلم</label>' +
          '<input id="payReceived" type="number" inputmode="decimal" step="0.5" value="' + U.fmtPrice(total) + '"></div>' +
        '<div class="change-box" id="changeBox"><span>الباقي</span><b>0</b></div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn ghost" data-pay-cancel type="button">إلغاء</button>' +
        '<button class="btn primary" data-pay-ok type="button">تأكيد التحصيل</button>' +
      '</div>'
    );

    var input = m.el.querySelector('#payReceived');
    var box = m.el.querySelector('#changeBox');
    var ok = m.el.querySelector('[data-pay-ok]');

    function currentReceived() {
      if (method !== 'cash') return total;
      return U.num(input.value);
    }

    function refresh() {
      var received = currentReceived();
      var change = U.round(received - total);
      box.classList.toggle('neg', change < 0);
      box.querySelector('b').textContent = U.fmtPrice(Math.max(0, change)) + ' ' + S.state.settings.currency;
      if (change < 0) box.querySelector('span').textContent = 'المبلغ ناقص';
      else box.querySelector('span').textContent = 'الباقي';
      ok.disabled = change < 0;
    }

    m.el.querySelectorAll('[data-method]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        method = btn.getAttribute('data-method');
        m.el.querySelectorAll('[data-method]').forEach(function (b) { b.classList.toggle('active', b === btn); });
        if (method !== 'cash') input.value = U.fmtPrice(total);
        input.disabled = method !== 'cash';
        refresh();
      });
    });

    input.addEventListener('input', refresh);
    refresh();

    m.el.querySelector('[data-pay-cancel]').addEventListener('click', function () { m.close(); });
    ok.addEventListener('click', function () {
      var received = method === 'cash' ? U.num(input.value) : total;
      if (received < total) return;
      m.close();
      onConfirm({ method: method, received: received });
    });
  }

  App.openPaymentModal = openPaymentModal;

  /* ============================================================
     Orders
     ============================================================ */

  var OS = App.ordersState = App.ordersState || { filter: 'active', allDays: false };

  var STATUS_FLOW = { new: 'preparing', preparing: 'ready', ready: 'served', served: 'paid' };
  var STATUS_NEXT_LABEL = { new: '▶️ بدء التحضير', preparing: '✅ جاهز', ready: '🍽️ تم التقديم', served: '💵 تحصيل' };

  function orderCard(o) {
    var active = ['new', 'preparing', 'ready', 'served'].indexOf(o.status) !== -1;
    var badge = '<span class="badge ' + o.status + '">' + S.statusLabel(o.status) + '</span>';
    if (o.status !== 'cancelled' && !o.payment) badge += '<span class="badge due">آجل</span>';
    if (o.payment) badge += '<span class="badge cash">' + h(S.methodLabel(o.payment.method)) + '</span>';

    var items = (o.items || []).map(function (it) {
      return '<li><b>' + it.qty + '×</b><span>' + h(it.name) + (it.note ? ' <i style="color:var(--gold);font-style:normal">(' + h(it.note) + ')</i>' : '') + '</span></li>';
    }).join('');

    var actions = '';
    if (active) {
      if (o.status !== 'served') {
        actions += '<button class="btn sm blue" data-act="advance" data-id="' + h(o.id) + '">' + STATUS_NEXT_LABEL[o.status] + '</button>';
      }
      if (!o.payment) actions += '<button class="btn sm green" data-act="pay" data-id="' + h(o.id) + '">💵 تحصيل</button>';
      actions += '<button class="btn sm ghost" data-act="printKitchen" data-id="' + h(o.id) + '" title="طباعة للمطبخ">🖨️</button>';
      actions += '<button class="btn sm ghost" data-act="cancel" data-id="' + h(o.id) + '" title="إلغاء">✕</button>';
    } else if (o.status === 'paid') {
      actions += '<button class="btn sm ghost" data-act="print" data-id="' + h(o.id) + '">🖨️ إيصال</button>';
    }

    return '<article class="order-card s-' + o.status + '">' +
      '<div class="oc-head">' +
        '<div class="oc-num">#' + h(o.seq || o.number) + ' <span class="type">' + S.typeLabel(o.type) + (o.table ? ' · ' + h(o.table) : '') + '</span></div>' +
        '<div class="oc-time">' + U.fmtTime(o.createdAt) + ' · ' + U.ago(o.createdAt) + '</div>' +
      '</div>' +
      '<div class="oc-badges">' + badge + (o.createdBy ? '<span class="badge served">👤 ' + h(o.createdBy) + '</span>' : '') + '</div>' +
      '<ul class="oc-items">' + items + '</ul>' +
      (o.note ? '<div class="oc-note">📝 ' + h(o.note) + '</div>' : '') +
      (o.customer ? '<div class="small muted" style="margin-bottom:6px">👤 ' + h(o.customer) + (o.phone ? ' · ' + h(o.phone) : '') + '</div>' : '') +
      '<div class="oc-foot">' +
        '<div class="oc-total">' + money(o.total) + '</div>' +
        '<div class="oc-actions">' + actions + '</div>' +
      '</div>' +
      '</article>';
  }

  function filteredOrders() {
    var list = S.orderList();
    if (!OS.allDays) {
      var from = U.startOfDay();
      list = list.filter(function (o) { return Number(o.createdAt) >= from; });
    }
    if (OS.filter === 'active') list = list.filter(function (o) { return ['new', 'preparing', 'ready', 'served'].indexOf(o.status) !== -1; });
    else if (OS.filter !== 'all') list = list.filter(function (o) { return o.status === OS.filter; });
    if (OS.filter === 'active') list.sort(function (a, b) { return Number(a.createdAt) - Number(b.createdAt); });
    else list.sort(function (a, b) { return Number(b.createdAt) - Number(a.createdAt); });
    return list;
  }

  V.orders = {
    html: function () {
      var all = S.orderList().filter(function (o) { return Number(o.createdAt) >= U.startOfDay(); });
      var counts = { active: 0, new: 0, preparing: 0, ready: 0, paid: 0, cancelled: 0 };
      all.forEach(function (o) {
        if (['new', 'preparing', 'ready', 'served'].indexOf(o.status) !== -1) counts.active++;
        if (counts[o.status] !== undefined) counts[o.status]++;
      });
      var list = filteredOrders();
      var chips = [
        ['active', 'الشغالين', counts.active],
        ['new', 'جديد', counts.new],
        ['preparing', 'تحضير', counts.preparing],
        ['ready', 'جاهز', counts.ready],
        ['paid', 'مدفوع', counts.paid],
        ['cancelled', 'ملغي', counts.cancelled],
        ['all', 'الكل', all.length]
      ];

      return syncBanner() +
        '<div class="page-head">' +
          '<div><h1>📋 الطلبات</h1><p>الطلبات بتظهر هنا لحظياً على كل الأجهزة المتصلة</p></div>' +
          '<div class="actions">' +
            '<button class="btn sm ' + (OS.allDays ? 'primary' : 'ghost') + '" data-act="toggleDays">' + (OS.allDays ? 'كل الأيام ✓' : 'كل الأيام') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="chips" style="margin-bottom:12px">' +
          chips.map(function (c) {
            return '<button class="chip ' + (OS.filter === c[0] ? 'active' : '') + '" data-act="filter" data-id="' + c[0] + '">' +
              c[1] + ' <span class="cnt">' + c[2] + '</span></button>';
          }).join('') +
        '</div>' +
        (list.length
          ? '<div class="orders-grid">' + list.map(orderCard).join('') + '</div>'
          : '<div class="empty"><span class="big">☕</span><strong>مفيش طلبات هنا</strong><span>الطلبات الجديدة هتظهر تلقائياً مع صوت تنبيه.</span><button class="btn primary sm mt8" data-act="goPos">➕ أضف طلب</button></div>');
    },
    mount: function () {},
    actions: {
      filter: function (el) { OS.filter = el.dataset.id; App.render(); },
      toggleDays: function () { OS.allDays = !OS.allDays; App.render(); },
      goPos: function () { location.hash = '#pos'; },
      advance: function (el) {
        var o = S.getOrder(el.dataset.id);
        if (!o) return;
        var next = STATUS_FLOW[o.status];
        if (!next) return;
        if (next === 'paid') {
          App.openPaymentModal(o.total, 'تحصيل الطلب #' + (o.seq || o.number), function (payment) {
            S.payOrder(o.id, payment);
            U.beep('success');
            U.toast('تم تحصيل ' + money(o.total), { type: 'success' });
          });
          return;
        }
        S.setOrderStatus(o.id, next);
        U.beep('notify');
      },
      pay: function (el) {
        var o = S.getOrder(el.dataset.id);
        if (!o) return;
        App.openPaymentModal(o.total, 'تحصيل الطلب #' + (o.seq || o.number), function (payment) {
          S.payOrder(o.id, payment);
          U.beep('success');
          U.toast('تم تحصيل ' + money(o.total), { type: 'success' });
        });
      },
      cancel: function (el) {
        var o = S.getOrder(el.dataset.id);
        if (!o) return;
        U.prompt('إلغاء الطلب #' + (o.seq || o.number), { placeholder: 'سبب الإلغاء (اختياري)', okText: 'تأكيد الإلغاء' })
          .then(function (reason) {
            if (reason === null) return;
            S.cancelOrder(o.id, reason);
            U.toast('تم إلغاء الطلب', { type: 'error' });
          });
      },
      print: function (el) { var o = S.getOrder(el.dataset.id); if (o) App.printOrder(o, 'receipt'); },
      printKitchen: function (el) { var o = S.getOrder(el.dataset.id); if (o) App.printOrder(o, 'kitchen'); },
      goSync: function () { location.hash = '#settings'; }
    }
  };

  /* ============================================================
     Reports
     ============================================================ */

  var RS = App.reportsState = App.reportsState || { range: 'today', from: '', to: '' };

  function rangeOf() {
    return S.rangeFor(RS.range, RS.from, RS.to);
  }

  function hourlyChart(byHour) {
    var max = Math.max.apply(null, byHour.map(function (x) { return x.total; }).concat([1]));
    var bars = '';
    for (var i = 0; i < 24; i++) {
      var val = byHour[i].total;
      var bh = max ? (val / max) * 64 : 0;
      bars += '<rect x="' + (i * 10 + 1) + '" y="' + (72 - bh) + '" width="7" height="' + Math.max(bh, val > 0 ? 1.5 : 0) + '" rx="1.5" fill="' + (val > 0 ? 'url(#goldgrad)' : '#2b251f') + '"></rect>';
    }
    var labels = '';
    [0, 6, 12, 18, 23].forEach(function (hr) {
      labels += '<text x="' + (hr * 10 + 4.5) + '" y="80" font-size="5" fill="#7d7468" text-anchor="middle">' + hr + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 240 84">' +
      '<defs><linearGradient id="goldgrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#f0d7a6"/><stop offset="100%" stop-color="#d8b477"/>' +
      '</linearGradient></defs>' + bars + labels + '</svg>';
  }

  function shiftCard() {
    var shift = S.currentShift();
    if (!shift) {
      return '<div class="card"><h3>🧾 الوردية</h3>' +
        '<p class="small muted" style="margin-bottom:10px">مفيش وردية مفتوحة. افتح وردية عشان تقفل الدرج وتحسب الفرق في آخر اليوم.</p>' +
        '<button class="btn primary sm" data-act="openShift">▶️ فتح وردية</button></div>';
    }
    var st = S.shiftStats(shift.id);
    return '<div class="card"><h3>🧾 الوردية مفتوحة</h3>' +
      '<div class="kv"><span>بدأت</span><b>' + U.fmtTime(shift.openedAt) + ' · ' + U.fmtDateShort(shift.openedAt) + '</b></div>' +
      '<div class="kv"><span>الكاشير</span><b>' + h(shift.openedBy || '') + '</b></div>' +
      '<div class="kv"><span>النقدية الافتتاحية</span><b>' + money(shift.openingCash) + '</b></div>' +
      '<div class="kv"><span>مبيعات الوردية</span><b>' + money(st.sales) + ' · ' + st.orders + ' طلب</b></div>' +
      '<div class="kv"><span>مبيعات كاش</span><b>' + money(st.cashSales) + '</b></div>' +
      '<div class="kv"><span>مصاريف كاش</span><b>' + money(st.expenses) + '</b></div>' +
      '<div class="kv"><span>المتوقع في الدرج</span><b style="color:var(--gold)">' + money(st.expected) + '</b></div>' +
      '<div class="row mt12"><button class="btn primary sm" data-act="closeShift">🔒 إغلاق الوردية</button>' +
      '<button class="btn ghost sm" data-act="shiftHistory">📜 السجل</button></div></div>';
  }

  function barRows(items, valueKey) {
    var max = Math.max.apply(null, items.map(function (x) { return U.num(x[valueKey]); }).concat([1]));
    return items.map(function (it) {
      var pct = Math.round((U.num(it[valueKey]) / max) * 100);
      return '<div class="bar-row"><span class="n">' + h(it.name) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + pct + '%"></span></span>' +
        '<span class="v">' + (valueKey === 'count' ? it.count : money(it[valueKey])) + '</span></div>';
    }).join('');
  }

  V.reports = {
    html: function () {
      var range = rangeOf();
      var st = S.stats(range.from, range.to);
      var paymentRows = Object.keys(st.byPayment).map(function (k) {
        return { name: S.methodLabel(k), count: st.byPayment[k].count, total: st.byPayment[k].total };
      }).sort(function (a, b) { return b.total - a.total; });

      var typeRows = [
        { name: '🍽️ صالة', count: st.byType.dine.count, total: st.byType.dine.total },
        { name: '🥡 تيك أوي', count: st.byType.take.count, total: st.byType.take.total },
        { name: '🛵 دليفري', count: st.byType.delivery.count, total: st.byType.delivery.total }
      ];

      var top = st.topItems.slice(0, 12);
      var ranges = [['today', 'اليوم'], ['yesterday', 'أمس'], ['week', '٧ أيام'], ['month', 'الشهر'], ['custom', 'مخصص']];

      return '<div class="page-head">' +
          '<div><h1>📊 الحسابات</h1><p>' + U.fmtDate(range.from) + (range.from !== range.to ? ' — ' + U.fmtDate(range.to) : '') + '</p></div>' +
          '<div class="actions">' +
            '<button class="btn sm ghost" data-act="exportOrders">⬇️ طلبات CSV</button>' +
            '<button class="btn sm ghost" data-act="exportItems">⬇️ أصناف CSV</button>' +
          '</div>' +
        '</div>' +
        '<div class="chips" style="margin-bottom:12px">' +
          ranges.map(function (r) {
            return '<button class="chip ' + (RS.range === r[0] ? 'active' : '') + '" data-act="range" data-id="' + r[0] + '">' + r[1] + '</button>';
          }).join('') +
        '</div>' +
        (RS.range === 'custom'
          ? '<div class="card" style="margin-bottom:12px"><div class="form-row two">' +
            '<div><label class="lbl">من</label><input type="date" data-change="from" value="' + h(RS.from) + '"></div>' +
            '<div><label class="lbl">إلى</label><input type="date" data-change="to" value="' + h(RS.to) + '"></div>' +
            '</div></div>'
          : '') +

        '<div class="grid2">' +
          '<div class="stat gold"><div class="k">💰 المبيعات</div><div class="v">' + money(st.sales) + '</div></div>' +
          '<div class="stat green"><div class="k">✅ المحصّل</div><div class="v">' + money(st.collected) + '</div></div>' +
          '<div class="stat"><div class="k">🧾 عدد الطلبات</div><div class="v">' + st.orders + '</div></div>' +
          '<div class="stat"><div class="k">📈 متوسط الفاتورة</div><div class="v">' + money(st.avg) + '</div></div>' +
          '<div class="stat red"><div class="k">💸 المصاريف</div><div class="v">' + money(st.expenses) + '</div></div>' +
          '<div class="stat ' + (st.net >= 0 ? 'green' : 'red') + '"><div class="k">📊 الصافي</div><div class="v">' + money(st.net) + '</div></div>' +
        '</div>' +

        (st.due > 0 ? '<div class="hint mt12">⏳ في <b>' + money(st.due) + '</b> آجل على ' + st.dueCount + ' طلب لسه ما اتحصّلوش.</div>' : '') +

        '<div class="reports-grid mt12">' +
          '<div>' +
            '<div class="card"><h3>🕒 المبيعات على مدار اليوم</h3>' + hourlyChart(st.byHour) + '</div>' +
            '<div class="card"><h3>🏆 الأصناف الأكثر مبيعاً</h3>' +
              (top.length
                ? '<div class="list">' + top.map(function (it, i) {
                    return '<div class="list-row"><span class="badge served">#' + (i + 1) + '</span>' +
                      '<div class="grow"><div class="t">' + h(it.name) + '</div><div class="s">' + it.qty + ' وحدة</div></div>' +
                      '<div class="amt">' + money(it.revenue) + '</div></div>';
                  }).join('') + '</div>'
                : '<p class="small muted">مفيش مبيعات في الفترة دي.</p>') +
            '</div>' +
            '<div class="card"><h3>🗂️ المبيعات حسب القسم</h3>' +
              (st.byCategory.length ? barRows(st.byCategory, 'revenue') : '<p class="small muted">—</p>') +
            '</div>' +
          '</div>' +
          '<div>' +
            shiftCard() +
            '<div class="card"><h3>💳 طرق الدفع</h3>' +
              (paymentRows.length ? barRows(paymentRows, 'total') : '<p class="small muted">مفيش تحصيل في الفترة دي.</p>') +
            '</div>' +
            '<div class="card"><h3>🧾 أنواع الطلبات</h3>' +
              barRows(typeRows, 'total') +
            '</div>' +
            '<div class="card"><h3>💸 المصاريف</h3>' +
              '<div class="kv"><span>إجمالي مصاريف الفترة</span><b style="color:var(--red)">' + money(st.expenses) + '</b></div>' +
              '<div class="row mt12"><button class="btn ghost sm" data-act="goExpenses">➕ إضافة مصروف</button>' +
              '<button class="btn ghost sm" data-act="exportExpenses">⬇️ CSV</button></div>' +
            '</div>' +
            '<div class="card"><h3>🗃️ نسخة احتياطية</h3>' +
              '<p class="small muted" style="margin-bottom:10px">نزّل نسخة من كل البيانات (طلبات، منيو، إعدادات) واحتفظ بيها.</p>' +
              '<button class="btn ghost sm block" data-act="backup">⬇️ تنزيل نسخة JSON</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    },
    mount: function () {},
    actions: {
      range: function (el) {
        RS.range = el.dataset.id;
        if (RS.range === 'custom' && !RS.from) {
          RS.from = U.dateKey();
          RS.to = U.dateKey();
        }
        App.render();
      },
      goExpenses: function () { location.hash = '#expenses'; },
      exportOrders: function () {
        var r = rangeOf();
        U.download('orders-' + U.dateKey() + '.csv', S.exportOrdersCSV(r.from, r.to), 'text/csv;charset=utf-8');
      },
      exportItems: function () {
        var r = rangeOf();
        U.download('items-' + U.dateKey() + '.csv', S.exportItemsCSV(r.from, r.to), 'text/csv;charset=utf-8');
      },
      exportExpenses: function () {
        var r = rangeOf();
        U.download('expenses-' + U.dateKey() + '.csv', S.exportExpensesCSV(r.from, r.to), 'text/csv;charset=utf-8');
      },
      backup: function () {
        U.download('costa-rica-backup-' + U.dateKey() + '.json', JSON.stringify(S.exportData(), null, 2), 'application/json');
      },
      openShift: function () {
        U.prompt('فتح وردية', {
          message: 'اكتب النقدية الافتتاحية في الدرج',
          type: 'number',
          value: '0',
          okText: 'فتح الوردية'
        }).then(function (value) {
          if (value === null) return;
          S.openShift(U.num(value));
          U.toast('تم فتح الوردية ✓', { type: 'success' });
        });
      },
      closeShift: function () {
        var shift = S.currentShift();
        if (!shift) return;
        var st = S.shiftStats(shift.id);
        var m = U.modal(
          '<h3>إغلاق الوردية</h3>' +
          '<p class="m-sub">المتوقع في الدرج <b style="color:var(--gold)">' + money(st.expected) + '</b></p>' +
          '<div class="m-body">' +
            '<div><label class="lbl">النقدية المعدودة فعلياً</label><input id="countedCash" type="number" inputmode="decimal" value="' + U.fmtPrice(st.expected) + '"></div>' +
            '<div class="change-box" id="diffBox"><span>الفرق</span><b>0</b></div>' +
            '<div><label class="lbl">ملاحظات</label><textarea id="shiftNote" rows="2" placeholder="اختياري"></textarea></div>' +
          '</div>' +
          '<div class="modal-actions"><button class="btn ghost" data-cancel type="button">إلغاء</button>' +
          '<button class="btn primary" data-ok type="button">إغلاق الوردية</button></div>'
        );
        var input = m.el.querySelector('#countedCash');
        var box = m.el.querySelector('#diffBox');
        function refresh() {
          var diff = U.round(U.num(input.value) - st.expected);
          box.querySelector('b').textContent = (diff >= 0 ? '+' : '') + U.fmtPrice(diff) + ' ' + S.state.settings.currency;
          box.querySelector('b').style.color = diff === 0 ? 'var(--green)' : diff > 0 ? 'var(--amber)' : 'var(--red)';
        }
        input.addEventListener('input', refresh);
        refresh();
        m.el.querySelector('[data-cancel]').addEventListener('click', function () { m.close(); });
        m.el.querySelector('[data-ok]').addEventListener('click', function () {
          S.closeShift(U.num(input.value), m.el.querySelector('#shiftNote').value);
          m.close();
          U.toast('تم إغلاق الوردية ✓', { type: 'success' });
        });
      },
      shiftHistory: function () {
        var shifts = S.shiftList().slice(0, 30);
        U.modal(
          '<h3>سجل الورديات</h3>' +
          '<p class="m-sub">آخر ' + shifts.length + ' وردية</p>' +
          '<div class="list">' + (shifts.length ? shifts.map(function (s) {
            var st = s.totals || S.shiftStats(s.id);
            return '<div class="list-row"><div class="grow">' +
              '<div class="t">' + U.fmtDateShort(s.openedAt) + ' · ' + U.fmtTime(s.openedAt) + ' → ' + (s.closedAt ? U.fmtTime(s.closedAt) : 'مفتوحة') + '</div>' +
              '<div class="s">' + h(s.openedBy || '') + ' · ' + (st.orders || 0) + ' طلب · متوقع ' + money(st.expected) + (s.countedCash !== undefined ? ' · معدود ' + money(s.countedCash) + ' · فرق ' + money(s.difference) : '') + '</div>' +
              '</div></div>';
          }).join('') : '<p class="small muted">مفيش ورديات مسجلة.</p>') + '</div>',
          { wide: true }
        );
      }
    }
  };

  /* ============================================================
     Expenses
     ============================================================ */

  var ES = App.expensesState = App.expensesState || { range: 'today' };

  function expensesRange() {
    var now = new Date();
    if (ES.range === 'today') return { from: U.startOfDay(now), to: U.endOfDay(now) };
    if (ES.range === 'week') return { from: U.startOfDay(U.addDays(now, -6)), to: U.endOfDay(now) };
    if (ES.range === 'month') return { from: U.startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: U.endOfDay(now) };
    return { from: 0, to: Date.now() + 86400000 };
  }

  V.expenses = {
    html: function () {
      var r = expensesRange();
      var list = S.expenseList().filter(function (e) {
        var t = e.date ? U.startOfDay(e.date) : Number(e.createdAt);
        return t >= r.from && t <= r.to;
      });
      var total = list.reduce(function (s, e) { return s + U.num(e.amount); }, 0);
      var cats = S.expenseCategories;

      return '<div class="page-head"><div><h1>💸 المصاريف</h1><p>سجّل كل مصروف عشان الصافي يطلع صح</p></div></div>' +
        '<div class="card">' +
          '<h3>➕ مصروف جديد</h3>' +
          '<div class="form-row two">' +
            '<div><label class="lbl">البند</label><input id="expTitle" type="text" placeholder="مثال: بن، لبن، كهربا"></div>' +
            '<div><label class="lbl">المبلغ</label><input id="expAmount" type="number" inputmode="decimal" placeholder="0"></div>' +
          '</div>' +
          '<div class="form-row two mt8">' +
            '<div><label class="lbl">التصنيف</label><select id="expCat">' +
              cats.map(function (c) { return '<option value="' + c.id + '">' + h(c.name) + '</option>'; }).join('') +
            '</select></div>' +
            '<div><label class="lbl">التاريخ</label><input id="expDate" type="date" value="' + U.dateKey() + '"></div>' +
          '</div>' +
          '<div class="mt8"><label class="lbl">ملاحظات</label><input id="expNote" type="text" placeholder="اختياري"></div>' +
          '<button class="btn primary block mt12" data-act="add">إضافة المصروف</button>' +
        '</div>' +
        '<div class="chips mt12" style="margin-bottom:12px">' +
          [['today', 'اليوم'], ['week', '٧ أيام'], ['month', 'الشهر'], ['all', 'الكل']].map(function (x) {
            return '<button class="chip ' + (ES.range === x[0] ? 'active' : '') + '" data-act="range" data-id="' + x[0] + '">' + x[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="stat red" style="margin-bottom:12px"><div class="k">إجمالي المصاريف في الفترة</div><div class="v">' + money(total) + '</div></div>' +
        (list.length ? '<div class="list">' + list.map(function (e) {
          return '<div class="list-row">' +
            '<div class="grow"><div class="t">' + h(e.title) + '</div>' +
            '<div class="s">' + h(S.expenseCatLabel(e.category)) + ' · ' + U.fmtDateShort(e.date || e.createdAt) + (e.by ? ' · ' + h(e.by) : '') + (e.note ? ' · ' + h(e.note) : '') + '</div></div>' +
            '<div class="amt" style="color:var(--red)">-' + money(e.amount) + '</div>' +
            '<button class="x" data-act="del" data-id="' + h(e.id) + '" aria-label="حذف">🗑</button>' +
            '</div>';
        }).join('') + '</div>'
          : '<div class="empty"><span class="big">🧾</span><strong>مفيش مصاريف في الفترة دي</strong><span>أضف أول مصروف من الفورم فوق.</span></div>');
    },
    mount: function () {},
    actions: {
      range: function (el) { ES.range = el.dataset.id; App.render(); },
      add: function () {
        var title = (document.getElementById('expTitle').value || '').trim();
        var amount = U.num(document.getElementById('expAmount').value);
        var cat = document.getElementById('expCat').value;
        var date = document.getElementById('expDate').value || U.dateKey();
        var note = (document.getElementById('expNote').value || '').trim();
        if (!title) { U.toast('اكتب اسم المصروف', { type: 'error' }); return; }
        if (amount <= 0) { U.toast('اكتب مبلغ صحيح', { type: 'error' }); return; }
        S.addExpense({ title: title, amount: amount, category: cat, date: date, note: note });
        U.toast('تم إضافة المصروف ✓', { type: 'success' });
        App.render();
      },
      del: function (el) {
        var exp = S.state.expenses[el.dataset.id];
        if (!exp) return;
        U.confirm('حذف المصروف', 'هتحذف «' + exp.title + '» بقيمة ' + money(exp.amount) + '.', { danger: true, okText: 'حذف' })
          .then(function (ok) { if (ok) { S.deleteExpense(exp.id); U.toast('تم الحذف'); } });
      }
    }
  };

  /* ============================================================
     Settings
     ============================================================ */

  function syncStatusHtml() {
    var st = S.sync.status;
    var isCloud = S.sync.mode === 'cloud';
    var cfg = isCloud ? S.sync.cloudCfg : (S.sync.cfg || S.loadSyncConfig());
    var color = st === 'online' ? 'var(--green)' : st === 'error' ? 'var(--red)' : st === 'offline' ? 'var(--amber)' : 'var(--muted)';
    var label = st === 'online'
      ? (isCloud ? 'متزامن عبر السحابة ✓' : 'متزامن عبر Firebase ✓')
      : st === 'offline' ? 'غير متصل بالنت — شغال محلياً'
      : st === 'connecting' ? 'جاري الاتصال…'
      : st === 'error' ? 'خطأ في الاتصال'
      : 'وضع محلي (جهاز واحد)';
    return '<div style="padding:10px 12px;border-radius:10px;background:var(--surface);border:1px solid var(--border)">' +
      '<div style="color:' + color + ';font-weight:800;font-size:13px">● ' + h(label) + '</div>' +
      (cfg ? '<div class="small muted mt8">الكافيه: <span class="mono">' + h(cfg.cafeKey) + '</span></div>' : '') +
      (st === 'error' && S.sync.error ? '<div class="small" style="color:var(--red);margin-top:6px">' + h(S.sync.error) + '</div>' : '') +
      '<div class="small muted" style="margin-top:6px">' + (st === 'local'
        ? 'البيانات محفوظة على الهاتف ده بس. شغّل السحابة عشان تتزامن مع الأجهزة التانية.'
        : 'أي طلب جديد بيظهر على كل الأجهزة المتصلة في نفس اللحظة.') + '</div>' +
      '</div>';
  }

  V.settings = {
    html: function () {
      var s = S.state.settings;
      var cfg = S.sync.cfg || S.loadSyncConfig();
      var isCloud = S.sync.mode === 'cloud';
      var cloudCfg = (isCloud && S.sync.cloudCfg) || S.loadCloudConfig() || S.CLOUD_DEFAULT;
      var menuCount = S.allItems().length;

      return '<div class="page-head"><div><h1>⚙️ الإعدادات</h1><p>بيانات الكافيه، المنيو، والمزامنة</p></div></div>' +

        '<details class="acc" open><summary><span class="ico">🏪</span> بيانات الكافيه <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div class="form-row two">' +
              '<div><label class="lbl">اسم الكافيه</label><input id="setName" value="' + h(s.cafeName) + '"></div>' +
              '<div><label class="lbl">العملة</label><input id="setCurrency" value="' + h(s.currency) + '"></div>' +
            '</div>' +
            '<div class="form-row two">' +
              '<div><label class="lbl">تليفون</label><input id="setPhone" type="tel" value="' + h(s.phone) + '"></div>' +
              '<div><label class="lbl">واتساب</label><input id="setWhatsapp" type="tel" value="' + h(s.whatsapp) + '"></div>' +
            '</div>' +
            '<div><label class="lbl">العنوان</label><input id="setAddress" value="' + h(s.address) + '"></div>' +
            '<div class="form-row two">' +
              '<div><label class="lbl">ضريبة %</label><input id="setTax" type="number" inputmode="decimal" value="' + h(s.taxRate) + '"></div>' +
              '<div><label class="lbl">خدمة %</label><input id="setService" type="number" inputmode="decimal" value="' + h(s.serviceRate) + '"></div>' +
            '</div>' +
            '<div class="form-row two">' +
              '<div><label class="lbl">رسوم توصيل افتراضية</label><input id="setDelivery" type="number" inputmode="decimal" value="' + h(s.deliveryFee) + '"></div>' +
              '<div><label class="lbl">عدد الترابيزات</label><input id="setTables" type="number" inputmode="numeric" value="' + h(s.tables) + '"></div>' +
            '</div>' +
            '<div><label class="lbl">جملة أسفل الإيصال</label><input id="setFooter" value="' + h(s.receiptFooter) + '"></div>' +
            '<button class="btn primary" data-act="saveCafe">💾 حفظ البيانات</button>' +
          '</div>' +
        '</details>' +

        '<details class="acc" open><summary><span class="ico">☁️</span> المزامنة بين الأجهزة <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div id="syncStatusBox">' + syncStatusHtml() + '</div>' +
            '<div class="cloud-box">' +
              '<div class="row between"><b>☁️ السحابة المفتوحة</b><span class="pill ' + (isCloud ? 'ok' : '') + '">' + (isCloud ? 'مفعّلة' : 'متوقفة') + '</span></div>' +
              '<p class="small muted">مزامنة لحظية بين كل الأجهزة من غير أي حساب أو إعداد. امسح الـQR من تليفون تاني وخلاص.</p>' +
              '<label class="lbl">كود الكافيه</label>' +
              '<div class="row"><input id="cloudKey" class="mono" dir="ltr" value="' + h(cloudCfg.cafeKey) + '">' +
                '<button class="btn sm ghost" data-act="genCloudKey">جديد</button></div>' +
              '<div class="row wrap">' +
                (isCloud
                  ? '<button class="btn primary sm" data-act="cloudOn">🔄 تحديث الاتصال</button>' +
                    '<button class="btn ghost sm" data-act="cloudOff">⏹ إيقاف</button>'
                  : '<button class="btn primary sm" data-act="cloudOn">▶️ تشغيل السحابة</button>') +
                '<button class="btn gold sm" data-act="showQR">📷 QR للربط</button>' +
                '<button class="btn ghost sm" data-act="copyJoin">نسخ لينك الربط</button>' +
              '</div>' +
              '<p class="small" style="color:var(--amber);line-height:1.7;margin:8px 0 0">🔓 السحابة مفتوحة: أي حد عنده كود الكافيه يقدر يشوف ويعدّل. متشاركش الكود برا الفريق.</p>' +
            '</div>' +
            '<details class="adv"><summary>⚙️ متقدم: قاعدة بيانات Firebase خاصة</summary>' +
              '<div class="adv-body">' +
                '<div><label class="lbl">رابط قاعدة البيانات (Firebase databaseURL)</label>' +
                  '<input id="dbUrl" class="mono" dir="ltr" placeholder="https://xxxx-default-rtdb.firebaseio.com" value="' + h(cfg && cfg.databaseURL ? cfg.databaseURL : '') + '"></div>' +
                '<div><label class="lbl">كود الكافيه</label>' +
                  '<div class="row"><input id="cafeKey" class="mono" dir="ltr" placeholder="crc-xxxxxxx" value="' + h(cfg && cfg.cafeKey ? cfg.cafeKey : '') + '">' +
                  '<button class="btn sm ghost" data-act="genKey">جديد</button></div></div>' +
                '<div class="row wrap">' +
                  '<button class="btn primary sm" data-act="connect">🔗 اتصال</button>' +
                  '<button class="btn ghost sm" data-act="disconnect">فصل</button>' +
                  '<button class="btn ghost sm" data-act="showGuide">❓ دليل Firebase</button>' +
                '</div>' +
              '</div>' +
            '</details>' +
            '<div class="divider"></div>' +
            '<div><label class="lbl">عندك كود ربط من جهاز تاني؟</label>' +
              '<div class="row"><input id="joinCode" placeholder="الصق الكود هنا"><button class="btn sm" data-act="join">ربط الجهاز</button></div></div>' +
          '</div>' +
        '</details>' +

        '<details class="acc"><summary><span class="ico">📋</span> المنيو والأسعار <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div class="kv"><span>عدد الأقسام</span><b>' + S.categories().length + '</b></div>' +
            '<div class="kv"><span>عدد الأصناف الظاهرة</span><b>' + menuCount + '</b></div>' +
            '<p class="small muted">عدّل الأسماء والأسعار، أضف أصناف، أو أخفي صنف مؤقتاً.</p>' +
            '<button class="btn primary" data-act="goMenu">✏️ تعديل المنيو</button>' +
          '</div>' +
        '</details>' +

        '<details class="acc"><summary><span class="ico">👤</span> الكاشير والجهاز <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div><label class="lbl">اسم الكاشير على الجهاز ده</label><input id="setUser" value="' + h(S.user) + '"></div>' +
            '<button class="btn sm" data-act="saveUser">حفظ الاسم</button>' +
            '<div class="divider"></div>' +
            '<div class="kv"><span>معرف الجهاز</span><b class="mono">' + h(S.deviceId) + '</b></div>' +
            '<label class="row" style="gap:10px;cursor:pointer"><input type="checkbox" id="setSound" ' + (s.sound ? 'checked' : '') + ' style="width:20px;min-height:20px"> صوت تنبيه عند وصول طلب جديد</label>' +
            '<label class="row" style="gap:10px;cursor:pointer"><input type="checkbox" id="setAutoPrint" ' + (s.autoPrint ? 'checked' : '') + ' style="width:20px;min-height:20px"> طباعة الإيصال تلقائياً بعد التحصيل</label>' +
          '</div>' +
        '</details>' +

        '<details class="acc"><summary><span class="ico">🔒</span> حماية الإعدادات <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div><label class="lbl">رمز PIN لفتح الإعدادات والمنيو</label><input id="setPin" type="text" inputmode="numeric" value="' + h(s.adminPin || '') + '" placeholder="اتركه فاضي لتعطيل القفل"></div>' +
            '<p class="small muted">لو حطيت رمز، أي حد هيفتح الإعدادات أو المنيو هيطلب منه الرمز. سيب الحقل فاضي لو مش عايز قفل.</p>' +
            '<button class="btn sm" data-act="savePin">حفظ الرمز</button>' +
          '</div>' +
        '</details>' +

        '<details class="acc"><summary><span class="ico">💾</span> النسخ الاحتياطي والبيانات <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div class="row wrap">' +
              '<button class="btn sm ghost" data-act="exportJSON">⬇️ تنزيل نسخة كاملة</button>' +
              '<button class="btn sm ghost" data-act="importBtn">⬆️ استيراد نسخة</button>' +
            '</div>' +
            '<input type="file" id="importFile" accept="application/json,.json" class="hide">' +
            '<div class="divider"></div>' +
            '<button class="btn danger sm" data-act="clearOrders">🗑 مسح كل الطلبات</button>' +
            '<button class="btn danger sm" data-act="clearAll">🗑 مسح كل البيانات (طلبات + مصاريف + ورديات)</button>' +
            '<p class="small muted">المنيو وبيانات الكافيه مش هيتمسحوا. خد نسخة احتياطية الأول.</p>' +
          '</div>' +
        '</details>' +

        '<details class="acc"><summary><span class="ico">ℹ️</span> عن النظام <span class="chev">▾</span></summary>' +
          '<div class="acc-body">' +
            '<div class="kv"><span>الإصدار</span><b>1.0</b></div>' +
            '<div class="kv"><span>يعمل أوفلاين</span><b>نعم (PWA)</b></div>' +
            '<div class="kv"><span>المزامنة</span><b>Firebase Realtime Database</b></div>' +
            '<p class="small muted" style="line-height:1.8">نظام كاشير وحسابات كوستا ريكا كافيه. الأصناف والأسعار مأخوذة من منيو الكافيه، وتقدر تعدّلها من قسم المنيو.</p>' +
            '<button class="btn ghost sm" data-act="showGuide">دليل تشغيل المزامنة</button>' +
          '</div>' +
        '</details>';
    },
    mount: function () {
      var snd = document.getElementById('setSound');
      if (snd) snd.addEventListener('change', function () { S.updateSettings({ sound: snd.checked }); });
      var ap = document.getElementById('setAutoPrint');
      if (ap) ap.addEventListener('change', function () { S.updateSettings({ autoPrint: ap.checked }); });

      var file = document.getElementById('importFile');
      if (file) {
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function () {
            try {
              var data = JSON.parse(String(reader.result));
              U.confirm('استيراد نسخة', 'هيتم استبدال البيانات الحالية بالنسخة المستوردة. متأكد؟', { okText: 'استيراد' })
                .then(function (ok) {
                  if (!ok) return;
                  S.importData(data);
                  U.toast('تم استيراد النسخة ✓', { type: 'success' });
                  App.render();
                });
            } catch (err) {
              U.toast('ملف غير صالح', { type: 'error' });
            }
          };
          reader.readAsText(f);
        });
      }
    },
    updateSync: function () {
      var box = document.getElementById('syncStatusBox');
      if (box) box.innerHTML = syncStatusHtml();
    },
    actions: {
      saveCafe: function () {
        S.updateSettings({
          cafeName: document.getElementById('setName').value.trim() || 'كوستا ريكا كافيه',
          currency: document.getElementById('setCurrency').value.trim() || 'ج.م',
          phone: document.getElementById('setPhone').value.trim(),
          whatsapp: document.getElementById('setWhatsapp').value.trim(),
          address: document.getElementById('setAddress').value.trim(),
          taxRate: U.num(document.getElementById('setTax').value),
          serviceRate: U.num(document.getElementById('setService').value),
          deliveryFee: U.num(document.getElementById('setDelivery').value),
          tables: parseInt(document.getElementById('setTables').value, 10) || 12,
          receiptFooter: document.getElementById('setFooter').value.trim()
        });
        U.toast('تم حفظ بيانات الكافيه ✓', { type: 'success' });
        App.renderHeader();
      },
      goMenu: function () { location.hash = '#menu'; },
      saveUser: function () {
        S.setUser(document.getElementById('setUser').value);
        App.renderHeader();
        U.toast('تم حفظ اسم الكاشير ✓', { type: 'success' });
      },
      savePin: function () {
        S.updateSettings({ adminPin: document.getElementById('setPin').value.trim() });
        try { sessionStorage.setItem('crc_admin', '1'); } catch (e) { /* ignore */ }
        U.toast('تم حفظ رمز الحماية ✓', { type: 'success' });
      },
      genKey: function () {
        var input = document.getElementById('cafeKey');
        input.value = S.generateCafeKey();
        U.toast('اتعمل كود جديد — اضغط اتصال', { type: 'success' });
      },
      genCloudKey: function () {
        var input = document.getElementById('cloudKey');
        if (input) input.value = S.generateCafeKey();
        U.toast('اتعمل كود جديد — اضغط «تحديث الاتصال»', { type: 'success' });
      },
      cloudOn: function () {
        var base = S.loadCloudConfig() || S.CLOUD_DEFAULT;
        var input = document.getElementById('cloudKey');
        var key = input && input.value.trim() ? input.value.trim() : base.cafeKey;
        U.toast('جاري تشغيل السحابة…');
        S.connectCloud({ broker: base.broker, cafeKey: key }).then(function (res) {
          if (!res || res.cancelled) return;
          U.toast('السحابة شغّالة ✓', { type: 'success' });
          App.renderHeader();
          App.render();
        }).catch(function (err) {
          U.toast(err.message || 'تعذر تشغيل السحابة', { type: 'error', duration: 5200 });
        });
      },
      cloudOff: function () {
        U.confirm('إيقاف السحابة', 'البيانات هتفضل محفوظة على الجهاز، بس مش هتتزامن مع الأجهزة التانية لحد ما تشغّلها تاني.', { okText: 'إيقاف' })
          .then(function (ok) {
            if (!ok) return;
            S.disconnect().then(function () {
              U.toast('اتوقفت السحابة');
              App.renderHeader();
              App.render();
            });
          });
      },
      connect: function () {
        var url = document.getElementById('dbUrl').value.trim();
        var key = document.getElementById('cafeKey').value.trim();
        if (!url) { U.toast('الصق رابط قاعدة البيانات الأول', { type: 'error' }); return; }
        if (!key) {
          key = S.generateCafeKey();
          document.getElementById('cafeKey').value = key;
        }
        U.toast('جاري الاتصال…');
        S.connect({ databaseURL: url, cafeKey: key }).then(function () {
          U.toast('تم الاتصال والمزامنة ✓', { type: 'success' });
          App.renderHeader();
          App.render();
        }).catch(function (err) {
          U.toast(err.message || 'تعذر الاتصال', { type: 'error', duration: 5200 });
          V.settings.updateSync();
        });
      },
      disconnect: function () {
        U.confirm('فصل المزامنة', 'هترجع للوضع المحلي على الجهاز ده. البيانات اللي على السحابة مش هتتمسح.', { okText: 'فصل' })
          .then(function (ok) {
            if (!ok) return;
            S.disconnect().then(function () {
              U.toast('تم فصل المزامنة');
              App.renderHeader();
              App.render();
            });
          });
      },
      showQR: function () {
        var cfg = S.sync.cloudCfg || S.loadCloudConfig() || S.sync.cfg || S.loadSyncConfig() || S.CLOUD_DEFAULT;
        var link = S.joinLink(cfg);
        U.modal(
          '<h3>امسح الكود من تليفون تاني</h3>' +
          '<p class="m-sub">افتح كاميرا التليفون التاني وامسح الكود، أو ابعتله اللينك.</p>' +
          '<div class="center" style="background:#fff;border-radius:14px;padding:12px;margin-bottom:12px">' +
            '<img alt="QR" width="240" height="240" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' + encodeURIComponent(link) + '">' +
          '</div>' +
          '<div class="code-box">' + h(link) + '</div>' +
          '<div class="modal-actions"><button class="btn ghost" data-copy type="button">نسخ اللينك</button><button class="btn primary" data-done type="button">تم</button></div>'
        ).el.querySelector('[data-copy]').addEventListener('click', function () {
          U.copy(link).then(function () { U.toast('تم نسخ اللينك ✓'); });
        });
        document.querySelectorAll('.modal [data-done]').forEach(function (b) {
          b.addEventListener('click', function () { U.closeTopModal(); });
        });
      },
      copyJoin: function () {
        var cfg = S.sync.cloudCfg || S.loadCloudConfig() || S.sync.cfg || S.loadSyncConfig() || S.CLOUD_DEFAULT;
        U.copy(S.joinLink(cfg)).then(function () { U.toast('تم نسخ كود الربط ✓', { type: 'success' }); })
          .catch(function () { U.toast('تعذر النسخ', { type: 'error' }); });
      },
      join: function () {
        var raw = document.getElementById('joinCode').value.trim();
        if (!raw) { U.toast('الصق كود الربط', { type: 'error' }); return; }
        if (raw.indexOf('#join=') !== -1) raw = raw.split('#join=')[1];
        var cfg = S.parseJoinCode(raw);
        if (!cfg) { U.toast('الكود غير صالح', { type: 'error' }); return; }
        U.confirm('ربط الجهاز', 'هيتم الاتصال بكافيه ' + cfg.cafeKey + ' وسحب بياناته. متأكد؟', { okText: 'ربط' })
          .then(function (ok) {
            if (!ok) return;
            S.connect(cfg).then(function () {
              U.toast('تم ربط الجهاز ✓', { type: 'success' });
              App.renderHeader();
              App.render();
            }).catch(function (err) {
              U.toast(err.message || 'تعذر الربط', { type: 'error', duration: 5200 });
            });
          });
      },
      showGuide: function () {
        U.modal(
          '<h3>تشغيل المزامنة في 5 دقايق</h3>' +
          '<p class="m-sub">هنستخدم Firebase Realtime Database — مجاني وبيتزامن لحظياً.</p>' +
          '<ol class="steps">' +
            '<li>افتح <b>console.firebase.google.com</b> واعمل حساب/دخول.</li>' +
            '<li>اضغط <b>Add project</b> واختار اسم للمشروع (مثلاً costa-rica).</li>' +
            '<li>من القائمة: <b>Build → Realtime Database → Create Database</b>.</li>' +
            '<li>اختار <b>Start in test mode</b> واضغط <b>Enable</b>.</li>' +
            '<li>انسخ الرابط اللي شكله <b>https://xxxx-default-rtdb.firebaseio.com</b>.</li>' +
            '<li>ارجع هنا، الصق الرابط، واضغط <b>جديد</b> لجعل كود كافيه، وبعدين <b>اتصال</b>.</li>' +
            '<li>على التليفون التاني: افتح نفس لينك النظام → الإعدادات → المزامنة → امسح <b>QR</b>.</li>' +
          '</ol>' +
          '<div class="divider"></div>' +
          '<p class="small muted" style="line-height:1.8">مهم: وضع Test mode بيقفل بعد 30 يوم. من صفحة Realtime Database → Rules الصق القواعد دي عشان يفضل شغال:</p>' +
          '<div class="code-box">{\n  "rules": {\n    "cafes": {\n      "$cafe": { ".read": true, ".write": true }\n    }\n  }\n}</div>' +
          '<p class="small" style="color:var(--amber);line-height:1.7;margin-top:8px">⚠️ أي حد يعرف كود الكافيه يقدر يوصل للبيانات. خلي الكود سرّي ومتشاركوش برا الفريق.</p>' +
          '<div class="modal-actions"><button class="btn primary" data-done type="button">فهمت</button></div>',
          { wide: true }
        );
        document.querySelectorAll('.modal [data-done]').forEach(function (b) {
          b.addEventListener('click', function () { U.closeTopModal(); });
        });
      },
      exportJSON: function () {
        U.download('costa-rica-backup-' + U.dateKey() + '.json', JSON.stringify(S.exportData(), null, 2), 'application/json');
      },
      importBtn: function () {
        var f = document.getElementById('importFile');
        if (f) f.click();
      },
      clearOrders: function () {
        U.confirm('مسح كل الطلبات', 'هيتم مسح كل الطلبات من كل الأجهزة المتصلة. الخطوة دي مش بترجع.', { danger: true, okText: 'مسح الطلبات' })
          .then(function (ok) {
            if (!ok) return;
            S.clearData('orders');
            U.toast('تم مسح الطلبات');
            App.render();
          });
      },
      clearAll: function () {
        U.prompt('مسح كل البيانات', {
          message: 'اكتب كلمة «حذف» للتأكيد. هيتم مسح الطلبات والمصاريف والورديات من كل الأجهزة.',
          placeholder: 'حذف',
          okText: 'مسح نهائي'
        }).then(function (value) {
          if (value !== 'حذف') { if (value !== null) U.toast('التأكيد غلط — مفيش حاجة اتمسحت', { type: 'error' }); return; }
          S.clearData('all');
          U.toast('تم مسح كل البيانات');
          App.render();
        });
      }
    }
  };

  /* ============================================================
     Menu editor
     ============================================================ */

  V.menu = {
    html: function () {
      return '<div class="page-head">' +
          '<div><h1>✏️ المنيو والأسعار</h1><p>التعديلات بتتزامن مع كل الأجهزة</p></div>' +
          '<div class="actions"><button class="btn sm ghost" data-act="back">→ رجوع للإعدادات</button>' +
          '<button class="btn sm primary" data-act="addCat">➕ قسم</button></div>' +
        '</div>' +
        S.categories().map(function (cat) {
          return '<div class="menu-cat">' +
            '<div class="mc-head">' +
              '<span class="ic">' + h(cat.icon) + '</span>' +
              '<b class="grow">' + h(cat.name) + '</b>' +
              '<button class="btn sm ghost" data-act="editCat" data-id="' + h(cat.id) + '">تعديل</button>' +
              '<button class="btn sm ghost" data-act="addItem" data-id="' + h(cat.id) + '">➕ صنف</button>' +
              '<button class="x" data-act="delCat" data-id="' + h(cat.id) + '" style="color:var(--muted2)">🗑</button>' +
            '</div>' +
            '<div class="menu-head"><span>الصنف</span><span>السعر</span><span>التكلفة</span><span>ظاهر</span><span></span></div>' +
            (cat.items.length ? cat.items.map(function (item) {
              return '<div class="menu-item ' + (item.hidden ? 'hidden-item' : '') + '">' +
                '<input type="text" value="' + h(item.name) + '" data-change="itemName" data-cat="' + h(cat.id) + '" data-id="' + h(item.id) + '">' +
                '<input class="p" type="number" inputmode="decimal" value="' + h(item.price) + '" data-change="itemPrice" data-cat="' + h(cat.id) + '" data-id="' + h(item.id) + '">' +
                '<input class="p" type="number" inputmode="decimal" value="' + h(item.cost) + '" data-change="itemCost" data-cat="' + h(cat.id) + '" data-id="' + h(item.id) + '">' +
                '<button class="eye ' + (item.hidden ? 'off' : '') + '" data-act="toggleItem" data-cat="' + h(cat.id) + '" data-id="' + h(item.id) + '" title="إظهار/إخفاء">' + (item.hidden ? '🚫' : '👁️') + '</button>' +
                '<button class="del" data-act="delItem" data-cat="' + h(cat.id) + '" data-id="' + h(item.id) + '">✕</button>' +
                '</div>';
            }).join('') : '<div class="small muted" style="padding:10px">مفيش أصناف — اضغط «➕ صنف».</div>') +
            '</div>';
        }).join('') +
        '<div class="hint mt12">💡 التكلفة اختيارية — لو كتبتها، النظام هيحسب لك الربح الحقيقي (المبيعات − تكلفة الخامات − المصاريف).</div>';
    },
    mount: function () {},
    actions: {
      back: function () { location.hash = '#settings'; },
      addCat: function () {
        U.modal(
          '<h3>قسم جديد</h3>' +
          '<div class="m-body"><div><label class="lbl">اسم القسم</label><input id="newCatName" placeholder="مثال: حلويات"></div>' +
          '<div><label class="lbl">أيقونة (إيموجي)</label><input id="newCatIcon" value="🍰" maxlength="4"></div></div>' +
          '<div class="modal-actions"><button class="btn ghost" data-cancel type="button">إلغاء</button><button class="btn primary" data-ok type="button">إضافة</button></div>'
        );
        bindSimpleModal(function (m) {
          var name = m.el.querySelector('#newCatName').value.trim();
          if (!name) { U.toast('اكتب اسم القسم', { type: 'error' }); return false; }
          S.addCategory({ name: name, icon: m.el.querySelector('#newCatIcon').value.trim() || '☕' });
          return true;
        });
      },
      editCat: function (el) {
        var cat = S.categories().filter(function (c) { return c.id === el.dataset.id; })[0];
        if (!cat) return;
        U.modal(
          '<h3>تعديل القسم</h3>' +
          '<div class="m-body"><div><label class="lbl">اسم القسم</label><input id="catName" value="' + h(cat.name) + '"></div>' +
          '<div><label class="lbl">أيقونة</label><input id="catIcon" value="' + h(cat.icon) + '" maxlength="4"></div></div>' +
          '<div class="modal-actions"><button class="btn ghost" data-cancel type="button">إلغاء</button><button class="btn primary" data-ok type="button">حفظ</button></div>'
        );
        bindSimpleModal(function (m) {
          var name = m.el.querySelector('#catName').value.trim();
          if (!name) { U.toast('اكتب اسم القسم', { type: 'error' }); return false; }
          S.updateCategory(cat.id, { name: name, icon: m.el.querySelector('#catIcon').value.trim() || '☕' });
          return true;
        });
      },
      delCat: function (el) {
        var cat = S.categories().filter(function (c) { return c.id === el.dataset.id; })[0];
        if (!cat) return;
        U.confirm('حذف القسم', 'هتحذف «' + cat.name + '» وكل أصنافه (' + cat.items.length + ' صنف).', { danger: true, okText: 'حذف' })
          .then(function (ok) {
            if (!ok) return;
            S.deleteCategory(cat.id);
            U.toast('تم حذف القسم');
            App.render();
          });
      },
      addItem: function (el) {
        var catId = el.dataset.id;
        U.modal(
          '<h3>صنف جديد</h3>' +
          '<div class="m-body">' +
            '<div><label class="lbl">اسم الصنف</label><input id="newItemName" placeholder="مثال: لاتيه"></div>' +
            '<div class="form-row two"><div><label class="lbl">السعر</label><input id="newItemPrice" type="number" inputmode="decimal" placeholder="0"></div>' +
            '<div><label class="lbl">التكلفة (اختياري)</label><input id="newItemCost" type="number" inputmode="decimal" placeholder="0"></div></div>' +
          '</div>' +
          '<div class="modal-actions"><button class="btn ghost" data-cancel type="button">إلغاء</button><button class="btn primary" data-ok type="button">إضافة</button></div>'
        );
        bindSimpleModal(function (m) {
          var name = m.el.querySelector('#newItemName').value.trim();
          if (!name) { U.toast('اكتب اسم الصنف', { type: 'error' }); return false; }
          S.addItem(catId, {
            name: name,
            price: U.num(m.el.querySelector('#newItemPrice').value),
            cost: U.num(m.el.querySelector('#newItemCost').value)
          });
          return true;
        });
      },
      delItem: function (el) {
        var item = S.findItem(el.dataset.id);
        if (!item) return;
        U.confirm('حذف الصنف', 'هتحذف «' + item.item.name + '» من المنيو.', { danger: true, okText: 'حذف' })
          .then(function (ok) {
            if (!ok) return;
            S.deleteItem(el.dataset.cat, el.dataset.id);
            U.toast('تم حذف الصنف');
            App.render();
          });
      },
      toggleItem: function (el) {
        var item = S.findItem(el.dataset.id);
        if (!item) return;
        S.updateItem(el.dataset.cat, el.dataset.id, { hidden: !item.item.hidden });
        App.render();
      }
    }
  };

  function bindSimpleModal(onOk) {
    var wraps = document.querySelectorAll('.modal-wrap');
    var wrap = wraps[wraps.length - 1];
    if (!wrap) return;
    var modal = wrap.querySelector('.modal');
    var m = { el: wrap };
    wrap.querySelector('[data-cancel]').addEventListener('click', function () { U.closeTopModal(); });
    wrap.querySelector('[data-ok]').addEventListener('click', function () {
      if (onOk(m) !== false) {
        U.closeTopModal();
        App.render();
      }
    });
    var first = wrap.querySelector('input');
    if (first) setTimeout(function () { first.focus(); }, 80);
  }

  /* expose for app */
  App.syncBanner = syncBanner;
})();
