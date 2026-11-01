/* ============================================================
   Costa Rica Cafe — لوحة التحكم
   ============================================================ */
(function () {
  'use strict';

  var C = window.CRC;
  var STORE = { creds: 'crc_gh_v1', draft: 'crc_draft_v1' };
  var DATA = { menu: 'data/menu.json', site: 'data/site.json' };

  var state = {
    menu: null,
    site: null,
    creds: { owner: '', repo: '', branch: 'main', token: '' },
    dirty: false,
    busy: false,
    repo: null,
    lastSaved: null
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------------- أدوات ---------------- */

  function toast(message, isError) {
    var box = $('#toast');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('is-error', !!isError);
    box.classList.add('is-visible');
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.classList.remove('is-visible'); }, 2600);
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function b64encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString('ar-EG', {
        dateStyle: 'medium', timeStyle: 'short'
      });
    } catch (err) {
      return iso;
    }
  }

  function setResult(sel, message, isError) {
    var el = $(sel);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('err', !!isError);
    el.classList.toggle('ok', !isError && !!message);
  }

  /* ---------------- التخزين المحلي ---------------- */

  function loadCreds() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE.creds) || 'null');
      if (saved && typeof saved === 'object') {
        state.creds.owner = saved.owner || '';
        state.creds.repo = saved.repo || '';
        state.creds.branch = saved.branch || 'main';
        state.creds.token = saved.token || '';
      }
    } catch (err) { /* تجاهل */ }
  }

  function saveCreds() {
    try {
      localStorage.setItem(STORE.creds, JSON.stringify(state.creds));
    } catch (err) { /* تجاهل */ }
  }

  function readDraft() {
    try {
      var draft = JSON.parse(localStorage.getItem(STORE.draft) || 'null');
      if (!draft || !draft.menu || !draft.site) return null;
      return draft;
    } catch (err) {
      return null;
    }
  }

  function writeDraft() {
    try {
      localStorage.setItem(STORE.draft, JSON.stringify({
        menu: state.menu,
        site: state.site,
        savedAt: new Date().toISOString()
      }));
      state.lastSaved = new Date();
    } catch (err) {
      toast('مش قادر يحفظ المسودة محلياً', true);
    }
  }

  var saveDraftSoon = debounce(writeDraft, 350);

  function clearDraft() {
    try { localStorage.removeItem(STORE.draft); } catch (err) { /* تجاهل */ }
    state.dirty = false;
    renderBanner();
  }

  function markDirty() {
    state.dirty = true;
    saveDraftSoon();
    renderBanner();
  }

  /* ---------------- تحميل البيانات ---------------- */

  function fetchJSON(url) {
    return fetch(url + '?v=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function boot() {
    loadCreds();
    fillCredsInputs();
    renderConn();
    $('#year').textContent = new Date().getFullYear();

    var draft = readDraft();

    Promise.all([
      fetchJSON(DATA.menu).catch(function () { return null; }),
      fetchJSON(DATA.site).catch(function () { return null; })
    ]).then(function (out) {
      var publishedMenu = out[0] ? C.normalizeMenu(out[0]) : null;
      var publishedSite = out[1] ? C.normalizeSite(out[1]) : null;
      var loadError = !publishedMenu || !publishedSite;

      if (draft) {
        state.menu = C.normalizeMenu(draft.menu);
        state.site = C.normalizeSite(draft.site);
        state.dirty = true;
      } else if (!loadError) {
        state.menu = publishedMenu;
        state.site = publishedSite;
        state.dirty = false;
      } else {
        state.menu = C.normalizeMenu({ categories: [] });
        state.site = C.normalizeSite({});
      }

      renderItems();
      renderSite();
      renderBanner();
      if (loadError) showBannerError();
      fillCredsInputs();
      renderConn();
    });
  }

  function showBannerError() {
    var banner = $('#banner');
    if (!banner) return;
    banner.hidden = false;
    banner.className = 'banner is-error';
    banner.innerHTML = '<span>⚠️ مش قادر أقرأ ملفات <code>data/</code> — لو بتفتح الصفحة من جهازك، ارفع المشروع على GitHub أو شغّل سيرفر محلي.</span>';
  }

  /* ---------------- تبويبات ---------------- */

  function switchTab(name) {
    $$('.tab').forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-tab') === name);
    });
    ['items', 'site', 'sync'].forEach(function (key) {
      var panel = $('#panel-' + key);
      if (panel) panel.hidden = key !== name;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- الأصناف ---------------- */

  function findCategory(catId) {
    return state.menu.categories.filter(function (cat) { return cat.id === catId; })[0] || null;
  }

  function findItem(cat, itemId) {
    return cat.items.filter(function (item) { return item.id === itemId; })[0] || null;
  }

  function categoryCountWord(n) {
    if (n === 1) return 'صنف واحد';
    if (n === 2) return 'صنفين';
    if (n >= 3 && n <= 10) return n + ' أصناف';
    return n + ' صنف';
  }

  function itemRow(item) {
    var id = C.esc(item.id);
    return '' +
      '<div class="item-row' + (item.hidden ? ' is-hidden' : '') + '" data-item="' + id + '">' +
        '<input class="in name f-name" data-field="name" value="' + C.esc(item.name) + '" placeholder="اسم الصنف" aria-label="اسم الصنف">' +
        '<input class="in price f-price" data-field="price" type="number" inputmode="decimal" min="0" step="1" value="' + C.esc(item.price) + '" placeholder="السعر" aria-label="السعر">' +
        '<input class="in f-desc" data-field="desc" value="' + C.esc(item.desc) + '" placeholder="وصف مختصر (اختياري)" aria-label="الوصف">' +
        '<div class="row-actions">' +
          '<label class="hide-toggle" title="إخفاء الصنف من الموقع">' +
            '<input type="checkbox" data-field="hidden"' + (item.hidden ? ' checked' : '') + '> مخفي' +
          '</label>' +
          '<button class="icon-btn" type="button" data-act="item-up" title="لأعلى" aria-label="تحريك لأعلى">↑</button>' +
          '<button class="icon-btn" type="button" data-act="item-down" title="لأسفل" aria-label="تحريك لأسفل">↓</button>' +
          '<button class="icon-btn danger" type="button" data-act="item-del" title="حذف" aria-label="حذف الصنف">🗑</button>' +
        '</div>' +
      '</div>';
  }

  function renderItems() {
    var wrap = $('#catList');
    if (!wrap) return;

    if (!state.menu.categories.length) {
      wrap.innerHTML = '<div class="loading">مفيش أقسام — اضغط «+ قسم جديد».</div>';
      return;
    }    wrap.innerHTML = state.menu.categories.map(function (cat) {
      return '' +
        '<section class="cat-card" data-cat="' + C.esc(cat.id) + '">' +
          '<div class="cat-head">' +
            '<input class="in icon" data-field="icon" value="' + C.esc(cat.icon) + '" maxlength="4" aria-label="أيقونة القسم">' +
            '<input class="in name" data-field="name" value="' + C.esc(cat.name) + '" aria-label="اسم القسم">' +
            '<span class="cat-count">' + categoryCountWord(cat.items.length) + '</span>' +
            '<div class="row-actions">' +
              '<button class="icon-btn" type="button" data-act="cat-up" title="لأعلى" aria-label="تحريك القسم لأعلى">↑</button>' +
              '<button class="icon-btn" type="button" data-act="cat-down" title="لأسفل" aria-label="تحريك القسم لأسفل">↓</button>' +
              '<button class="icon-btn danger" type="button" data-act="cat-del" title="حذف القسم" aria-label="حذف القسم">🗑</button>' +
            '</div>' +
          '</div>' +
          '<div class="items">' + cat.items.map(itemRow).join('') + '</div>' +
          '<button class="add-item" type="button" data-act="item-add">+ إضافة صنف</button>' +
        '</section>';
    }).join('');
  }

  function addCategory() {
    var newCat = C.normalizeCategory({ name: 'قسم جديد', icon: '☕' });
    state.menu.categories.push(newCat);
    renderItems();

    var nameInput = $('[data-cat="' + newCat.id + '"] .in.name');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
      nameInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    markDirty();
  }

  function onItemsInput(event) {
    var target = event.target;
    var field = target.getAttribute('data-field');
    if (!field) return;

    var catEl = target.closest('[data-cat]');
    if (!catEl) return;
    var cat = findCategory(catEl.getAttribute('data-cat'));
    if (!cat) return;

    var itemEl = target.closest('[data-item]');

    if (itemEl) {
      var item = findItem(cat, itemEl.getAttribute('data-item'));
      if (!item) return;

      if (field === 'hidden') {
        item.hidden = target.checked;
        itemEl.classList.toggle('is-hidden', item.hidden);
      } else if (field === 'price') {
        item.price = C.num(target.value, 0);
      } else if (field === 'name' || field === 'desc') {
        item[field] = target.value;
      }
    } else if (field === 'name' || field === 'icon') {
      cat[field] = target.value;
    }

    markDirty();
  }

  function move(list, from, to) {
    if (to < 0 || to >= list.length) return false;
    var picked = list.splice(from, 1)[0];
    list.splice(to, 0, picked);
    return true;
  }

  function onItemsClick(event) {
    var btn = event.target.closest('[data-act]');
    if (!btn) return;

    var act = btn.getAttribute('data-act');
    var catEl = btn.closest('[data-cat]');
    var itemEl = btn.closest('[data-item]');
    var cat = catEl ? findCategory(catEl.getAttribute('data-cat')) : null;
    var changed = false;

    if (act === 'item-add' && cat) {
      var created = C.normalizeItem({ id: '', name: '', price: 0, desc: '' });
      cat.items.push(created);
      renderItems();
      var input = $('[data-item="' + created.id + '"] .f-name');
      if (input) {
        input.focus();
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      markDirty();
      return;
    }

    if (act === 'cat-add') {
      addCategory();
      return;
    }

    if (!cat) return;

    var catIndex = state.menu.categories.indexOf(cat);

    if (act === 'cat-up') changed = move(state.menu.categories, catIndex, catIndex - 1);
    if (act === 'cat-down') changed = move(state.menu.categories, catIndex, catIndex + 1);

    if (act === 'cat-del' && !itemEl) {
      if (confirm('تحذف قسم «' + cat.name + '» مع كل أصنافه (' + cat.items.length + ')؟')) {
        state.menu.categories.splice(catIndex, 1);
        changed = true;
      }
    }

    if (itemEl) {
      var item = findItem(cat, itemEl.getAttribute('data-item'));
      if (!item) return;
      var itemIndex = cat.items.indexOf(item);

      if (act === 'item-up') changed = move(cat.items, itemIndex, itemIndex - 1);
      if (act === 'item-down') changed = move(cat.items, itemIndex, itemIndex + 1);

      if (act === 'item-del') {
        if (confirm('تحذف «' + (item.name || 'الصنف ده') + '»؟')) {
          cat.items.splice(itemIndex, 1);
          changed = true;
        }
      }
    }

    if (changed) {
      renderItems();
      markDirty();
    }
  }

  /* ---------------- بيانات الموقع ---------------- */

  var SITE_SCHEMA = [
    {
      title: '🏷️ الهوية',
      fields: [
        { key: 'nameAr', label: 'الاسم بالعربي' },
        { key: 'nameEn', label: 'الاسم بالإنجليزي' },
        { key: 'sub', label: 'السطر تحت الاسم', hint: 'مثال: CAFE' },
        { key: 'logo', label: 'اللوجو (إيموجي)', hint: 'مثال: ☕' },
        { key: 'tagline', label: 'جملة الترحيب', type: 'textarea', rows: 2, full: true },
        { key: 'description', label: 'وصف الموقع (بيظهر في جوجل)', type: 'textarea', rows: 2, full: true }
      ]
    },
    {
      title: '📞 التواصل',
      fields: [
        { key: 'whatsapp', label: 'رقم واتساب', hint: '01103766822 أو 201103766822', dir: 'ltr' },
        { key: 'phones', label: 'أرقام التليفون', type: 'textarea', rows: 3, hint: 'كل رقم في سطر', dir: 'ltr' },
        { key: 'hours', label: 'مواعيد العمل', hint: 'مثال: يومياً من 10 ص لـ 2 ص' },
        { key: 'address', label: 'العنوان' },
        { key: 'facebook', label: 'لينك فيسبوك', type: 'url', dir: 'ltr' },
        { key: 'instagram', label: 'لينك إنستجرام', type: 'url', dir: 'ltr' },
        { key: 'mapUrl', label: 'لينك الموقع على الخريطة', type: 'url', dir: 'ltr', full: true }
      ]
    },
    {
      title: '🎨 العرض والألوان',
      fields: [
        { key: 'currency', label: 'العملة', hint: 'مثال: ج.م' },
        { key: 'gold', label: 'اللون الذهبي', type: 'color', theme: true },
        { key: 'gold2', label: 'اللون الذهبي الفاتح', type: 'color', theme: true },
        { key: 'bg', label: 'لون الخلفية', type: 'color', theme: true },
        { key: 'note', label: 'ملاحظة أسفل المنيو', type: 'textarea', rows: 2, full: true }
      ]
    }
  ];

  function fieldHTML(field) {
    var value = field.theme ? state.site.theme[field.key] : state.site[field.key];
    if (field.key === 'phones') value = state.site.phones.join('\n');

    var attrs = 'data-site="' + field.key + '"' +
      (field.theme ? ' data-theme="1"' : '') +
      (field.dir ? ' dir="' + field.dir + '"' : '');

    var control;
    if (field.type === 'textarea') {
      control = '<textarea ' + attrs + ' rows="' + (field.rows || 3) + '">' + C.esc(value) + '</textarea>';
    } else if (field.type === 'color') {
      control = '<input type="color" ' + attrs + ' value="' + C.esc(value) + '">';
    } else {
      control = '<input type="' + (field.type || 'text') + '" ' + attrs + ' value="' + C.esc(value) + '">';
    }

    return '<label class="field' + (field.full ? ' full' : '') + '">' +
      '<span>' + field.label + (field.hint ? ' <small>— ' + field.hint + '</small>' : '') + '</span>' +
      control +
      '</label>';
  }

  function renderSite() {
    var form = $('#siteForm');
    if (!form) return;

    form.innerHTML = SITE_SCHEMA.map(function (group) {
      return '<section class="form-card">' +
        '<h2>' + group.title + '</h2>' +
        '<div class="form-grid">' + group.fields.map(fieldHTML).join('') + '</div>' +
        '</section>';
    }).join('');
  }

  function onSiteInput(event) {
    var key = event.target.getAttribute('data-site');
    if (!key) return;

    if (key === 'phones') {
      state.site.phones = event.target.value.split(/[\n,]+/)
        .map(function (p) { return p.trim(); })
        .filter(Boolean);
    } else if (event.target.hasAttribute('data-theme')) {
      state.site.theme[key] = event.target.value;
    } else {
      state.site[key] = event.target.value;
    }

    markDirty();
  }

  /* ---------------- GitHub ---------------- */

  function api(path, options) {
    options = options || {};
    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + state.creds.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (options.body) headers['Content-Type'] = 'application/json';

    return fetch('https://api.github.com' + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (err) { /* مش JSON */ }
        if (!res.ok) {
          var error = new Error((data && data.message) || ('HTTP ' + res.status));
          error.status = res.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
  }

  function repoPath() {
    return '/repos/' + encodeURIComponent(state.creds.owner) + '/' +
      encodeURIComponent(state.creds.repo);
  }

  function fillCredsInputs() {
    var owner = $('#ghOwner');
    if (!owner) return;
    owner.value = state.creds.owner;
    $('#ghRepo').value = state.creds.repo;
    $('#ghBranch').value = state.creds.branch || 'main';
    $('#ghToken').value = state.creds.token;
  }

  function readCredsInputs() {
    state.creds.owner = $('#ghOwner').value.trim();
    state.creds.repo = $('#ghRepo').value.trim();
    state.creds.branch = $('#ghBranch').value.trim() || 'main';
    state.creds.token = $('#ghToken').value.trim();
  }

  function renderConn() {
    var badge = $('#connBadge');
    if (!badge) return;
    var hasCreds = !!(state.creds.owner && state.creds.repo && state.creds.token);
    badge.classList.toggle('is-on', hasCreds && !!state.repo);
    badge.textContent = state.repo
      ? 'متصل: ' + state.repo.full_name
      : hasCreds
        ? 'GitHub محفوظ — اضغط اتصال للتأكد'
        : 'بيانات GitHub مش متظبطة';
  }

  function connect() {
    readCredsInputs();
    if (!state.creds.owner || !state.creds.repo || !state.creds.token) {
      setResult('#ghResult', 'كمّل اسم المستخدم واسم المستودع والتوكن الأول.', true);
      return;
    }

    setResult('#ghResult', 'بجرب الاتصال بـ GitHub…');
    var btn = $('#ghConnect');
    btn.disabled = true;

    api(repoPath()).then(function (info) {
      state.repo = info;
      if (info.default_branch) {
        state.creds.branch = state.creds.branch || info.default_branch;
        $('#ghBranch').value = state.creds.branch;
      }
      saveCreds();

      var canWrite = !info.permissions || info.permissions.push !== false;
      setResult('#ghResult',
        'متصل بـ ' + info.full_name + ' ✓' +
        (canWrite ? ' — الصلاحية موجودة وجاهز للنشر.' : ' — تحذير: التوكن مش عليه صلاحية كتابة (Contents: Read and write).'),
        !canWrite);

      renderConn();
    }).catch(function (err) {
      state.repo = null;
      var msg = err.status === 401 ? 'التوكن غلط أو منتهي.'
        : err.status === 404 ? 'المستودع مش موجود — اتأكد من اسم المستخدم واسم المستودع.'
          : err.message;
      setResult('#ghResult', 'فشل الاتصال: ' + msg, true);
      renderConn();
    }).then(function () {
      btn.disabled = false;
    });
  }

  function putFile(path, data, message) {
    var base = repoPath() + '/contents/' + path;
    var sha = null;

    return api(base + '?ref=' + encodeURIComponent(state.creds.branch)).then(function (existing) {
      sha = existing && existing.sha;
      return null;
    }).catch(function (err) {
      if (err.status !== 404) throw err;
      return null;
    }).then(function () {
      var body = {
        message: message,
        content: b64encode(JSON.stringify(data, null, 2) + '\n'),
        branch: state.creds.branch
      };
      if (sha) body.sha = sha;
      return api(base, { method: 'PUT', body: body });
    });
  }

  function cleanMenu(menu) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      categories: menu.categories.map(function (cat) {
        return {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          items: cat.items.map(function (item) {
            return {
              id: item.id,
              name: item.name,
              price: C.num(item.price, 0),
              desc: item.desc || '',
              hidden: !!item.hidden
            };
          })
        };
      })
    };
  }

  function cleanSite(site) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      nameEn: site.nameEn,
      nameAr: site.nameAr,
      sub: site.sub,
      logo: site.logo,
      tagline: site.tagline,
      description: site.description,
      currency: site.currency,
      whatsapp: site.whatsapp,
      phones: site.phones,
      address: site.address,
      hours: site.hours,
      facebook: site.facebook,
      instagram: site.instagram,
      mapUrl: site.mapUrl,
      note: site.note,
      theme: {
        gold: site.theme.gold,
        gold2: site.theme.gold2,
        bg: site.theme.bg
      }
    };
  }

  function pagesUrl() {
    var owner = (state.creds.owner || '').toLowerCase();
    var repo = (state.creds.repo || '').toLowerCase();
    if (!owner || !repo) return '';
    if (repo === owner + '.github.io') return 'https://' + owner + '.github.io/';
    return 'https://' + owner + '.github.io/' + repo + '/';
  }

  function publish() {
    if (state.busy) return;

    readCredsInputs();
    saveCreds();
    renderConn();

    if (!state.creds.owner || !state.creds.repo || !state.creds.token) {
      switchTab('sync');
      toast('اربط حساب GitHub الأول من تبويب «النشر»', true);
      return;
    }

    state.busy = true;
    var buttons = [$('#publishBtn'), $('#publishBtn2')];
    buttons.forEach(function (btn) { if (btn) btn.disabled = true; });
    setResult('#publishLog', 'بنشر المنيو…');

    var stamp = fmtDate(new Date().toISOString());
    var menuData = cleanMenu(state.menu);
    var siteData = cleanSite(state.site);

    putFile('data/menu.json', menuData, 'تحديث المنيو — ' + stamp)
      .then(function () {
        setResult('#publishLog', 'بنشر بيانات الموقع…');
        return putFile('data/site.json', siteData, 'تحديث بيانات الموقع — ' + stamp);
      })
      .then(function () {
        state.menu.updatedAt = menuData.updatedAt;
        state.site.updatedAt = siteData.updatedAt;
        clearDraft();
        toast('تم النشر ✓ الموقع هيتحدّث خلال دقيقة');
        setResult('#publishLog',
          'تم النشر بنجاح ✓ — افتح الموقع بعد دقيقة: ' + pagesUrl(), false);
      })
      .catch(function (err) {
        var msg = err.status === 401 ? 'التوكن غلط أو منتهي.'
          : err.status === 403 ? 'التوكن مش عليه صلاحية كتابة (Contents: Read and write).'
            : err.status === 404 ? 'المستودع أو الملف مش موجود — راجع بيانات GitHub.'
              : err.message;
        setResult('#publishLog', 'فشل النشر: ' + msg, true);
        toast('فشل النشر: ' + msg, true);
      })
      .then(function () {
        state.busy = false;
        buttons.forEach(function (btn) { if (btn) btn.disabled = false; });
      });
  }

  /* ---------------- نسخ احتياطي ---------------- */

  function download(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2) + '\n'], {
      type: 'application/json;charset=utf-8'
    });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 1200);
  }

  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();

    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data && Array.isArray(data.categories)) {
          state.menu = C.normalizeMenu(data);
          renderItems();
        } else if (data && (data.theme || data.nameAr || data.nameEn || data.whatsapp)) {
          state.site = C.normalizeSite(data);
          renderSite();
        } else {
          throw new Error('الملف مش منيو ولا بيانات موقع');
        }
        markDirty();
        toast('تم استيراد الملف ✓');
      } catch (err) {
        toast('الملف مش صالح: ' + err.message, true);
      }
    };

    reader.readAsText(file, 'utf-8');
  }

  /* ---------------- الشعار / الحالة ---------------- */

  function renderBanner() {
    var banner = $('#banner');
    if (!banner) return;

    if (!state.dirty) {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    banner.className = 'banner';
    banner.innerHTML = '<span>📝 فيه تعديلات محفوظة كمسودة على المتصفح ده — لسه مش منشورة على الموقع.</span>' +
      '<div class="row" style="margin:0">' +
        '<button class="btn btn-gold" type="button" data-act="publish">نشر دلوقتي</button>' +
        '<button class="btn btn-ghost" type="button" data-act="discard">تجاهل</button>' +
      '</div>';
  }

  /* ---------------- الربط ---------------- */

  function bind() {
    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchTab(tab.getAttribute('data-tab'));
      });
    });

    var list = $('#catList');
    list.addEventListener('input', onItemsInput);
    list.addEventListener('click', onItemsClick);
    list.addEventListener('change', onItemsInput);

    $('#addCategory').addEventListener('click', addCategory);

    $('#siteForm').addEventListener('input', onSiteInput);

    $('#ghConnect').addEventListener('click', connect);

    $('#ghForget').addEventListener('click', function () {
      if (!confirm('هتمسح بيانات GitHub المحفوظة على المتصفح ده. متأكد؟')) return;
      state.creds = { owner: '', repo: '', branch: 'main', token: '' };
      state.repo = null;
      try { localStorage.removeItem(STORE.creds); } catch (err) { /* تجاهل */ }
      fillCredsInputs();
      renderConn();
      setResult('#ghResult', 'تم مسح البيانات.');
    });

    $('#publishBtn').addEventListener('click', publish);
    $('#publishBtn2').addEventListener('click', publish);

    $('#downloadMenu').addEventListener('click', function () {
      download('menu.json', cleanMenu(state.menu));
      toast('تم تنزيل menu.json');
    });

    $('#downloadSite').addEventListener('click', function () {
      download('site.json', cleanSite(state.site));
      toast('تم تنزيل site.json');
    });

    $('#importFile').addEventListener('change', function (event) {
      importFile(event.target.files && event.target.files[0]);
      event.target.value = '';
    });

    $('#resetDraft').addEventListener('click', function () {
      if (!confirm('هتتجاهل كل التعديلات غير المنشورة وترجع لآخر نسخة منشورة. متأكد؟')) return;
      clearDraft();
      location.reload();
    });

    $('#banner').addEventListener('click', function (event) {
      var btn = event.target.closest('[data-act]');
      if (!btn) return;
      if (btn.getAttribute('data-act') === 'publish') publish();
      if (btn.getAttribute('data-act') === 'discard') {
        if (!confirm('هتتجاهل التعديلات غير المنشورة. متأكد؟')) return;
        clearDraft();
        location.reload();
      }
    });

    // نحفظ المسودة فوراً قبل ما الصفحة تتقفل
    window.addEventListener('pagehide', function () {
      if (state.dirty) writeDraft();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.dirty) writeDraft();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bind(); boot(); });
  } else {
    bind();
    boot();
  }
})();
