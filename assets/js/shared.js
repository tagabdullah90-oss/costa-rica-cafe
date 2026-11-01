/* ============================================================
   Costa Rica Cafe — دوال مشتركة بين الموقع ولوحة التحكم
   ============================================================ */
(function (global) {
  'use strict';

  var RESERVED = {};

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    var base = (prefix || 'item').toString().replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'item';
    return base + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function num(value, fallback) {
    var n = parseFloat(String(value == null ? '' : value).replace(',', '.'));
    return isFinite(n) ? n : (fallback || 0);
  }

  function formatPrice(value) {
    var n = num(value, 0);
    var text = Number.isInteger(n) ? String(n) : n.toFixed(2);
    return text;
  }

  function normalizeItem(raw, index) {
    raw = raw || {};
    return {
      id: raw.id ? String(raw.id) : uid('item'),
      name: String(raw.name || 'صنف بدون اسم'),
      price: num(raw.price, 0),
      desc: String(raw.desc || ''),
      hidden: !!raw.hidden,
      order: typeof raw.order === 'number' ? raw.order : index || 0
    };
  }

  function normalizeCategory(raw, index) {
    raw = raw || {};
    var items = Array.isArray(raw.items) ? raw.items : [];
    return {
      id: raw.id ? String(raw.id).replace(/[^a-z0-9-]/gi, '') || uid('cat') : uid('cat'),
      name: String(raw.name || 'قسم جديد'),
      icon: String(raw.icon || '☕'),
      items: items.map(normalizeItem)
    };
  }

  function normalizeMenu(raw) {
    raw = raw || {};
    var cats = Array.isArray(raw.categories) ? raw.categories : [];
    var usedCatIds = {};
    var usedItemIds = {};

    return {
      version: num(raw.version, 1),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      categories: cats.map(function (cat, index) {
        var clean = normalizeCategory(cat, index);

        while (usedCatIds[clean.id]) clean.id = uid('cat');
        usedCatIds[clean.id] = true;

        clean.items.forEach(function (item) {
          while (usedItemIds[item.id]) item.id = uid('item');
          usedItemIds[item.id] = true;
        });

        return clean;
      })
    };
  }

  var SITE_DEFAULTS = {
    nameEn: 'Costa Rica',
    nameAr: 'كوستا ريكا كافيه',
    sub: 'CAFE',
    logo: '☕',
    tagline: '',
    description: '',
    currency: 'ج.م',
    whatsapp: '',
    phones: [],
    address: '',
    hours: '',
    facebook: '',
    instagram: '',
    mapUrl: '',
    note: '',
    theme: { gold: '#d8b477', gold2: '#f0d7a6', bg: '#100e0c' }
  };

  function normalizeSite(raw) {
    raw = raw || {};
    var site = {};
    Object.keys(SITE_DEFAULTS).forEach(function (key) {
      site[key] = raw[key] !== undefined ? raw[key] : SITE_DEFAULTS[key];
    });
    site.nameEn = String(site.nameEn || SITE_DEFAULTS.nameEn);
    site.nameAr = String(site.nameAr || SITE_DEFAULTS.nameAr);
    site.sub = String(site.sub || '');
    site.logo = String(site.logo || '☕');
    site.currency = String(site.currency || '');
    site.whatsapp = String(site.whatsapp || '');
    site.phones = Array.isArray(site.phones) ? site.phones.map(String) : String(site.phones || '')
      .split(/[\n,]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    site.theme = site.theme && typeof site.theme === 'object' ? site.theme : {};
    site.theme = {
      gold: site.theme.gold || SITE_DEFAULTS.theme.gold,
      gold2: site.theme.gold2 || SITE_DEFAULTS.theme.gold2,
      bg: site.theme.bg || SITE_DEFAULTS.theme.bg
    };
    return site;
  }

  /* رقم واتساب: يقبل 01103766822 أو +201103766822 أو 0020... */
  function waNumber(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    digits = digits.replace(/^00/, '');
    if (digits.indexOf('20') === 0 && digits.length >= 12) return digits;
    if (digits.charAt(0) === '0') return '20' + digits.slice(1);
    if (digits.length === 10) return '20' + digits;
    return digits;
  }

  function waLink(value, text) {
    var n = waNumber(value);
    if (!n) return '';
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function el(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  global.CRC = {
    esc: esc,
    uid: uid,
    num: num,
    formatPrice: formatPrice,
    normalizeMenu: normalizeMenu,
    normalizeSite: normalizeSite,
    waNumber: waNumber,
    waLink: waLink,
    el: el,
    SITE_DEFAULTS: SITE_DEFAULTS
  };
})(window);
