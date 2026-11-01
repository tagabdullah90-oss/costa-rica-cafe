/* ============================================================
   Costa Rica Cafe — سكربت الموقع
   ============================================================ */
(function () {
  'use strict';

  var C = window.CRC;
  var CART_KEY = 'crc_cart_v1';
  var DRAFT_KEY = 'crc_draft_v1';
  var DATA_MENU = 'data/menu.json';
  var DATA_SITE = 'data/site.json';

  var state = {
    site: null,
    menu: null,
    byId: new Map(),
    query: '',
    cat: 'all',
    cart: {},           /* { itemId: qty } */
    install: null,
    preview: false
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ---------------- أدوات ---------------- */

  function normalizeArabic(text) {
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

  function itemsWord(n) {
    if (n === 1) return 'صنف واحد';
    if (n === 2) return 'صنفين';
    if (n >= 3 && n <= 10) return n + ' أصناف';
    return n + ' صنف';
  }

  function money(value) {
    return C.formatPrice(value) + ' ' + (state.site ? state.site.currency : '');
  }

  function toast(message) {
    var box = $('#toast');
    if (!box) return;
    box.textContent = message;
    box.classList.add('is-visible');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () {
      box.classList.remove('is-visible');
    }, 1800);
  }

  /* ---------------- تحميل البيانات ---------------- */

  function fetchJSON(url) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return fetch(url + sep + 'v=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + url);
      return res.json();
    });
  }

  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var draft = JSON.parse(raw);
      if (!draft || !draft.menu || !draft.site) return null;
      return {
        menu: C.normalizeMenu(draft.menu),
        site: C.normalizeSite(draft.site)
      };
    } catch (err) {
      return null;
    }
  }

  function loadData() {
    state.preview = /(?:\?|&)preview=1/.test(location.search);
    if (state.preview) {
      var draft = readDraft();
      if (draft) return Promise.resolve(draft);
    }
    return Promise.all([fetchJSON(DATA_MENU), fetchJSON(DATA_SITE)]).then(function (out) {
      return { menu: C.normalizeMenu(out[0]), site: C.normalizeSite(out[1]) };
    });
  }

  function readCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      var clean = {};
      Object.keys(raw || {}).forEach(function (id) {
        var qty = parseInt(raw[id], 10);
        if (state.byId.has(id) && qty > 0 && qty < 99) clean[id] = qty;
      });
      return clean;
    } catch (err) {
      return {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch (err) { /* التخزين ممتلئ أو متوقف — نتجاهل */ }
  }

  /* ---------------- الثيم ---------------- */

  function applyTheme(site) {
    var root = document.documentElement;
    if (site.theme.gold) root.style.setProperty('--gold', site.theme.gold);
    if (site.theme.gold2) root.style.setProperty('--gold2', site.theme.gold2);
    if (site.theme.bg) {
      root.style.setProperty('--bg', site.theme.bg);
      document.body.style.background = site.theme.bg;
    }
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', site.theme.bg || '#100e0c');
  }

  /* ---------------- الهيدر ---------------- */

  function renderHero(site, wa) {
    var badges = [];
    if (site.hours) badges.push('<span>' + C.esc(site.hours) + '</span>');
    if (site.address) badges.push('<span>' + C.esc(site.address) + '</span>');

    return '' +
      '<header class="hero">' +
        '<div class="logo" aria-hidden="true">' + C.esc(site.logo) + '</div>' +
        '<h1>' + C.esc(site.nameEn) + '</h1>' +
        (site.sub ? '<p class="sub">' + C.esc(site.sub) + '</p>' : '') +
        '<p class="name-ar">' + C.esc(site.nameAr) + '</p>' +
        (site.tagline ? '<p class="tag">' + C.esc(site.tagline) + '</p>' : '') +
        (badges.length ? '<div class="hero-badges">' + badges.join('') + '</div>' : '') +
        '<div class="hero-actions">' +
          (wa ? '<a class="btn btn-gold" href="' + C.esc(wa) + '" target="_blank" rel="noopener">💬 اطلب على واتساب</a>' : '') +
          '<a class="btn btn-ghost" href="#menu">📖 شوف المنيو</a>' +
          '<button class="btn btn-ghost" id="installBtn" type="button" hidden>📲 ثبّت التطبيق</button>' +
        '</div>' +
      '</header>';
  }

  /* ---------------- شريط البحث والأقسام ---------------- */

  function renderTopbar(menu) {
    var chips = ['<button class="chip is-active" type="button" data-cat="all">الكل</button>'];
    menu.categories.forEach(function (cat) {
      chips.push('<button class="chip" type="button" data-cat="' + C.esc(cat.id) + '">' +
        (cat.icon ? '<span aria-hidden="true">' + C.esc(cat.icon) + '</span>' : '') +
        C.esc(cat.name) + '</button>');
    });

    return '' +
      '<div class="topbar">' +
        '<div class="search">' +
          '<span class="search-icon" aria-hidden="true">🔍</span>' +
          '<input id="searchInput" type="search" inputmode="search" autocomplete="off" ' +
            'placeholder="ابحث عن مشروب… (لاتيه، موهيتو، شيشة)" aria-label="ابحث في المنيو">' +
          '<button class="clear" id="clearSearch" type="button" aria-label="مسح البحث" hidden>✕</button>' +
        '</div>' +
        '<div class="chips" role="tablist" aria-label="أقسام المنيو">' + chips.join('') + '</div>' +
      '</div>';
  }

  /* ---------------- المنيو ---------------- */

  function renderSection(cat, items) {
    var rows = items.map(function (item) {
      return '' +
        '<div class="item">' +
          '<div class="item-main">' +
            '<p class="item-name">' + C.esc(item.name) + '</p>' +
            (item.desc ? '<p class="item-desc">' + C.esc(item.desc) + '</p>' : '') +
          '</div>' +
          '<div class="item-side">' +
            '<span class="price">' + C.formatPrice(item.price) +
              (state.site.currency ? '<i>' + C.esc(state.site.currency) + '</i>' : '') +
            '</span>' +
            '<button class="add" type="button" data-add="' + C.esc(item.id) + '" ' +
              'aria-label="أضف ' + C.esc(item.name) + ' للسلة">+</button>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<section class="menu" id="cat-' + C.esc(cat.id) + '" aria-labelledby="h-' + C.esc(cat.id) + '">' +
        '<div class="cat-head">' +
          '<span class="cat-icon" aria-hidden="true">' + C.esc(cat.icon || '☕') + '</span>' +
          '<h2 id="h-' + C.esc(cat.id) + '">' + C.esc(cat.name) + '</h2>' +
          '<span class="cat-count">' + items.length + '</span>' +
        '</div>' +
        rows +
      '</section>';
  }

  function filteredCategories() {
    var q = normalizeArabic(state.query);
    var out = [];

    state.menu.categories.forEach(function (cat) {
      if (state.cat !== 'all' && cat.id !== state.cat) return;

      var items = cat.items.filter(function (item) { return !item.hidden; });

      if (q) {
        var catHit = normalizeArabic(cat.name).indexOf(q) !== -1;
        if (!catHit) {
          items = items.filter(function (item) {
            return normalizeArabic(item.name + ' ' + item.desc).indexOf(q) !== -1;
          });
        }
      }

      if (items.length) out.push({ cat: cat, items: items });
    });

    return out;
  }

  function renderList() {
    var wrap = $('#sections');
    if (!wrap) return;

    var groups = filteredCategories();
    var single = state.cat !== 'all' || !!state.query;

    wrap.className = 'grid' + (single ? ' single' : '');

    if (!groups.length) {
      wrap.innerHTML = '<div class="empty">' +
        '<strong>مفيش نتائج للبحث ده</strong>' +
        '<span>جرّب كلمة تانية زي «لاتيه» أو «موهيتو»، أو اضغط «الكل».</span>' +
        '</div>';
      return;
    }

    wrap.innerHTML = groups.map(function (g) {
      return renderSection(g.cat, g.items);
    }).join('');
  }

  function bindSearch() {
    var input = $('#searchInput');
    var clear = $('#clearSearch');
    if (!input) return;

    input.addEventListener('input', function () {
      state.query = input.value.trim();
      clear.hidden = !state.query;
      renderList();
    });

    clear.addEventListener('click', function () {
      input.value = '';
      state.query = '';
      clear.hidden = true;
      renderList();
      input.focus();
    });
  }

  function bindChips() {
    var chips = $('.chips');
    if (!chips) return;

    chips.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;

      state.cat = chip.getAttribute('data-cat') || 'all';
      state.query = '';

      var searchInput = $('#searchInput');
      var clearSearch = $('#clearSearch');
      if (searchInput) searchInput.value = '';
      if (clearSearch) clearSearch.hidden = true;

      Array.prototype.forEach.call(chips.querySelectorAll('.chip'), function (el) {
        el.classList.toggle('is-active', el === chip);
      });
      renderList();

      var top = $('.topbar').getBoundingClientRect().height + 12;
      var menu = $('#sections');
      if (menu) {
        var y = menu.getBoundingClientRect().top + window.pageYOffset - top;
        window.scrollTo({ top: Math.max(y, 0), behavior: 'smooth' });
      }
    });
  }

  /* ---------------- السلة ---------------- */

  function cartEntries() {
    var out = [];
    Object.keys(state.cart).forEach(function (id) {
      var item = state.byId.get(id);
      var qty = state.cart[id];
      if (!item || !qty) return;
      out.push({ item: item, qty: qty, total: item.price * qty });
    });
    return out;
  }

  function cartCount() {
    return Object.keys(state.cart).reduce(function (sum, id) { return sum + state.cart[id]; }, 0);
  }

  function cartTotal() {
    return cartEntries().reduce(function (sum, line) { return sum + line.total; }, 0);
  }

  function addToCart(id) {
    var item = state.byId.get(id);
    if (!item) return;
    state.cart[id] = Math.min((state.cart[id] || 0) + 1, 99);
    saveCart();
    updateCartUI();
    toast(item.name + ' اتضاف للسلة ✓');
  }

  function changeQty(id, delta) {
    var next = (state.cart[id] || 0) + delta;
    if (next <= 0) delete state.cart[id];
    else state.cart[id] = Math.min(next, 99);
    saveCart();
    updateCartUI();
    renderCartLines();
  }

  function updateCartUI() {
    var count = cartCount();
    var total = cartTotal();
    var bar = $('#cartbar');
    if (!bar) return;

    bar.classList.toggle('is-visible', count > 0);

    var badge = $('.badge', bar);
    if (badge) badge.textContent = count > 99 ? '99+' : String(count);

    var priceEl = $('.cart-text b', bar);
    if (priceEl) priceEl.textContent = money(total);

    var subEl = $('.cart-text span', bar);
    if (subEl) subEl.textContent = itemsWord(count);
  }

  function renderCartLines() {
    var box = $('#cartLines');
    if (!box) return;

    var lines = cartEntries();

    if (!lines.length) {
      box.innerHTML = '<li class="sheet-empty">السلة فاضية — اختار مشروبك من المنيو ☕</li>';
    } else {
      box.innerHTML = lines.map(function (line) {
        var id = C.esc(line.item.id);
        return '' +
          '<li class="cart-line" data-id="' + id + '">' +
            '<div class="cl-name">' + C.esc(line.item.name) +
              '<small>' + C.formatPrice(line.item.price) + ' × ' + line.qty + '</small>' +
            '</div>' +
            '<div class="qty">' +
              '<button type="button" data-dec="' + id + '" aria-label="تقليل">−</button>' +
              '<span>' + line.qty + '</span>' +
              '<button type="button" data-inc="' + id + '" aria-label="زيادة">+</button>' +
            '</div>' +
            '<div class="cl-total">' + C.formatPrice(line.total) + '</div>' +
          '</li>';
      }).join('');
    }

    var totalEl = $('#cartTotal');
    if (totalEl) totalEl.textContent = money(cartTotal());

    var send = $('#sendOrder');
    if (send) send.disabled = !lines.length;
  }

  function openCart() {
    var drawer = $('#drawer');
    if (!drawer) return;
    renderCartLines();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    var closeBtn = $('.sheet-close', drawer);
    if (closeBtn) closeBtn.focus();
  }

  function closeCart() {
    var drawer = $('#drawer');
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  function buildOrderText() {
    var site = state.site;
    var lines = cartEntries();
    var parts = [];

    parts.push('مرحباً ' + site.nameAr + ' 👋');
    parts.push('');
    parts.push('عايز أطلب:');

    lines.forEach(function (line) {
      parts.push('• ' + line.item.name + ' × ' + line.qty +
        ' = ' + C.formatPrice(line.total) + ' ' + site.currency);
    });

    parts.push('');
    parts.push('الإجمالي: ' + C.formatPrice(cartTotal()) + ' ' + site.currency);

    var name = ($('#customerName') && $('#customerName').value || '').trim();
    var note = ($('#orderNote') && $('#orderNote').value || '').trim();

    if (name) {
      parts.push('الاسم: ' + name);
    }
    if (note) {
      parts.push('ملاحظات: ' + note);
    }

    return parts.join('\n');
  }

  function sendOrder() {
    if (!cartEntries().length) return;

    var link = C.waLink(state.site.whatsapp, buildOrderText());
    if (!link) {
      toast('رقم الواتساب مش متظبط — كلّمنا على الأرقام الموجودة تحت');
      closeCart();
      var contact = $('#contact');
      if (contact) contact.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    window.open(link, '_blank', 'noopener');
  }

  function bindCart() {
    var grid = $('#sections');

    if (grid) {
      grid.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-add]');
        if (btn) addToCart(btn.getAttribute('data-add'));
      });
    }

    var bar = $('#cartbar');
    if (bar) bar.addEventListener('click', openCart);

    var drawer = $('#drawer');
    if (drawer) {
      drawer.addEventListener('click', function (event) {
        if (event.target.closest('.scrim') || event.target.closest('.sheet-close')) {
          closeCart();
          return;
        }

        var inc = event.target.closest('[data-inc]');
        if (inc) { changeQty(inc.getAttribute('data-inc'), 1); return; }

        var dec = event.target.closest('[data-dec]');
        if (dec) { changeQty(dec.getAttribute('data-dec'), -1); return; }

        if (event.target.closest('#sendOrder')) { sendOrder(); return; }

        if (event.target.closest('#clearCart')) {
          state.cart = {};
          saveCart();
          updateCartUI();
          renderCartLines();
          toast('تم تفريغ السلة');
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeCart();
    });
  }

  /* ---------------- التواصل والفوتر ---------------- */

  function renderContact(site, wa) {
    var buttons = [];

    if (wa) {
      buttons.push('<a class="btn btn-gold" href="' + C.esc(wa) + '" target="_blank" rel="noopener">💬 واتساب</a>');
    }
    if (site.facebook) {
      buttons.push('<a class="btn btn-ghost" href="' + C.esc(site.facebook) + '" target="_blank" rel="noopener">Facebook</a>');
    }
    if (site.instagram) {
      buttons.push('<a class="btn btn-ghost" href="' + C.esc(site.instagram) + '" target="_blank" rel="noopener">Instagram</a>');
    }
    if (site.mapUrl) {
      buttons.push('<a class="btn btn-ghost" href="' + C.esc(site.mapUrl) + '" target="_blank" rel="noopener">📍 الموقع على الخريطة</a>');
    }

    var phones = site.phones.map(function (phone) {
      var digits = String(phone).replace(/\s/g, '');
      return '<li><a href="tel:' + C.esc(digits) + '">' + C.esc(phone) + '</a></li>';
    }).join('');

    return '' +
      '<section class="contact" id="contact">' +
        '<h2>تواصل معانا</h2>' +
        '<p class="hint">اطلب أو احجز، وإحنا في خدمتك.</p>' +
        '<div class="actions">' + buttons.join('') + '</div>' +
        (phones ? '<ul class="contacts">' + phones + '</ul>' : '') +
        (site.address ? '<p class="note">' + C.esc(site.address) + '</p>' : '') +
        (site.note ? '<p class="note">' + C.esc(site.note) + '</p>' : '') +
      '</section>';
  }

  function renderFooter(site) {
    return '' +
      '<footer>' +
        '<div>© ' + new Date().getFullYear() + ' ' + C.esc(site.nameAr) + ' — كل الحقوق محفوظة.</div>' +
        '<div class="foot-links">' +
          '<a href="#" id="printBtn">🖨️ طباعة المنيو</a>' +
          '<a href="admin.html">⚙️ لوحة التحكم</a>' +
        '</div>' +
      '</footer>';
  }

  function renderDrawer(site, wa) {
    return '' +
      '<div class="drawer" id="drawer" aria-hidden="true">' +
        '<div class="scrim" aria-hidden="true"></div>' +
        '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="cartTitle">' +
          '<div class="sheet-head">' +
            '<h2 id="cartTitle">طلبك</h2>' +
            '<button class="sheet-close" type="button" aria-label="إغلاق">✕</button>' +
          '</div>' +
          '<div class="sheet-body">' +
            '<ul class="cart-lines" id="cartLines"></ul>' +
            '<div class="sheet-total">الإجمالي <b id="cartTotal">0</b></div>' +
            '<input class="field" id="customerName" type="text" autocomplete="name" placeholder="اسمك (اختياري)">' +
            '<textarea class="field" id="orderNote" rows="2" placeholder="ملاحظات على الطلب (اختياري)"></textarea>' +
            '<div class="sheet-actions">' +
              (wa
                ? '<button class="btn btn-gold wide" id="sendOrder" type="button">💬 إرسال الطلب على واتساب</button>'
                : '<button class="btn btn-gold wide" id="sendOrder" type="button">💬 إرسال الطلب</button>') +
              '<button class="link-btn" id="clearCart" type="button">تفريغ السلة</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cartbar" id="cartbar" role="region" aria-label="سلة الطلب">' +
        '<div class="cart-icon" aria-hidden="true">🛒<span class="badge">0</span></div>' +
        '<div class="cart-text"><b>0 ' + C.esc(site.currency) + '</b><span>السلة فاضية</span></div>' +
        '<button class="go" type="button">عرض السلة</button>' +
      '</div>';
  }

  /* ---------------- SEO ---------------- */

  function updateMeta(site) {
    document.title = site.nameAr + ' | ' + site.nameEn + ' Cafe';

    var desc = $('meta[name="description"]');
    if (desc && site.description) desc.setAttribute('content', site.description);

    var ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', site.nameAr + ' | ' + site.nameEn);
    var ogDesc = $('meta[property="og:description"]');
    if (ogDesc && site.description) ogDesc.setAttribute('content', site.description);
    var ogSite = $('meta[property="og:site_name"]');
    if (ogSite) ogSite.setAttribute('content', site.nameEn);
    var ogImage = $('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', new URL('assets/icon-512.png', location.href).href);
    var ogUrl = $('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', location.href);

    var canonical = $('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', location.origin + location.pathname);

    var data = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      'name': site.nameAr,
      'alternateName': site.nameEn,
      'description': site.description,
      'servesCuisine': 'Coffee, Beverages',
      'priceRange': site.priceRange || '££',
      'telephone': site.phones.length ? '+20' + String(site.phones[0]).replace(/^0+/, '') : undefined,
      'address': site.address ? { '@type': 'PostalAddress', 'streetAddress': site.address } : undefined,
      'openingHours': site.hours || undefined,
      'url': location.href,
      'hasMenu': location.href,
      'sameAs': [site.facebook, site.instagram].filter(Boolean)
    };

    Object.keys(data).forEach(function (key) {
      if (data[key] === undefined) delete data[key];
    });

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /* ---------------- التثبيت / PWA ---------------- */

  function bindInstall() {
    var btn = $('#installBtn');
    if (!btn) return;

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      state.install = event;
      btn.hidden = false;
    });

    btn.addEventListener('click', function () {
      if (!state.install) return;
      state.install.prompt();
      state.install.userChoice.then(function () {
        state.install = null;
        btn.hidden = true;
      });
    });

    window.addEventListener('appinstalled', function () {
      btn.hidden = true;
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (state.preview) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* تجاهل */ });
    });
  }

  /* ---------------- التشغيل ---------------- */

  function render() {
    var site = state.site;
    var menu = state.menu;
    var wa = C.waLink(site.whatsapp, 'مرحباً ' + site.nameAr + ' 👋');

    applyTheme(site);

    var app = $('#app');
    app.innerHTML = '' +
      renderHero(site, wa) +
      renderTopbar(menu) +
      '<main id="menu">' +
        '<p class="intro">اختار مشروبك المفضل واستمتع بوقتك معانا ✨</p>' +
        '<div class="grid" id="sections"></div>' +
        renderContact(site, wa) +
      '</main>' +
      renderFooter(site) +
      renderDrawer(site, wa);

    renderList();
    bindSearch();
    bindChips();
    bindCart();
    bindInstall();
    updateMeta(site);

    var printBtn = $('#printBtn');
    if (printBtn) {
      printBtn.addEventListener('click', function (event) {
        event.preventDefault();
        window.print();
      });
    }

    updateCartUI();
    registerSW();
  }

  function showError(err) {
    var app = $('#app');
    app.innerHTML = '' +
      '<div class="boot boot-error">' +
        '<div class="boot-logo">☕</div>' +
        '<h2>المنيو مش قادر يحمّل</h2>' +
        '<p>تأكد إن ملفات البيانات موجودة وإن النت شغّال، وبعدين جرّب تاني.</p>' +
        '<p><code>' + C.esc(err && err.message ? err.message : 'unknown error') + '</code></p>' +
        '<button class="btn btn-gold" type="button" onclick="location.reload()">إعادة المحاولة</button>' +
      '</div>';
    console.error(err);
  }

  function start() {
    loadData().then(function (data) {
      state.menu = data.menu;
      state.site = data.site;

      state.menu.categories.forEach(function (cat) {
        cat.items.forEach(function (item) {
          if (!item.hidden) state.byId.set(item.id, item);
        });
      });

      state.cart = readCart();
      render();
    }).catch(showError);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
